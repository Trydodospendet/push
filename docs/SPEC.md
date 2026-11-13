# PUSH – Projektspezifikation (MVP)

> Diese Datei ist die verbindliche Spezifikation für dieses Projekt. Lies sie vollständig, bevor du Code schreibst.
> Arbeitstitel der App: **PUSH** (Name kann sich ändern – App-Name nur an EINER Stelle definieren: `src/config/app.ts`).
> Code, Bezeichner, Commits: Englisch. UI-Texte: Deutsch. Kommunikation mit mir: Deutsch.

---

## 1. Produkt in einem Satz

Menschen setzen einen Einsatz darauf, dass sie ein Lauf- oder Schrittziel erreichen. Wer es schafft, bekommt seinen Einsatz zurück und teilt sich die Einsätze derer, die es nicht geschafft haben. Die Zielerreichung wird automatisch über Apple Health (iOS) bzw. Health Connect (Android) geprüft – niemand kann sein Ergebnis selbst behaupten.

## 2. Festgelegte Entscheidungen

| Thema | Entscheidung |
|---|---|
| Challenge-System | **Gemeinsamer Pool** (alle zahlen gleichen Einsatz, Gewinner teilen verlorene Einsätze) |
| Challenge-Arten | **Nur Laufen und Schritte** (3 Zieltypen, siehe 6.2) |
| Design | **Schwarz mit Lime-Grün als einziger Akzentfarbe**, minimalistisch |
| Geld im MVP | **KEIN echtes Geld.** Nur virtuelle Credits. Echte Zahlungen erst nach rechtlicher Prüfung (nicht Teil dieses Projekts). |
| Plattformen | iOS + Android mit einer Codebasis |
| Budget | Nur kostenlose Tarife (Supabase Free, EAS Free) |

**Wichtig:** Die Architektur soll so gebaut sein, dass echte Zahlungen später über einen lizenzierten Zahlungsanbieter (z. B. Stripe Connect) angebunden werden können. Baue aber KEINE Zahlungsintegration, KEINE Auszahlungen, KEIN Aufladen mit echtem Geld.

## 3. Tech-Stack

- **Expo (aktuelles stabiles SDK) + React Native + TypeScript (strict)**
- **expo-router** (dateibasierte Navigation)
- **expo-dev-client** – Expo Go funktioniert NICHT, weil HealthKit/Health Connect native Module brauchen. Wir arbeiten mit Development Builds (EAS Build oder lokal).
- **Supabase**: Auth, Postgres, Row Level Security, RPC-Funktionen, `pg_cron`. Lokale Entwicklung mit der Supabase CLI (`supabase start`), Migrationen in `supabase/migrations/`.
- **iOS Health**: `@kingstinct/react-native-healthkit` (hat Expo Config Plugin)
- **Android Health**: `react-native-health-connect` + `expo-health-connect` Config Plugin
- **State/Data**: `@tanstack/react-query` für Server-State; kein Redux.
- **Formulare/Validierung**: `zod`
- **Schriften**: `@expo-google-fonts/inter`
- **Tests**: Jest (+ `@testing-library/react-native`) für App-Logik, **pgTAP** (`supabase test db`) für Datenbanklogik
- **Lint/Format**: ESLint + Prettier

Prüfe vor der Installation jeder Bibliothek die aktuelle Dokumentation und Kompatibilität mit dem verwendeten Expo SDK. Wenn eine Bibliothek veraltet oder inkompatibel ist, sag mir das und schlag eine Alternative vor, statt still zu wechseln.

## 4. Nicht verhandelbare Regeln

1. **Alle Geldlogik läuft serverseitig in Postgres** (Funktionen mit `SECURITY DEFINER`, in Transaktionen). Der Client berechnet niemals Salden, Auszahlungen oder Gewinner – er zeigt nur an.
2. **Beträge immer als Integer in Cent** (`bigint`). Niemals Floats für Geld. Anzeige-Formatierung nur im UI (`Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' })`).
3. **RLS auf jeder Tabelle aktiv.** Clients dürfen Ledger, Wallets, Teilnahmestatus und Challenge-Status nicht direkt schreiben – nur über RPC-Funktionen.
4. **Idempotenz:** Die Abrechnung einer Challenge darf auch bei doppeltem Aufruf nur einmal passieren.
5. **Manuell eingetragene Gesundheitsdaten zählen nie.**
6. **Keine Secrets im Code.** `.env` + `.env.example`; Service-Role-Key niemals in der App.
7. **Kein `any`**, keine auskommentierten Codeblöcke, keine ungenutzten Abhängigkeiten.
8. Jede Phase endet mit: `typecheck`, `lint`, alle Tests grün, Git-Commit, kurze Zusammenfassung an mich. **Dann warten, bis ich „weiter“ sage.**

