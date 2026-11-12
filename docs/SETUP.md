# PUSH – Einrichtung Schritt für Schritt

Diese Anleitung ist für Windows mit PowerShell geschrieben. Alle Befehle kannst du kopieren und im
Projektordner ausführen. Stand: **Phase 5 (Kontolöschung, Rechtliches, Supabase Cloud, Play-Store-Build)**.

Projektordner öffnen:

```powershell
cd "$HOME\Desktop\PUSH"
```

---

## 1. Was installiert sein muss

| Programm                                                          | Wofür                       | Prüfen mit         |
| ----------------------------------------------------------------- | --------------------------- | ------------------ |
| [Node.js](https://nodejs.org) 22.13+ oder 24.3+                   | führt alle Werkzeuge aus    | `node -v`          |
| [Git](https://git-scm.com)                                        | Versionsverwaltung          | `git --version`    |
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | lokale Supabase-Datenbank   | `docker --version` |
| EAS CLI (`npm install --global eas-cli`)                          | baut die App fürs Handy     | `eas --version`    |
| Kostenloses [Expo-Konto](https://expo.dev/signup)                 | wird von EAS Build benötigt | –                  |

Auf diesem PC waren bei der Einrichtung vorhanden: Node.js 24.22.0, Git 2.55, Docker 29.8.
Die EAS CLI und das Expo-Konto musst du noch selbst einrichten (siehe Abschnitt 5).

> **Expo Go funktioniert für PUSH nicht.** Die App braucht später Apple Health / Health Connect,
> das geht nur mit einem eigenen „Development Build“ (Abschnitt 5).

---

## 2. Projekt einrichten (einmalig, und nach jedem `git pull`)

```powershell
npm install
```

Danach die Datei für lokale Einstellungen anlegen (einmalig):

```powershell
Copy-Item .env.example .env
```

Die Datei `.env` wird nie ins Git eingecheckt. Dort stehen die Adresse und der öffentliche Schlüssel
des lokalen Supabase (Abschnitt 4). **Ohne gültige `.env` startet die App nicht** – sie zeigt dann
einen roten Fehlerbildschirm mit dem Hinweis auf `EXPO_PUBLIC_SUPABASE_URL`.

---

## 3. Prüfen, ob alles in Ordnung ist

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npm test
```

Alle drei Befehle müssen ohne Fehler durchlaufen. `npm run format` formatiert den Code automatisch,
falls `npm run lint` Formatierungsfehler meldet.

---

## 4. Lokales Supabase (Datenbank auf deinem PC)

1. **Docker Desktop** über das Startmenü starten und warten, bis unten links „Engine running“ steht.
2. Supabase starten:

   ```powershell
   npm run db:start
   ```

   Beim allerersten Mal werden mehrere GB heruntergeladen, das dauert einige Minuten.

3. Adressen und Schlüssel anzeigen:

   ```powershell
   npm run db:status
   ```

   - **Studio** (Tabellen ansehen): <http://127.0.0.1:54323>
   - **Mailpit** (hier landen ab Phase 1 die Login-Codes statt echter E-Mails): <http://127.0.0.1:54324>
   - Den Wert bei **Publishable** (beginnt mit `sb_publishable_`) trägst du in `.env` bei
     `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=` ein.
   - Der Wert bei **Secret** (`sb_secret_…`) gehört **niemals** in die App oder in `.env`.

4. Datenbank auf den neuesten Stand bringen (nach jedem `git pull` mit neuen Dateien in
   `supabase/migrations/`). **Achtung: löscht alle lokalen Testdaten und Testkonten.**

   ```powershell
   npm run db:reset
   ```

   Danach sind die **Testdaten aus `supabase/seed.sql`** geladen:

   | Testkonto (E-Mail)  | Name  | Guthaben      | dabei bei                                                         |
   | ------------------- | ----- | ------------- | ----------------------------------------------------------------- |
   | `anna@example.com`  | Anna  | 15,00 Credits | 5 km am Stück, Halbmarathon-Woche, Büro-Lauftreff, Großer Einsatz |
   | `ben@example.com`   | Ben   | 75,00 Credits | 5 km am Stück, 10.000 Schritte täglich, Büro-Lauftreff, Solo-Ziel |
   | `clara@example.com` | Clara | 80,00 Credits | Halbmarathon-Woche                                                |

   Die private Challenge „Büro-Lauftreff“ hat den Einladungscode **`LAUF26`**. Außerdem gibt es
   „Großer Einsatz“ (50,00) und „10 km am Wochenende“ (20,00, noch niemand dabei). Alle
   Beispiel-Challenges starten 1–3 Tage nach dem Reset, man kann also noch beitreten. Ben hat
   außerdem das Solo-Ziel „Mein 10-km-Lauf“ (Einsatz 5,00).

5. Datenbank-Tests ausführen (pgTAP, prüft Startguthaben, Zugriffsrechte usw.):

   ```powershell
   npm run db:test
   ```

6. Supabase wieder beenden (die Daten bleiben erhalten):

   ```powershell
   npm run db:stop
   ```

**Hinweise**

- In `supabase/config.toml` sind Realtime, Storage, Edge Functions und Analytics abgeschaltet. PUSH
  braucht sie nicht, und so startet Supabase schneller und braucht weniger Arbeitsspeicher.
- **Echtes Handy (wichtig):** `127.0.0.1` meint auf dem Handy das Handy selbst. Damit die
  App dein lokales Supabase erreicht, muss in `.env` die IP-Adresse deines PCs stehen, z. B.
  `EXPO_PUBLIC_SUPABASE_URL=http://192.168.178.20:54321`. Die Adresse findest du mit `ipconfig`
  unter „IPv4-Adresse“. PC und Handy müssen im selben WLAN sein. Nach einer Änderung an `.env`
  den Entwicklungsserver mit `npx expo start --clear` neu starten.
- **Anmeldecodes:** Das lokale Supabase verschickt keine echten E-Mails. Jede Code-E-Mail landet in
  **Mailpit** am PC: <http://127.0.0.1:54324>. Du kannst also eine beliebige, auch ausgedachte
  Adresse verwenden (z. B. `test1@example.com`).
- Ändert sich `supabase/config.toml` oder etwas in `supabase/templates/`, Supabase einmal neu
  starten: `npm run db:stop`, dann `npm run db:start`.
- `npm run db:types` erzeugt `src/lib/database.types.ts` neu (TypeScript-Typen der Datenbank).
  Das mache ich nach jeder Migration; du brauchst es normalerweise nicht.

---

## 5. Development Build für dein Handy

Ein Development Build ist deine eigene Test-Version der App. Du installierst sie **einmal** auf dem
Handy. Danach lädt sie den aktuellen Code jedes Mal frisch von deinem PC – Änderungen am Code
erscheinen also ohne neuen Build.

### 5.1 Einmalig: Expo-Konto und EAS

1. Kostenloses Konto anlegen: <https://expo.dev/signup>
2. EAS CLI installieren und anmelden (öffnet den Browser):

   ```powershell
   npm install --global eas-cli
   ```

   ```powershell
   eas login
   ```

3. Das Projekt mit deinem Expo-Konto verbinden:

   ```powershell
   eas init
   ```

   Die Frage, ob ein neues Projekt angelegt werden soll, mit **Y** bestätigen. `eas init` trägt eine
   `projectId` in `app.json` ein. Diese Änderung bitte einchecken:

   ```powershell
   git add app.json
   ```

   ```powershell
   git commit -m "chore: link EAS project"
   ```

> **App-Kennung:** In `app.json` steht die technische App-Kennung `com.pushchallenge.app` (bei
> `ios.bundleIdentifier` und `android.package`). Sie ist für Nutzer unsichtbar und wurde am
> 11.11.2026 so festgelegt. Nach einer Veröffentlichung im Store lässt sie sich nicht mehr ändern.

### 5.2 Android

```powershell
eas build --platform android --profile development
```

- Frage „Generate a new Android Keystore?“ mit **Y** beantworten.
- Der Build läuft in der Cloud. Im kostenlosen Tarif kann die Warteschlange zu Stoßzeiten über eine
  Stunde dauern; du kannst das Terminal offen lassen oder den Link im Browser verfolgen.
- Am Ende erscheint ein **QR-Code** und ein Link. Auf dem Android-Handy öffnen, die APK-Datei
  herunterladen und installieren. Android fragt dabei einmal, ob die Installation aus dieser Quelle
  erlaubt werden soll – zulassen.

### 5.3 iPhone

Für ein echtes iPhone verlangt Apple eine Mitgliedschaft im **Apple Developer Program
(99 USD pro Jahr)**. Unter Windows gibt es keinen kostenlosen Weg, weil iOS-Apps ohne Mac nur über
EAS Build gebaut werden können. Das widerspricht der Vorgabe „nur kostenlose Tarife“ und ist ein
offener Punkt (siehe Abschnitt 7).

Mit Mitgliedschaft:

1. iPhone registrieren:

   ```powershell
   eas device:create
   ```

   Den angezeigten Link/QR-Code auf dem iPhone öffnen und das Profil installieren
   (Einstellungen → „Profil geladen“).

2. Build starten und bei der Frage nach dem Apple-Konto anmelden. EAS legt Zertifikate und Profile
   automatisch an:

   ```powershell
   eas build --platform ios --profile development
   ```

   Fragt EAS, ob die App nur Standard-Verschlüsselung nutzt („standard/exempt encryption“), mit
   **Y** antworten – PUSH verwendet nur die übliche HTTPS-Verbindung.

3. Den QR-Code am Ende mit dem iPhone scannen und die App installieren.
4. Auf dem iPhone den Entwicklermodus einschalten: Einstellungen → Datenschutz & Sicherheit →
   Entwicklermodus → an (das iPhone startet neu).

Ein neu registriertes iPhone kann bei frischen Apple-Mitgliedschaften erst nach 24–72 Stunden
nutzbar sein.

### 5.4 App starten

1. PC und Handy ins selbe WLAN bringen.
2. Auf dem PC:

   ```powershell
   npx expo start
   ```

3. Den QR-Code aus dem Terminal mit der Kamera des Handys scannen – oder die installierte App
   **PUSH** öffnen und den angezeigten Server antippen.
4. Erwartet: schwarzer Bildschirm mit **„PUSH.“**, darunter „YOUR GOALS. YOUR STAKES.“ und unten
   ein lime-grüner Button **„Loslegen“**. Wie es weitergeht, steht in Abschnitt 5.6.
5. Beenden: im Terminal `Strg + C`.

**Wenn das Handy keine Verbindung bekommt**

- Beim ersten Start fragt die Windows-Firewall nach Node.js – für **private Netzwerke** zulassen.
- Bleibt nach „Code senden“ die Meldung „Keine Verbindung zum Server“: Prüfe die IP in `.env`
  (Abschnitt 4) und öffne im Browser **des Handys** `http://<deine-PC-IP>:54321`. Kommt dort keine
  Antwort, blockiert die Windows-Firewall den Port. Einmalig in einer PowerShell **als
  Administrator** freigeben:

  ```powershell
  New-NetFirewallRule -DisplayName "Supabase lokal" -Direction Inbound -Protocol TCP -LocalPort 54321 -Action Allow -Profile Private
  ```

- Cache leeren und neu starten: `npx expo start --clear`
- Notlösung bei gesperrtem WLAN (z. B. Gastnetz): `npx expo start --tunnel`

### 5.5 Wann brauche ich einen neuen Build?

Nur wenn sich „native“ Teile ändern – ich sage es dir dann ausdrücklich:

- eine neue native Bibliothek kommt dazu (z. B. Health in Phase 3, Benachrichtigungen in Phase 5),
- Einstellungen in `app.json` ändern sich (Berechtigungen, Icon, Splash),
- das Expo SDK wird aktualisiert.

Bisher nötige Builds: einer in Phase 0, ein neuer in Phase 1 (wegen `expo-secure-store`, das die
Anmeldung sicher auf dem Handy speichert), ein neuer in **Phase 3** (wegen der nativen Module für
Health Connect und HealthKit sowie neuer Berechtigungen in `app.json`). Ein älterer Build kann die
Health-Daten nicht lesen; die App zeigt dann „Diese App-Version kann keine Gesundheitsdaten lesen“.
Phase 2 brauchte **keinen** neuen Build (`@expo/vector-icons` ist reines JavaScript), Phase 4 und
Phase 5 ebenfalls nicht (nur JavaScript und Datenbank – der Phase-3-Build bleibt gültig). Für den
Play Store brauchst du zusätzlich einen **Produktions-Build** (Abschnitt 9).

Für normale Code-Änderungen reicht `npx expo start`. Den Phase-3-Build für Android startest du im
Projektordner mit:

```powershell
eas build --platform android --profile development
```

Der Build verwendet das bestehende Expo-Projekt und Konto. Expo Go kann die nativen Health-Module
nicht laden. Der kostenlose EAS-Tarif enthält laut Expo derzeit bis zu 15 Android- und 15 iOS-Builds
(Stand November 2026, aktuelle Zahlen: <https://expo.dev/pricing>).

---

### 5.6 Konto testen (Phase 1)

Voraussetzungen: Development Build mit `expo-secure-store` (seit Phase 1, siehe 5.5), Docker
läuft, `npm run db:start`, `.env` mit der IP deines PCs, `npx expo start`.

1. **Loslegen** → E-Mail eingeben (z. B. `test1@example.com`) → **Code senden**.
2. Am PC <http://127.0.0.1:54324> öffnen, die E-Mail „Dein Anmeldecode“ anklicken, den
   6-stelligen Code ablesen.
3. Code in der App eingeben – nach der 6. Ziffer meldet sie dich automatisch an.
4. Anzeigenamen wählen (3–24 Zeichen) → **Weiter**.
5. Erwartet: Tab **Home** mit „Noch keine Challenge“. Im Tab **Wallet** steht **100,00 Credits**.
6. App komplett schließen und neu öffnen: Du bist weiterhin angemeldet und landest direkt auf Home.
7. Tab **Profil** → **Abmelden**: zurück auf dem Welcome-Screen.
8. Mit derselben E-Mail erneut anmelden: Kein Namens-Schritt mehr, das Guthaben bleibt bei
   100,00 Credits (der Bonus wird pro Konto nur einmal gebucht).

In **Studio** (<http://127.0.0.1:54323>) siehst du unter „Table Editor“ die Tabellen `profiles`,
`wallets` und `ledger_entries` mit deinem Konto und der Buchung `signup_bonus`.

### 5.7 Challenges testen (Phase 2)

Voraussetzungen wie in 5.6, dazu einmal `npm run db:reset` (lädt die Testdaten aus Abschnitt 4).
Für den Test „zwei Nutzer in derselben Challenge“ meldest du dich nacheinander mit zwei Konten an
(Profil → Abmelden → mit der anderen E-Mail anmelden). Die Codes stehen jeweils in Mailpit.

1. **Als neues Konto** (z. B. `test1@example.com`) anmelden, Namen wählen.
2. Tab **Ranked** (hieß bis Phase 3 „Challenges“): Unter „Offene Challenges“ stehen die
   Beispiel-Challenges.
3. „5 km am Stück“ antippen → Ziel, Zeitraum, Einsatz, Teilnehmer, Topf und Regeln prüfen.
4. **Beitreten** → im Sheet steht „Du setzt 10,00 Credits …“ und der Testphasen-Hinweis →
   **Jetzt beitreten**.
5. Erwartet: „Dabei“-Markierung, Topf steigt um 10,00, die Teilnehmerliste zeigt dich, Anna und Ben
   (jeweils „offen“). Im Tab **Wallet**: **90,00 Credits** und die Buchungen „Einsatz – 5 km am
   Stück −10,00“ und „Startguthaben +100,00“. Auf **Home** erscheint die Challenge.
6. **Challenge verlassen** → **Verlassen**: Guthaben wieder 100,00, Buchung „Erstattung +10,00“.
   Erneut beitreten ist danach nicht möglich (Hinweis erscheint).
7. **Code eingeben** → `LAUF26` → **Challenge anzeigen** → **Beitreten** → bestätigen. Jetzt siehst
   du den privaten „Büro-Lauftreff“ mit Einladungscode und Button **Code teilen**.
8. **Erstellen** → z. B. „Tägliche Schritte“, „10.000 Schritte“, Start „Morgen“, „7 Tage“,
   Einsatz „5,00“, **Privat** → **Challenge erstellen**. Die neue Challenge hat einen eigenen
   Code. Du bist als Ersteller **nicht** automatisch dabei – tritt selbst bei.
9. **Zweites Konto:** Abmelden, mit `test2@example.com` anmelden, Namen wählen, über **Code
   eingeben** mit dem Code aus Schritt 8 beitreten. Beide Konten haben jetzt je 5,00 weniger, und in
   der Challenge stehen zwei Personen.
10. **Zu wenig Guthaben:** als `anna@example.com` anmelden (15,00 Credits) und „10 km am
    Wochenende“ (Einsatz 20,00) beitreten wollen. Erwartet: „Dein Guthaben reicht für diesen
    Einsatz nicht aus.“, das Guthaben bleibt bei 15,00.

### 5.8 Health-Daten testen (Phase 3, Android)

Voraussetzungen: der neue Development Build aus 5.5 ist auf dem Handy, Docker läuft,
`npm run db:start`, `npm run db:reset`, `.env` mit der IP deines PCs, `npx expo start`.
Health Connect ist ab Android 14 Teil des Systems. Bei Android 13 und älter installierst du die App
**Health Connect** aus dem Play Store. Außerdem muss eine App Läufe dort eintragen (z. B. die Uhr-App,
Google Fit, Samsung Health, Strava – je nach Gerät muss die Weitergabe an Health Connect in dieser
App eingeschaltet sein).

1. **Verbinden:** Neues Konto anlegen (oder ein bestehendes nach dem Update öffnen). Nach dem Namen
   erscheint „Automatisch geprüft statt behauptet“ → **Health Connect verbinden** → im
   System-Dialog **Alles zulassen** (Läufe, Distanz, Schritte). Bei „Später“ erscheint auf Home ein
   Hinweis mit demselben Knopf; im Profil gibt es **Erneut verbinden** und **Jetzt synchronisieren**.
2. **Challenge starten lassen:** Challenges starten erst um 0:00 Uhr des Folgetags; seit Phase 4
   setzt die Datenbank sie dann automatisch auf „läuft“ (alle 5 Minuten). Zum sofortigen Testen
   verlegst du den Start in die Vergangenheit. In Studio (<http://127.0.0.1:54323>) → SQL Editor,
   einmal ausführen (nach dem Beitritt zu „5 km am Stück“):

   ```sql
   update public.challenges
      set starts_at = now() - interval '1 day', ends_at = now() + interval '6 days'
    where title = '5 km am Stück';
   select public.advance_challenges();
   ```

3. **Echter Lauf:** Einen Lauf von mindestens 5 km aufzeichnen (Uhr oder Lauf-App, die an Health
   Connect schreibt). App öffnen bzw. auf Home nach unten ziehen. Erwartet: Große Zahl
   „5,02 / 5,00“ mit Balken, „Ziel erreicht“ und „Zuletzt synchronisiert: …“. In der Challenge
   unter **Deine Läufe im Zeitraum**: der Lauf mit „zählt“.
4. **Manueller Lauf:** In einer App einen Lauf **von Hand eintragen** (nicht aufzeichnen) – er muss
   in Health Connect landen. Nach dem Synchronisieren steht er in der Liste mit **„zählt nicht“** und
   dem Grund „Manuell eingetragen – manuelle Einträge zählen nie.“; der Fortschritt ändert sich nicht.
5. **Schritte:** Challenge „10.000 Schritte täglich“ ebenso auf „läuft“ setzen (`title` im SQL
   anpassen). Pro Tag erscheint „geschafft“ oder „zu wenig“.

**Wichtig zu wissen**

- **Manuelle Schritte:** Health Connect kann Schritte nicht „ohne die manuellen“ zählen. Enthält eine
  App an einem Tag manuell eingetragene Schritte, lässt PUSH **diese App für den ganzen Tag weg**.
  Dann können auch echte Schritte dieser App fehlen (Sicherheit vor Genauigkeit).
- **Rückblick:** Android erlaubt nur die 30 Tage **vor** der ersten Verbindung. Ältere Tage werden
  nie mit 0 überschrieben, sondern gar nicht erst gesendet.
- **Zwei Verweigerungen:** Lehnst du den System-Dialog zweimal ab, zeigt Android ihn nicht mehr.
  Erlaube die Rechte dann in der App **Health Connect** → App-Berechtigungen → PUSH.
- **iPhone:** Der Code für Apple Health ist vorhanden, wurde aber noch **nicht auf einem Gerät
  getestet** (siehe Abschnitt 7 und `docs/SECURITY_NOTES.md`).

### 5.9 Solo, Ranked und Abrechnung testen (Phase 4)

Voraussetzungen wie in 5.7. **Kein neuer Build nötig** – der Phase-3-Build reicht.

Die App hat jetzt zwei getrennte Bereiche (Tabs):

- **Solo:** Du setzt dir selbst ein Ziel und einen Einsatz. Geschafft → Einsatz zurück. Nicht
  geschafft → der Einsatz geht an das Haus-Konto. Der Einsatz wird schon beim Setzen des Ziels
  abgebucht (nach einem Bestätigungs-Sheet).
- **Ranked:** gemeinsamer Topf gegen andere. Wer es schafft, bekommt den Einsatz zurück plus einen
  gleichen Anteil an den Einsätzen der anderen. Ab dem Start zeigt die Challenge eine
  **Rangliste** (nur Reihenfolge und „geschafft/offen“, keine Kilometer der anderen; ausgezahlt wird
  nicht nach Platz).

**A. Solo in der App**

1. Tab **Solo** → **Solo-Ziel setzen** → z. B. „Ein Lauf“, „5 km“, Einsatz „5,00“ →
   **Weiter zum Einsatz**.
2. Im Sheet steht „Du setzt 5,00 Credits auf dich selbst …“ → **Einsatz setzen**.
3. Erwartet: Detailseite des Ziels mit Pill „Solo“, ohne Teilnehmerliste und Topf. Im Wallet
   „Einsatz −5,00“. Bis zum Start kannst du noch aussteigen (Einsatz zurück).

**B. Abrechnung im Zeitraffer (Simulation)**

Das Skript spielt eine Ranked-Challenge und ein Solo-Ziel mit den Testkonten bis zur Abrechnung
durch (Anna und Ben schaffen 5 km, Clara trägt 10 km von Hand ein und verliert; Bens Solo-Ziel
„10 km insgesamt“ scheitert mit 9,1 km). Es ändert nur die Zeitpunkte – alle Buchungen machen die
echten Datenbank-Funktionen.

```powershell
npm run db:reset
```

```powershell
Get-Content supabase\scripts\simulate_challenge.sql | docker exec -i supabase_db_push psql -U postgres -d postgres
```

Erwartet am Ende: Anna und Ben bekommen je **7,50** (5,00 Einsatz + 2,50 von Clara), Clara 0,
Bens Solo-Einsatz von 3,00 geht als „forfeit“ ans Haus, die Summe je Challenge ist **0**, und der
zweite Aufruf von `settle_challenge` liefert `f` (nichts passiert doppelt).

In der App als `anna@example.com` anmelden: Tab **Ranked** → „Abgeschlossen“ → „Simulation 5 km“
zeigt **„Ziel geschafft! Dir wurden 7,50 Credits gutgeschrieben.“** und die Rangliste. Im Wallet
steht „Auszahlung +7,50“. Als `ben@example.com`: Tab **Solo** → „Abgeschlossen“ →
„Simulation Solo“ zeigt **„Ziel nicht geschafft. Dein Einsatz ist verfallen.“**

**C. Eine eigene Challenge von Hand abrechnen** (SQL Editor in Studio)

```sql
-- 1. Zeitraum in die Vergangenheit legen und Kulanzzeit abschalten
update public.challenges
   set starts_at = now() - interval '2 days', ends_at = now() - interval '1 minute',
       sync_grace_hours = 0
 where title = 'DEIN TITEL';
-- 2. Starten (oder absagen), Zeitraum beenden und abrechnen – alles in einem Aufruf
select public.advance_challenges();
```

Ohne dein Zutun passiert dasselbe automatisch alle 5 Minuten (`pg_cron`): Start um 0:00 Uhr
(zu wenige Teilnehmer → abgesagt, alle bekommen den Einsatz zurück), Ende nach dem letzten Tag,
Abrechnung 24 Stunden später (Zeit für späte Synchronisierungen).

**Haus-Konto und Gebühr**

- Das Haus-Konto gibt es nur im Ledger (`account = 'house'`). Nutzer sehen diese Buchungen nie.
  Saldo ansehen:

  ```sql
  select type, sum(amount_cents) from public.ledger_entries where account = 'house' group by type;
  ```

- Die Gebühr ist ein Konfigurationswert, Standard **0**. Sie gilt nur für Ranked, nur auf die
  verlorenen Einsätze, und wird beim Erstellen einer Challenge fest übernommen (spätere Änderungen
  betreffen nur neue Challenges). Ändern, z. B. auf 10 %:

  ```sql
  update private.settings set fee_bps = 1000;
  ```

- Rundung immer zugunsten des Hauses: Gewinner bekommen den abgerundeten Anteil, übrige Cent gehen
  als „rounding“ ans Haus.

### 5.10 Konto löschen und Rechtliches testen (Phase 5)

Voraussetzungen wie in 5.7 (`npm run db:reset`). **Kein neuer Build nötig.**

1. Als `anna@example.com` anmelden. Anna ist bei offenen Challenges dabei (Einsatz wird erstattet).
2. Tab **Profil** → **Datenschutz**: Die Datenschutzerklärung erscheint, Platzhalter stehen in
   eckigen Klammern. Zurück, dann **Impressum** ebenso.
3. **Konto löschen** → das Sheet erklärt, was passiert. **Abbrechen** schließt es, nichts passiert.
4. Erneut **Konto löschen** → **Endgültig löschen**. Erwartet: zurück auf dem Welcome-Screen.
5. Als `ben@example.com` anmelden → Ranked → „5 km am Stück“: In der Teilnehmerliste fehlt Anna
   (sie wurde vor dem Start erstattet und ist ausgestiegen).
6. In Studio prüfen: `auth.users` und `profiles` enthalten Anna nicht mehr, ihre Buchungen in
   `ledger_entries` stehen noch da, aber mit leerem `user_id`.
7. Mit `anna@example.com` neu anmelden ergibt ein **neues** Konto mit 100,00 Credits.

---

## 6. Befehle im Überblick

| Befehl              | Was er tut                                        |
| ------------------- | ------------------------------------------------- |
| `npx expo start`    | Entwicklungsserver für den Development Build      |
| `npm run typecheck` | prüft die TypeScript-Typen                        |
| `npm run lint`      | prüft Code-Stil und typische Fehler               |
| `npm run format`    | formatiert den Code mit Prettier                  |
| `npm test`          | führt die automatischen Tests aus                 |
| `npm run db:start`  | startet das lokale Supabase (Docker muss laufen)  |
| `npm run db:status` | zeigt Adressen und Schlüssel des lokalen Supabase |
| `npm run db:reset`  | Datenbank neu aufbauen (löscht lokale Testdaten)  |
| `npm run db:test`   | führt die Datenbank-Tests (pgTAP) aus             |
| `npm run db:types`  | erzeugt die TypeScript-Typen der Datenbank neu    |
| `npm run db:stop`   | beendet das lokale Supabase                       |

---

## 7. Gut zu wissen

- **App-Name:** steht nur in `src/config/app.ts`. Von dort übernehmen ihn die App-Texte und der
  Name unter dem App-Icon.
- **Texte:** alle sichtbaren Texte stehen in `src/i18n/de.ts`.
- **Farben und Abstände:** stehen in `src/theme/`. In Komponenten werden keine Farbwerte direkt
  geschrieben.
- **iPhone ohne Bezahlkonto:** unter Windows nicht möglich. Möglichkeiten: Apple Developer Program
  abschließen, zunächst nur mit Android testen, oder einen Mac mit Xcode nutzen (dort geht ein
  7 Tage gültiger Test-Build mit kostenloser Apple-ID). Spätestens vor Phase 3 (Health-Daten auf
  dem echten Gerät) muss das entschieden sein.
- **Startguthaben:** Konto, Profil, Wallet und die 100,00 Credits entstehen schon, wenn jemand zum
  ersten Mal einen Code für eine E-Mail-Adresse anfordert – nicht erst bei der Eingabe des Codes.
  So arbeitet Supabase. Bei virtuellen Credits ist das unkritisch, vor echtem Geld wird es
  geprüft.
- **Anzeigename:** Bis du einen Namen wählst, heißt dein Profil z. B. „Läufer 4821“. Die App lässt
  dich erst nach der Namenswahl weiter.
- **Verlassen ist endgültig:** Wer eine Challenge vor dem Start verlässt, bekommt den Einsatz
  zurück, kann aber nicht erneut beitreten. Grund: Pro Person und Challenge darf es nur eine
  Einsatz-Buchung geben (Schutz vor Doppelbuchungen, siehe CLAUDE.md 5.1).
- **Ranked mit nur einer Person:** Eine Ranked-Challenge braucht beim Start mindestens 2 Personen,
  sonst wird sie abgesagt und der Einsatz erstattet. Die Abrechnung beherrscht auch den Fall „nur
  eine Person“ (gewinnt → Einsatz zurück, verliert → Haus); er tritt aber nur ein, wenn man
  `min_participants` per SQL auf 1 setzt.
- **Challenges starten immer um 0:00 Uhr** (Zeitzone Europe/Berlin) und dauern ganze Tage. So ist
  bei „Tägliche Schritte“ jeder Tag vollständig. Frühester Start ist morgen, spätester in 30 Tagen.
- **Konten löschen:** in der App unter Profil → **Konto löschen**. Für Löschanfragen per E-Mail
  (ohne App) im SQL Editor: `select private.delete_account((select id from auth.users where email = 'name@example.com'));`
  Nicht in Studio direkt bei `auth.users` löschen – dann fehlen Erstattungen und Verfall-Regeln.
- **Rechtstexte:** stehen doppelt – in der App (`src/i18n/de.ts`, Bereich `legal`, Firmendaten in
  `src/config/app.ts` → `LEGAL`) und als Webseiten in `docs/legal/`. Bei Änderungen immer beide
  anpassen.
- **Lokaler Android-Build ohne EAS** wäre möglich, braucht aber Android Studio und Java 17 (auf
  diesem PC ist Java 25 installiert, das passt nicht). EAS Build ist der einfachere Weg.

---

## 8. Supabase Cloud (für den Play Store)

Bisher läuft die Datenbank nur auf deinem PC. Für Tester und den Play Store braucht die App eine
Datenbank im Internet. Der kostenlose Supabase-Tarif reicht dafür. **Diese Schritte machst du
selbst** – ich lege nichts in der Cloud an.

### 8.1 Projekt anlegen

1. Auf <https://supabase.com> kostenlos registrieren und anmelden.
2. **New project**:
   - **Name:** `push`
   - **Database Password:** auf **Generate a password** klicken und das Passwort sicher speichern
     (z. B. im Passwort-Manager). Du brauchst es gleich wieder.
   - **Region:** **Central EU (Frankfurt)** – wichtig für den Datenschutz (steht so in der
     Datenschutzerklärung).
   - **Plan:** Free
3. Warten, bis das Projekt fertig ist (1–2 Minuten).
4. Die **Project Ref** notieren: Sie steht in der Adresse des Browsers
   (`https://supabase.com/dashboard/project/`**`abcdefghijklmnopqrst`**) und unter
   **Project Settings → General → Project ID**.

### 8.2 pg_cron einschalten

`pg_cron` startet alle 5 Minuten die Statuswechsel und Abrechnungen.

1. Im Dashboard links **Database → Extensions**.
2. Nach `pg_cron` suchen und den Schalter **einschalten** (Schema so lassen, wie vorgeschlagen).

(Die Migration schaltet `pg_cron` zur Sicherheit ebenfalls ein; ist es schon an, passiert nichts.)

### 8.3 Migrationen hochladen

Im Projektordner (PowerShell). Docker muss dafür **nicht** laufen.

```powershell
npx supabase login
```

Öffnet den Browser; dort bestätigen.

```powershell
npx supabase link --project-ref DEINE_PROJECT_REF
```

Fragt nach dem Datenbank-Passwort aus 8.1. Danach zuerst ansehen, was hochgeladen würde:

```powershell
npx supabase db push --dry-run
```

Es sollten alle Dateien aus `supabase/migrations/` aufgelistet sein. Dann wirklich hochladen:

```powershell
npx supabase db push
```

- **Niemals** `--include-seed` verwenden: Die Testkonten aus `seed.sql` gehören nicht in die Cloud.
- Nach jeder späteren Phase mit neuen Migrationen wieder `npx supabase db push` ausführen.

Prüfen, ob der Zeitplan läuft – im Dashboard **SQL Editor**:

```sql
select jobname, schedule, active from cron.job;
```

Erwartet: eine Zeile `advance-challenges`, `*/5 * * * *`, `true`. Die letzten Läufe siehst du unter
**Integrations → Cron** (oder mit
`select status, start_time from cron.job_run_details order by start_time desc limit 5;`).

### 8.4 Anmeldung per E-Mail-Code einrichten

Die lokalen Einstellungen aus `supabase/config.toml` gelten **nicht** für die Cloud. Im Dashboard:

1. **Authentication → Sign In / Providers → Email**:
   - **Enable Email provider:** an
   - **Confirm email:** an
   - **Email OTP Length:** `6`
   - **Email OTP Expiration:** `3600`
   - Speichern.
2. **Authentication → Emails → Templates**: Bei **Confirm signup** und bei **Magic Link** jeweils
   - **Subject:** `Dein Anmeldecode`
   - **Body:** den kompletten Inhalt der Datei `supabase/templates/sign-in-code.html` einfügen
     (enthält `{{ .Token }}`, also den 6-stelligen Code).
3. **Eigener E-Mail-Versand (SMTP) – Pflicht für Tester:** Der eingebaute Versand von Supabase
   schickt Mails nur an Mitglieder deines Supabase-Teams und nur wenige pro Stunde. Für echte Tester
   brauchst du einen E-Mail-Dienst, z. B. **Resend** (kostenloser Tarif, eigene Domain nötig):
   - Bei Resend registrieren, deine Domain hinzufügen und die angezeigten DNS-Einträge bei deinem
     Domain-Anbieter eintragen, API-Key erzeugen.
   - In Supabase **Authentication → Emails → SMTP Settings** → **Enable custom SMTP**:
     Host `smtp.resend.com`, Port `465`, Username `resend`, Password = der API-Key,
     Sender email z. B. `login@deine-domain.de`, Sender name `PUSH`.
   - Danach unter **Authentication → Rate Limits** die E-Mails pro Stunde passend einstellen
     (z. B. 30).
   - Den gewählten Dienst in die Datenschutzerklärung eintragen (Platzhalter „E-Mail-Dienst“).

### 8.5 `.env.production` anlegen

```powershell
Copy-Item .env.production.example .env.production
```

`.env.production` mit einem Editor öffnen und eintragen:

- `EXPO_PUBLIC_SUPABASE_URL` – Dashboard → **Project Settings → Data API → Project URL**
  (`https://….supabase.co`)
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` – Dashboard → **Project Settings → API Keys** →
  **Publishable key** (`sb_publishable_…`)

Der **Secret key** (`sb_secret_…`) gehört **niemals** in diese Datei. `.env.production` wird nicht
eingecheckt.

Die EAS-Cloud-Builds sehen deine lokale Datei nicht. Deshalb die Werte einmal zu EAS hochladen
(und nach jeder Änderung erneut):

```powershell
eas env:push production --path .env.production
```

Prüfen:

```powershell
eas env:list production
```

Deine lokale `.env` (lokales Supabase für die Entwicklung) bleibt unverändert. `npx expo start`
verwendet weiterhin `.env`; nur der Produktions-Build verwendet die Cloud-Werte.

### 8.6 Gut zu wissen (Free-Tarif)

- **Pausieren:** Kostenlose Projekte werden nach etwa einer Woche ohne Nutzung pausiert. Dann
  meldet die App „Keine Verbindung zum Server“, und `pg_cron` läuft nicht. Im Dashboard auf
  **Restore project** klicken.
- **Backups:** Im Free-Tarif gibt es keine herunterladbaren Backups. Für echte Nutzer später auf
  einen bezahlten Tarif wechseln.
- **Gebühr:** Auch in der Cloud ist die Plattformgebühr 0 %. Ändern im SQL Editor wie in 5.9.
- **Löschanfragen per E-Mail:** im SQL Editor (E-Mail-Adresse anpassen):

  ```sql
  select private.delete_account((select id from auth.users where email = 'name@example.com'));
  ```

---

## 9. Produktions-Build für den Play Store (Android)

Voraussetzungen: Abschnitt 8 ist erledigt (`eas env:list production` zeigt beide Werte).

```powershell
eas build --platform android --profile production
```

- Ergebnis ist eine **`.aab`-Datei** (Android App Bundle) – die lädt man in der Play Console hoch.
  Auf dem Handy direkt installieren lässt sie sich nicht.
- Die **Versionsnummer für Google** (`versionCode`) erhöht EAS bei jedem Produktions-Build
  automatisch. Die sichtbare Version (`1.0.0` in `app.json` → `version`) änderst du selbst, wenn du
  eine neue Version veröffentlichen willst.
- Der Signierschlüssel ist derselbe, den EAS in 5.2 angelegt hat. **Nie löschen** – ohne ihn kann
  die App im Store nicht mehr aktualisiert werden (Google speichert zusätzlich eine Kopie, wenn du
  „Play App Signing“ nutzt, was Standard ist).
- Der Produktions-Build enthält **keinen** Entwicklungsserver und verbindet sich mit der Cloud-
  Datenbank.

Alles, was danach in der Play Console auszufüllen ist (inkl. fertiger Texte), steht in
**`docs/RELEASE.md`**.
