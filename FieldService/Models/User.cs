namespace FieldService.Models;

/// <summary>
/// Użytkownik panelu webowego — handlowiec, supervisor lub administrator.
/// Technicy NIE logują się tu; mają osobną tabelę i osobną apkę.
/// </summary>
public class User
{
    public int Id { get; set; }

    /// <summary>Login użytkownika (unikalny)</summary>
    public string Login { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;

    /// <summary>
    /// Rola: handlowiec, starszy_handlowiec, admin, supervisor, superadmin
    /// </summary>
    public string Role { get; set; } = "handlowiec";

    public string FullName { get; set; } = string.Empty;

    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Nawigacja — zlecenia stworzone przez tego użytkownika
    public List<Order> CreatedOrders { get; set; } = new();
}
