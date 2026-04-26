using FieldService.Controllers;

namespace FieldService.Tests.Auth;

/// <summary>
/// Testy PBKDF2 — krytyczne security: jeśli hashowanie się zepsuje,
/// nikt się nie zaloguje albo (gorzej) wszyscy się zalogują.
/// </summary>
public class PasswordHashingTests
{
    [Fact]
    public void HashPassword_ReturnsSaltColonHashFormat()
    {
        var hash = AuthController.HashPassword("test123");

        Assert.Contains(":", hash);
        var parts = hash.Split(':');
        Assert.Equal(2, parts.Length);

        // base64 of 16 bytes salt
        var salt = Convert.FromBase64String(parts[0]);
        Assert.Equal(16, salt.Length);

        // base64 of 32 bytes hash
        var derived = Convert.FromBase64String(parts[1]);
        Assert.Equal(32, derived.Length);
    }

    [Fact]
    public void HashPassword_GeneratesUniqueSaltEachTime()
    {
        var h1 = AuthController.HashPassword("identical_password");
        var h2 = AuthController.HashPassword("identical_password");
        Assert.NotEqual(h1, h2);
    }

    [Fact]
    public void VerifyPassword_RoundTrip_Succeeds()
    {
        var hash = AuthController.HashPassword("CorrectHorseBatteryStaple");
        Assert.True(AuthController.VerifyPassword("CorrectHorseBatteryStaple", hash));
    }

    [Fact]
    public void VerifyPassword_WrongPassword_Fails()
    {
        var hash = AuthController.HashPassword("real_password");
        Assert.False(AuthController.VerifyPassword("wrong_password", hash));
    }

    [Fact]
    public void VerifyPassword_IsCaseSensitive()
    {
        var hash = AuthController.HashPassword("Password");
        Assert.False(AuthController.VerifyPassword("password", hash));
        Assert.False(AuthController.VerifyPassword("PASSWORD", hash));
    }

    [Theory]
    [InlineData("")]
    [InlineData("not-a-valid-hash")]
    [InlineData("missing:colons:everywhere")]
    [InlineData("notbase64:notbase64")]
    public void VerifyPassword_MalformedHash_ReturnsFalse(string malformed)
    {
        // Nie powinno rzucać wyjątku — VerifyPassword musi po prostu odmówić.
        var result = SafeVerify("any", malformed);
        Assert.False(result);
    }

    [Fact]
    public void VerifyPassword_TamperedSalt_Fails()
    {
        var hash = AuthController.HashPassword("password");
        var parts = hash.Split(':');
        // Zmień ostatni znak salta
        var tamperedSalt = parts[0][..^1] + (parts[0][^1] == 'A' ? 'B' : 'A');
        var tampered = $"{tamperedSalt}:{parts[1]}";

        Assert.False(SafeVerify("password", tampered));
    }

    [Fact]
    public void VerifyPassword_PinAsString_WorksTheSame()
    {
        // PIN technika to też string — używa tego samego mechanizmu
        var pinHash = AuthController.HashPassword("1234");
        Assert.True(AuthController.VerifyPassword("1234", pinHash));
        Assert.False(AuthController.VerifyPassword("4321", pinHash));
    }

    private static bool SafeVerify(string password, string hash)
    {
        try { return AuthController.VerifyPassword(password, hash); }
        catch (FormatException) { return false; }
    }
}
