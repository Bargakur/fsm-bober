using FieldService.Data;
using FieldService.Models;
using FieldService.Services;
using Microsoft.EntityFrameworkCore;

namespace FieldService.Tests.Services;

/// <summary>
/// SuggestionService — najważniejsza logika domenowa: kogo zasugerować na zlecenie.
/// Używamy EF Core InMemory provider zamiast Postgres — testy są szybkie i nie wymagają Dockera.
///
/// UWAGA: InMemory provider nie wspiera niektórych funkcji (np. PostGIS, raw SQL).
/// Tu tego nie używamy — SuggestionService liczy odległość po stronie .NET (Haversine).
/// </summary>
public class SuggestionServiceTests
{
    // Warszawa — punkt referencyjny klienta we wszystkich testach
    private const double WarsawLat = 52.2297;
    private const double WarsawLng = 21.0122;

    private static AppDbContext NewDb()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .ConfigureWarnings(b => b.Ignore(Microsoft.EntityFrameworkCore.Diagnostics.InMemoryEventId.TransactionIgnoredWarning))
            .Options;
        return new AppDbContext(options);
    }

    private static Technician MakeTech(int id, string name, double lat, double lng,
        string specs = "drabina,osy", bool active = true)
        => new()
        {
            Id = id,
            FullName = name,
            HomeLat = lat,
            HomeLng = lng,
            Specializations = specs,
            IsActive = active,
            Phone = "",
            Skills = "",
            PinHash = "",
        };

    [Fact]
    public async Task GetSuggestions_NoTechnicians_ReturnsEmpty()
    {
        await using var db = NewDb();
        var sut = new SuggestionService(db);

        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Empty(result);
    }

    [Fact]
    public async Task GetSuggestions_InactiveTechnician_IsExcluded()
    {
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "Aktywny", 52.23, 21.01));
        db.Technicians.Add(MakeTech(2, "Nieaktywny", 52.23, 21.01, active: false));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.Equal(1, result[0].TechnicianId);
    }

    [Fact]
    public async Task GetSuggestions_RequiredSkill_FiltersByCommaSeparatedSpecializations()
    {
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "Ma osy", 52.23, 21.01, specs: "drabina,osy"));
        db.Technicians.Add(MakeTech(2, "Tylko ddd", 52.23, 21.01, specs: "ddd"));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), requiredSkill: "osy");

        Assert.Single(result);
        Assert.Equal(1, result[0].TechnicianId);
    }

    [Fact]
    public async Task GetSuggestions_SortsByDistance_ClosestFirst()
    {
        await using var db = NewDb();
        // Daleko: Kraków (~250 km od Warszawy)
        db.Technicians.Add(MakeTech(1, "Kraków", 50.0647, 19.9450));
        // Blisko: 1 km od centrum Warszawy
        db.Technicians.Add(MakeTech(2, "Warszawa", 52.2387, 21.0122));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Equal(2, result.Count);
        Assert.Equal(2, result[0].TechnicianId);  // Warszawa pierwszy
        Assert.Equal(1, result[1].TechnicianId);  // Kraków drugi
        Assert.True(result[0].DistanceKm < result[1].DistanceKm);
    }

    [Fact]
    public async Task GetSuggestions_TopCandidate_GetsRecommendedFitLevel()
    {
        await using var db = NewDb();
        var tech = MakeTech(1, "Available", 52.2387, 21.0122);
        db.Technicians.Add(tech);
        db.Availabilities.Add(new Availability
        {
            TechnicianId = 1,
            Date = new DateOnly(2026, 5, 1),
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(16, 0),
        });
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.Equal("recommended", result[0].FitLevel);
        Assert.Equal(new TimeOnly(8, 0), result[0].AvailableFrom);
        Assert.Equal(new TimeOnly(16, 0), result[0].AvailableTo);
    }

    [Fact]
    public async Task GetSuggestions_NoAvailabilitySet_GetsWarning()
    {
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "Bez dostępności", 52.2387, 21.0122));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.Equal("warning", result[0].FitLevel);
        Assert.Null(result[0].AvailableFrom);
    }

    [Fact]
    public async Task GetSuggestions_TimeOutsideAvailability_GetsWarning()
    {
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "Krótka zmiana", 52.2387, 21.0122));
        db.Availabilities.Add(new Availability
        {
            TechnicianId = 1,
            Date = new DateOnly(2026, 5, 1),
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(10, 0),  // kończy o 10
        });
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        // Zlecenie 10:00–12:00 — wykracza poza zmianę
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.Equal("warning", result[0].FitLevel);
    }

    [Fact]
    public async Task GetSuggestions_AvailableTechnicianBeatsWarningOne()
    {
        await using var db = NewDb();
        // Bliżej, ale poza zmianą
        db.Technicians.Add(MakeTech(1, "Blisko ale niedostępny", 52.2300, 21.0125));
        db.Availabilities.Add(new Availability
        {
            TechnicianId = 1,
            Date = new DateOnly(2026, 5, 1),
            StartTime = new TimeOnly(14, 0),
            EndTime = new TimeOnly(16, 0),
        });
        // Dalej, ale dostępny
        db.Technicians.Add(MakeTech(2, "Dalej ale dostępny", 52.25, 21.05));
        db.Availabilities.Add(new Availability
        {
            TechnicianId = 2,
            Date = new DateOnly(2026, 5, 1),
            StartTime = new TimeOnly(8, 0),
            EndTime = new TimeOnly(16, 0),
        });
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Equal(2, result.Count);
        // Dostępny technik powinien być pierwszy mimo większej odległości
        Assert.Equal(2, result[0].TechnicianId);
        Assert.Equal("recommended", result[0].FitLevel);
        Assert.Equal("warning", result[1].FitLevel);
    }

    [Fact]
    public async Task GetSuggestions_DistanceFromEarlierOrder_BeatsFarHome()
    {
        await using var db = NewDb();
        var tech = MakeTech(1, "T", 50.0647, 19.9450);  // dom: Kraków
        db.Technicians.Add(tech);
        SeedFixtures(db);

        // Wcześniejsze zlecenie dziś — w Warszawie
        db.Orders.Add(MakeOrder(100, technicianId: 1, lat: 52.2300, lng: 21.0125,
            start: new TimeOnly(8, 0), end: new TimeOnly(9, 0)));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.True(result[0].DistanceKm < 5,
            $"Min{{Kraków→WWA, WWA→WWA}} ≈ 1 km, dostałem {result[0].DistanceKm}");
        Assert.Equal("order", result[0].DistanceSource);
    }

    [Fact]
    public async Task GetSuggestions_DistanceFromLaterOrder_AlsoCounts()
    {
        // Klucz: technik z domem w Krakowie, ale z zaplanowanym zleceniem w Warszawie LATER tego dnia,
        // powinien być sugerowany jako bliski klientowi w Warszawie — bo i tak będzie w okolicy.
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "T", 50.0647, 19.9450));  // dom: Kraków
        SeedFixtures(db);

        // Zlecenie LATER dziś — w Warszawie (16:00–17:00)
        db.Orders.Add(MakeOrder(100, technicianId: 1, lat: 52.2300, lng: 21.0125,
            start: new TimeOnly(16, 0), end: new TimeOnly(17, 0)));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        // Nowy slot 10:00 — przed istniejącym zleceniem
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.True(result[0].DistanceKm < 5,
            $"Późniejsze zlecenie też się liczy — oczekiwałem ~1 km, dostałem {result[0].DistanceKm}");
        Assert.Equal("order", result[0].DistanceSource);
    }

    [Fact]
    public async Task GetSuggestions_PicksMinimumAcrossMultipleOrders()
    {
        await using var db = NewDb();
        db.Technicians.Add(MakeTech(1, "T", 50.0647, 19.9450));  // dom: Kraków (~250 km)
        SeedFixtures(db);

        // 3 zlecenia w różnych odległościach od klienta (centrum Warszawy)
        db.Orders.Add(MakeOrder(100, 1, lat: 52.4000, lng: 21.0122,   // ~19 km na północ
            start: new TimeOnly(8, 0), end: new TimeOnly(9, 0)));
        db.Orders.Add(MakeOrder(101, 1, lat: 52.2400, lng: 21.0200,   // ~1.5 km
            start: new TimeOnly(13, 0), end: new TimeOnly(14, 0)));
        db.Orders.Add(MakeOrder(102, 1, lat: 52.3000, lng: 21.0500,   // ~9 km
            start: new TimeOnly(16, 0), end: new TimeOnly(17, 0)));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        // Powinien wybrać najbliższe zlecenie (101: ~1.5 km), nie domu (~250 km)
        Assert.True(result[0].DistanceKm < 3,
            $"Min{{Kraków, 19km, 1.5km, 9km}} ≈ 1.5 km, dostałem {result[0].DistanceKm}");
        Assert.Equal("order", result[0].DistanceSource);
    }

    [Fact]
    public async Task GetSuggestions_SzczecinTechWithOrderInSuwalki_IsSuggestedForSuwalki()
    {
        // REGRESJA z bug reportu: technik mieszkający w Szczecinie ma już zlecenie
        // koło Suwałk tego samego dnia. Handlowiec tworzy NOWE zlecenie również w Suwałkach.
        // Ten technik MUSI być sugerowany — bo i tak będzie w okolicy.
        // Wcześniej algorytm patrzył tylko na dom (~555 km od Suwałk po wielkim okręgu)
        // i odrzucał kandydata, mimo że logistycznie był idealny.
        await using var db = NewDb();
        // Szczecin (centrum)
        db.Technicians.Add(MakeTech(1, "Szczeciński technik", 53.4285, 14.5528));
        SeedFixtures(db);

        // Istniejące zlecenie ~5 km od centrum Suwałk
        db.Orders.Add(MakeOrder(100, technicianId: 1, lat: 54.0995, lng: 22.9296,
            start: new TimeOnly(8, 0), end: new TimeOnly(10, 0)));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        // Klient w Suwałkach (ten sam punkt co istniejące zlecenie)
        var result = await sut.GetSuggestionsAsync(
            54.0995, 22.9296, new DateOnly(2026, 5, 1),
            new TimeOnly(12, 0), new TimeOnly(14, 0), null);

        Assert.Single(result);
        Assert.Equal(1, result[0].TechnicianId);
        Assert.Equal("order", result[0].DistanceSource);
        Assert.True(result[0].DistanceKm < 1,
            $"Klient w punkcie istniejącego zlecenia → 0 km, dostałem {result[0].DistanceKm}");
    }

    [Fact]
    public async Task GetSuggestions_NoOrders_DistanceFromHome()
    {
        await using var db = NewDb();
        // Dom blisko klienta (1 km od centrum WWA)
        db.Technicians.Add(MakeTech(1, "T", 52.2387, 21.0122));
        await db.SaveChangesAsync();

        var sut = new SuggestionService(db);
        var result = await sut.GetSuggestionsAsync(
            WarsawLat, WarsawLng, new DateOnly(2026, 5, 1),
            new TimeOnly(10, 0), new TimeOnly(12, 0), null);

        Assert.Single(result);
        Assert.Equal("home", result[0].DistanceSource);
        Assert.True(result[0].DistanceKm < 2);
    }

    // ---- Fixtures helpers ----

    private static void SeedFixtures(AppDbContext db)
    {
        db.Treatments.Add(new Treatment { Id = 1, Name = "Test", DurationMinutes = 60, DefaultPrice = 100 });
        db.Users.Add(new User { Id = 1, Login = "u", Email = "", PasswordHash = "", Role = "admin", FullName = "U", IsActive = true });
    }

    private static Order MakeOrder(int id, int technicianId, double lat, double lng, TimeOnly start, TimeOnly end)
        => new()
        {
            Id = id,
            CustomerName = $"Klient #{id}",
            CustomerPhone = "",
            Address = "addr",
            Lat = lat,
            Lng = lng,
            TreatmentId = 1,
            CreatedByUserId = 1,
            TechnicianId = technicianId,
            ScheduledDate = new DateOnly(2026, 5, 1),
            ScheduledStart = start,
            ScheduledEnd = end,
            Status = "scheduled",
            Price = 100,
        };
}
