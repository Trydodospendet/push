# PUSH – Veröffentlichung im Google Play Store

Diese Anleitung führt dich durch die **Google Play Console**: erst ein **geschlossener Test**, danach
**Produktion**. Alle Texte zum Kopieren stehen in grauen Kästen. Stand: Phase 5 (November 2026).
Google ändert Formulare regelmäßig – wenn ein Feld anders heißt, nimm das am besten passende.

> **Wichtig:** PUSH verwendet nur **virtuelle Credits**. Es gibt keine Käufe, keine Zahlungen und
> keine Auszahlungen. Alle Antworten unten gehen davon aus. Sobald echtes Geld dazukommt, müssen
> Datensicherheit, Inhaltseinstufung und die Glücksspiel-Richtlinien neu beantwortet werden.

---

## 0. Vorher erledigen (Checkliste)

| ✔   | Aufgabe                                                                                                      | Wo                                                        |
| --- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------- |
| ☐   | Alle `[PLATZHALTER: …]` ausfüllen (Name, Anschrift, E-Mail, Serverstandort, E-Mail-Dienst, Datum, Lösch-URL) | `src/config/app.ts` (`LEGAL`) **und** `docs/legal/*.html` |
| ☐   | Rechtstexte prüfen lassen (Datenschutz, Impressum) – die Texte sind Vorlagen, keine Rechtsberatung           | –                                                         |
| ☐   | `docs/legal/` öffentlich ins Internet stellen (siehe 0.1)                                                    | –                                                         |
| ☐   | Supabase Cloud eingerichtet, Migrationen hochgeladen, SMTP eingerichtet                                      | `docs/SETUP.md` Abschnitt 8                               |
| ☐   | **Eigenes App-Icon** statt des Expo-Standard-Icons (blaues „A“)                                              | `assets/`, siehe Abschnitt 10                             |
| ☐   | Produktions-Build erstellt (`.aab`)                                                                          | `docs/SETUP.md` Abschnitt 9                               |
| ☐   | Google-Play-Entwicklerkonto (einmalig 25 USD, Identitätsprüfung)                                             | <https://play.google.com/console>                         |

### 0.1 Webseiten aus `docs/legal/` veröffentlichen

Google verlangt **öffentliche Links** zur Datenschutzerklärung und zur Kontolöschung. Ein einfacher,
kostenloser Weg ist **GitHub Pages**:

1. Auf GitHub dein Repository öffnen → **Settings → Pages**.
2. **Source:** „Deploy from a branch“, **Branch:** `main`, Ordner **`/docs`** → **Save**.
3. Nach 1–2 Minuten erreichbar unter
   `https://DEIN-GITHUB-NAME.github.io/DEIN-REPO/legal/privacy.html` (bzw. `imprint.html`,
   `delete-account.html`).

GitHub Pages ist bei privaten Repositories nur in bezahlten GitHub-Tarifen möglich. Alternativen:
das Repository öffentlich machen (dann ist auch der Code öffentlich), nur den Ordner `docs/legal` in
ein eigenes öffentliches Repository kopieren, oder Netlify/Cloudflare Pages (kostenlos, Ordner per
Drag & Drop hochladen). Die Lösch-URL danach in `src/config/app.ts` (`LEGAL.deletionUrl`) eintragen.

Im Folgenden steht `https://DEINE-SEITE` für die Adresse, unter der `docs/legal/` erreichbar ist.

---

## 1. App anlegen

Play Console → **App erstellen**

| Feld                           | Eingabe                                                    |
| ------------------------------ | ---------------------------------------------------------- |
| App-Name                       | `PUSH – Lauf- & Schrittziele`                              |
| Standardsprache                | Deutsch – de-DE                                            |
| App oder Spiel                 | **App**                                                    |
| Kostenlos oder kostenpflichtig | **Kostenlos**                                              |
| Erklärungen                    | Richtlinien für Entwickler und US-Exportgesetze bestätigen |

---

## 2. App-Inhalte (Menü „Richtlinien → App-Inhalte“)

### 2.1 Datenschutzerklärung

```
https://DEINE-SEITE/legal/privacy.html
```

