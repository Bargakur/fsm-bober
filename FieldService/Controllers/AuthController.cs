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

    /// <summary>POST /api/auth/login</summary>
    [HttpPost("login")]
    [AllowAnonymous]
    public async Task<ActionResult<LoginResponse>> Login([FromBody] LoginRequest request)
    {
        var user = await _db.Users
            .FirstOrDefaultAsync(u => u.Login == request.Login && u.IsActive);

        if (user == null || !VerifyPassword(request.Password, user.PasswordHash))
            return Unauthorized(new { message = "Nieprawidłowy login lub hasło" });

        var token = GenerateToken(user);

        return Ok(new LoginResponse(token, new UserInfo(
            user.Id, user.Login, user.FullName, user.Role, user.Email
        )));
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
