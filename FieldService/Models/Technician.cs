namespace FieldService.Models;

/// <summary>
/// Technik wykonujący zabiegi w terenie.
/// HomeLat/HomeLng = współrzędne domu — VROOM używa ich
/// do obliczenia trasy od domu do pierwszego zlecenia dnia.
/// </summary>
public class Technician
{
    public int Id { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    
    /// <summary>Szerokość geograficzna domu technika</summary>
    public double HomeLat { get; set; }
    
    /// <summary>Długość geograficzna domu technika</summary>
    public double HomeLng { get; set; }
    
    /// <summary>[Deprecated — zastąpione przez Specializations] Zachowane dla kompatybilności z bazą</summary>
    public string Skills { get; set; } = string.Empty;

    /// <summary>
    /// Co robi technik — wartości: "drabina,osy,szerszenie"
    /// Przechowywane jako comma-separated string.
    /// System filtruje techników po tych wartościach przy sugestiach.
    /// </summary>
    public string Specializations { get; set; } = string.Empty;
    
    public bool IsActive { get; set; } = true;
    
    // Nawigacja
    public List<Availability> Availabilities { get; set; } = new();
    public List<Order> Orders { get; set; } = new();
}
