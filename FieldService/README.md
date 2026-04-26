# FieldService — Backend

REST API systemu FSM Bober. .NET 8, ASP.NET Core, Entity Framework Core 8, PostgreSQL/PostGIS.

Dla architektury domenowej i decyzji projektowych zobacz [`../docs/ARCHITECTURE.md`](../docs/ARCHITECTURE.md).
Dla deployu i runbooka — [`../docs/DEPLOYMENT.md`](../docs/DEPLOYMENT.md).

## Layout

```
FieldService/
├── Program.cs                      Startup, DI, JWT, CORS, migracje (Database.Migrate + baseline)
├── appsettings.json                Domyślny connection string (lokalny, dla dev)
├── docker-compose.yml              Postgres + MinIO + API (lokalnie)
├── Dockerfile                      Multi-stage build dla Railway
│
├── Controllers/
│   ├── AuthController.cs           POST /api/auth/login, /technician-login, GET /me
│   ├── OrdersController.cs         CRUD zleceń, GPS auto-arrival, complete
│   ├── TechniciansController.cs    Lista publiczna + admin CRUD + dostępność
│   └── TreatmentsController.cs     Słownik zabiegów (dropdown)
│
├── Services/
│   ├── SuggestionService.cs        Ranking techników (odległość + dostępność + skill)
│   └── GeocodingService.cs         Nominatim → lat/lng dla adresu
│
├── Data/
│   ├── AppDbContext.cs             EF Core mapowanie, indeksy, FK
│   └── AppDbContextDesignTimeFactory.cs   Factory dla `dotnet ef` (bez startupu aplikacji)
│
├── Models/                         Encje domenowe (User, Technician, Treatment, Order, …)
├── DTOs/                           Walidacja wejścia + kształt odpowiedzi
├── Migrations/                     EF Core migracje (InitialCreate + kolejne)
└── Utils/GeoUtils.cs               Haversine
```

## Uruchomienie lokalne

```bash
# Z głównego katalogu repo skopiuj plik .env
cp ../.env.example .env
$EDITOR .env

docker compose up --build
```

Po starcie:

| Usługa     | URL                                |
| ---------- | ---------------------------------- |
| API        | http://localhost:5050              |
| Swagger    | http://localhost:5050/swagger      |
| Health     | http://localhost:5050/health       |
| Postgres   | localhost:5432 (user: `postgres`)  |
| MinIO      | http://localhost:9001              |

## Konfiguracja

Wszystko przez zmienne środowiskowe (kompozycja: `Section__Key`). Brak pliku konfiguracyjnego z sekretami w
repo — lokalnie używamy `.env` (gitignored).

| Zmienna                       | Wymagane | Opis                                                                |
| ----------------------------- | -------- | ------------------------------------------------------------------- |
| `Jwt__Key`                    | tak      | Klucz HMAC do JWT, min. 32 znaki. Brak = aplikacja nie wystartuje.  |
| `ConnectionStrings__Default`  | tak\*    | Postgres connection string (lokalnie / generic).                    |
| `DATABASE_URL`                | tak\*    | Format Railway/Heroku (`postgresql://user:pass@host/db`).           |
| `Cors__AllowedOrigins__0..N`  | nie      | Białą listę originów. Domyślnie `http://localhost:5173`.            |
| `PORT`                        | nie      | Override portu (Railway ustawia automatycznie).                     |

\* `DATABASE_URL` ma priorytet nad `ConnectionStrings__Default`. Dokładnie jeden musi być ustawiony.

## Migracje

Schema zarządzana przez EF Core Migrations. Przy starcie:

1. Świeża baza → `Database.Migrate()` aplikuje wszystkie migracje od zera.
2. Legacy baza (utworzona przez `EnsureCreated()`, bez `__EFMigrationsHistory`) → kod w `Program.cs`
   robi *baseline*: dosypuje brakujące kolumny (idempotentne `ALTER TABLE … IF NOT EXISTS`),
   tworzy `__EFMigrationsHistory` i markuje wszystkie istniejące migracje jako zaaplikowane.
3. Baza zarządzana migracjami → `Database.Migrate()` aplikuje pending.

Tworzenie nowej migracji:

```bash
DOTNET_ROLL_FORWARD=Major dotnet ef migrations add <NazwaZmiany> --project FieldService
```

Zmień model → wygeneruj migrację → commit obu plików (`Migrations/<timestamp>_*.cs` +
`AppDbContextModelSnapshot.cs`). Push deployuje się sam, baza migruje przy starcie kontenera.

`AppDbContextDesignTimeFactory` pozwala uruchomić `dotnet ef` bez podnoszenia całej aplikacji
(nie wymaga `Jwt__Key` ani połączenia z bazą).

## Endpointy

Wszystkie pod prefiksem `/api/`. Auth via `Authorization: Bearer <jwt>` o ile nie zaznaczono inaczej.

### Auth

| Metoda | Ścieżka                         | Auth          | Opis                                          |
| ------ | ------------------------------- | ------------- | --------------------------------------------- |
| POST   | `/api/auth/login`               | anonim        | Login + hasło → JWT (12 h, claim z rolą).     |
| POST   | `/api/auth/technician-login`    | anonim        | TechnicianId + PIN → JWT technika (24 h).     |
| GET    | `/api/auth/me`                  | bearer        | Bieżący użytkownik z claimów tokena.          |

