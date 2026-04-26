# Deployment

Produkcja działa na **Railway**. Repo `Bargakur/fsm-bober`, gałąź `main` → auto-deploy backendu i frontendu.

## Serwisy Railway

| Serwis                  | Root Directory       | Build                  | Runtime                   |
| ----------------------- | -------------------- | ---------------------- | ------------------------- |
| `fsm-bober`             | `FieldService`       | Dockerfile             | ASP.NET Core na `$PORT`   |
| `affectionate-emotion`  | `fieldservice-web`   | Dockerfile (multi-stg) | nginx serwuje `dist/`     |
| `Postgres`              | —                    | managed (Railway)      | PostgreSQL z PostGIS      |

## Zmienne środowiskowe — backend (`fsm-bober`)

| Zmienna                          | Źródło               | Uwagi                                                       |
| -------------------------------- | -------------------- | ----------------------------------------------------------- |
| `DATABASE_URL`                   | Railway Postgres ref | Wstrzykiwane automatycznie po podłączeniu Postgresa.        |
| `Jwt__Key`                       | ręcznie              | min. 32 losowe znaki; `openssl rand -base64 48`             |
| `Cors__AllowedOrigins__0`        | ręcznie              | URL frontendu, np. `https://affectionate-emotion-…up.railway.app` |
| `Cors__AllowedOrigins__1..N`     | opcjonalnie          | Dodatkowe originy (custom domain).                          |
| `PORT`                           | Railway              | Wstrzykiwane automatycznie.                                 |
| `ASPNETCORE_ENVIRONMENT`         | opcjonalnie          | `Production` (domyślne).                                    |

Brak `Jwt__Key` → aplikacja **rzuca przy starcie** (świadomie, żeby nie wystartowała z domyślnym kluczem).

## Zmienne środowiskowe — frontend (`affectionate-emotion`)

| Zmienna                  | Uwagi                                                                          |
| ------------------------ | ------------------------------------------------------------------------------ |
| `VITE_API_URL`           | URL backendu, np. `https://fsm-bober-production.up.railway.app`                |
| `VITE_GOOGLE_MAPS_KEY`   | Opcjonalny — autocomplete adresów. Bez klucza fallback do textboxa.            |

⚠️ **`VITE_*` są build-time.** Po zmianie wartości trzeba wykonać Redeploy w Railway — sam push tego nie
spowoduje, jeśli kod się nie zmienił.

## Pierwsze uruchomienie produkcji

1. Stwórz projekt na Railway, podłącz repo GitHub.
2. **Postgres**: dodaj managed PostgreSQL. Domyślnie nie ma PostGIS — wpisz w SQL editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
   (Aktualnie kod tego nie wymaga, ale model jest pod PostGIS).
3. **Backend**: nowy serwis z root `FieldService`. Połącz z Postgresem (Railway wstrzyknie `DATABASE_URL`).
   Ustaw `Jwt__Key` i `Cors__AllowedOrigins__0`.
4. **Frontend**: nowy serwis z root `fieldservice-web`. Ustaw `VITE_API_URL` na URL backendu.
5. Dodaj custom domains (jeśli trzeba) i zaktualizuj `Cors__AllowedOrigins__N`.

## Migracje przy deployu

Backend przy starcie wykonuje `Database.Migrate()` z baseline'em (patrz [`ARCHITECTURE.md`](ARCHITECTURE.md#schemat-migracji-ef-core)).
Trzy scenariusze:

1. **Świeża baza** — Migrate() tworzy schemat od zera.
2. **Legacy baza** (utworzona przez `EnsureCreated()` w starej wersji kodu) — kod baseline'uje:
   - `ALTER TABLE … ADD COLUMN IF NOT EXISTS …` (idempotentne, bezpieczne),
   - tworzy `__EFMigrationsHistory`,
   - markuje istniejące migracje jako zaaplikowane.
3. **Baza migrowana** — Migrate() aplikuje pending.

### Dodanie nowej migracji

```bash
# zmień model w FieldService/Models/*
# wygeneruj migrację (lokalnie, bez bazy):
DOTNET_ROLL_FORWARD=Major dotnet ef migrations add <NazwaZmiany> --project FieldService

# zacommituj WSZYSTKIE 3 pliki:
#   FieldService/Migrations/<timestamp>_<nazwa>.cs
#   FieldService/Migrations/<timestamp>_<nazwa>.Designer.cs
#   FieldService/Migrations/AppDbContextModelSnapshot.cs

git add FieldService/Migrations FieldService/Models
git commit -m "feat(db): <opis>"
git push origin main      # auto-deploy → Migrate() przy starcie
```

