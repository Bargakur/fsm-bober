using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FieldService.Data;
using FieldService.Models;
using FieldService.DTOs;
using FieldService.Utils;
using FieldService.Services;

namespace FieldService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly ISuggestionService _suggestions;
    private readonly IGeocodingService _geocoding;

    public OrdersController(AppDbContext db, ISuggestionService suggestions, IGeocodingService geocoding)
    {
        _db = db;
        _suggestions = suggestions;
        _geocoding = geocoding;
    }

    /// <summary>GET /api/orders?date=2026-04-15</summary>
    [HttpGet]
    public async Task<ActionResult> GetOrders([FromQuery] DateOnly date)
    {
        var orders = await _db.Orders
            .Include(o => o.Treatment)
            .Include(o => o.Technician)
            .Include(o => o.CreatedBy)
            .Where(o => o.ScheduledDate == date)
            .OrderBy(o => o.ScheduledStart)
            .ToListAsync();

        return Ok(orders);
    }

    /// <summary>
    /// POST /api/orders
    /// Handlowiec wpisuje dane klienta, wybiera zabieg z listy,
    /// opisuje zakres. System zwraca sugestie techników.
    /// </summary>
    [HttpPost]
    public async Task<ActionResult> CreateOrder([FromBody] CreateOrderDto dto)
    {
        var treatment = await _db.Treatments.FindAsync(dto.TreatmentId);
        if (treatment == null)
            return BadRequest("Nieznany zabieg");

        var duration = dto.DurationOverride ?? treatment.DurationMinutes;
        var scheduledEnd = dto.ScheduledStart.AddMinutes(duration);

        // Koordynaty z frontendu (autocomplete/mapka) mają priorytet
        double lat = 52.2297; // fallback: Warszawa centrum
        double lng = 21.0122;
        if (dto.Lat.HasValue && dto.Lng.HasValue)
        {
            lat = dto.Lat.Value;
            lng = dto.Lng.Value;
        }
        else
        {
            // Geokodowanie adresu -> lat/lng (Nominatim / OpenStreetMap)
            var coords = await _geocoding.GeocodeAsync(dto.Address);
            if (coords.HasValue)
            {
                lat = coords.Value.Lat;
                lng = coords.Value.Lng;
            }
        }

        var order = new Order
        {
            CustomerName = dto.CustomerName,
            CustomerPhone = dto.CustomerPhone,
            ContactPhone = dto.ContactPhone,
            Address = dto.Address,
            Lat = lat,
            Lng = lng,
            TreatmentId = dto.TreatmentId,
            Scope = dto.Scope,
            ScheduledDate = dto.ScheduledDate,
            ScheduledStart = dto.ScheduledStart,
            ScheduledEnd = scheduledEnd,
            Price = dto.PriceOverride ?? treatment.DefaultPrice,
            PaymentMethod = dto.PaymentMethod,
            Notes = dto.Notes,
            CreatedByUserId = GetCurrentUserId(),
            Status = "draft",
        };

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        // Załaduj Treatment do odpowiedzi
        await _db.Entry(order).Reference(o => o.Treatment).LoadAsync();

        var suggestions = await _suggestions.GetSuggestionsAsync(
            clientLat: lat,
            clientLng: lng,
            date: dto.ScheduledDate,
            startTime: dto.ScheduledStart,
            endTime: scheduledEnd,
            requiredSkill: treatment.RequiredSkill
        );

        return Ok(new { order, suggestedTechnicians = suggestions });
    }

    /// <summary>PUT /api/orders/5/assign</summary>
    [HttpPut("{id}/assign")]
    public async Task<ActionResult> AssignTechnician(int id, [FromBody] AssignTechnicianDto dto)
    {
        var order = await _db.Orders.FindAsync(id);
        if (order == null) return NotFound();

        order.TechnicianId = dto.TechnicianId;
        order.Status = "assigned";
        await _db.SaveChangesAsync();

        return Ok(order);
    }

    /// <summary>GET /api/orders/technician/3?date=2026-04-15</summary>
    [HttpGet("technician/{technicianId}")]
    [Authorize(Roles = "technician,admin,superadmin")]
    public async Task<ActionResult> GetTechnicianOrders(int technicianId, [FromQuery] DateOnly date)
    {
        if (!CanAccessTechnicianData(technicianId))
            return Forbid();

        var orders = await _db.Orders
            .Include(o => o.Treatment)
            .Include(o => o.Protocol)
            .Where(o => o.TechnicianId == technicianId && o.ScheduledDate == date)
            .OrderBy(o => o.ScheduledStart)
            .ToListAsync();

        return Ok(orders);
    }

    /// <summary>POST /api/orders/technician/3/location — GPS co 30s</summary>
    [HttpPost("technician/{technicianId}/location")]
    [Authorize(Roles = "technician,admin,superadmin")]
    public async Task<ActionResult> ReportLocation(int technicianId, [FromBody] LocationReportDto dto)
    {
        if (!CanAccessTechnicianData(technicianId))
            return Forbid();

        var activeOrder = await _db.Orders
            .Include(o => o.Protocol)
            .Where(o => o.TechnicianId == technicianId
                     && o.ScheduledDate == DateOnly.FromDateTime(DateTime.UtcNow)
                     && (o.Status == "assigned" || o.Status == "in_progress"))
            .OrderBy(o => o.ScheduledStart)
            .FirstOrDefaultAsync();

        if (activeOrder == null)
            return Ok(new { arrived = false });

        var distanceMeters = GeoUtils.DistanceInMeters(
            dto.Lat, dto.Lng, activeOrder.Lat, activeOrder.Lng);

        if (distanceMeters <= 100)
        {
            if (activeOrder.Protocol == null)
            {
                activeOrder.Protocol = new Protocol { OrderId = activeOrder.Id };
                _db.Protocols.Add(activeOrder.Protocol);
            }
            if (activeOrder.Protocol.ArrivalAt == null)
            {
                activeOrder.Protocol.ArrivalAt = DateTime.UtcNow;
                activeOrder.Status = "in_progress";
                await _db.SaveChangesAsync();
            }
            return Ok(new { arrived = true, orderId = activeOrder.Id });
        }

        return Ok(new { arrived = false, distanceMeters });
    }

    /// <summary>PUT /api/orders/5/complete</summary>
    [HttpPut("{id}/complete")]
    [Authorize(Roles = "technician,admin,superadmin")]
    public async Task<ActionResult> CompleteOrder(int id, [FromBody] SubmitProtocolDto dto)
    {
        var order = await _db.Orders
            .Include(o => o.Protocol)
            .FirstOrDefaultAsync(o => o.Id == id);

        if (order == null) return NotFound();

        // Technik może zamknąć tylko własne zlecenie
        var techId = GetCurrentTechnicianId();
        if (techId.HasValue && order.TechnicianId != techId)
            return Forbid();

        if (order.Protocol == null)
        {
            order.Protocol = new Protocol { OrderId = id };
            _db.Protocols.Add(order.Protocol);
        }

        order.Protocol.CompletedAt = DateTime.UtcNow;
        order.Protocol.PaymentOverride = dto.PaymentOverride;
        order.Protocol.TechnicianNotes = dto.TechnicianNotes;
        order.Status = "completed";

        _db.Payments.Add(new Payment
        {
            OrderId = id,
            Method = dto.PaymentOverride ?? order.PaymentMethod ?? "transfer",
            Amount = order.Price,
            Status = "pending",
        });

        await _db.SaveChangesAsync();
        return Ok(order);
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return claim != null ? int.Parse(claim) : 1;
    }

    private int? GetCurrentTechnicianId()
    {
        var claim = User.FindFirstValue("technicianId");
        return claim != null ? int.Parse(claim) : null;
    }

    /// <summary>Technician token may only access their own data; admins can access any.</summary>
    private bool CanAccessTechnicianData(int technicianId)
    {
        var techId = GetCurrentTechnicianId();
        return techId == null || techId == technicianId;
    }
}
