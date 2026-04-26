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

// JWT Authentication — key must be set via Jwt__Key env var or appsettings.json
var jwtKey = builder.Configuration["Jwt:Key"];
if (string.IsNullOrWhiteSpace(jwtKey))
    throw new InvalidOperationException("Jwt:Key is required. Set it via environment variable Jwt__Key.");

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
        o.JsonSerializerOptions.Converters.Add(new DateOnlyJsonConverter());
        o.JsonSerializerOptions.Converters.Add(new TimeOnlyJsonConverter());
        o.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles;
    });
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// CORS — origins configured via Cors__AllowedOrigins__0, __1 etc. in env or appsettings
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? ["http://localhost:5173"];
builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader()));

var app = builder.Build();

// ---- Schema migration ----
// Strategia:
//   1. Świeża baza (brak tabel)              → Database.Migrate() tworzy wszystko od zera.
//   2. Stara baza utworzona EnsureCreated()  → wykonujemy "baseline": brakujące kolumny dosypujemy ALTER-em
//                                              i wstawiamy InitialCreate do __EFMigrationsHistory, żeby EF
//                                              uznał ją za zaaplikowaną. Potem Migrate() doda kolejne migracje.
//   3. Baza zarządzana migracjami            → Database.Migrate() po prostu aplikuje to, czego brakuje.
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();

    // 1. Czy schema już istnieje (utworzona przez EnsureCreated() w starej wersji)?
    var usersTableExists = (bool)(db.Database
        .SqlQueryRaw<bool>("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='Users') AS \"Value\"")
        .AsEnumerable()
        .First());

    var historyTableExists = (bool)(db.Database
        .SqlQueryRaw<bool>("SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='__EFMigrationsHistory') AS \"Value\"")
        .AsEnumerable()
        .First());

    if (usersTableExists && !historyTableExists)
    {
        // Legacy DB — utworzona przez EnsureCreated(), bez historii migracji.
        logger.LogWarning("Detected legacy schema without __EFMigrationsHistory. Running baseline.");

        // Naprawa kolumn, które dodano do modelu PO EnsureCreated() — np. PinHash dla Technician.
        // IF NOT EXISTS jest bezpieczne — jeśli kolumna już jest, ALTER nie zrobi nic.
        db.Database.ExecuteSqlRaw(@"
            ALTER TABLE ""Technicians"" ADD COLUMN IF NOT EXISTS ""PinHash"" text NOT NULL DEFAULT '';
        ");

        // Tworzymy __EFMigrationsHistory ręcznie i markujemy InitialCreate jako zaaplikowaną.
        db.Database.ExecuteSqlRaw(@"
            CREATE TABLE IF NOT EXISTS ""__EFMigrationsHistory"" (
                ""MigrationId"" character varying(150) NOT NULL,
                ""ProductVersion"" character varying(32) NOT NULL,
                CONSTRAINT ""PK___EFMigrationsHistory"" PRIMARY KEY (""MigrationId"")
            );
        ");

        // Wpisujemy WSZYSTKIE istniejące migracje jako już zaaplikowane,
        // bo legacy DB ma już cały schema utworzony przez EnsureCreated().
        var allMigrations = db.Database.GetMigrations().ToList();
        foreach (var migrationId in allMigrations)
        {
            db.Database.ExecuteSqlRaw(@"
                INSERT INTO ""__EFMigrationsHistory"" (""MigrationId"", ""ProductVersion"")
                VALUES ({0}, '8.0.0')
                ON CONFLICT (""MigrationId"") DO NOTHING;
            ", migrationId);
        }

        logger.LogInformation("Baseline complete. Marked {Count} migrations as applied.", allMigrations.Count);
    }

    // Aplikujemy wszystkie pending migracje. Na świeżej bazie tworzy schema od zera.
    db.Database.Migrate();
}

app.UseCors();
app.UseSwagger();
app.UseSwaggerUI();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

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