### 2.2 App-Zugriff

Auswahl: **Alle oder einige Funktionen sind eingeschränkt** → Anleitung hinzufügen:

```
Die Anmeldung erfolgt ohne Passwort mit einem 6-stelligen Code per E-Mail. Jede E-Mail-Adresse kann ein neues Konto anlegen:
1. „Loslegen“ antippen, eine erreichbare E-Mail-Adresse eingeben, „Code senden“.
2. Den Code aus der E-Mail „Dein Anmeldecode“ eingeben.
3. Einen Anzeigenamen wählen.
4. Health Connect verbinden (oder „Später“). Läufe und Schritte werden nur aus Health Connect gelesen.
Jedes neue Konto erhält 100,00 virtuelle Credits. Es gibt keine Käufe und keine echten Zahlungen.
```

> Falls Google ausdrücklich feste Zugangsdaten verlangt: Ein Konto mit festem Code ist mit
> Supabase-E-Mail-Login nicht möglich. Dann im Antwortformular erklären, dass die Registrierung mit
> jeder E-Mail-Adresse funktioniert, oder mich nach einer Lösung fragen (z. B. eigenes Prüfkonto).

### 2.3 Anzeigen

**Nein, meine App enthält keine Werbung.**

### 2.4 Inhaltseinstufung (IARC-Fragebogen)

- **E-Mail-Adresse für die Einstufung:** deine Kontakt-Adresse
- **Kategorie:** **Alle anderen App-Typen** (keine Spiele-App, kein soziales Netzwerk)

Antworten (sinngemäß, Reihenfolge kann abweichen):

| Frage                                                            | Antwort  | Begründung                                                                                                                                |
| ---------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Gewalt, Sexualität, Sprache, Drogen                              | Nein     | –                                                                                                                                         |
| Können Nutzer miteinander interagieren oder Inhalte austauschen? | **Ja**   | Anzeigenamen und selbst gewählte Challenge-Titel sind für andere sichtbar. Kein Chat, keine Bilder.                                       |
| Werden Standortdaten an andere Nutzer weitergegeben?             | Nein     | –                                                                                                                                         |
| Können Nutzer digitale Waren kaufen?                             | Nein     | Keine In-App-Käufe.                                                                                                                       |
| Glücksspiel mit echtem Geld?                                     | **Nein** | Nur virtuelle Credits, nicht kaufbar, nicht auszahlbar.                                                                                   |
| Simuliertes Glücksspiel?                                         | **Nein** | Keine Casino- oder Zufallsspiele. Ergebnisse hängen ausschließlich von der eigenen, automatisch gemessenen Lauf- bzw. Schrittleistung ab. |

> **Ehrlich bleiben:** Wenn der Fragebogen „Wetten“ oder „Einsätze mit virtueller Währung“
> ausdrücklich abfragt, mit **Ja** antworten. Eine falsche Einstufung kann zur Sperre führen. Die
> höhere Altersstufe ist unkritisch, da PUSH ohnehin nur für Erwachsene ist (2.5).

### 2.5 Zielgruppe und Inhalte

| Feld                              | Eingabe                |
| --------------------------------- | ---------------------- |
| Altersgruppen                     | **nur „18 und älter“** |
| Könnte die App Kinder ansprechen? | **Nein**               |

Begründung (falls gefragt):

```
PUSH richtet sich ausschließlich an Erwachsene. Nutzer setzen virtuelle Credits auf eigene Lauf- und Schrittziele; Gestaltung und Texte sprechen keine Kinder an.
```

### 2.6 Datensicherheit (Data safety)

**Übersicht**

| Frage                                                                           | Antwort                                                                            |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Erhebt oder teilt deine App erforderliche Nutzerdatentypen?                     | **Ja**                                                                             |
| Werden alle Nutzerdaten bei der Übertragung verschlüsselt?                      | **Ja** (HTTPS)                                                                     |
| Welche Kontoerstellung bietet deine App?                                        | **Benutzername und andere Authentifizierung** (E-Mail + Einmalcode, kein Passwort) |
| Link zum Löschen des Kontos                                                     | `https://DEINE-SEITE/legal/delete-account.html`                                    |
| Können Nutzer anfordern, dass Daten gelöscht werden, ohne das Konto zu löschen? | **Nein** (Löschung nur zusammen mit dem Konto)                                     |

