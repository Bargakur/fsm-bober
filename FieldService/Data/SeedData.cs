using FieldService.Controllers; // AuthController.HashPassword
using FieldService.Models;
using Microsoft.EntityFrameworkCore;

namespace FieldService.Data;

/// <summary>
/// Dane początkowe — idempotentne. Każdy element sprawdzany osobno,
/// więc można bezpiecznie uruchamiać wielokrotnie bez utraty danych.
/// </summary>
public static class SeedData
{
    public static void Initialize(AppDbContext db)
    {
        SeedUsers(db);
        SeedTreatments(db);
        SeedTechnicians(db);
        db.SaveChanges();

        SeedAvailabilities(db);
        SeedSampleOrders(db);
        db.SaveChanges();
    }

    // ---- Użytkownicy ----
    private static void SeedUsers(AppDbContext db)
    {
        var users = new (string Login, string Email, string Password, string Role, string FullName)[]
        {
            ("MKgrupastop", "mk@grupastop.pl", "betelgeza", "superadmin", "Maciej Kijkowski"),
            ("admin", "admin@fieldservice.pl", "admin123", "admin", "Administrator"),
            ("anna.w", "anna@fieldservice.pl", "anna123", "starszy_handlowiec", "Anna Wiśniewska"),
            ("marek.k", "marek@fieldservice.pl", "marek123", "handlowiec", "Marek Kowalczyk"),
        };

        foreach (var (login, email, password, role, fullName) in users)
        {
            if (!db.Users.Any(u => u.Login == login))
            {
                db.Users.Add(new User
                {
                    Login = login,
                    Email = email,
                    PasswordHash = AuthController.HashPassword(password),
                    Role = role,
                    FullName = fullName,
                });
            }
        }
    }

    // ---- Zabiegi ----
    private static void SeedTreatments(AppDbContext db)
    {
        var treatments = new (string Name, int Duration, string Category, decimal Price, string? Skill)[]
        {
            ("Szczury", 60, "DDD", 350, "ddd"),
            ("Pluskwy", 120, "Dezynsekcja", 600, "dezynsekcja"),
            ("Zabezpieczenie balkonu", 120, "Zabezpieczenia", 500, null),
        };

        foreach (var (name, duration, category, price, skill) in treatments)
        {
            if (!db.Treatments.Any(t => t.Name == name))
            {
                db.Treatments.Add(new Treatment
                {
                    Name = name,
                    DurationMinutes = duration,
                    Category = category,
                    DefaultPrice = price,
                    RequiredSkill = skill,
                });
            }
        }
    }

    // ---- Technicy ----
    private static void SeedTechnicians(AppDbContext db)
    {
        var technicians = new (string FullName, string Phone, double Lat, double Lng, string Skills, string Specs)[]
        {
            ("Tomasz Mazur", "+48 601 111 111", 52.2297, 21.0122, "ddd,dezynsekcja", "drabina,osy,szerszenie"),
            ("Ewa Kaczmarek", "+48 602 222 222", 52.2550, 20.9840, "dezynsekcja", "osy"),
            ("Piotr Wójcik", "+48 603 333 333", 52.1935, 21.0350, "ddd,dezynsekcja", "drabina,szerszenie"),
            ("Karolina Zielińska", "+48 604 444 444", 52.2680, 20.9530, "dezynsekcja", "osy,szerszenie"),
            ("Adam Nowakowski", "+48 605 555 555", 52.2150, 21.0460, "ddd", "drabina"),
        };

        foreach (var (fullName, phone, lat, lng, skills, specs) in technicians)
        {
            if (!db.Technicians.Any(t => t.FullName == fullName))
            {
                db.Technicians.Add(new Technician
                {
                    FullName = fullName,
                    Phone = phone,
                    HomeLat = lat,
                    HomeLng = lng,
                    Skills = skills,
                    Specializations = specs,
                    IsActive = true,
                });
            }
        }
    }

