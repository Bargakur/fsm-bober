namespace FieldService.Models;

/// <summary>
/// Protokół zabiegu — wypełniany automatycznie i przez technika w apce mobilnej.
/// 
/// Przepływ w apce:
/// 1. ArrivalAt — ustawiany AUTOMATYCZNIE przez GPS, gdy technik jest w promieniu
///    100m od adresu klienta. Technik nie musi nic klikać.
/// 2. CompletedAt — technik klika "Zakończ zabieg", robi zdjęcie protokołu,
///    opcjonalnie zmienia formę płatności i dodaje uwagi.
/// 
/// Obliczane metryki (nie zapisywane w DB, liczone w zapytaniach):
/// - Spóźnienie = ArrivalAt - Order.ScheduledStart
/// - Realny czas zabiegu = CompletedAt - ArrivalAt
/// - Odchylenie od normy = (CompletedAt - ArrivalAt) - Treatment.DurationMinutes
/// </summary>
public class Protocol
{
    public int Id { get; set; }
    
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    
    /// <summary>
    /// URL zdjęcia protokołu w MinIO.
    /// Technik robi zdjęcie papierowego protokołu aparatem w apce,
    /// apka uploaduje do MinIO i zapisuje URL tutaj.
    /// </summary>
    public string? PhotoUrl { get; set; }
    
    /// <summary>
    /// Rzeczywisty czas przyjazdu — ustawiany automatycznie przez GPS.
    /// Apka mobilna co 30s wysyła lokalizację. Gdy dystans do Client.Lat/Lng
    /// jest mniejszy niż 100m, system zapisuje ten timestamp.
    /// Technik nie jest świadomy tego mechanizmu — zero dodatkowej pracy.
    /// </summary>
    public DateTime? ArrivalAt { get; set; }
    
    /// <summary>
    /// Czas zakończenia zabiegu — technik klika "Zakończ" w apce.
    /// Jedyny wymagany krok administracyjny obok zdjęcia protokołu.
    /// </summary>
    public DateTime? CompletedAt { get; set; }
    
    /// <summary>
    /// Jeśli klient zapłacił inaczej niż ustalono w zleceniu.
    /// Null = płatność zgodna z Order.PaymentMethod.
    /// Np. handlowiec wpisał "przelew", ale klient zapłacił gotówką.
    /// </summary>
    public string? PaymentOverride { get; set; }
    
    /// <summary>
    /// Opcjonalne uwagi technika — problemy, obserwacje, potrzeba ponownej wizyty.
    /// Technik pisze tylko jeśli uznaje to za potrzebne.
    /// </summary>
    public string? TechnicianNotes { get; set; }
}
