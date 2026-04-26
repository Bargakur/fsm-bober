# FSM Bober

Field Service Management dla firmy DDD (dezynfekcja, dezynsekcja, deratyzacja). System obsługuje pełen cykl
zlecenia: handlowiec planuje termin → algorytm sugeruje technika → technik wykonuje zabieg w aplikacji
mobilnej → administracja widzi protokół i płatność.

## Komponenty

| Katalog                | Stack                                    | Rola                                                                        |
| ---------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| `FieldService/`        | .NET 8 · ASP.NET Core · EF Core · Npgsql | REST API, baza domenowa, JWT auth, algorytm sugestii, geocoding             |
| `FieldService.Tests/`  | xUnit · EF Core InMemory                 | Testy jednostkowe i integracyjne backendu                                   |
| `fieldservice-web/`    | React 18 · TypeScript · Vite             | Panel handlowca i administratora — kalendarz, CRUD, sugestie                |
| `fieldservice_mobile/` | Flutter                                  | Aplikacja terenowa technika — lista dnia, GPS auto-arrival, protokół        |

## Quickstart (lokalnie)

Wymagane: Docker 24+, Node 18+, .NET 8 SDK, Flutter 3.x (tylko jeśli pracujesz nad mobile).

```bash
# 1. Skonfiguruj sekrety
cp .env.example FieldService/.env       # docker-compose czyta .env z FieldService/
$EDITOR FieldService/.env               # ustaw POSTGRES_PASSWORD i JWT_KEY

# 2. Backend + Postgres + MinIO
cd FieldService
docker compose up --build
# API:      http://localhost:5050
# Swagger:  http://localhost:5050/swagger
# MinIO:    http://localhost:9001

# 3. Web (w nowym terminalu)
cd fieldservice-web
npm install
npm run dev
# Web:      http://localhost:5173 (proxy /api → :5050)

# 4. Mobile (opcjonalnie)
cd fieldservice_mobile
flutter pub get
flutter run -d macos    # albo: -d chrome, -d <emulator-id>
```

Ścieżki konfiguracji per komponent — patrz `FieldService/README.md`, `fieldservice-web/README.md`,
`fieldservice_mobile/README.md`.

## Dokumentacja

- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — model domenowy, przepływ zlecenia, decyzje projektowe
- [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) — Railway, zmienne środowiskowe, procedura migracji, runbook
- [`docs/SECURITY.md`](docs/SECURITY.md) — model autoryzacji, JWT, hashowanie, brute-force, sekrety

## Deploy

Produkcja działa na Railway. `git push origin main` uruchamia auto-deploy backendu i frontendu.
Migracje EF Core aplikują się przy starcie kontenera (logika baseline obsługuje legacy DB).
Szczegóły: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

## Testy

```bash
dotnet test                                # backend, bez Dockera
DOTNET_ROLL_FORWARD=Major dotnet test      # gdy lokalnie masz tylko .NET 9/10
```

27 testów w `FieldService.Tests/`: utils geo, hashowanie haseł, algorytm sugestii (EF InMemory).

## Konwencja commitów

Conventional Commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`. Body w trybie wyjaśniającym
*dlaczego*, nie *co*. Jedna logiczna zmiana = jeden commit.