## 5. Datenmodell (Postgres / Supabase)

Erstelle die Migrationen nach diesem Modell. Namen dürfen leicht angepasst werden, die Logik nicht.

### 5.1 Tabellen

**profiles**
- `id uuid pk` → `auth.users.id` (on delete cascade)
- `display_name text not null` (3–24 Zeichen)
- `timezone text not null default 'Europe/Berlin'`
- `created_at timestamptz`

**wallets**
- `user_id uuid pk` → profiles
- `balance_cents bigint not null default 0 check (balance_cents >= 0)`
- `updated_at timestamptz`

**ledger_entries** (append-only, niemals UPDATE/DELETE)
- `id uuid pk`
- `account text not null check (account in ('user','house'))`
- `user_id uuid null` (null bei `house`)
- `challenge_id uuid null`
- `type text not null check (type in ('signup_bonus','stake','payout','refund','fee','rounding','forfeit'))`
- `amount_cents bigint not null` (positiv = Gutschrift, negativ = Belastung)
- `created_at timestamptz`
- **Unique-Constraint** auf `(user_id, challenge_id, type)` für die Typen `stake`, `payout`, `refund` → verhindert doppelte Buchungen.

**challenges**
- `id uuid pk`
- `creator_id uuid` → profiles
- `title text not null`
- `goal_type text not null check (goal_type in ('run_single','run_total','steps_daily'))`
- `target_value integer not null` (Meter bei Lauf, Schritte bei `steps_daily`)
- `stake_cents bigint not null` (gleich für alle Teilnehmer; erlaubt: 100–5000 = 1 € bis 50 €)
- `fee_bps integer not null default 0` (Plattformgebühr in Basispunkten auf den **verlorenen** Topf; 1000 = 10 %)
- `timezone text not null default 'Europe/Berlin'`
- `starts_at timestamptz not null`, `ends_at timestamptz not null` (Dauer 1–42 Tage)
- `sync_grace_hours integer not null default 24`
- `min_participants integer not null default 2`
- `max_participants integer null`
- `visibility text not null check (visibility in ('public','private'))`
- `invite_code text unique null` (6 Zeichen, nur bei private)
- `status text not null check (status in ('open','active','settling','settled','cancelled'))`
- `settled_at timestamptz null`
- `created_at timestamptz`

**challenge_participants**
- `challenge_id`, `user_id` (zusammen PK)
- `stake_cents bigint not null`
- `result text not null default 'pending' check (result in ('pending','success','failed','refunded'))`
- `progress_value integer not null default 0` (vom Server berechnet)
- `payout_cents bigint null`
- `joined_at timestamptz`

**activity_workouts**
- `id uuid pk`, `user_id uuid`
- `platform text check (platform in ('ios','android'))`
- `source_record_id text not null` (UUID aus HealthKit / Health Connect)
- `source_name text` (z. B. App- oder Gerätename)
- `activity_type text not null` (nur `running` wird gespeichert)
- `start_at timestamptz`, `end_at timestamptz`
- `distance_m integer not null`, `duration_s integer not null`
- `was_user_entered boolean not null`
- `is_valid boolean not null`, `invalid_reason text null`
- `synced_at timestamptz`
- **Unique** `(user_id, platform, source_record_id)`

**activity_daily_steps**
- `user_id`, `date` (lokales Datum in der Zeitzone des Nutzers), PK aus beiden
- `steps integer not null`
- `platform text`, `synced_at timestamptz`
- Upsert: neuer Wert überschreibt alten für denselben Tag.

### 5.2 RLS-Grundsätze
- `profiles`: jeder darf `display_name` aller Profile lesen (für Teilnehmerlisten); schreiben nur das eigene.
- `wallets`, `ledger_entries`: nur eigene Zeilen lesen; Schreiben nur über Funktionen.
- `challenges`: `public` für alle lesbar; `private` nur für Ersteller und Teilnehmer (bzw. über `join_by_code`).
- `challenge_participants`: lesbar für Teilnehmer derselben Challenge; Schreiben nur über Funktionen.
- `activity_*`: nur eigene Zeilen lesen; Schreiben nur über die Sync-Funktionen.