**Erhobene Datentypen** – bei allen: _erhoben_ = Ja, _geteilt_ = **Nein**, _nur vorübergehend
verarbeitet_ = Nein. (Supabase und der E-Mail-Dienst sind Auftragsverarbeiter, das zählt laut
Google nicht als „Teilen“.)

| Kategorie → Datentyp                                                              | Pflicht/optional                                  | Zwecke                          |
| --------------------------------------------------------------------------------- | ------------------------------------------------- | ------------------------------- |
| Personenbezogene Daten → **E-Mail-Adresse**                                       | Pflicht                                           | App-Funktionen, Kontoverwaltung |
| Personenbezogene Daten → **Name** (Anzeigename)                                   | Pflicht                                           | App-Funktionen, Kontoverwaltung |
| Personenbezogene Daten → **Nutzer-IDs**                                           | Pflicht                                           | App-Funktionen, Kontoverwaltung |
| Gesundheit und Fitness → **Fitnessinformationen** (Läufe, Distanz, Schritte)      | **Optional** (Verbinden kann übersprungen werden) | App-Funktionen                  |
| App-Aktivitäten → **Sonstige nutzergenerierte Inhalte** (Challenge-Titel)         | Pflicht                                           | App-Funktionen                  |
| App-Aktivitäten → **Sonstige Aktionen** (Teilnahmen, Einsätze virtueller Credits) | Pflicht                                           | App-Funktionen                  |

**Nicht** angeben: Standort, Finanzinformationen (virtuelle Credits sind keine Finanzdaten), Fotos,
Kontakte, Nachrichten, Geräte-IDs, Absturzberichte, Werbe-/Analysezwecke.

### 2.7 Gesundheits-Apps (Health apps declaration)

- **Ist deine App eine Gesundheits-App?** Ja → Kategorie **Fitness / Aktivitäts-Tracking**
  (bzw. „Activity and fitness“).
- Beschreibung:

```
PUSH ist eine Fitness-App für Lauf- und Schrittziele. Nutzer setzen virtuelle Credits darauf, ein selbst gewähltes Ziel zu erreichen (z. B. 5 km am Stück, 10.000 Schritte täglich). Ob ein Ziel erreicht wurde, wird automatisch anhand der Daten aus Health Connect geprüft. Die App stellt keine Diagnosen, gibt keine medizinischen Ratschläge und ist kein Medizinprodukt.
```

### 2.8 Health-Connect-Berechtigungen (Erklärung je Berechtigung)

PUSH fordert **nur Leserechte** an, keine Schreibrechte, keinen Hintergrundzugriff und keinen Zugriff
auf ältere Daten (`READ_HEALTH_DATA_HISTORY` wird nicht verwendet).

**Hauptzweck der App (Use case):**

```
PUSH prüft automatisch, ob Nutzer ihre selbst gewählten Lauf- und Schrittziele in einem festgelegten Zeitraum erreichen. Dafür werden ausschließlich Lauf-Trainings, die zugehörige Distanz und die täglichen Schritte gelesen. Die Daten werden nur zur Zielprüfung und zur Fortschrittsanzeige verwendet, nicht für Werbung, nicht verkauft und nicht an Dritte weitergegeben. Manuell eingetragene Daten werden erkannt und nicht gewertet.
```

**android.permission.health.READ_EXERCISE** (Trainingseinheiten)

```
Wir lesen Trainingseinheiten vom Typ „Laufen“ (Beginn, Ende, Dauer, aufzeichnende App und Aufzeichnungsart), um zu prüfen, ob ein Nutzer im Zeitraum seiner Challenge einen Lauf absolviert hat (z. B. „ein Lauf über 5 km“). Andere Sportarten werden ignoriert. Über die Aufzeichnungsart erkennen wir manuell eingetragene Läufe; diese zählen nie.
```

**android.permission.health.READ_DISTANCE** (Distanz)

