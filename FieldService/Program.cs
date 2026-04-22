using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using FieldService.Data;
using FieldService.Services;

var builder = WebApplication.CreateBuilder(args);

// Railway ustawia PORT — ASP.NET musi słuchać na tym porcie
var port = Environment.GetEnvironmentVariable("PORT");
if (!string.IsNullOrEmpty(port))
{
    builder.WebHost.UseUrls($"http://0.0.0.0:{port}");
}

// Railway PostgreSQL daje DATABASE_URL w formacie: postgresql://user:pass@host:port/db
// Lokalny Docker Compose daje ConnectionStrings__Default
var databaseUrl = Environment.GetEnvironmentVariable("DATABASE_URL");
string connectionString;
if (!string.IsNullOrEmpty(databaseUrl))
{
    // Konwersja DATABASE_URL → Npgsql connection string
    var uri = new Uri(databaseUrl);
    var userInfo = uri.UserInfo.Split(':');
    connectionString = $"Host={uri.Host};Port={uri.Port};Database={uri.AbsolutePath.TrimStart('/')};Username={userInfo[0]};Password={userInfo[1]};SSL Mode=Require;Trust Server Certificate=true";
}
else
{
    connectionString = builder.Configuration.GetConnectionString("Default")!;
}

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseNpgsql(connectionString));

// JWT Authentication
var jwtKey = builder.Configuration["Jwt:Key"] ?? "FsmBoberSuperSecretKey2026!@#$%^&*()";
builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = "FsmBober",
            ValidAudience = "FsmBober",
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        };
    });
builder.Services.AddAuthorization();

builder.Services.AddScoped<ISuggestionService, SuggestionService>();
builder.Services.AddHttpClient<IGeocodingService, NominatimGeocodingService>();
builder.Services.AddControllers()
    .AddJsonOptions(o =>
    {
        // Obsługa DateOnly / TimeOnly w JSON
        o.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
        // Zapobiega cyklicznej serializacji (Treatment -> Orders -> Treatment -> ...)
        o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// Migracja bazy + seed data
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
    SeedData.Initialize(db);
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

// Health check dla Railway
app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

// Diagnostyka bazy — tymczasowy endpoint do debugowania
app.MapGet("/debug/db", async (AppDbContext db) =>
{
    var result = new Dictionary<string, object>();

    try
    {
        // 1. Sprawdź nazwy tabel
        using var conn = db.Database.GetDbConnection();
        await conn.OpenAsync();

        using var cmd = conn.CreateCommand();
        cmd.CommandText = "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name";
        var tables = new List<string>();
        using (var reader = await cmd.ExecuteReaderAsync())
        {
            while (await reader.ReadAsync())
                tables.Add(reader.GetString(0));
        }
        result["tables"] = tables;

        // 2. Sprawdź kolumny tabeli Technicians (jakakolwiek nazwa)
        var techTable = tables.FirstOrDefault(t => t.Equals("Technicians", StringComparison.OrdinalIgnoreCase));
        if (techTable != null)
        {
            cmd.CommandText = $"SELECT column_name, data_type FROM information_schema.columns WHERE table_name = '{techTable}' ORDER BY ordinal_position";
            var columns = new List<string>();
            using (var reader = await cmd.ExecuteReaderAsync())
            {
                while (await reader.ReadAsync())
                    columns.Add($"{reader.GetString(0)} ({reader.GetString(1)})");
            }
            result["technicians_table_name"] = techTable;
            result["technicians_columns"] = columns;
        }
        else
        {
            result["technicians_table_name"] = "NOT FOUND";
        }

        // 3. Ile techników w bazie
        cmd.CommandText = techTable != null
            ? $"SELECT COUNT(*) FROM \"{techTable}\""
            : "SELECT 0";
        result["technicians_count"] = (await cmd.ExecuteScalarAsync())?.ToString() ?? "0";

        conn.Close();
    }
    catch (Exception ex)
    {
        result["error"] = ex.Message;
    }

    return Results.Ok(result);
});

app.Run();

// ---- JSON convertery dla DateOnly / TimeOnly (.NET 8) ----

public class DateOnlyJsonConverter : System.Text.Json.Serialization.JsonConverter<DateOnly>
{
    public override DateOnly Read(ref System.Text.Json.Utf8JsonReader reader, Type type, System.Text.Json.JsonSerializerOptions options)
        => DateOnly.Parse(reader.GetString()!);
    public override void Write(System.Text.Json.Utf8JsonWriter writer, DateOnly value, System.Text.Json.JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString("yyyy-MM-dd"));
}

public class TimeOnlyJsonConverter : System.Text.Json.Serialization.JsonConverter<TimeOnly>
{
    public override TimeOnly Read(ref System.Text.Json.Utf8JsonReader reader, Type type, System.Text.Json.JsonSerializerOptions options)
        => TimeOnly.Parse(reader.GetString()!);
    public override void Write(System.Text.Json.Utf8JsonWriter writer, TimeOnly value, System.Text.Json.JsonSerializerOptions options)
        => writer.WriteStringValue(value.ToString("HH:mm:ss"));
}
