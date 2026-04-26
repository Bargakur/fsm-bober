# Bezpieczeństwo

## Model autoryzacji

Dwa rozłączne typy aktorów, dwa endpointy logowania, dwa formaty tokena:

| Aktor       | Logowanie                          | Tabela        | Token TTL | Claims                                                |
| ----------- | ---------------------------------- | ------------- | --------- | ----------------------------------------------------- |
| User        | login + hasło                      | `Users`       | 12 h      | `nameid`, `name`, `role`, `fullName`                  |
| Technician  | technicianId + PIN                 | `Technicians` | 24 h      | `nameid`, `name`, `role=technician`, `technicianId`   |

Token JWT podpisany HMAC-SHA256 kluczem `Jwt__Key`. Issuer/Audience: `FsmBober`.

### Role użytkowników

`User.Role` to string (świadomie, dla 5 ról nie ma wartości w RBAC framework):

```
handlowiec → starszy_handlowiec → admin → supervisor → superadmin
```

Egzekwowane:

- **`OrdersController`** — wszystko `[Authorize]` (dowolny zalogowany), niektóre operacje
  na zleceniach technika sprawdzają `claim technicianId == route id || role in {admin, superadmin}`.
- **`TechniciansController`** — `GET` publiczne (anonimowy widzi tylko `id` + `fullName`,
  zalogowany — pełne dane). Mutacje (`POST/PUT/DELETE`) sprawdzają `role in {admin, supervisor, superadmin}`.
- **`AuthController`** — `/login` i `/technician-login` `[AllowAnonymous]`, `/me` `[Authorize]`.
- **Frontend** — gating jest UI-only (`AdminPanel` widoczny tylko dla adminów). Faktyczne
  uprawnienia weryfikuje backend.

## Hashowanie haseł i PIN-ów

`AuthController.HashPassword` / `VerifyPassword`:

```
PBKDF2-SHA256, 100 000 iteracji
salt: 16 bajtów z RandomNumberGenerator
hash: 32 bajty
format storage: "<base64(salt)>:<base64(hash)>"
```

Verify używa `CryptographicOperations.FixedTimeEquals` (constant-time), więc czas odpowiedzi nie
zdradza, czy źle poszedł hash czy salt. PIN-y techników używają tego samego mechanizmu — krótki PIN
(4 cyfry) jest podatny na brute-force, więc dodajemy ratelimit i lockout (poniżej).

Testy: `FieldService.Tests/Auth/PasswordHashingTests.cs` — round-trip, malformed hash safety,
tamper detection, case sensitivity.

## Brute-force protection

W pamięci procesu (`ConcurrentDictionary`), ostatnie 5 min:

| Limit                              | Akcja                                         |
| ---------------------------------- | --------------------------------------------- |
| 5 prób / minutę / IP               | HTTP 429, blokada IP na okno 1 min            |
| 5 nieudanych prób na konto         | Lockout konta na 15 min                       |

Reset stanu konta — po udanym logowaniu albo po wygaśnięciu lockoutu.

⚠️ **Ograniczenia.** Stan w pamięci procesu — przy skali horyzontalnej (>1 instancja backendu)
ratelimit się rozjedzie. Dla obecnej skali (1 instancja Railway) wystarcza. Skalowanie horyzontalne
wymagałoby Redisa (mamy już w `docker-compose.yml`, ale w produkcji nieużywany).

⚠️ **Restart kontenera czyści stan.** Atakujący może to wykorzystać przy szybkim re-deployu.
Akceptujemy — to wewnętrzny tool, threat model jest niski.

## Sekrety

Żaden sekret nie jest w repo:

- `.env` w `.gitignore`, `.env.example` zawiera **wyłącznie placeholdery** (`changeme_*`).
- `appsettings.json` ma tylko domyślny lokalny connection string (do dev), bez kluczy.
- Produkcyjne sekrety wyłącznie w Railway Variables.
- Backend **rzuca przy starcie**, jeśli `Jwt__Key` jest pusty — nigdy nie wystartuje z domyślnym kluczem.

### Rotacja kluczy

| Klucz                  | Procedura rotacji                                                           | Skutek                                 |
| ---------------------- | --------------------------------------------------------------------------- | -------------------------------------- |
| `Jwt__Key`             | Zmień w Railway → Redeploy                                                  | Wszyscy zalogowani — wylogowanie       |
| `POSTGRES_PASSWORD`    | Reset w Postgres + zmień zmienną → Redeploy backendu                        | Krótki downtime backendu               |
| `MINIO_ROOT_PASSWORD`  | Reset w MinIO + zmień zmienną → Redeploy                                    | Reset uploadów w trakcie               |
| `VITE_GOOGLE_MAPS_KEY` | Wymień w Google Cloud Console → ustaw nowy w Railway → Redeploy frontendu   | Nowa wersja JS po redeploy             |

