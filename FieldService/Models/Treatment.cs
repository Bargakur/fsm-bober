namespace FieldService.Models;

/// <summary>
/// Formatka zabiegu — gotowy szablon, który handlowiec wybiera z listy.
/// DurationMinutes jest kluczowy: system oblicza ScheduledEnd = ScheduledStart + DurationMinutes,
/// dzięki czemu wie, kiedy technik będzie wolny na następne zlecenie.
/// </summary>
public class Treatment
{
    public int Id { get; set; }
    
    /// <summary>Nazwa zabiegu, np. "Dezynsekcja mieszkania do 50m²"</summary>
    public string Name { get; set; } = string.Empty;
    
    /// <summary>Szacowany czas trwania w minutach</summary>
    public int DurationMinutes { get; set; }
    
    /// <summary>Kategoria, np. "DDD", "Dezynfekcja", "Deratyzacja"</summary>
    public string Category { get; set; } = string.Empty;
    
    /// <summary>Domyślna cena — handlowiec może ją zmienić w zleceniu</summary>
    public decimal DefaultPrice { get; set; }
    
    /// <summary>
    /// Wymagane uprawnienia technika, np. "ddd".
    /// Porównywane z Technician.Specializations przy generowaniu sugestii.
    /// </summary>
    public string? RequiredSkill { get; set; }
    
    public bool IsActive { get; set; } = true;
    
    // Nawigacja
    public List<Order> Orders { get; set; } = new();
}
