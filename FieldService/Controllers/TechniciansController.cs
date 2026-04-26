using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FieldService.Data;
using FieldService.Models;

namespace FieldService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TechniciansController : ControllerBase
{
    private readonly AppDbContext _db;
    public TechniciansController(AppDbContext db) => _db = db;

    // ---- DTOs ----
    public record CreateTechnicianDto(
        string FullName, string Phone, double HomeLat, double HomeLng, string Specializations);
    public record UpdateTechnicianDto(
        string? FullName, string? Phone, double? HomeLat, double? HomeLng, string? Specializations, bool? IsActive);

    /// <summary>GET /api/technicians</summary>
    [HttpGet]
    [AllowAnonymous]
    public async Task<ActionResult> GetAll([FromQuery] bool includeInactive = false)
    {
        if (User.Identity?.IsAuthenticated == true)
        {
            var query = _db.Technicians.AsQueryable();
            if (!includeInactive)
                query = query.Where(t => t.IsActive);
            return Ok(await query.OrderBy(t => t.FullName).ToListAsync());
        }

        // Niezalogowani (ekran logowania mobilnej appki) — tylko id i imię, bez danych kontaktowych
        return Ok(await _db.Technicians
            .Where(t => t.IsActive)
            .OrderBy(t => t.FullName)
            .Select(t => new { t.Id, t.FullName })
            .ToListAsync());
    }

    /// <summary>GET /api/technicians/3</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> Get(int id)
    {
        var tech = await _db.Technicians.FindAsync(id);
        return tech == null ? NotFound() : Ok(tech);
    }

    /// <summary>GET /api/technicians/3/availability?date=2026-04-15</summary>
    [HttpGet("{id}/availability")]
    public async Task<ActionResult> GetAvailability(int id, [FromQuery] DateOnly date)
    {
        var avail = await _db.Availabilities
            .Where(a => a.TechnicianId == id && a.Date == date)
            .FirstOrDefaultAsync();

        return avail == null
            ? Ok(new { available = false })
            : Ok(new { available = true, avail.StartTime, avail.EndTime });
    }

    /// <summary>GET /api/technicians/availability/bulk?date=2026-04-15 — dostępność wszystkich techników na dzień</summary>
    [HttpGet("availability/bulk")]
    public async Task<ActionResult> GetBulkAvailability([FromQuery] DateOnly date)
    {
        var availabilities = await _db.Availabilities
            .Where(a => a.Date == date)
            .Select(a => new
            {
                a.TechnicianId,
                StartTime = a.StartTime.ToString("HH:mm"),
                EndTime = a.EndTime.ToString("HH:mm"),
            })
            .ToListAsync();

        return Ok(availabilities);
    }

    /// <summary>POST /api/technicians — dodaj technika (admin/superadmin)</summary>
    [HttpPost]
    public async Task<ActionResult> Create([FromBody] CreateTechnicianDto dto)
    {
        if (!IsAdmin()) return Forbid();

        var tech = new Technician
        {
            FullName = dto.FullName,
            Phone = dto.Phone,
            HomeLat = dto.HomeLat,
            HomeLng = dto.HomeLng,
            Specializations = dto.Specializations ?? "",
            IsActive = true,
        };

        _db.Technicians.Add(tech);
        await _db.SaveChangesAsync();

        // Dodaj domyślną dostępność (14 dni, pon-pt 08:00-16:00)
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        for (int i = 0; i < 14; i++)
        {
            var date = today.AddDays(i);
            if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                continue;

            _db.Availabilities.Add(new Availability
            {
                TechnicianId = tech.Id,
                Date = date,
                StartTime = new TimeOnly(8, 0),
                EndTime = new TimeOnly(16, 0),
            });
        }
        await _db.SaveChangesAsync();

        return CreatedAtAction(nameof(Get), new { id = tech.Id }, tech);
    }

    /// <summary>PUT /api/technicians/3 — edytuj technika (admin/superadmin)</summary>
    [HttpPut("{id}")]
    public async Task<ActionResult> Update(int id, [FromBody] UpdateTechnicianDto dto)
    {
        if (!IsAdmin()) return Forbid();

        var tech = await _db.Technicians.FindAsync(id);
        if (tech == null) return NotFound();

        if (dto.FullName != null) tech.FullName = dto.FullName;
        if (dto.Phone != null) tech.Phone = dto.Phone;
        if (dto.HomeLat.HasValue) tech.HomeLat = dto.HomeLat.Value;
        if (dto.HomeLng.HasValue) tech.HomeLng = dto.HomeLng.Value;
        if (dto.Specializations != null) tech.Specializations = dto.Specializations;
        if (dto.IsActive.HasValue) tech.IsActive = dto.IsActive.Value;

        await _db.SaveChangesAsync();
        return Ok(tech);
    }

    /// <summary>DELETE /api/technicians/3 — dezaktywuj technika (admin/superadmin)</summary>
    [HttpDelete("{id}")]
    public async Task<ActionResult> Delete(int id)
    {
        if (!IsAdmin()) return Forbid();

        var tech = await _db.Technicians.FindAsync(id);
        if (tech == null) return NotFound();

        // Soft delete — zachowujemy dane, deaktywujemy
        tech.IsActive = false;
        await _db.SaveChangesAsync();

        return Ok(new { message = $"Technik {tech.FullName} dezaktywowany" });
    }

    private bool IsAdmin()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        return role == "admin" || role == "superadmin" || role == "supervisor";
    }
}