### Cofnięcie migracji

EF Core potrafi `dotnet ef migrations remove` **przed** zacommitowaniem. Po deployu — trzeba napisać
nową migrację, która cofa zmiany (Down operations).

## Runbook — typowe sytuacje

### "Failed to fetch" w UI po deployu

Przyczyna 95% przypadków: backend zwraca 500 (a nie CORS). Browser raportuje to jako CORS, bo
serwer nie zdążył dodać nagłówków. Sprawdzić:

```bash
# 1. Backend health
curl https://<backend>/health

# 2. Czy backend rzuca 500
curl -i -H "Authorization: Bearer <token>" https://<backend>/api/technicians

# 3. Logi Railway (UI projektu → Deployments → Logs)
```

Najczęstsza przyczyna 500: schemat DB nie zgadza się z modelem (np. dodano kolumnę bez migracji).
Po wprowadzeniu Migrate() z baseline'em ten klasa błędów powinna zniknąć.

### Backend nie startuje: `Jwt:Key is required`

Brak zmiennej `Jwt__Key` w Railway. Wygeneruj:

```bash
openssl rand -base64 48
```

Wklej w Railway → Variables → `Jwt__Key`. Redeploy.

### CORS error w UI mimo poprawnego backendu

Sprawdź `Cors__AllowedOrigins__0` — musi być **dokładny** origin (schemat + host, bez ścieżki, bez
slasha końcowego). Custom domain wymaga osobnego wpisu (`__1`, `__2`).

### Migracja nie zaaplikowała się

```bash
# sprawdź historię migracji
railway connect Postgres
> SELECT * FROM "__EFMigrationsHistory" ORDER BY "MigrationId";

# jeśli brak najnowszej migracji a w kodzie jest — sprawdź logi startupu backendu
# Migrate() loguje co aplikuje
```

Jeśli baseline poszedł źle (legacy DB, ale `__EFMigrationsHistory` już istnieje z błędnymi wpisami) —
trzeba ręcznie wyczyścić tabelę i zrestartować kontener:

```sql
TRUNCATE "__EFMigrationsHistory";
```

Backend przy następnym starcie wpadnie w gałąź "legacy" i zrobi baseline od nowa.

### Hotfix kolumny w produkcji (gdy nie ma czasu na migrację)

Tylko awaryjnie, gdy produkcja leży:

```sql
ALTER TABLE "Technicians" ADD COLUMN IF NOT EXISTS "PinHash" text NOT NULL DEFAULT '';
```

Potem **i tak napisz migrację**, żeby snapshot EF Core się zgadzał z bazą. Migrate() przy następnym
starcie rozpozna kolumnę jako istniejącą (bo `IF NOT EXISTS`) i zacommituje wpis do historii.

## Healthcheck

```
GET /health   → 200 {"status":"healthy"}
```

Lekki probe — nie sprawdza bazy. Jeśli chcesz głębszego (DB ping) — TBD.

## Backup bazy

Railway nie robi backupów automatycznie na darmowym tierze. Manual:

```bash
railway connect Postgres
\copy ... TO 'backup.csv' CSV HEADER
```

Albo `pg_dump` przez Railway CLI:

```bash
railway run -s Postgres -- pg_dump $DATABASE_URL > backup.sql
```

Skrypt periodyczny — TBD.

## Bezpieczeństwo deployu

- **Sekrety** wyłącznie w Railway Variables. `.env` jest w `.gitignore`. `.env.example` w repo zawiera
  tylko placeholder values.
- **GitHub PAT** nie powinien siedzieć w `git remote get-url origin`. Jeśli widzisz `https://<token>@github.com/...` — przełącz na SSH (`git remote set-url origin git@github.com:Bargakur/fsm-bober.git`).
- **Secrets rotation**: `Jwt__Key` rotujesz przez zmianę zmiennej i redeploy. Wszystkie istniejące
  tokeny przestają działać (wszyscy się wylogują). To by-design — nie mamy refresh tokenów.

Pełen model security: [`SECURITY.md`](SECURITY.md).
