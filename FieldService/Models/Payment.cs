namespace FieldService.Models;

/// <summary>
/// Rozliczenie zlecenia.
/// Method bierze się z Order.PaymentMethod, chyba że technik
/// ustawił Protocol.PaymentOverride — wtedy nadpisujemy.
/// </summary>
public class Payment
{
    public int Id { get; set; }
    
    public int OrderId { get; set; }
    public Order Order { get; set; } = null!;
    
    /// <summary>"cash", "transfer", "card"</summary>
    public string Method { get; set; } = string.Empty;
    
    public decimal Amount { get; set; }
    
    /// <summary>"pending", "paid", "overdue"</summary>
    public string Status { get; set; } = "pending";
    
    public DateTime? PaidAt { get; set; }
}