### 5.3 RPC-Funktionen (alle `SECURITY DEFINER`, `search_path` fest gesetzt, `auth.uid()` geprüft)

- `handle_new_user()` (Trigger auf `auth.users`): legt Profil + Wallet an und bucht **10.000 Cent (100,00 Credits) `signup_bonus`**.
- `create_challenge(...)`: validiert alle Grenzen, setzt `status='open'`, erzeugt `invite_code` bei private. Der Ersteller tritt NICHT automatisch bei.
- `join_challenge(challenge_id)` / `join_challenge_by_code(code)`:
  - nur wenn `status='open'` und `now() < starts_at`
  - nicht doppelt, `max_participants` beachten
  - Wallet-Zeile mit `SELECT … FOR UPDATE` sperren, Saldo prüfen, Einsatz abziehen, `stake`-Buchung (negativ) schreiben, Teilnehmer anlegen – alles in einer Transaktion
- `leave_challenge(challenge_id)`: nur vor `starts_at`; Einsatz vollständig zurück (`refund`).
- `sync_workouts(jsonb)`: nimmt ein Array von Workouts, validiert (siehe 7), upsert. Maximal 500 Einträge pro Aufruf.
- `sync_daily_steps(jsonb)`: nimmt Tageswerte, validiert, upsert.
- `recompute_progress(challenge_id)`: berechnet `progress_value` aller Teilnehmer neu (siehe 6.2). Wird nach jedem Sync für die aktiven Challenges des Nutzers aufgerufen.
- `advance_challenges()`: Statusübergänge (siehe 6.1). Läuft per **`pg_cron` alle 5 Minuten**.
- `settle_challenge(challenge_id)`: Abrechnung (siehe 6.3).
- `delete_my_account()`: siehe Phase 5.

## 6. Kernlogik

### 6.1 Lebenszyklus einer Challenge

```
open ──(starts_at erreicht, genug Teilnehmer)──▶ active
open ──(starts_at erreicht, < min_participants)──▶ cancelled  (alle bekommen refund)
active ──(ends_at erreicht)──▶ settling
settling ──(ends_at + sync_grace_hours erreicht)──▶ settle_challenge() ──▶ settled
```

Nach `ends_at` können Nutzer noch während der Kulanzzeit synchronisieren, es zählen aber nur Aktivitäten, die **innerhalb von `starts_at` bis `ends_at`** begonnen haben.

### 6.2 Zieltypen und Fortschritt

| goal_type | Bedeutung | `progress_value` | Erfolg wenn |
|---|---|---|---|
| `run_single` | Ein einzelner Lauf ≥ Zieldistanz im Zeitraum | längster gültiger Lauf (m) | `progress_value >= target_value` |
| `run_total` | Summe aller Läufe im Zeitraum ≥ Zieldistanz | Summe gültiger Läufe (m) | `progress_value >= target_value` |
| `steps_daily` | An **jedem** Tag im Zeitraum ≥ Zielschritte | Anzahl erfüllter Tage | erfüllte Tage = Anzahl Tage im Zeitraum |

Tage für `steps_daily` werden in der `timezone` der Challenge bestimmt. Nur gültige Workouts (`is_valid = true`, `was_user_entered = false`) zählen.

### 6.3 Abrechnung (`settle_challenge`)

Ablauf in **einer Transaktion**, nur wenn `status = 'settling'` (sonst sofort zurückkehren → Idempotenz). Challenge-Zeile mit `FOR UPDATE` sperren.

1. `recompute_progress` ausführen, jedem Teilnehmer `success` oder `failed` zuweisen.
2. Berechnung (alles Integer, Cent):
   - `S` = Einsatz, `W` = Anzahl Gewinner, `L` = Anzahl Verlierer
   - `lost_pot = L * S`
   - `fee = floor(lost_pot * fee_bps / 10000)`
   - `distributable = lost_pot - fee`
   - **Falls W > 0:** `bonus = floor(distributable / W)`, `rounding = distributable - bonus * W`. Jeder Gewinner erhält `S + bonus` als `payout`. `fee` und `rounding` gehen als Buchung an `house`.
   - **Falls W = 0:** alle Einsätze gehen als `forfeit` an `house`. *(Produktentscheidung, später rechtlich prüfen.)*
