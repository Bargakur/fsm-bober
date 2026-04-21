namespace FieldService.Models;

/// <summary>
/// Dostępność technika na dany dzień.
/// Technik deklaruje: "W poniedziałek pracuję od 8:00 do 16:00".
/// System sprawdza to przy generowaniu sugestii — nie zasugeruje
/// technika na zlecenie o 17:00, jeśli kończy o 16:00.
/// </summary>
public class Availability
{
    public int Id { get; set; }
    
    public int TechnicianId { get; set; }
    public Technician Technician { get; set; } = null!;
    
    /// <summary>Dzień, którego dotyczy dostępność</summary>
    public DateOnly Date { get; set; }
    
    /// <summary>Godzina rozpoczęcia pracy, np. 08:00</summary>
    public TimeOnly StartTime { get; set; }
    
    /// <summary>Godzina zakończenia pracy, np. 16:00</summary>
    public TimeOnly EndTime { get; set; }
}
