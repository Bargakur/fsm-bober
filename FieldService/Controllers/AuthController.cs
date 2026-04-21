using System.Collections.Concurrent;
using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FieldService.Data;
using FieldService.Models;

namespace FieldService.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly IConfiguration _config;

    public AuthController(AppDbContext db, IConfiguration config)
    {
        _db = db;
        _config = config;
    }

    public record LoginRequest(string Login, string Password);
    public record LoginResponse(string Token, UserInfo User);
    public record UserInfo(int Id, string Login, string FullName, string Role, string Email);

    // ---- Brute-force protection ----
    private const int MaxAttemptsPerIp = 5;          // max prób z jednego IP na minutę
    private const int MaxAttemptsPerAccount = 5;      // max prób na konto
    private const int AccountLockoutMinutes = 15;     // blokada konta po przekroczeniu
    private const int IpWindowMinutes = 1;            // okno czasowe dla IP

    // In-memory store — wystarczający dla jednej instancji
    private static readonly ConcurrentDictionary<string, List<DateTime>> _ipAttempts = new();
    private static readonly ConcurrentDictionary<string, (int Count, DateTime? LockedUntil)> _accountAttempts = new();

    /// <summary>POST /api/auth/login</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        // 1. Sprawdź rate limit per IP
        if (IsIpBlocked(ip))
            return StatusCode(429, new { message = "Zbyt wiele prób logowania. Spróbuj za minutę." });

        // 2. Sprawdź blokadę konta
        var loginLower = request.Login.ToLowerInvariant();
        if (IsAccountLocked(loginLower, out var lockedUntil))
        {
            var minutesLeft = (int)Math.Ceiling((lockedUntil!.Value - DateTime.UtcNow).TotalMinutes);
            return StatusCode(429, new { message = $"Konto tymczasowo zablokowane. Spróbuj za {minutesLeft} min." });
        }

        // 3. Rejestruj próbę z tego IP
        RecordIpAttempt(ip);

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Login == request.Login && u.IsActive);

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            // Nieudane logowanie — zwiększ licznik konta
            RecordFailedAccountAttempt(loginLower);
            return Unauthorized(new { message = "Nieprawidłowy login lub hasło" });
        }

        // Udane logowanie — wyczyść licznik konta
        _accountAttempts.TryRemove(loginLower, out _);

        var token = GenerateToken(user);

        return Ok(new LoginResponse(token, new UserInfo(
            user.Id, user.Login, user.FullName, user.Role, user.Email
        )));
    }

    private static bool IsIpBlocked(string ip)
    {
        if (!_ipAttempts.TryGetValue(ip, out var attempts)) return false;
        var cutoff = DateTime.UtcNow.AddMinutes(-IpWindowMinutes);
        var recent = attempts.Count(a => a > cutoff);
        return recent >= MaxAttemptsPerIp;
    }

    private static void RecordIpAttempt(string ip)
    {
        var attempts = _ipAttempts.GetOrAdd(ip, _ => new List<DateTime>());
        lock (attempts)
        {
            attempts.Add(DateTime.UtcNow);
            // Wyczyść stare wpisy (starsze niż 5 minut)
            attempts.RemoveAll(a => a < DateTime.UtcNow.AddMinutes(-5));
        }
    }

    private static bool IsAccountLocked(string login, out DateTime? lockedUntil)
    {
        lockedUntil = null;
        if (!_accountAttempts.TryGetValue(login, out var info)) return false;
        if (info.LockedUntil != null && info.LockedUntil > DateTime.UtcNow)
        {
            lockedUntil = info.LockedUntil;
            return true;
        }
        // Jeśli blokada wygasła — wyczyść
        if (info.LockedUntil != null && info.LockedUntil <= DateTime.UtcNow)
        {
            _accountAttempts.TryRemove(login, out _);
        }
        return false;
    }

    private static void RecordFailedAccountAttempt(string login)
    {
        _accountAttempts.AddOrUpdate(login,
            _ => (1, null),
            (_, old) =>
            {
                var newCount = old.Count + 1;
                if (newCount >= MaxAttemptsPerAccount)
                    return (newCount, DateTime.UtcNow.AddMinutes(AccountLockoutMinutes));
                return (newCount, old.LockedUntil);
            });
    }

    /// <summary>GET /api/auth/me — bieżący użytkownik z tokena</summary>
    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<UserInfo>> Me()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var user = await _db.Users.FindAsync(userId);
        if (user == null) return NotFound();

        return Ok(new UserInfo(user.Id, user.Login, user.FullName, user.Role, user.Email));
    }

    // ---- Helpers ----

    private string GenerateToken(User user)
    {
        var key = new SymmetricSecurityKey(
            Encoding.UTF8.GetBytes(_config["Jwt:Key"] ?? "FsmBoberSuperSecretKey2026!@#$%^&*()"));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new Claim(ClaimTypes.Name, user.Login),
            new Claim(ClaimTypes.Role, user.Role),
            new Claim("fullName", user.FullName),
        };

        var token = new JwtSecurityToken(
            issuer: "FsmBober",
            audience: "FsmBober",
            claims: claims,
            expires: DateTime.UtcNow.AddHours(12),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ---- Password hashing (PBKDF2) ----

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 100_000, HashAlgorithmName.SHA256, 32);

        // Format: base64(salt):base64(hash)
        return $"{Convert.ToBase64String(salt)}:{Convert.ToBase64String(hash)}";
    }

    public static bool VerifyPassword(string password, string storedHash)
    {
        var parts = storedHash.Split(':');
        if (parts.Length != 2) return false;

        var salt = Convert.FromBase64String(parts[0]);
        var hash = Convert.FromBase64String(parts[1]);
        var testHash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 100_000, HashAlgorithmName.SHA256, 32);

        return CryptographicOperations.FixedTimeEquals(hash, testHash);
    }
}