```
Wir lesen die Distanz innerhalb des Zeitraums einer Lauf-Trainingseinheit, um die gelaufene Strecke zu bestimmen. Daraus berechnet der Server den Fortschritt (längster Lauf oder Gesamtstrecke) und prüft die Plausibilität (z. B. ob das Tempo für einen Lauf realistisch ist).
```

**android.permission.health.READ_STEPS** (Schritte)

```
Wir lesen die Schrittzahl pro Tag (über die Aggregations-Schnittstelle, ohne Doppelzählungen), um Challenges vom Typ „X Schritte an jedem Tag“ zu prüfen. Es werden nur Tageswerte der letzten 45 Tage übertragen; Schritte von Apps mit manuellen Einträgen an diesem Tag werden nicht gewertet.
```

Falls nach Videos gefragt wird: ein kurzes, **nicht gelistetes** YouTube-Video aufnehmen, das zeigt:
Erklär-Screen „Automatisch geprüft statt behauptet“ → Health-Connect-Dialog → Fortschritt einer
Challenge → Profil → Datenschutz. Link im Formular eintragen.

Im Formular außerdem bestätigen, dass die Datenschutzerklärung die Health-Connect-Daten beschreibt
und die „Limited Use“-Anforderungen erfüllt (Abschnitt 5 der Datenschutzerklärung).

### 2.9 Weitere Erklärungen

| Formular                  | Antwort                                            |
| ------------------------- | -------------------------------------------------- |
| Finanzfunktionen          | **Keine** (nur virtuelle Credits, keine Zahlungen) |
| Behörden-App              | Nein                                               |
| Nachrichten-App           | Nein                                               |
| COVID-19                  | Nein                                               |
| Werbe-ID (Advertising ID) | **Nein**, die App verwendet keine Werbe-ID         |

---

## 3. Store-Eintrag (Hauptdetails)

**App-Name** (max. 30 Zeichen)

```
PUSH – Lauf- & Schrittziele
```

**Kurzbeschreibung** (max. 80 Zeichen)

```
Setz auf dein Lauf- oder Schrittziel. Automatisch geprüft über Health Connect.
```

**Vollständige Beschreibung** (max. 4.000 Zeichen)

```
PUSH. YOUR GOALS. YOUR STAKES.

Du nimmst dir vor, mehr zu laufen – und dann kommt doch wieder etwas dazwischen? Mit PUSH setzt du auf dein eigenes Ziel. Schaffst du es, bekommst du deinen Einsatz zurück. Schaffst du es nicht, ist er weg. So einfach, so motivierend.

SO FUNKTIONIERT'S
• Ziel wählen: ein Lauf über 3, 5, 10 oder 21,1 km, eine Gesamtstrecke oder 8.000 bis 12.000 Schritte an jedem Tag.
• Zeitraum festlegen: von einem Tag bis zu sechs Wochen.
• Einsatz setzen: 1 bis 50 Credits.
• Loslegen: PUSH prüft deinen Fortschritt automatisch über Health Connect.

ZWEI MODI
• Solo: Du wettest auf dich selbst. Ziel erreicht – Einsatz zurück.
• Ranked: Tritt gegen andere an. Wer das Ziel schafft, bekommt seinen Einsatz zurück und teilt sich die Einsätze derer, die es nicht geschafft haben. Öffentlich oder privat mit Einladungscode für Freunde, Kollegen oder deinen Lauftreff.

AUTOMATISCH GEPRÜFT STATT BEHAUPTET
• Läufe und Schritte kommen direkt aus Health Connect – aufgezeichnet von deiner Uhr, deinem Handy oder deiner Lauf-App.
• Manuell eingetragene Läufe und Schritte zählen nie.
• Unplausible Aktivitäten (z. B. Radfahren statt Laufen) werden erkannt und mit Grund angezeigt.

DEINE DATEN
• PUSH liest nur Lauf-Trainings, Distanz und Tagesschritte – und schreibt nichts in deine Gesundheitsdaten.
• Andere Teilnehmer sehen nur deinen Namen und ob du dein Ziel geschafft hast, nie deine Gesundheitsdaten.
• Keine Werbung, kein Tracking.
• Konto jederzeit in der App löschbar.

TESTPHASE
Credits sind virtuell. Jedes neue Konto startet mit 100 Credits. Credits können nicht gekauft und nicht ausgezahlt werden.

Voraussetzung: Health Connect (ab Android 14 im System enthalten, sonst kostenlos im Play Store) und eine App, die Läufe bzw. Schritte an Health Connect weitergibt. PUSH ist für Personen ab 18 Jahren.
```