## CORS

Białą listę originów ustawia `Cors__AllowedOrigins__0..N`. **Brak wildcarda** (`*`) i **brak
`AllowAnyOrigin()`**. `WithOrigins(allowedOrigins).AllowAnyMethod().AllowAnyHeader()` — origin musi się
zgadzać dokładnie.

Domyślnie (gdy zmienna nie ustawiona): `http://localhost:5173` — tylko dev.

⚠️ Przy custom domain trzeba dopisać kolejny `Cors__AllowedOrigins__1` (dokładny schemat + host, bez
slasha końcowego).

## JWT — szczegóły walidacji

`TokenValidationParameters` w `Program.cs`:

```
ValidateIssuer = true,   ValidIssuer = "FsmBober"
ValidateAudience = true, ValidAudience = "FsmBober"
ValidateLifetime = true
ValidateIssuerSigningKey = true
```

- **Brak `ClockSkew = 0`** → domyślne 5 min tolerancji. Dla naszego TTL (12 h / 24 h) nie ma znaczenia.
- **Brak refresh tokenów** świadomy. Wewnętrzny tool, nie publiczny SaaS — wygaśnięcie tokena = ponowne
  logowanie. Trade-off prostoty za UX.
- **Storage tokena**: `localStorage` (web), `shared_preferences` (mobile). XSS na froncie pozwoliłoby
  go wykraść — chronimy się ścisłym CORS-em i brakiem inline `<script>` z user inputu.

## Threat model — co jest pokryte, co nie

### Pokryte

- Brute-force loginu (ratelimit + lockout).
- Słabe hashowanie haseł (PBKDF2 100k SHA-256, salt per hasło).
- Tampering tokenem (HMAC weryfikacja).
- Cross-origin abuse (CORS allowlist).
- Hardcoded secrets w repo (egzekwowane przez build — fail jeśli `Jwt__Key` pusty).
- Privilege escalation per technician (`technicianId` z claima vs `route id`).

### Nie pokryte (świadomie, threat model uznaje)

- **CSRF.** Brak ochrony — tokeny w `localStorage` (nie cookie), więc nieczułe na CSRF.
- **Audit log.** Nie logujemy kto co zmienił. Jeśli klient zażąda — dorobimy `OrderHistory`.
- **Secrets at rest.** Railway szyfruje, ale nie mamy KMS. Dla obecnej skali OK.
- **Rate limit poza loginem.** API ogólnie ma `[Authorize]`, więc próg wejścia jest, ale brak limitu
  per endpoint. Akceptowalne dla wewnętrznego use case.
- **DoS.** Pojedyncza instancja, brak Cloudflare przed Railway. Próbka w `vite.config.ts` dopuszcza
  `*.trycloudflare.com` dla dev tunneli — produkcja by wymagała dodatkowego CDN/WAF.

### Nie pokryte (do zrobienia)

- **Upload zdjęć protokołów** → walidacja typu/rozmiaru, sanityzacja nazw, antywirus na MinIO.
- **PII w logach** → audyt logów aplikacji pod kątem wycieku danych klienta (nazwiska, telefony).
- **Refresh PIN flow** → obecnie zmiana PIN-u technika wymaga ingerencji admina przez DB. Trzeba
  endpoint.

## Reagowanie na incydent

1. **Wyciek `Jwt__Key`** → rotacja (sekcja powyżej). Wszyscy zalogowani — out.
2. **Wyciek hasła użytkownika** → `UPDATE Users SET PasswordHash = '' WHERE Login = '...'` →
   user musi przejść reset (na razie tylko przez admina, endpoint TBD).
3. **Skompromitowane konto admina** → odebrać rolę przez DB:
   ```sql
   UPDATE "Users" SET "Role" = 'handlowiec' WHERE "Login" = '...';
   ```
   + rotacja `Jwt__Key`.
4. **Podejrzany ruch** → logi Railway, w razie potrzeby Cloudflare przed serwisami.

Brak formalnego procesu disclosure — to wewnętrzny projekt jednej firmy. Zgłoszenia zewnętrzne
trafiają do właściciela repo.
