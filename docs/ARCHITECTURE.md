# Architektura

## Diagram

```
┌──────────────────┐       ┌──────────────────┐       ┌──────────────────┐
│  fieldservice-   │       │   FieldService   │       │  fieldservice_   │
│  web (React SPA) │ ──┐   │   (.NET 8 API)   │   ┌── │  mobile (Flutter)│
└──────────────────┘   │   └─────────┬────────┘   │   └──────────────────┘
                       │             │            │
                  HTTPS + JWT    EF Core     HTTPS + JWT
                       │             │            │
                       └────┬────────┼────────────┘
                            │        │
                            ▼        ▼
                    ┌─────────────────────┐    ┌─────────────────┐
                    │  PostgreSQL/PostGIS │    │  Nominatim      │
                    │  (Railway managed)  │    │  (zewn., HTTP)  │
                    └─────────────────────┘    └─────────────────┘

                    ┌─────────────────────┐
                    │  MinIO (S3-compat,  │   [planowane: zdjęcia
                    │   lokalnie/Railway) │    protokołów]
                    └─────────────────────┘
```

Trzy klienty (web SPA, mobile, ewentualne integracje) → jeden monolityczny backend → jedna baza.
Świadomy wybór: zespół jest mały, domena prosta, mikroserwisy byłyby narzutem bez korzyści.

## Model domenowy

```
User ────owns────► Order ──assigned──► Technician
                    │  ▲                    │
                    │  │                    │
                    ▼  │                    ▼
                 Treatment              Availability (per date)
                    │
                    ▼
                Protocol ────1:1──── Order ────1:1──── Payment
```

### Encje

- **User** — operator panelu webowego: handlowiec, starszy_handlowiec, admin, supervisor, superadmin.
  Logowanie login + hasło. Hash PBKDF2 (100k iteracji SHA-256, 16-bajtowy salt).
- **Technician** — pracownik terenowy. Logowanie do mobile via PIN (też PBKDF2). Ma `HomeLat`/`HomeLng`
  i `Specializations` (comma-separated, np. `"drabina,osy"`).
- **Treatment** — słownik zabiegów (`Name`, `DurationMinutes`, `DefaultPrice`, opcjonalny `RequiredSkill`).
- **Order** — centralna encja. Klient (dane wpisywane bezpośrednio, brak osobnej tabeli klientów),
  adres + koordynaty, zabieg, czas, technik, status (`draft` → `assigned` → `in_progress` →
  `completed`), cena.
- **Availability** — `(TechnicianId, Date)` → `(StartTime, EndTime)`. Indeks złożony.
- **Protocol** — 1:1 z `Order`. `ArrivalAt` ustawiane automatycznie przez GPS, `CompletedAt` ręcznie.
  Notatki technika, opcjonalny override metody płatności.
- **Payment** — 1:1 z `Order`. Tworzony przy `complete`, status `pending` do rozliczenia.

### Co świadomie pominięto

- **Brak tabeli klientów.** Wpisujemy ich przy zleceniu. Powtarzalność klientów w DDD jest niska, więc
  kartoteka generowałaby narzut bez wartości. Jeśli pojawi się potrzeba CRM-u — wydzielimy.
- **Brak ról przez RBAC.** `User.Role` to string, sprawdzany w kontrolerach. Wystarczy dla 5 ról i
  nie chcemy ciągnąć Identity / OPA.
- **Brak event sourcingu / audit logu.** Status zmienia się w miejscu. Jeśli sąd zażąda historii —
  dorobimy `OrderStatusHistory`.

## Przepływ zlecenia

```
Handlowiec                     Backend                     Technik (mobile)
    │                              │                              │
    │ POST /api/orders             │                              │
    │ {customer, address, slot}    │                              │
    │ ────────────────────────────►│                              │
    │                              │ Geocoding (Nominatim)        │
    │                              │ → Order(status=draft)        │
    │                              │ → SuggestionService          │
    │ {order, suggestedTechs}      │                              │
    │ ◄────────────────────────────│                              │
    │                              │                              │
    │ PUT /api/orders/{id}/assign  │                              │
    │ ────────────────────────────►│ Order(status=assigned,       │
    │                              │       technicianId=…)        │
    │                              │                              │
    │                              │      GET /api/orders/        │
    │                              │      technician/{id}?date=…  │
    │                              │ ◄────────────────────────────│
    │                              │                              │
    │                              │      POST .../location       │
    │                              │      (co 30 s)               │
    │                              │ ◄────────────────────────────│
    │                              │ if dist <100 m:              │
    │                              │   Protocol(ArrivalAt=now)    │
    │                              │   Order(status=in_progress)  │
    │                              │                              │
    │                              │      PUT /api/orders/{id}/   │
    │                              │      complete                │
    │                              │ ◄────────────────────────────│
    │                              │ Protocol(CompletedAt=now)    │
    │                              │ Payment(status=pending)      │
    │                              │ Order(status=completed)      │
```

