using System.ComponentModel.DataAnnotations;

namespace FieldService.DTOs;

/// <summary>
/// Tworzenie zlecenia — handlowiec wpisuje dane klienta bezpośrednio,
/// wybiera zabieg z dropdown, wpisuje zakres jako tekst.
/// </summary>
public class CreateOrderDto
{
    // Dane klienta — wpisywane ręcznie
    [Required] public string CustomerName { get; set; } = string.Empty;
    [Required] public string CustomerPhone { get; set; } = string.Empty;
    public string? ContactPhone { get; set; }
    [Required] public string Address { get; set; } = string.Empty;
    
    // Zabieg — dropdown + tekst
    [Required] public int TreatmentId { get; set; }
    
    /// <summary>Zakres zabiegu, np. "Mieszkanie 65m², 3 pokoje, parter"</summary>
    public string? Scope { get; set; }
    
    // Czas
    [Required] public DateOnly ScheduledDate { get; set; }
    [Required] public TimeOnly ScheduledStart { get; set; }
    
    // Opcjonalne — handlowiec może zmienić czas i cenę
    public int? DurationOverride { get; set; }
    public decimal? PriceOverride { get; set; }
    public string? PaymentMethod { get; set; }
    public string? Notes { get; set; }

    // Opcjonalne — koordynaty z autocomplete/mapki (priorytet nad geocodingiem serwera)
    public double? Lat { get; set; }
    public double? Lng { get; set; }
}

public class AssignTechnicianDto
{
    [Required] public int TechnicianId { get; set; }
}

public class TechnicianSuggestion
{
    public int TechnicianId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public double DistanceKm { get; set; }
    public int EstimatedMinutes { get; set; }
    public TimeOnly? AvailableFrom { get; set; }
    public TimeOnly? AvailableTo { get; set; }
    public int OrdersToday { get; set; }
    public string FitLevel { get; set; } = "available";
}

public class SubmitProtocolDto
{
    public string? PaymentOverride { get; set; }
    public string? TechnicianNotes { get; set; }
}

public class LocationReportDto
{
    [Required] public double Lat { get; set; }
    [Required] public double Lng { get; set; }
}
