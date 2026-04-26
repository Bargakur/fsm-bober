using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;

namespace FieldService.Data;

/// <summary>
/// Design-time factory używana wyłącznie przez `dotnet ef` (migrations, scaffolding).
/// Nie jest używana w runtime — produkcja używa DI z Program.cs.
/// </summary>
public class AppDbContextDesignTimeFactory : IDesignTimeDbContextFactory<AppDbContext>
{
    public AppDbContext CreateDbContext(string[] args)
    {
        var conn = Environment.GetEnvironmentVariable("ConnectionStrings__Default")
                   ?? "Host=localhost;Port=5432;Database=fieldservice;Username=postgres;Password=postgres";

        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseNpgsql(conn)
            .Options;

        return new AppDbContext(options);
    }
}