## Algorytm sugestii techników

Wejście: `(clientLat, clientLng, date, startTime, endTime, requiredSkill?)`.
Wyjście: lista techników z `DistanceKm`, `EstimatedMinutes`, `FitLevel`, posortowana.

1. Pobierz aktywnych techników wraz z `Availabilities` na `date` i `Orders` z `date`.
2. Filtr: `requiredSkill in Specializations` (substring, comma-separated).
3. `DistanceKm = min(Haversine(p, klient)) / 1000` po zbiorze punktów `{dom technika} ∪ {każde zlecenie tego dnia}`.
   `DistanceSource = "home"` lub `"order"` — który punkt wygrał (UI pokazuje adnotację „od zlecenia").
   Założenie: jeśli technik jest gdzieś w okolicy klienta tego dnia (niezależnie od pory),
   da się ułożyć trasę, by zgrupować pobliskie punkty.
4. `EstimatedMinutes = DistanceKm / 40 km/h × 60` (heurystyka miejska).
5. `FitLevel`:
   - `warning` — brak `Availability` na ten dzień, lub `[startTime, endTime]` wykracza poza zmianę.
   - `available` — pasuje.
6. Sort: `available` przed `warning`, dalej rosnąco po `DistanceKm`.
7. Pierwszy `available` z listy dostaje promocję `recommended` (UI-hint, nie zmienia logiki).

Implementacja: `FieldService/Services/SuggestionService.cs`. Testy: `FieldService.Tests/Services/SuggestionServiceTests.cs`.

### Świadome ograniczenia

- **Linia prosta, nie trasa drogowa.** Dla Warszawy w godzinach pracy estymata 40 km/h jest
  sensowna; w korkach lub na obrzeżach — nie. Migracja na VROOM/OSRM jest na liście (patrz
  `docker-compose.yml`).
- **Nie blokuje konfliktów.** Jeśli handlowiec zignoruje `warning` i przypisze technika poza zmianą —
  system dopuszcza. Sugestia, nie wymuszenie.
- **Dostępność jest "all or nothing".** Brak częściowych slotów (np. lunch break). Wystarczy nam.

## Schemat migracji EF Core

`Program.cs` przy starcie:

1. Pyta `information_schema` czy istnieje tabela `Users` i czy istnieje `__EFMigrationsHistory`.
2. **Świeża baza** (brak `Users`) → `Database.Migrate()` tworzy całość z migracji.
3. **Legacy baza** (`Users` jest, brak `__EFMigrationsHistory`):
   - dosypuje brakujące kolumny przez idempotentne `ALTER … ADD COLUMN IF NOT EXISTS`,
   - tworzy `__EFMigrationsHistory`,
   - markuje wszystkie istniejące migracje jako zaaplikowane,
   - wywołuje `Migrate()` (no-op, ale spójność).
4. **Migrowana baza** → `Database.Migrate()` aplikuje pending.

Logika: pierwszy deploy z migracjami trafia na DB utworzoną przez `EnsureCreated()` w starszej wersji
kodu. Bez baseline'u `Migrate()` próbowałby utworzyć tabele, które już istnieją, i wywaliłby się na
duplikatach. Po pierwszym przejściu legacy gałęzi DB jest "normalna" i kolejne migracje idą zwykłą drogą.

## Granice integracyjne

| Zewnętrzne                    | Cel                                             | Tryb         |
| ----------------------------- | ----------------------------------------------- | ------------ |
| Nominatim (OpenStreetMap)     | Geocoding adresu (fallback gdy front nie poda)  | best-effort  |
| Google Places (frontend only) | Autocomplete adresów + dokładny lat/lng         | opt-in (key) |
| Google Maps (deeplink)        | Nawigacja w mobile                              | URL scheme   |
| MinIO / S3                    | Storage zdjęć protokołów (planowane)            | TBD          |
| Railway PostgreSQL            | Managed Postgres + PostGIS                      | required     |

Wszystkie integracje są **opcjonalne lub mają fallback** poza Postgresem. Jeśli Nominatim leży —
zlecenie tworzy się z koordynatami "Warszawa centrum" i handlowiec poprawia. Jeśli Google Places nie
ma klucza — autocomplete degraduje do textboxa.