Brute-force protection: 5 prób / minutę / IP, 5 prób na konto → lock 15 min. Patrz
[`docs/SECURITY.md`](../docs/SECURITY.md).

### Orders

| Metoda | Ścieżka                                      | Rola                            | Opis                                                  |
| ------ | -------------------------------------------- | ------------------------------- | ----------------------------------------------------- |
| GET    | `/api/orders?date=YYYY-MM-DD`                | dowolny zalogowany              | Zlecenia z danego dnia (kalendarz).                   |
| POST   | `/api/orders`                                | dowolny zalogowany              | Tworzy zlecenie + zwraca sugestie techników.          |
| PUT    | `/api/orders/{id}/assign`                    | dowolny zalogowany              | Przypisuje technika do zlecenia.                      |
| GET    | `/api/orders/technician/{id}?date=…`         | technician (own) / admin        | Zlecenia technika na dzień.                           |
| POST   | `/api/orders/technician/{id}/location`       | technician (own) / admin        | Raport GPS. Auto-arrival gdy <100 m od adresu.        |
| PUT    | `/api/orders/{id}/complete`                  | technician (own) / admin        | Zamknięcie zlecenia + protokół + Payment.             |

`POST /api/orders` — geocoding fallback: jeśli front nie poda `Lat/Lng`, backend pyta Nominatim.
Przy braku wyniku spada do *Warszawa centrum* (52.2297, 21.0122) — to celowo, żeby zlecenie nie
przepadło, ale handlowiec powinien poprawić adres.

### Technicians

| Metoda | Ścieżka                                       | Rola                | Opis                                                |
| ------ | --------------------------------------------- | ------------------- | --------------------------------------------------- |
| GET    | `/api/technicians`                            | publiczne (bez tel) | Lista aktywnych. Niezalogowany dostaje tylko id+name (na ekran logowania mobile). |
| GET    | `/api/technicians?includeInactive=true`       | bearer              | Wszyscy, z dezaktywowanymi.                         |
| GET    | `/api/technicians/{id}`                       | bearer              | Szczegóły.                                          |
| GET    | `/api/technicians/{id}/availability?date=…`   | bearer              | Dostępność na konkretny dzień.                      |
| GET    | `/api/technicians/availability/bulk?date=…`   | bearer              | Dostępność wszystkich techników na dzień (kalendarz).|
| POST   | `/api/technicians`                            | admin/superadmin    | Dodaje technika + 14 dni domyślnej dostępności.     |
| PUT    | `/api/technicians/{id}`                       | admin/superadmin    | Edycja (partial — `null` = bez zmian).              |
| DELETE | `/api/technicians/{id}`                       | admin/superadmin    | Soft delete (`IsActive = false`).                   |

### Treatments

| Metoda | Ścieżka                  | Auth   | Opis                          |
| ------ | ------------------------ | ------ | ----------------------------- |
| GET    | `/api/treatments`        | bearer | Słownik aktywnych zabiegów.   |
| GET    | `/api/treatments/{id}`   | bearer | Szczegóły zabiegu.            |

### Pozostałe

| Metoda | Ścieżka       | Opis                              |
| ------ | ------------- | --------------------------------- |
| GET    | `/health`     | Liveness probe (zwraca 200 zawsze). |

## Testy

```bash
dotnet test                                  # ze ścieżki głównej repo
DOTNET_ROLL_FORWARD=Major dotnet test        # gdy nie masz lokalnie .NET 8 runtime
```

27 testów, ~500 ms, bez wymagań runtime'owych poza .NET. EF Core InMemory zastępuje Postgresa
(dla testów logiki — nie dla testowania samych migracji).

## Algorytm sugestii (skrót)

`SuggestionService.GetSuggestionsAsync(clientLat, clientLng, date, start, end, requiredSkill)`:

1. Pobierz aktywnych techników z dostępnością i zleceniami z danego dnia.
2. Filtruj po `requiredSkill` (substring w `Specializations`, comma-separated).
3. `DistanceKm = min(Haversine(p, klient)) / 1000` po zbiorze punktów
   `{dom technika} ∪ {każde zlecenie z `ScheduledDate == date`}`.
   Pole `DistanceSource` (`"home"`/`"order"`) mówi, który punkt wygrał — UI pokazuje to
   handlowcowi (np. „4.2 km · od zlecenia").
   Intuicja: jeśli technik jest gdzieś w okolicy klienta tego dnia (niezależnie od pory),
   warto zgrupować pobliskie punkty w trasie — to lepszy sygnał niż sam dom.
4. `EstimatedMinutes = DistanceKm / 40 * 60` (założenie: 40 km/h średnio w mieście).
5. `FitLevel`:
   - `warning` — brak `Availability` lub slot wykracza poza zmianę,
   - `available` — dostępny.
6. Sortuj: `available` przed `warning`, potem rosnąco po odległości.
7. Pierwszy z listy (jeśli `available`) dostaje promocję `recommended`.

Testy: `FieldService.Tests/Services/SuggestionServiceTests.cs`.
