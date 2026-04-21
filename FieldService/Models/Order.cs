namespace FieldService.Models;

/// <summary>
/// Zlecenie — centralna tabela systemu.
/// Dane klienta wpisywane bezpośrednio przez handlowca (nie z bazy klientów).
/// </summary>
public class Order
{
    public int Id { get; set; }
    
    // ---- Dane klienta (wpisywane przez handlowca) ----
    
    /// <summary>Imię i nazwisko osoby zamawiającej</summary>
    public string CustomerName { get; set; } = string.Empty;
    
    /// <summary>Numer telefonu zamawiającego</summary>
    public string CustomerPhone { get; set; } = string.Empty;
    
    /// <summary>Telefon kontaktowy na miejscu — jeśli inny niż zamawiającego</summary>
    public string? ContactPhone { get; set; }
    
    /// <summary>Adres zabiegu</summary>
    public string Address { get; set; } = string.Empty;
    
    /// <summary>Współrzędne adresu — do obliczania odległości techników</summary>
    public double Lat { get; set; }
    public double Lng { get; set; }
    
    // ---- Zabieg ----
    
    /// <summary>Rodzaj zabiegu — wybrany z listy (dropdown)</summary>
    public int TreatmentId { get; set; }
    public Treatment Treatment { get; set; } = null!;
    
    /// <summary>
    /// Zakres zabiegu — tekst wpisany przez handlowca.
    /// Np. "Mieszkanie 3-pokojowe, 65m², kuchnia i łazienka"
    /// </summary>
    public string? Scope { get; set; }
    
    // ---- Przypisanie technika ----
    
    public int? TechnicianId { get; set; }
    public Technician? Technician { get; set; }
    
    public int CreatedByUserId { get; set; }
    public User CreatedBy { get; set; } = null!;
    
    // ---- Czas ----
    
    public DateOnly ScheduledDate { get; set; }
    public TimeOnly ScheduledStart { get; set; }
    public TimeOnly ScheduledEnd { get; set; }
    
    // ---- Status i szczegóły ----
    
    public string Status { get; set; } = "draft";
    public string? PaymentMethod { get; set; }
    public decimal Price { get; set; }
    public string? Notes { get; set; }
    
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    
    // Nawigacja
    public Protocol? Protocol { get; set; }
    public Payment? Payment { get; set; }
}
