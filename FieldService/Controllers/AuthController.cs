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
    public record TechnicianLoginRequest(int TechnicianId, string Pin);

    // ---- Brute-force protection ----
    private const int MaxAttemptsPerIp = 5;
    private const int MaxAttemptsPerAccount = 5;
    private const int AccountLockoutMinutes = 15;
    private const int IpWindowMinutes = 1;

    private static readonly ConcurrentDictionary<string, List<DateTime>> _ipAttempts = new();
    private static readonly ConcurrentDictionary<string, (int Count, DateTime? LockedUntil)> _accountAttempts = new();

    /// <summary>POST /api/auth/login</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var ip = HttpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";

        if (IsIpBlocked(ip))
            return StatusCode(429, new { message = "Zbyt wiele prób logowania. Spróbuj za minutę." });

        var loginLower = request.Login.ToLowerInvariant();
        if (IsAccountLocked(loginLower, out var lockedUntil))
        {
            var minutesLeft = (int)Math.Ceiling((lockedUntil!.Value - DateTime.UtcNow).TotalMinutes);
            return StatusCode(429, new { message = $"Konto tymczasowo zablokowane. Spróbuj za {minutesLeft} min." });
        }

        RecordIpAttempt(ip);

        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Login == request.Login && u.IsActive);

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
        {
            RecordFailedAccountAttempt(loginLower);
            return Unauthorized(new { message = "Nieprawidłowy login lub hasło" });
        }

        _accountAttempts.TryRemove(loginLower, out _);

        var token = GenerateUserToken(user);

        return Ok(new LoginResponse(token, new UserInfo(
            user.Id, user.Login, user.FullName, user.Role, user.Email
        )));
    }

    /// <summary>POST /api/auth/technician-login — logowanie technika przez PIN</summary>
    [HttpPost("technician-login")]
    [AllowAnonymous]
    public async Task<ActionResult> TechnicianLogin([FromBody] TechnicianLoginRequest request)
    {
        var technician = await _db.Technicians
            .FirstOrDefaultAsync(t => t.Id == request.TechnicianId && t.IsActive);

        if (technician == null || string.IsNullOrEmpty(technician.PinHash)
            || !VerifyPassword(request.Pin, technician.PinHash))
        {
            return Unauthorized(new { message = "Nieprawidłowy PIN" });
        }

        var token = GenerateTechnicianToken(technician);
        return Ok(new { token, technicianId = technician.Id, fullName = technician.FullName });
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

    // ---- Token generation ----

    private string GenerateUserToken(User user)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
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

    private string GenerateTechnicianToken(Technician tech)
    {
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(_config["Jwt:Key"]!));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, tech.Id.ToString()),
            new Claim(ClaimTypes.Name, tech.FullName),
            new Claim(ClaimTypes.Role, "technician"),
            new Claim("technicianId", tech.Id.ToString()),
        };

        var token = new JwtSecurityToken(
            issuer: "FsmBober",
            audience: "FsmBober",
            claims: claims,
            expires: DateTime.UtcNow.AddDays(1),
            signingCredentials: creds
        );

        return new JwtSecurityTokenHandler().WriteToken(token);
    }

    // ---- Brute-force helpers ----

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
        if (info.LockedUntil != null && info.LockedUntil <= DateTime.UtcNow)
            _accountAttempts.TryRemove(login, out _);
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

    // ---- Password / PIN hashing (PBKDF2) ----

    public static string HashPassword(string password)
    {
        var salt = RandomNumberGenerator.GetBytes(16);
        var hash = Rfc2898DeriveBytes.Pbkdf2(
            Encoding.UTF8.GetBytes(password), salt, 100_000, HashAlgorithmName.SHA256, 32);
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