    // ---- Dostępność techników (14 dni) ----
    private static void SeedAvailabilities(AppDbContext db)
    {
        // Tylko dodaj jeśli w ogóle nie ma dostępności
        if (db.Availabilities.Any()) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var technicians = db.Technicians.ToList();

        foreach (var tech in technicians)
        {
            for (int i = 0; i < 14; i++)
            {
                var date = today.AddDays(i);
                if (date.DayOfWeek == DayOfWeek.Saturday || date.DayOfWeek == DayOfWeek.Sunday)
                    continue;

                db.Availabilities.Add(new Availability
                {
                    TechnicianId = tech.Id,
                    Date = date,
                    StartTime = new TimeOnly(8, 0),
                    EndTime = new TimeOnly(16, 0),
                });
            }
        }
    }

    // ---- Przykładowe zlecenia (tylko jeśli brak) ----
    private static void SeedSampleOrders(AppDbContext db)
    {
        if (db.Orders.Any()) return;

        var anna = db.Users.FirstOrDefault(u => u.Login == "anna.w");
        var marek = db.Users.FirstOrDefault(u => u.Login == "marek.k");
        if (anna == null || marek == null) return;

        var treatments = db.Treatments.ToList();
        var technicians = db.Technicians.ToList();
        if (treatments.Count < 3 || technicians.Count == 0) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        db.Orders.AddRange(
            new Order
            {
                CustomerName = "Jan Kowalski",
                CustomerPhone = "+48 500 100 200",
                Address = "ul. Marszałkowska 10, Warszawa",
                Lat = 52.2310, Lng = 21.0118,
                TreatmentId = treatments[0].Id,
                Scope = "Piwnica budynku mieszkalnego, ok. 200m²",
                ScheduledDate = today,
                ScheduledStart = new TimeOnly(9, 0),
                ScheduledEnd = new TimeOnly(10, 0),
                Status = "assigned",
                TechnicianId = technicians[0].Id,
                Price = 350, PaymentMethod = "transfer",
                CreatedByUserId = anna.Id,
            },
            new Order
            {
                CustomerName = "Maria Nowak",
                CustomerPhone = "+48 500 300 400",
                ContactPhone = "+48 500 300 401",
                Address = "ul. Puławska 45/12, Warszawa",
                Lat = 52.2050, Lng = 21.0230,
                TreatmentId = treatments[1].Id,
                Scope = "Mieszkanie 2-pokojowe, 48m², sypialnia i salon",
                ScheduledDate = today,
                ScheduledStart = new TimeOnly(11, 0),
                ScheduledEnd = new TimeOnly(13, 0),
                Status = "draft",
                Price = 600, PaymentMethod = "cash",
                CreatedByUserId = anna.Id,
            },
            new Order
            {
                CustomerName = "Firma ABC Sp. z o.o.",
                CustomerPhone = "+48 22 123 45 67",
                Address = "ul. Żelazna 32, Warszawa",
                Lat = 52.2320, Lng = 20.9950,
                TreatmentId = treatments[2].Id,
                Scope = "Balkon 15m², 4 piętro, siatka przeciw gołębiom",
                ScheduledDate = today.AddDays(1),
                ScheduledStart = new TimeOnly(7, 0),
                ScheduledEnd = new TimeOnly(9, 0),
                Status = "draft",
                Price = 500, PaymentMethod = "transfer",
                CreatedByUserId = marek.Id,
            },
            new Order
            {
                CustomerName = "Zofia Lewandowska",
                CustomerPhone = "+48 500 500 600",
                Address = "ul. Bielańska 5/24, Warszawa",
                Lat = 52.2680, Lng = 20.9600,
                TreatmentId = treatments[1].Id,
                Scope = "Mieszkanie 3-pokojowe, 70m², sypialnia i salon",
                ScheduledDate = today.AddDays(1),
                ScheduledStart = new TimeOnly(10, 0),
                ScheduledEnd = new TimeOnly(12, 0),
                Status = "draft",
                Price = 600, PaymentMethod = "cash",
                CreatedByUserId = anna.Id,
            }
        );
    }
}
