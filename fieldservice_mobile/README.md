# fieldservice_mobile — Aplikacja technika

Flutter dla techników wykonujących zabiegi w terenie. Logowanie PIN-em, lista zleceń na dziś,
nawigacja przez Google Maps, automatyczne odnotowanie przyjazdu (GPS), zamknięcie zlecenia z protokołem.

## Layout

```
fieldservice_mobile/
├── pubspec.yaml                Flutter 3.x (Dart >=3.2), http, intl, url_launcher,
│                               image_picker, shared_preferences
└── lib/
    ├── main.dart               Punkt wejścia, locale PL, MaterialApp
    ├── models/
    │   ├── order.dart          Order (lat/lng dla GPS auto-arrival)
    │   ├── treatment.dart
    │   └── technician.dart
    ├── services/
    │   └── api_service.dart    HTTP client, JWT z shared_preferences
    ├── screens/
    │   ├── login_screen.dart   Wybór technika + PIN + konfiguracja URL API
    │   └── day_screen.dart     Lista zleceń dnia + nawigacja
    └── widgets/
        └── order_card.dart     Rozwijalna karta zlecenia + Google Maps deeplink
```

Platformy obecne w repo: iOS, Android, macOS, Web, Linux, Windows. Aktywnie wspierane: **iOS, Android**.
macOS + Web używamy do dev/debug.

## Uruchomienie

```bash
flutter pub get

# macOS (najszybszy dev loop)
flutter run -d macos

# iOS Simulator
open -a Simulator
flutter run

# Android Emulator
flutter run -d emulator

# Web (fallback)
flutter run -d chrome
```

Reset przy problemach:

```bash
flutter clean && flutter pub get
```

## Konfiguracja URL API

URL backendu konfigurowany na **ekranie logowania** (zapisywany w `shared_preferences`).
Domyślnie: `http://localhost:5050/api`.

| Środowisko             | URL                                          |
| ---------------------- | -------------------------------------------- |
| iOS Simulator / macOS  | `http://localhost:5050/api`                  |
| Android Emulator       | `http://10.0.2.2:5050/api`                   |
| Urządzenie fizyczne    | `http://<IP-komputera-w-sieci-LAN>:5050/api` |
| Produkcja              | `https://<railway-url>/api`                  |

## Auth flow

1. Pobierz publiczną listę techników: `GET /api/technicians` (anonim → `id` + `fullName`).
2. Wybór technika + PIN → `POST /api/auth/technician-login` → JWT (24 h, claim `technicianId`).
3. Token w `shared_preferences`, dodawany jako `Authorization: Bearer …` przy każdym wywołaniu.
4. Token wygasa → wylogowanie do ekranu PIN.

Bez przechowywania PIN-u na urządzeniu — każde uruchomienie wymaga ponownego wpisania.

## Główne przepływy

**Lista dnia.** `GET /api/orders/technician/{id}?date=YYYY-MM-DD` → karty zleceń posortowane po
`ScheduledStart`. Tap karty rozwija szczegóły i przyciski (zadzwoń, nawiguj, zamknij).

**GPS auto-arrival.** Aplikacja co 30 s wysyła `POST /api/orders/technician/{id}/location`
z aktualnymi koordynatami. Backend porównuje z adresem najbliższego aktywnego zlecenia.
Gdy <100 m → tworzy `Protocol`, ustawia `ArrivalAt = now`, zlecenie przechodzi w `in_progress`.
Aplikacja dostaje `{ arrived: true, orderId }` i pokazuje toast.

**Zamknięcie zlecenia.** `PUT /api/orders/{id}/complete` z `paymentOverride` i `technicianNotes`.
Backend tworzy `Payment` w statusie `pending`. Zdjęcia protokołu — w toku (MinIO storage).

## Testy

```bash
flutter test
```

Folder `test/` aktualnie zawiera szablon Flutter — testy domenowe TBD.
