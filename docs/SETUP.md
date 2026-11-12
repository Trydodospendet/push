# PUSH – Einrichtung Schritt für Schritt

Diese Anleitung ist für Windows mit PowerShell geschrieben. Alle Befehle kannst du kopieren und im
Projektordner ausführen. Stand: **Phase 1 (Konto)**.

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
Anmeldung sicher auf dem Handy speichert). Ein älterer Build stürzt beim Öffnen von Phase-1-Code ab.

Für normale Code-Änderungen reicht `npx expo start`. Der kostenlose EAS-Tarif enthält derzeit bis zu
15 Android- und 15 iOS-Builds (Stand November 2026, aktuelle Zahlen: <https://expo.dev/pricing>).

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
- **Tab-Leiste ohne Symbole:** Für Icons bräuchte es eine Icon-Bibliothek (z. B.
  `@expo/vector-icons`, nur JavaScript, kein neuer Build). Sie ist noch nicht freigegeben.
- **Lokaler Android-Build ohne EAS** wäre möglich, braucht aber Android Studio und Java 17 (auf
  diesem PC ist Java 25 installiert, das passt nicht). EAS Build ist der einfachere Weg.
