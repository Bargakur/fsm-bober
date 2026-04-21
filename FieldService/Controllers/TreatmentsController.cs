using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FieldService.Data;

namespace FieldService.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class TreatmentsController : ControllerBase
{
    private readonly AppDbContext _db;
    public TreatmentsController(AppDbContext db) => _db = db;

    /// <summary>GET /api/treatments — lista zabiegów do dropdown</summary>
    [HttpGet]
    public async Task<ActionResult> GetAll()
    {
        var treatments = await _db.Treatments
            .Where(t => t.IsActive)
            .OrderBy(t => t.Category)
            .ThenBy(t => t.Name)
            .ToListAsync();

        return Ok(treatments);
    }

    /// <summary>GET /api/treatments/5</summary>
    [HttpGet("{id}")]
    public async Task<ActionResult> Get(int id)
    {
        var treatment = await _db.Treatments.FindAsync(id);
        return treatment == null ? NotFound() : Ok(treatment);
    }
}