3. Wallets der Gewinner gutschreiben, `payout_cents` setzen, `status='settled'`, `settled_at=now()`.

**Garantien:**
- Ein Gewinner bekommt **nie weniger als seinen Einsatz** zurück (die Gebühr wird nur auf den verlorenen Topf erhoben).
- **Summe aller Buchungen einer Challenge = 0** (alles Eingezahlte ist exakt verteilt). Das muss ein Test prüfen.

**Referenzbeispiel (muss als Test existieren):** 4 Teilnehmer × 1.000 Cent, 3 Gewinner, `fee_bps = 0` → `lost_pot = 1000`, `bonus = 333`, `rounding = 1`. Jeder Gewinner erhält 1.333 Cent, `house` erhält 1 Cent.

Weitere Pflicht-Tests: alle gewinnen (jeder bekommt genau S zurück), keiner gewinnt, Gebühr 10 %, doppelter Aufruf von `settle_challenge` bucht nichts doppelt, zu wenige Teilnehmer → cancelled + refund, Beitritt mit zu wenig Guthaben schlägt fehl, Beitritt nach Start schlägt fehl.

## 7. Health-Integration und Betrugsschutz

### 7.1 Berechtigungen
- iOS: nur Lesen von Workouts (Running), Distanz (Walking+Running) und Schritten. Texte in `NSHealthShareUsageDescription` auf Deutsch, ehrlich formuliert. Keine Schreibrechte.
- Android: nur Leserechte für `ExerciseSessionRecord`, `DistanceRecord`, `StepsRecord`. Health-Connect-Datenschutz-Activity einrichten (Pflicht für Play Store).
- Vor der System-Abfrage einen eigenen Erklär-Screen zeigen.

### 7.2 Daten lesen
- Lauf-Workouts: iOS `HKWorkoutActivityType.running`; Android `ExerciseSessionRecord` mit Typ Running, Distanz über `DistanceRecord` im Zeitraum der Session aggregieren.
- Schritte: **Tageswerte über die Aggregations-/Statistik-APIs** abfragen (diese entfernen Doppelzählungen zwischen iPhone und Watch bzw. zwischen Apps). NICHT einzelne Samples aufsummieren.
- **Manuelle Einträge ausschließen:** iOS `HKMetadataKeyWasUserEntered`, Android `metadata.recordingMethod == MANUAL_ENTRY`. Prüfe, ob die gewählte Bibliothek das für Statistik-Abfragen unterstützt. Falls nicht: sag mir Bescheid und schlag eine Lösung vor, statt Doppelzählungen in Kauf zu nehmen.
- Synchronisiert wird beim App-Start, beim Zurückkehren in den Vordergrund und per Pull-to-Refresh. Nur Daten der letzten 45 Tage.

### 7.3 Plausibilitätsregeln (serverseitig in `sync_workouts` / `sync_daily_steps`)
Ein Workout ist ungültig (`is_valid=false` + Grund), wenn:
- `was_user_entered = true` → `manual_entry`
- Durchschnittstempo schneller als 2:30 min/km → `too_fast` (Fahrrad/Auto)
- Durchschnittstempo langsamer als 15:00 min/km → `too_slow`
- `distance_m <= 0` oder `duration_s < 60` → `invalid_data`
- `start_at` in der Zukunft → `invalid_data`

Tagesschritte über 80.000 werden gespeichert, aber als verdächtig markiert und zählen nicht (eigene Spalte `is_valid`).

Ungültige Aktivitäten werden dem Nutzer in der App mit Grund angezeigt (Transparenz).

**Bekannte Grenze (dokumentieren, nicht lösen):** Die App lädt die Health-Daten hoch, ein manipulierter Client könnte also falsche Daten senden. Für virtuelle Credits akzeptabel. Vor echtem Geld braucht es zusätzliche Prüfungen (z. B. GPS-Routen, App Attest / Play Integrity). Lege dafür `docs/SECURITY_NOTES.md` an.

## 8. Screens (expo-router)