**Kategorie:** App → **Gesundheit & Fitness**
**Tags (falls angeboten):** Laufen, Fitness-Tracker, Schrittzähler
**Kontakt-E-Mail:** deine Kontakt-Adresse (wird im Store angezeigt)
**Website (optional):** `https://DEINE-SEITE/legal/`

### 3.1 Grafiken

| Element                | Vorgabe                                                                      | Inhalt-Vorschlag                                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| App-Symbol             | 512 × 512 px, PNG, max. 1 MB                                                 | Lime-„P“ oder „PUSH.“ auf Schwarz (`#0A0A0A` / `#C6FF00`)                                                |
| Vorstellungsgrafik     | 1024 × 500 px, PNG/JPG                                                       | Schwarz, „PUSH.“ groß in Weiß, darunter „YOUR GOALS. YOUR STAKES.“, ein lime-farbener Fortschrittsbalken |
| Smartphone-Screenshots | 2–8 Stück, PNG/JPG, Seiten 320–3.840 px, Hochformat 9:16 (z. B. 1080 × 1920) | siehe unten                                                                                              |

**Screenshots (Vorschlag, Reihenfolge):**

1. **Home** mit großer Fortschrittszahl, z. B. „3,25 / 5,00 km“ und Restzeit
2. **Challenge-Detail** (Ranked) mit Topf, Regeln und Teilnehmerliste
3. **Beitritts-Sheet** „Du setzt 10,00 Credits …“
4. **Solo** – eigenes Ziel setzen
5. **Erstellen** mit Zieltyp-, Ziel- und Einsatz-Auswahl
6. **Ergebnis** „Ziel geschafft! Dir wurden 7,50 Credits gutgeschrieben.“
7. **Wallet** mit Guthaben, Buchungen und Testphasen-Hinweis
8. **Erklär-Screen** „Automatisch geprüft statt behauptet“

So kommst du an schöne Screenshots: lokal `npm run db:reset`, dann die Simulation aus
`docs/SETUP.md` 5.9 laufen lassen, als `anna@example.com` anmelden und auf dem Handy
Screenshots machen (Ein/Aus + Leiser). Keine echten E-Mail-Adressen zeigen.

---

## 4. Geschlossener Test

1. **Testen und veröffentlichen → Tests → Geschlossener Test** → Track „Closed testing – Alpha“
   (oder neuen Track anlegen).
2. **Tester:** E-Mail-Liste anlegen (Google-Konten der Tester) oder eine Google Group.
3. **Länder:** Deutschland (ggf. Österreich, Schweiz).
4. **Neuen Release erstellen** → die `.aab`-Datei aus `eas build --platform android --profile
production` hochladen (Download-Link steht am Ende des Builds bzw. auf expo.dev).
5. **Play App Signing** akzeptieren (Standard).
6. **Versionshinweise:**

```
<de-DE>
Erste Testversion von PUSH: Solo- und Ranked-Challenges für Läufe und Schritte, automatische Prüfung über Health Connect, virtuelle Credits. Danke fürs Testen! Feedback bitte an [PLATZHALTER: kontakt@deine-domain.de].
</de-DE>
```

7. **Überprüfen und Einführung starten.** Die erste Prüfung durch Google kann mehrere Tage dauern
   (bei Health-Connect-Berechtigungen oft länger).
8. Tester erhalten einen **Opt-in-Link** (unter „Tester“) – den schickst du ihnen.

**Für neue private Entwicklerkonten** verlangt Google vor der Produktion einen geschlossenen Test mit
**mindestens 12 Testern über mindestens 14 Tage** am Stück (Stand der Regel bitte in der Play Console
prüfen). Plane das ein.

**Jedes Update:** `eas build --platform android --profile production` (der `versionCode` steigt
automatisch), neue `.aab` im selben Track hochladen.

