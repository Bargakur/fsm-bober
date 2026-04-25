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
            ("Szczury", 60, "DDD", 350, null),
            ("Pluskwy", 120, "Dezynsekcja", 600, null),
            ("Zabezpieczenie balkonu", 120, "Zabezpieczenia", 500, null),
            ("Wizja lokalna", 30, "Inne", 0, null),
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

    // ---- Technicy (50 — cała Polska) ----
    private static void SeedTechnicians(AppDbContext db)
    {
        var technicians = new (string FullName, string Phone, double Lat, double Lng, string Specs)[]
        {
            // Warszawa i okolice (10)
            ("Tomasz Mazur",        "+48 601 111 111", 52.2297, 21.0122, "drabina,osy,szerszenie"),
            ("Ewa Kaczmarek",       "+48 602 222 222", 52.2550, 20.9840, "osy"),
            ("Piotr Wójcik",        "+48 603 333 333", 52.1935, 21.0350, "drabina,szerszenie"),
            ("Karolina Zielińska",  "+48 604 444 444", 52.2680, 20.9530, "osy,szerszenie"),
            ("Adam Nowakowski",     "+48 605 555 555", 52.2150, 21.0460, "drabina"),
            ("Monika Pawlak",       "+48 606 111 001", 52.3100, 20.9600, "osy,drabina"),
            ("Rafał Sikora",        "+48 606 111 002", 52.1600, 20.9300, "szerszenie"),
            ("Natalia Kubiak",      "+48 606 111 003", 52.2850, 21.0700, "osy,szerszenie,drabina"),
            ("Jakub Michalski",     "+48 606 111 004", 52.1800, 21.1200, "drabina"),
            ("Agnieszka Kamińska",  "+48 606 111 005", 52.2400, 20.8800, "osy"),

            // Kraków i okolice (6)
            ("Bartosz Wiśniewski",  "+48 607 200 001", 50.0647, 19.9450, "drabina,osy,szerszenie"),
            ("Aleksandra Dudek",    "+48 607 200 002", 50.0800, 19.9100, "osy,szerszenie"),
            ("Marcin Wróbel",       "+48 607 200 003", 50.0400, 19.9600, "drabina"),
            ("Paulina Stępień",     "+48 607 200 004", 50.0900, 20.0100, "osy"),
            ("Damian Głowacki",     "+48 607 200 005", 50.0300, 19.8800, "szerszenie,drabina"),
            ("Klaudia Jasińska",    "+48 607 200 006", 50.1100, 19.9700, "osy,drabina"),

            // Wrocław (4)
            ("Łukasz Borkowski",    "+48 608 300 001", 51.1079, 17.0385, "drabina,osy"),
            ("Magdalena Szymczak",  "+48 608 300 002", 51.1200, 17.0600, "szerszenie,osy"),
            ("Krzysztof Pietrzak",  "+48 608 300 003", 51.0900, 17.0100, "drabina,szerszenie"),
            ("Ewelina Walczak",     "+48 608 300 004", 51.1350, 17.0800, "osy"),

            // Poznań (4)
            ("Michał Zawadzki",     "+48 609 400 001", 52.4064, 16.9252, "drabina,osy,szerszenie"),
            ("Dominika Krawczyk",   "+48 609 400 002", 52.3900, 16.9500, "osy,szerszenie"),
            ("Robert Czarnecki",    "+48 609 400 003", 52.4200, 16.8900, "drabina"),
            ("Sylwia Jabłońska",    "+48 609 400 004", 52.4400, 16.9100, "osy,drabina"),

            // Gdańsk / Trójmiasto (4)
            ("Paweł Majewski",      "+48 610 500 001", 54.3520, 18.6466, "drabina,osy,szerszenie"),
            ("Joanna Adamczyk",     "+48 610 500 002", 54.3700, 18.6200, "osy"),
            ("Grzegorz Sadowski",   "+48 610 500 003", 54.4100, 18.5700, "szerszenie,drabina"),
            ("Marta Bąk",           "+48 610 500 004", 54.3300, 18.6800, "osy,szerszenie"),

            // Łódź (3)
            ("Artur Kalinowski",    "+48 611 600 001", 51.7592, 19.4560, "drabina,osy"),
            ("Katarzyna Urbaniak",  "+48 611 600 002", 51.7800, 19.4200, "szerszenie"),
            ("Tomasz Piotrowski",   "+48 611 600 003", 51.7400, 19.4900, "osy,drabina,szerszenie"),

            // Szczecin (3)
            ("Wojciech Cieślak",    "+48 612 700 001", 53.4285, 14.5528, "drabina,osy"),
            ("Beata Kołodziej",     "+48 612 700 002", 53.4400, 14.5300, "szerszenie,osy"),
            ("Dariusz Szulc",       "+48 612 700 003", 53.4100, 14.5800, "drabina,szerszenie"),

            // Lublin (3)
            ("Kamil Rutkowski",     "+48 613 800 001", 51.2465, 22.5684, "drabina,osy,szerszenie"),
            ("Anna Mazurek",        "+48 613 800 002", 51.2600, 22.5400, "osy"),
            ("Marek Sobczak",       "+48 613 800 003", 51.2300, 22.5900, "drabina"),

            // Katowice / Śląsk (3)
            ("Szymon Wieczorek",    "+48 614 900 001", 50.2649, 19.0238, "drabina,osy,szerszenie"),
            ("Izabela Tomczak",     "+48 614 900 002", 50.2800, 19.0500, "osy,szerszenie"),
            ("Andrzej Kwiatkowski", "+48 614 900 003", 50.2500, 18.9900, "drabina"),

            // Bydgoszcz (2)
            ("Mateusz Jaworski",    "+48 615 010 001", 53.1235, 18.0084, "osy,drabina"),
            ("Renata Olszewska",    "+48 615 010 002", 53.1400, 17.9800, "szerszenie"),

            // Białystok (2)
            ("Filip Malinowski",    "+48 616 020 001", 53.1325, 23.1688, "drabina,osy"),
            ("Dorota Witkowska",    "+48 616 020 002", 53.1500, 23.1400, "szerszenie,osy"),

            // Rzeszów (2)
            ("Sebastian Górski",    "+48 617 030 001", 50.0412, 21.9991, "drabina,szerszenie"),
            ("Patrycja Kowalczyk",  "+48 617 030 002", 50.0300, 22.0200, "osy,drabina"),

            // Olsztyn (2)
            ("Konrad Lis",          "+48 618 040 001", 53.7784, 20.4801, "osy,szerszenie"),
            ("Justyna Wróblewska",  "+48 618 040 002", 53.7600, 20.5000, "drabina"),

            // Kielce (2)
            ("Dawid Zając",          "+48 619 050 001", 50.8661, 20.6286, "drabina,osy"),
            ("Weronika Nowak",      "+48 619 050 002", 50.8800, 20.6500, "szerszenie,osy"),
        };

        foreach (var (fullName, phone, lat, lng, specs) in technicians)
        {
            if (!db.Technicians.Any(t => t.FullName == fullName))
            {
                db.Technicians.Add(new Technician
                {
                    FullName = fullName,
                    Phone = phone,
                    HomeLat = lat,
                    HomeLng = lng,
                    Specializations = specs,
                    IsActive = true,
                });
            }
        }
    }

    // ---- Dostępność techników (14 dni, zróżnicowane godziny) ----
    private static void SeedAvailabilities(AppDbContext db)
    {
        // Tylko dodaj jeśli w ogóle nie ma dostępności
        if (db.Availabilities.Any()) return;

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var technicians = db.Technicians.ToList();

        // 5 schematów zmianowych, technik dostaje schemat wg indeksu % 5
        var schedules = new (int startH, int endH, bool includeSaturday, bool skipFriday)[]
        {
            (7, 15, false, false),  // wczesna zmiana pon-pt
            (9, 17, false, true),   // standardowa pon-czw
            (6, 14, false, false),  // najwcześniejsza pon-pt
            (10, 18, false, false), // późna zmiana pon-pt
            (8, 16, true, false),   // standardowa pon-sob
        };

        for (int t = 0; t < technicians.Count; t++)
        {
            var tech = technicians[t];
            var (startH, endH, includeSaturday, skipFriday) = schedules[t % schedules.Length];

            for (int i = 0; i < 14; i++)
            {
                var date = today.AddDays(i);
                if (date.DayOfWeek == DayOfWeek.Sunday) continue;
                if (date.DayOfWeek == DayOfWeek.Saturday && !includeSaturday) continue;
                if (date.DayOfWeek == DayOfWeek.Friday && skipFriday) continue;

                db.Availabilities.Add(new Availability
                {
                    TechnicianId = tech.Id,
                    Date = date,
                    StartTime = new TimeOnly(startH, 0),
                    EndTime = new TimeOnly(endH, 0),
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
