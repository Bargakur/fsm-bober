# FieldService — System zarządzania zabiegami w terenie

## Struktura projektu

```
FieldService/
├── Models/                    # Modele danych (tabele w bazie)
│   ├── User.cs                # Handlowcy i administratorzy
│   ├── Technician.cs          # Technicy (z współrzędnymi domu)
│   ├── Availability.cs        # Grafik dostępności techników
│   ├── Client.cs              # Klienci (z współrzędnymi adresu)
│   ├── Treatment.cs           # Formatki zabiegów (czas, cena, skill)
│   ├── Order.cs               # Zlecenia (centralna tabela)
│   ├── Protocol.cs            # Protokoły (GPS arrival, zdjęcie, uwagi)
│   └── Payment.cs             # Płatności
│
├── Data/
│   └── AppDbContext.cs        # Entity Framework — mapuje modele na tabele
│
├── DTOs/
│   └── OrderDtos.cs           # Obiekty transferu danych (walidacja wejścia)
│
├── Controllers/
│   └── OrdersController.cs    # Endpointy API (CRUD + sugestie + GPS)
│
├── Services/
│   └── SuggestionService.cs   # Algorytm rankingu techników
│
├── Program.cs                 # Punkt wejścia — konfiguracja serwisów
├── appsettings.json           # Connection string do PostgreSQL
├── Dockerfile                 # Budowanie obrazu API
└── docker-compose.yml         # Cały system — jedno polecenie
```

## Uruchomienie (wymagany Docker)

```bash
docker compose up --build
```

Po starcie:
- API:          http://localhost:5000
- Swagger docs: http://localhost:5000/swagger
- MinIO panel:  http://localhost:9001 (minioadmin / minioadmin123)

## Kluczowe endpointy

| Metoda | Ścieżka                              | Opis                                    |
|--------|---------------------------------------|------------------------------------------|
| GET    | /api/orders?date=2026-04-15           | Zlecenia na dany dzień (kalendarz)       |
| POST   | /api/orders                           | Utwórz zlecenie + pobierz sugestie       |
| PUT    | /api/orders/{id}/assign               | Przypisz technika (handlowiec wybiera)   |
| GET    | /api/orders/technician/{id}?date=...  | Zlecenia technika na dzień (apka)        |
| POST   | /api/orders/technician/{id}/location  | Raport GPS (automatyczny, co 30s)        |
| PUT    | /api/orders/{id}/complete             | Zakończ zabieg (technik w apce)          |

## Co jest gotowe, co trzeba dobudować

### Gotowe w tym szkielecie:
- [x] Model danych z relacjami i indeksami
- [x] CRUD zleceń z walidacją
- [x] Algorytm sugestii techników (Haversine — linia prosta)
- [x] Automatyczne wykrywanie przyjazdu technika (GPS)
- [x] Zakończenie zabiegu z protokołem
- [x] Docker Compose z PostgreSQL, Redis, MinIO
- [x] Swagger — automatyczna dokumentacja API

### Do dobudowania:
- [ ] Autoryzacja JWT (logowanie handlowców i techników)
- [ ] Upload zdjęć do MinIO
- [ ] Integracja VROOM + OSRM (realne trasy drogowe)
- [ ] Panel webowy React z FullCalendar.js
- [ ] Aplikacja mobilna Flutter
- [ ] Push notifications (Firebase)
- [ ] Dashboard KPI (spóźnienia, czasy zabiegów)
