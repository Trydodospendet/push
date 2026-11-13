# Testanleitung – Phase 7, Phase 8 und Ausbau

So probierst du alles aus, was seit Phase 6 dazugekommen ist. Alle Punkte funktionieren im
Development Build auf dem Handy (siehe `docs/SETUP.md` Abschnitt 5, bei neuen nativen Bausteinen
einmal neu bauen). Lokale Datenbank vorher neu aufsetzen:

```powershell
npm install
```

```powershell
supabase db reset
```

> Storage (für das Profilbild) läuft lokal nur, wenn in `supabase/config.toml` unter `[storage]`
> `enabled = true` steht (ist eingestellt). Beim ersten `supabase start` werden dafür zusätzliche
> Container geladen.

Die Seed-Daten (`supabase/seed.sql`) legen drei Testnutzer an (Anna, Ben, Clara) mit Pools und
Ranglisten. Anmeldung lokal: E-Mail eingeben, den Code in Mailpit lesen
(<http://127.0.0.1:54324>).

---

## A. Phase 7 – Community

1. **Erinnerungen** – Profil → _Benachrichtigungen_: Schalter an → System fragt nach Erlaubnis
   (Android 13+). Uhrzeit mit +/− einstellen. Tritt einer Challenge bei, die morgen startet: zur
   Erinnerungszeit kommt „Deine Challenge startet morgen.“ (Zum schnellen Testen die Uhrzeit auf
   2 Minuten später stellen und die App schließen.)
2. **Wochen-Challenge** – In der lokalen DB manuell auslösen:
   `select public.create_weekly_challenge();` (im Supabase Studio, SQL-Editor). Im _Ranked_-Tab
   erscheint oben die Karte „WOCHEN-CHALLENGE“ (Lime-Rand). Ein zweiter Aufruf legt nichts an.
3. **Feed & Anfeuern** – In einer Challenge, bei der du dabei bist: Abschnitt _AKTIVITÄT_. Mit
   einem zweiten Nutzer beitreten, einen Lauf synchronisieren, mit „Anfeuern“ antippen (nur einmal
   pro Eintrag).
4. **Abzeichen & Level** – Profil: _LEVEL & ABZEICHEN_. Nach dem ersten Beitritt erscheint
   „Erster Schritt“ mit einer kurzen Feier.

## B. Phase 8 – GPS-Läufe

1. Home → **GPS-Lauf starten** → Erklärtext lesen → _Lauf starten_ → Standort erlauben.
2. Mindestens 400 m zügig gehen oder laufen (langsamer als 15:00 min/km zählt nicht), Bildschirm
   sperren, später entsperren: Zeit, Distanz und Pace laufen weiter, die Karte zeigt die
   Lime-Linie.
3. _Stopp_ → _Speichern_. Das Ergebnis-Fenster sagt, ob der Lauf zählt.
4. Unter _Letzte Läufe_ den Lauf öffnen: Karte ohne die ersten und letzten 200 m.
5. **Fake-GPS** (nur Android, Entwickleroptionen → Standort-Simulation): Lauf aufzeichnen →
   erscheint als „zählt nicht“ mit dem Grund „Fake-GPS“.
6. **Doppelte Läufe**: Lauf per GPS _und_ über Health Connect (Uhr) aufzeichnen → nach dem Sync
   zählt nur der Health-Lauf, der GPS-Lauf zeigt „Derselbe Lauf wurde schon … gezählt“.

## C. Ausbau – neues Spielmodell

1. **Ranked (ohne Einsatz)** – Ranked-Tab → _Erstellen_: kein Einsatz, nur Ziel (meiste km /
   meiste Schritte), Zeitraum, öffentlich/privat. Beitreten ohne Bestätigung eines Einsatzes; das
   Guthaben bleibt gleich.
2. **Pool** – Pool-Tab → _Pool starten_: Zieltyp, Zeitraum, Einsatz-Vorschlag. Danach in der
   Challenge _Beitreten_: im Fenster den **eigenen Einsatz** wählen (1–50 Credits). Du kannst auch
   allein im Pool sein.
3. **Abrechnung ausprobieren** – Mit dem Zeitraffer-Skript
   (`supabase/scripts/simulate_challenge.sql`, Anleitung im Skript) eine Challenge bis zur
   Abrechnung durchspielen. Im Pool: Wer das Ziel schafft, bekommt den Einsatz plus einen Anteil
   im Verhältnis zum Einsatz; der Rest geht an das Haus. Ranked: Platz und Punkte, keine Buchung.
4. **Spenden** – Profil → _Spenden_: Standard an/aus und NGO wählen (NGO-Partner 1–3 sind
   Platzhalter). In einem Pool zusätzlich in der Challenge _GEWINNANTEIL SPENDEN?_ pro Challenge
   ändern (bis zur Abrechnung). Nach der Abrechnung: Wallet zeigt „Spende“-Buchungen, Profil →
   _Spenden_ die Übersicht „MEINE SPENDEN“.

## D. Ausbau – Profil & Kontrolle

Profil → Gruppen (jede Zeile öffnet einen Bildschirm):

- **Konto & Sicherheit**: Profilbild wählen (wird auf 256 × 256 verkleinert, nur du siehst es),
  Anzeigename, E-Mail ändern (Code geht an die neue Adresse), Passwort festlegen, auf allen
  Geräten abmelden.
- **Privatsphäre**: „In Ranglisten anonym bleiben“ – ein zweiter Nutzer sieht dich dann als
  „Anonym“ (Rangliste, Feed, Teilnehmerliste).
- **Darstellung**: Animationen und Haptik an/aus. Zusätzlich beachtet die App die
  Systemeinstellung _Bewegung reduzieren_.
- **Daten & Datenschutz**: „Meine Daten herunterladen“ (Teilen-Menü, JSON), Datenschutz,
  Impressum, _Konto löschen_.

## E. Ausbau – Anmeldung

1. Abmelden → Anmelden: Code-Felder pulsieren in Lime, jede Ziffer „poppt“. Falschen Code
   eingeben → Felder schütteln, rot, Vibration.
2. Langer Druck auf ein Feld → kopierten Code einfügen.
3. „Erneut senden in 30 s“ zählt herunter.
4. Anmelden mit **Passwort** (Chip „Passwort“) – vorher in _Konto & Sicherheit_ ein Passwort
   festlegen. „Passwort vergessen“ schickt einen Code.
5. E-Mail-Vorlage ansehen: nach dem Anfordern eines Codes in Mailpit
   (<http://127.0.0.1:54324>) – dunkel mit Lime-Code.

## F. Ausbau – Grafiken & Geheimnisse

- Einführung (5 Seiten) nach der ersten Anmeldung; Profil → _So funktioniert's_ (8 Schritte mit
  Bildern).
- Leere Zustände (z. B. neuer Nutzer ohne Challenge) zeigen eigene Illustrationen; Laden zeigt
  graue Platzhalter statt Spinner.
- Wallet-Saldo zählt hoch; ein Sieg zeigt Konfetti.
- **Geheime Abzeichen** (im Profil als „???“): Logo „PUSH.“ unten im Profil 7× schnell
  antippen; ein Lauf über 42,195 km; ein Lauf zwischen 03:00 und 05:30; ein Lauf am 1. Januar;
  ein Lauf über 7,777 km.

---

## Automatische Tests

```powershell
npm run typecheck
```

```powershell
npm run lint
```

```powershell
npm test
```

```powershell
supabase test db
```

Alle vier müssen grün sein. Die Datenbanktests liegen in `supabase/tests/` (`11_security` prüft
generisch alle Tabellen, Funktionen und den Storage, `12_modes` das Pool-/Ranked-Modell inkl.
Spenden).
