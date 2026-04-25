using Microsoft.EntityFrameworkCore;
using FieldService.Data;
using FieldService.DTOs;
using FieldService.Utils;

namespace FieldService.Services;

public interface ISuggestionService
{
    Task<List<TechnicianSuggestion>> GetSuggestionsAsync(
        double clientLat, double clientLng,
        DateOnly date, TimeOnly startTime, TimeOnly endTime,
        string? requiredSkill);
}

public class SuggestionService : ISuggestionService
{
    private readonly AppDbContext _db;

    public SuggestionService(AppDbContext db) => _db = db;

    public async Task<List<TechnicianSuggestion>> GetSuggestionsAsync(
        double clientLat, double clientLng,
        DateOnly date, TimeOnly startTime, TimeOnly endTime,
        string? requiredSkill)
    {
        var technicians = await _db.Technicians
            .Include(t => t.Availabilities.Where(a => a.Date == date))
            .Include(t => t.Orders.Where(o => o.ScheduledDate == date))
            .Where(t => t.IsActive)
            .ToListAsync();

        var suggestions = new List<TechnicianSuggestion>();

        foreach (var tech in technicians)
        {
            // Filtruj po uprawnieniach
            if (requiredSkill != null && !tech.Specializations.Contains(requiredSkill))
                continue;

            // Sprawdź dostępność
            var availability = tech.Availabilities.FirstOrDefault();
            var fitLevel = "available";

            if (availability == null)
            {
                fitLevel = "warning"; // brak ustawionej dostępności
            }
            else
            {
                if (startTime < availability.StartTime) fitLevel = "warning"; // przed zmianą
                if (endTime > availability.EndTime) fitLevel = "warning";     // po zmianie
            }

            // Oblicz odległość (z domu lub ostatniego zlecenia)
            double fromLat = tech.HomeLat, fromLng = tech.HomeLng;

            var lastOrder = tech.Orders
                .Where(o => o.ScheduledEnd <= startTime)
                .OrderByDescending(o => o.ScheduledEnd)
                .FirstOrDefault();

            if (lastOrder != null)
            {
                fromLat = lastOrder.Lat;
                fromLng = lastOrder.Lng;
            }

            var distanceKm = GeoUtils.DistanceInMeters(fromLat, fromLng, clientLat, clientLng) / 1000.0;
            var estimatedMinutes = (int)(distanceKm / 40.0 * 60.0);

            suggestions.Add(new TechnicianSuggestion
            {
                TechnicianId = tech.Id,
                FullName = tech.FullName,
                DistanceKm = Math.Round(distanceKm, 1),
                EstimatedMinutes = estimatedMinutes,
                AvailableFrom = availability?.StartTime,
                AvailableTo = availability?.EndTime,
                OrdersToday = tech.Orders.Count,
                FitLevel = fitLevel,
            });
        }

        suggestions = suggestions
            .OrderBy(s => s.FitLevel == "warning" ? 1 : 0)
            .ThenBy(s => s.DistanceKm)
            .ToList();

        if (suggestions.Count > 0 && suggestions[0].FitLevel != "warning")
            suggestions[0].FitLevel = "recommended";

        return suggestions;
    }
}