```
app/
  (auth)/welcome.tsx         Logo, Claim, „Loslegen“
  (auth)/sign-in.tsx         E-Mail eingeben → 6-stelliger Code (Supabase Email OTP)
  (auth)/verify.tsx          Code eingeben
  onboarding/name.tsx        Anzeigename
  onboarding/health.tsx      Erklärung + Health-Berechtigung anfragen
  (tabs)/index.tsx           Home
  (tabs)/challenges.tsx      Challenges entdecken
  (tabs)/wallet.tsx          Guthaben + Buchungen
  (tabs)/profile.tsx         Profil & Einstellungen
  challenge/[id].tsx         Details, Beitreten, Fortschritt, Ergebnis
  challenge/create.tsx       Challenge erstellen
  challenge/join.tsx         Beitritt per Einladungscode
```

**Home:** Große Zahl mit Fortschritt der wichtigsten aktiven Challenge (z. B. „3,25 / 5,00 km“), Fortschrittsbalken in Lime, Restzeit, Zeitpunkt der letzten Synchronisierung. Darunter weitere aktive Challenges als kompakte Karten. Leerer Zustand: „Noch keine Challenge“ + Button „Challenge finden“.

**Challenge-Detail:** Ziel, Zeitraum, Einsatz, Anzahl Teilnehmer, aktueller Topf, Regeln in Klartext (inkl. „Manuelle Einträge zählen nicht“), eigener Fortschritt, Teilnehmerliste (Name + geschafft/offen, keine Gesundheitsdetails anderer). Beitreten nur über ein Bestätigungs-Sheet: „Du setzt 10,00 Credits. Erreichst du dein Ziel, bekommst du sie zurück plus deinen Anteil am Topf.“ Nach der Abrechnung: Ergebnis + Auszahlung.

**Erstellen:** Zieltyp, Zielwert (Presets: 3 / 5 / 10 / 21,1 km; 8.000 / 10.000 / 12.000 Schritte), Zeitraum, Einsatz (Presets 1 / 5 / 10 / 20), öffentlich/privat. Validierung mit zod (gleiche Grenzen wie in der DB).

**Wallet:** Großer Saldo, Liste aller Buchungen mit verständlichen deutschen Bezeichnungen.

**Profil:** Name ändern, Health-Verbindungsstatus + „Erneut verbinden“, Datenschutz, Impressum (Platzhalter-Screens), Abmelden, **Konto löschen**.

**Überall sichtbar (Wallet + Beitritts-Sheet):** „Testphase: Credits sind virtuell und können nicht ausgezahlt werden.“

Jeder Screen braucht: Lade-, Leer- und Fehlerzustand.

## 9. Design-System

Lege alle Tokens in `src/theme/` an; keine Farbwerte direkt in Komponenten.

```ts
colors: {
  bg: '#0A0A0A',
  surface: '#161616',
  surfaceRaised: '#1F1F1F',
  border: '#2A2A2A',
  text: '#FFFFFF',
  textSecondary: '#A1A1A1',
  textMuted: '#6B6B6B',
  accent: '#C6FF00',      // Lime – sparsam: Fortschritt, primärer Button, Erfolg
  onAccent: '#0A0A0A',    // Text auf Lime-Flächen
  danger: '#FF4D4D',
}
spacing: 4, 8, 12, 16, 24, 32, 48
radius: 12 (Karten), 999 (Buttons/Pills)
```

