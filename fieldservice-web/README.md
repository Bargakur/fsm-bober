# fieldservice-web — Panel handlowca i administratora

React 18 SPA do FSM Bober. Ekran kalendarza dnia z kolumnami techników, modal nowego zlecenia,
panel sugestii, panel admina. TypeScript, Vite, własne style w `index.css` (bez frameworka CSS).

## Layout

```
fieldservice-web/
├── package.json                React 18, Leaflet, Lucide React, FullCalendar (legacy)
├── vite.config.ts              Dev server :3000, proxy /api → :5050
├── nginx.conf                  Konfiguracja SPA dla Railway (fallback do index.html)
├── Dockerfile                  Multi-stage: build z node, serwowanie z nginx
│
├── index.html                  Single entry; loader Google Maps Places (jeśli VITE_GOOGLE_MAPS_KEY)
└── src/
    ├── main.tsx                ReactDOM root
    ├── App.tsx                 Layout: Sidebar + widok główny + modale + auth state
    ├── index.css               Wszystkie style (zmienne CSS, layout, komponenty)
    │
    ├── types/index.ts          Współdzielone interfejsy domenowe
    ├── services/api.ts         Fetch wrapper, JWT z localStorage, CRUD techników
    │
    └── components/
        ├── ResourceCalendar.tsx     Główny widok: kolumny techników, godziny 06:00–20:00
        ├── OrderForm.tsx            Modal: nowe zlecenie (dropdown zabiegów, czas, cena)
        ├── OrderDetail.tsx          Szczegóły zlecenia + link do Google Maps
        ├── SuggestionPanel.tsx      Panel sugerowanych techników (po zapisie zlecenia)
        ├── AddressInput.tsx         Google Places autocomplete + Leaflet preview
        ├── PreFilterModal.tsx       Filtry przed otwarciem kalendarza
        ├── AdminPanel.tsx           CRUD techników (tylko admin/superadmin)
        ├── LoginScreen.tsx          Login + hasło → JWT
        ├── Sidebar.tsx              Nawigacja boczna (admin item warunkowo)
        └── Calendar.tsx             [legacy] FullCalendar — nieużywany
```

## Uruchomienie

```bash
npm install
npm run dev
# http://localhost:3000 (proxy /api → http://localhost:5050)
```

`npm run build` — produkcyjny bundle do `dist/`. `npm run preview` — lokalny serw `dist/`.

## Konfiguracja

| Zmienna                  | Wymagane | Opis                                                                 |
| ------------------------ | -------- | -------------------------------------------------------------------- |
| `VITE_API_URL`           | nie\*    | URL backendu w produkcji (np. `https://fsm-bober.up.railway.app`).   |
| `VITE_GOOGLE_MAPS_KEY`   | nie      | Klucz Google Places dla autocomplete adresów (degraduje do textbox). |

\* W dev serwer Vite proxy'uje `/api` na `localhost:5050`. W produkcji `VITE_API_URL` jest **build-time** —
po zmianie wymagany rebuild i redeploy.

`.env` lokalnie:

```
VITE_API_URL=http://localhost:5050
VITE_GOOGLE_MAPS_KEY=AIza...
```

## Auth flow

1. Brak tokena w `localStorage` → `<LoginScreen />`.
2. `POST /api/auth/login` → token zapisany jako `localStorage.token` + `localStorage.user`.
3. Każde wywołanie API dodaje `Authorization: Bearer <token>` (`services/api.ts`).
4. 401 z backendu → `localStorage.removeItem(...)` + redirect do logowania.

Token wygasa po 12 h. Brak refresh tokenów (świadomie — to wewnętrzny tool, nie publiczny SaaS).
Wylogowanie = `localStorage.clear()`.

## Najważniejsze decyzje UI

- **Kalendarz to nie FullCalendar.** Mamy własny `ResourceCalendar` — kolumny per technik, jedna doba
  06:00–20:00, drag-to-reschedule. FullCalendar został w deps (legacy `Calendar.tsx`), ale nie jest
  importowany. Można usunąć przy następnym sprzątaniu zależności.
- **Adres → współrzędne po stronie klienta** kiedy się da (Google Places). Backend ma fallback do
  Nominatim, ale frontend zwraca dokładniejsze koordynaty z autocomplete.
- **Style w jednym `index.css`.** Zmienne CSS, BEM-light. Brak Tailwinda — projekt jest mały, nie warto
  ciągnąć dependencji.

## Deploy

Railway, root directory: `fieldservice-web`. Build: `npm run build`. Serw: nginx z `nginx.conf`.
Po zmianie `VITE_API_URL` trzeba zrobić Redeploy w UI Railway.
