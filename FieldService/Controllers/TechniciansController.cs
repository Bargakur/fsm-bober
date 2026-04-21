using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FieldService.Data;

namespace FieldService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TechniciansController : ControllerBase
{
    private readonly AppDbContext _db;
    public TechniciansController(AppDbContext db) => _db = db;

    /// <summary>GET /api/technicians</summary>
    [HttpGet]
    [AllowAnonymous] // potrzebne dla mobilnej appki (lista techników do loginu)
    public async Task<ActionResult> GetAll()
    {
        var technicians = await _db.Technicians
            .Where(t => t.IsActive)
            .OrderBy(t => t.FullName)
            .ToListAsync();

        return Ok(technicians);
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
}
