using FieldService.Controllers;
using FieldService.Data;
using FieldService.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace FieldService.Tests.Controllers;

/// <summary>
/// OrdersController.DeleteOrder — testy polityki kasowania zlecenia.
///
/// Co weryfikujemy:
/// - 404 dla nieistniejącego rekordu (nie jest to przypadkiem ukryty silent-success).
/// - 409 dla statusu `completed` — zlecenie ma ślad finansowy (Payment, faktura),
///   więc skasowanie z palca jest zabronione. Refunda/anulowanie idzie osobnym flow.
/// - Pozostałe statusy (draft / assigned / in_progress / cancelled) — kasowalne.
/// - Cascade ręczny: Protocol i Payment muszą zniknąć razem ze zleceniem
///   (EF nie ma skonfigurowanego DeleteBehavior.Cascade dla tych relacji).
///
/// Uwagi techniczne:
/// - InMemory DbContext, jak w SuggestionServiceTests — szybko, bez Dockera.
/// - Atrybuty [Authorize] nie odpalają w unit testach (nie przechodzimy przez middleware),
///   więc kontroler jest instancjonowany bezpośrednio.
/// - SuggestionService/GeocodingService nie są używane przez DeleteOrder, więc null! wystarcza.
/// </summary>
public class OrdersControllerDeleteTests
{
    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(b => b.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    /// <summary>
    /// Helper: tworzy minimalne zlecenie wraz z wymaganymi powiązaniami (Treatment + User).
    /// Status jest parametryzowany — to główna zmienna w testach polityki delete.
    /// </summary>
    private static async Task<Order> SeedOrder(AppDbContext db, string status, int id = 1)
    {
        var treatment = new Treatment
        {
            Id = 100,
            Name = "Dezynsekcja",
            DurationMinutes = 60,
            DefaultPrice = 200m,
        };
        var user = new User
        {
            Id = 200,
            Login = "handlowiec",
            FullName = "Jan Handlowiec",
            PasswordHash = "x",
            Role = "salesperson",
        };
        db.Treatments.Add(treatment);
        db.Users.Add(user);

        var order = new Order
        {
            Id = id,
            CustomerName = "Klient Testowy",
            CustomerPhone = "+48123456789",
            Address = "ul. Testowa 1",
            Lat = 52.2297,
            Lng = 21.0122,
            TreatmentId = treatment.Id,
            CreatedByUserId = user.Id,
            ScheduledDate = new DateOnly(2026, 5, 1),
            ScheduledStart = new TimeOnly(10, 0),
            ScheduledEnd = new TimeOnly(11, 0),
            Status = status,
            Price = 200m,
        };
        db.Orders.Add(order);
        await db.SaveChangesAsync();
        return order;
    }

    private static OrdersController NewController(AppDbContext db)
        // ISuggestionService / IGeocodingService nie są dotykane przez DeleteOrder.
        // Jeśli kiedyś będą — test się wysypie z NRE i wtedy podstawimy mock.
        => new(db, suggestions: null!, geocoding: null!);

    [Fact]
    public async Task DeleteOrder_NonExistent_ReturnsNotFound()
    {
        await using var db = NewDb();
        var sut = NewController(db);

        var result = await sut.DeleteOrder(999);

        Assert.IsType<NotFoundResult>(result);
    }

    [Fact]
    public async Task DeleteOrder_DraftStatus_RemovesOrder()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "draft");
        var sut = NewController(db);

        var result = await sut.DeleteOrder(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task DeleteOrder_AssignedStatus_RemovesOrder()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "assigned");
        var sut = NewController(db);

        var result = await sut.DeleteOrder(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task DeleteOrder_InProgressStatus_RemovesOrder()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "in_progress");
        var sut = NewController(db);

        var result = await sut.DeleteOrder(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task DeleteOrder_CancelledStatus_RemovesOrder()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "cancelled");
        var sut = NewController(db);

        var result = await sut.DeleteOrder(1);

        Assert.IsType<OkObjectResult>(result);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task DeleteOrder_CompletedStatus_ReturnsConflict()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "completed");
        var sut = NewController(db);

        var result = await sut.DeleteOrder(1);

        // 409 Conflict — completed ma ślad finansowy, nie kasujemy z palca.
        Assert.IsType<ConflictObjectResult>(result);
        // Rekord NIE może zniknąć z bazy mimo wywołania.
        Assert.Equal(1, await db.Orders.CountAsync());
    }

    [Fact]
    public async Task DeleteOrder_WithProtocolAndPayment_CascadesAll()
    {
        await using var db = NewDb();
        var order = await SeedOrder(db, status: "in_progress");
        db.Protocols.Add(new Protocol
        {
            OrderId = order.Id,
            ArrivalAt = new DateTime(2026, 5, 1, 10, 5, 0, DateTimeKind.Utc),
        });
        db.Payments.Add(new Payment
        {
            OrderId = order.Id,
            Method = "cash",
            Amount = 200m,
            Status = "pending",
        });
        await db.SaveChangesAsync();

        Assert.Equal(1, await db.Protocols.CountAsync());
        Assert.Equal(1, await db.Payments.CountAsync());

        var sut = NewController(db);
        var result = await sut.DeleteOrder(order.Id);

        Assert.IsType<OkObjectResult>(result);
        // Cały trójkąt znika — Order + Protocol + Payment.
        // Jeśli ten test się wysypie po dodaniu kolejnej powiązanej tabeli (np. AuditLog),
        // to znak że trzeba dopisać Remove() w kontrolerze ALBO skonfigurować cascade w EF.
        Assert.Empty(db.Orders);
        Assert.Empty(db.Protocols);
        Assert.Empty(db.Payments);
    }

    [Fact]
    public async Task DeleteOrder_DraftWithoutProtocolOrPayment_DoesNotThrow()
    {
        // Większość draftów nie ma jeszcze ani protokołu, ani płatności.
        // Ten test pilnuje, że null-check w kontrolerze działa
        // (regression: kiedyś może ktoś zapomnieć `if (order.Protocol != null)` i wywali NRE).
        await using var db = NewDb();
        await SeedOrder(db, status: "draft");
        var sut = NewController(db);

        var ex = await Record.ExceptionAsync(() => sut.DeleteOrder(1));

        Assert.Null(ex);
        Assert.Empty(db.Orders);
    }

    [Fact]
    public async Task DeleteOrder_DoesNotAffectOtherOrders()
    {
        await using var db = NewDb();
        await SeedOrder(db, status: "draft", id: 1);
        // Drugie zlecenie z osobnymi ID i bez kolizji z pierwszym (Treatment/User już są).
        db.Orders.Add(new Order
        {
            Id = 2,
            CustomerName = "Inny Klient",
            CustomerPhone = "+48000000000",
            Address = "ul. Inna 5",
            Lat = 52.0,
            Lng = 21.0,
            TreatmentId = 100,
            CreatedByUserId = 200,
            ScheduledDate = new DateOnly(2026, 5, 2),
            ScheduledStart = new TimeOnly(12, 0),
            ScheduledEnd = new TimeOnly(13, 0),
            Status = "assigned",
            Price = 250m,
        });
        await db.SaveChangesAsync();

        var sut = NewController(db);
        await sut.DeleteOrder(1);

        // Drugie zlecenie żyje, kasacja jest celowana.
        Assert.Equal(1, await db.Orders.CountAsync());
        Assert.NotNull(await db.Orders.FindAsync(2));
    }
}
