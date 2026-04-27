using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace FieldService.Migrations
{
    /// <summary>
    /// Wypełnia katalog zabiegów DDD: zamgławianie termiczne, dwa rodzaje żelowania,
    /// rozdzielenie istniejącego "Pluskwy" na "Pluskwy ULV/zamgławianie" + "Pluskwy IPM".
    ///
    /// Idempotencja: każdy INSERT używa `WHERE NOT EXISTS` po nazwie. Jeśli ktoś wstawił
    /// te zabiegi ręcznie do bazy przed deployem, migracja nie zrobi duplikatów.
    /// UPDATE "Pluskwy" → "Pluskwy ULV/zamgławianie" zachowuje Id i wszystkie istniejące
    /// Order.TreatmentId — historyczne zlecenia "pluskwy" nie tracą referencji.
    ///
    /// Uwaga na ID: nie używamy stałych Id (`InsertData(values: new[] { 1, ... })`) bo
    /// kolumna Id jest IdentityByDefault — sequence-driven. Stałe Id mogłyby kolidować
    /// z istniejącymi danymi i zostawić sequence rozsynchronizowane.
    ///
    /// Wartości DurationMinutes / DefaultPrice są sensownymi defaultami branżowymi.
    /// Można je później zmienić ręcznie albo (gdy powstanie) admin CRUD dla treatments.
    /// </summary>
    public partial class SeedDddTreatments : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. Rename istniejącego "Pluskwy" — zachowujemy Id i powiązane Ordery.
            //    Jeśli rekordu nie ma, UPDATE nic nie zrobi (zero rows affected).
            migrationBuilder.Sql(@"
                UPDATE ""Treatments""
                SET ""Name"" = 'Pluskwy ULV/zamgławianie'
                WHERE ""Name"" = 'Pluskwy';
            ");

            // 2. Wstaw "Pluskwy ULV/zamgławianie" jeśli nie istnieje (przypadek: nikt wcześniej
            //    nie miał "Pluskwy" w bazie, więc UPDATE nic nie zrobił i potrzebujemy świeżego rekordu).
            migrationBuilder.Sql(@"
                INSERT INTO ""Treatments"" (""Name"", ""DurationMinutes"", ""Category"", ""DefaultPrice"", ""RequiredSkill"", ""IsActive"")
                SELECT 'Pluskwy ULV/zamgławianie', 90, 'DDD', 400, NULL, true
                WHERE NOT EXISTS (SELECT 1 FROM ""Treatments"" WHERE ""Name"" = 'Pluskwy ULV/zamgławianie');
            ");

            // 3. Pluskwy IPM — kompleksowy plan (inspekcja + ULV + żelowanie + monitoring), dłuższy i droższy.
            migrationBuilder.Sql(@"
                INSERT INTO ""Treatments"" (""Name"", ""DurationMinutes"", ""Category"", ""DefaultPrice"", ""RequiredSkill"", ""IsActive"")
                SELECT 'Pluskwy IPM', 150, 'DDD', 600, NULL, true
                WHERE NOT EXISTS (SELECT 1 FROM ""Treatments"" WHERE ""Name"" = 'Pluskwy IPM');
            ");

            // 4. Zamgławianie termiczne.
            migrationBuilder.Sql(@"
                INSERT INTO ""Treatments"" (""Name"", ""DurationMinutes"", ""Category"", ""DefaultPrice"", ""RequiredSkill"", ""IsActive"")
                SELECT 'Zamgławianie termiczne', 90, 'DDD', 350, NULL, true
                WHERE NOT EXISTS (SELECT 1 FROM ""Treatments"" WHERE ""Name"" = 'Zamgławianie termiczne');
            ");

            // 5. Żelowanie na mrówki.
            migrationBuilder.Sql(@"
                INSERT INTO ""Treatments"" (""Name"", ""DurationMinutes"", ""Category"", ""DefaultPrice"", ""RequiredSkill"", ""IsActive"")
                SELECT 'Żelowanie na mrówki', 45, 'DDD', 200, NULL, true
                WHERE NOT EXISTS (SELECT 1 FROM ""Treatments"" WHERE ""Name"" = 'Żelowanie na mrówki');
            ");

            // 6. Żelowanie na karaluchy.
            migrationBuilder.Sql(@"
                INSERT INTO ""Treatments"" (""Name"", ""DurationMinutes"", ""Category"", ""DefaultPrice"", ""RequiredSkill"", ""IsActive"")
                SELECT 'Żelowanie na karaluchy', 45, 'DDD', 250, NULL, true
                WHERE NOT EXISTS (SELECT 1 FROM ""Treatments"" WHERE ""Name"" = 'Żelowanie na karaluchy');
            ");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            // Cofnij seed: usuń 4 nowe wpisy. "Pluskwy ULV/zamgławianie" rename z powrotem
            // na "Pluskwy" — to konserwatywne, bo nie wiemy czy był oryginalny rekord.
            // Jeśli nie było, zostawiamy wpis (lepiej niż usunąć i zerwać Order.TreatmentId).
            migrationBuilder.Sql(@"
                DELETE FROM ""Treatments""
                WHERE ""Name"" IN (
                    'Pluskwy IPM',
                    'Zamgławianie termiczne',
                    'Żelowanie na mrówki',
                    'Żelowanie na karaluchy'
                );
            ");

            migrationBuilder.Sql(@"
                UPDATE ""Treatments""
                SET ""Name"" = 'Pluskwy'
                WHERE ""Name"" = 'Pluskwy ULV/zamgławianie';
            ");
        }
    }
}