- Schrift: Inter. Große Kennzahlen 56–72 pt, Gewicht 800, `fontVariant: ['tabular-nums']`.
- Labels in Großbuchstaben mit Laufweite (z. B. „TODAY'S CHALLENGE“) nur für kleine Überschriften.
- Primärer Button: Lime-Fläche, schwarzer Text, volle Breite. Sekundär: Rand, kein Fill.
- Nur dunkles Design im MVP. Keine Verläufe, keine Schatten, keine Illustrationen, Animationen nur dezent (Fortschrittsbalken, Sheet).
- Mindestgröße für Touch-Ziele 44 pt, Texte mit ausreichendem Kontrast, `accessibilityLabel` an allen Icons/Buttons.
- Slogan auf dem Welcome-Screen: **„PUSH.“** / „YOUR GOALS. YOUR STAKES.“

## 10. Projektstruktur

```
app/                    Screens (expo-router)
src/
  components/           wiederverwendbare UI-Bausteine
  features/             challenges/, wallet/, health/, auth/ (Hooks, Queries, Logik)
  lib/supabase.ts       Supabase-Client (Session in expo-secure-store)
  lib/money.ts          Formatierung Cent → Anzeige
  theme/
  config/app.ts         App-Name, Grenzen, Presets
  i18n/de.ts            ALLE UI-Texte zentral
supabase/
  migrations/
  tests/                pgTAP-Tests
  seed.sql              Testnutzer + Beispiel-Challenges
docs/
  SECURITY_NOTES.md
  SETUP.md              Schritt-für-Schritt-Anleitung für mich
```

## 11. Umsetzung in Phasen

Arbeite die Phasen nacheinander ab. **Nach jeder Phase anhalten** und berichten: was gebaut wurde, wie ich es teste, offene Punkte.

**Phase 0 – Fundament**
Expo-Projekt (TypeScript strict, expo-router, expo-dev-client), ESLint/Prettier, Theme, Basiskomponenten (Screen, Text, Button, Card, ProgressBar), Supabase CLI lokal, `.env.example`, `docs/SETUP.md` (inkl. wie ich einen Development Build für mein Handy erstelle).
*Fertig, wenn:* App startet im Dev Build mit Welcome-Screen im Design; `npm run typecheck`, `npm run lint`, `npm test` laufen.

**Phase 1 – Konto**
Auth per Email OTP, Session-Persistenz, Profil + Wallet + Startguthaben per Trigger, Onboarding (Name), Tab-Navigation mit Platzhaltern, Abmelden.
*Fertig, wenn:* Neuer Nutzer kann sich registrieren, sieht 100,00 Credits im Wallet.

**Phase 2 – Challenges & Wallet**
Alle Tabellen, RLS, Funktionen `create/join/leave/join_by_code`, Screens Entdecken, Detail, Erstellen, Beitreten per Code, Wallet mit Buchungen. Seed-Daten. pgTAP-Tests für Beitritt/Austritt/Guthaben.
*Fertig, wenn:* Zwei Testnutzer können derselben Challenge beitreten, Guthaben wird korrekt abgezogen, alle Tests grün.

**Phase 3 – Health-Daten**
Berechtigungen iOS + Android, Lesen von Läufen und Tagesschritten, Sync-Funktionen mit Plausibilitätsregeln, `recompute_progress`, Fortschritt auf Home + Detail, Anzeige ungültiger Aktivitäten mit Grund.
*Fertig, wenn:* Ein echter Lauf auf meinem Handy erscheint nach Sync als Fortschritt; ein manuell eingetragener Lauf wird als ungültig angezeigt.

**Phase 4 – Abrechnung**
`advance_challenges`, `settle_challenge`, `pg_cron`-Job, Ergebnisanzeige, Auszahlungsbuchungen. Alle Pflicht-Tests aus 6.3. Ein Entwickler-Skript (`supabase/scripts/simulate_challenge.sql`), mit dem ich eine Challenge im Zeitraffer bis zur Abrechnung durchspielen kann.
*Fertig, wenn:* Referenzbeispiel und alle Randfälle als Tests grün sind; Simulation funktioniert.

**Phase 5 – Feinschliff & Store-Pflichten**
Konto löschen in der App (Pflicht bei Apple; Profil/Aktivitäten löschen, Ledger anonymisieren), lokale Erinnerungen per `expo-notifications` (z. B. „Noch 2 km bis zu deinem Ziel – noch 3 Stunden“), App-Icon/Splash im Design, Datenschutz-/Impressum-Platzhalter, Fehler-Logging-Konzept, finale Durchsicht aller Lade-/Leer-/Fehlerzustände.
*Fertig, wenn:* Ich die App einem Freund zum Testen geben kann.

**Nicht bauen (später):** echte Zahlungen, Auszahlungen, KYC/Altersprüfung, Gym/Schwimmen/andere Sportarten, Social Feed, Chat, Web-Version, eigenes GPS-Tracking.

## 12. Arbeitsweise

- Wenn etwas in dieser Spezifikation unklar, widersprüchlich oder technisch nicht umsetzbar ist: **frag mich, bevor du davon abweichst.**
- Kleine, nachvollziehbare Commits mit klaren Nachrichten.
- Ich bin kein erfahrener Entwickler: Erkläre am Ende jeder Phase in einfachen Worten, was ich tun muss (Befehle zum Kopieren), um es auf meinem Handy zu testen.
- Halte `docs/SETUP.md` immer aktuell.