---

## 5. Produktion

1. **Produktion → Zugriff beantragen** (nach dem geschlossenen Test). Google stellt dabei Fragen zum
   Test (Anzahl Tester, Feedback, Änderungen) – ehrlich beantworten.
2. **Länder:** Deutschland (und ggf. weitere deutschsprachige Länder).
3. Release aus dem geschlossenen Test **übernehmen** („Release hochstufen“) oder neue `.aab`
   hochladen.
4. Optional **gestaffelte Einführung** (z. B. 20 %) wählen.

---

## 6. Löschanfragen per E-Mail bearbeiten

Wenn jemand über die Webseite eine Löschung per E-Mail beantragt:

1. Prüfen, dass die Absender-Adresse die registrierte Adresse ist (sonst nachfragen).
2. Supabase Dashboard → **SQL Editor** (E-Mail-Adresse anpassen):

   ```sql
   select private.delete_account((select id from auth.users where email = 'name@example.com'));
   ```

   Meldung `account_not_found` = zu dieser Adresse gibt es kein Konto.

3. Der Person die Löschung per E-Mail bestätigen (innerhalb von 30 Tagen nach Eingang).

Was dabei passiert, steht in `docs/SECURITY_NOTES.md` Abschnitt 7.

---

## 7. Regel für Einsätze bei Kontolöschung

| Zustand der Challenge                              | Was mit dem Einsatz passiert                                                             |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| noch nicht gestartet (`open`)                      | wird **erstattet**, Teilnahme entfernt (Solo-Ziel wird abgesagt)                         |
| läuft oder wird ausgewertet (`active`, `settling`) | **verfällt**, bleibt im Topf und wird an die Gewinner verteilt (Solo: an das Haus-Konto) |
| abgerechnet oder abgesagt                          | nichts mehr zu tun, Buchungen bleiben anonym erhalten                                    |

Das Restguthaben im Wallet verfällt mit dem Konto (virtuelle Credits).

---

## 8. Nicht Teil dieser Phase

- **Echte Zahlungen** (eigene Phase). Danach müssen Datensicherheit (Finanzinformationen),
  Inhaltseinstufung, die Richtlinie zu Echtgeld-Glücksspiel und die Rechtstexte neu bewertet werden.
- **iPhone / App Store:** braucht das Apple Developer Program (99 USD/Jahr); der Apple-Health-Code ist
  noch nicht auf einem Gerät getestet.
- **Erinnerungen per Benachrichtigung** (`expo-notifications`): wäre eine neue native Bibliothek und
  ist deshalb in dieser Phase nicht enthalten.

---

## 9. Kurz-Checkliste vor „Einführung starten“

- [ ] Keine `[PLATZHALTER` mehr in `src/config/app.ts` und `docs/legal/*.html`
      (`Select-String -Path src\config\app.ts, docs\legal\*.html -Pattern "PLATZHALTER"` liefert nichts)
- [ ] Datenschutz-Link und Lösch-Link im Browser des Handys geöffnet und geprüft
- [ ] Produktions-Build auf einem Testgerät über den Test-Track installiert: Anmeldung mit echter
      E-Mail klappt, Health Connect verbindet, Konto löschen klappt
- [ ] `select jobname from cron.job;` in der Cloud zeigt `advance-challenges`
- [ ] Datensicherheit, Inhaltseinstufung, Zielgruppe, Health-Connect-Erklärung ausgefüllt

---

## 10. Offener Punkt: App-Icon

`assets/icon.png` und die Android-Icon-Dateien sind noch die **Expo-Standardgrafiken** (blaues „A“
auf hellblauem Grund), und `app.json` → `android.adaptiveIcon.backgroundColor` ist `#E6F4FE`. Für den
Store braucht PUSH ein eigenes Icon im Design (Schwarz `#0A0A0A`, Lime `#C6FF00`). Das ist eine
Änderung an `app.json` und den Bilddateien und braucht danach einen neuen Build – sag mir Bescheid,
wenn ich das vorbereiten soll (Grafik lieferst du oder ich erstelle eine schlichte Text-Variante).
