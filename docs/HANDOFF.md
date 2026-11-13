# Handoff (Stand: Ende der Nacht-Session)

## Fertig

- **Phase 6** (Design) – in `main`.
- **Phase 7** (Branch `phase-7-community`, gepusht):
  1. Lokale Erinnerungen (`src/features/reminders/`): täglich zur gewählten Uhrzeit, „startet morgen“,
     „Ergebnis ist da“; Profil-Karte mit An/Aus und Uhrzeit (Buttons); Android-13-Berechtigung.
  2. Wochen-Challenge: `20261118090000_weekly_challenges.sql`, pg_cron jeden Sonntag, pgTAP `07_weekly`,
     hervorgehobene Karte im Ranked-Tab.
  3. Feed + Anfeuern: `20261119090000_feed.sql`, pgTAP `08_feed`, `src/features/feed/`.
  4. Abzeichen + Level: `20261120090000_badges.sql`, pgTAP `09_badges`, `src/features/badges/`
     (Punkte: 1/km, 1/1.000 Schritte, 50/Sieg), Feier bei neuem Abzeichen.
- **Phase 8** (Branch `phase-8-gps`, von `phase-7-community`, gepusht):
  - DB: `20261121090000_gps_runs.sql` (`sync_gps_run` rechnet aus Rohpunkten nach; Fake-GPS, Sprünge,
    Tempo; Duplikat-Erkennung gegen Health-Läufe; Route nur für den Besitzer, ohne 200 m an den
    Enden), pgTAP `10_gps`.
  - App: `src/features/gps/` (Messung, Codec, Recorder, Aufzeichnungsdienst mit Vordergrunddienst,
    Zwischenspeicher, Upload-Warteschlange), Screens `app/run/index.tsx` und `app/run/[id].tsx`,
    Karte mit OpenFreeMap (`fiord`, kein Schlüssel), Einstieg über Home.
  - Datenschutz (App + `docs/legal/privacy.html`), `docs/RELEASE.md` 2.8a (Play Console),
    `docs/SECURITY_NOTES.md` 8–9, `docs/SETUP.md` 5.9.

## Stand der Prüfungen

`npm run typecheck`, `npm run lint`, `npm test` (220) und `supabase test db` (10 Dateien) sind grün.

## Nächster Schritt (für dich)

1. Neuen Development Build bauen (neue native Bibliotheken): siehe `docs/SETUP.md` 5.9.
2. Auf dem Handy testen: GPS-Lauf, Erinnerungen (Profil), Karte.
3. Erst danach entscheiden, ob die neuen Migrationen `20261118…` bis `20261121…` in die Cloud
   sollen (`supabase db push` – bewusst **nicht** ausgeführt).

## Offene Fragen / getroffene Annahmen

- **Nichts auf einem echten Handy getestet.** Karte, Hintergrund-Aufzeichnung, Benachrichtigungen und
  der Vordergrunddienst sind nur typgeprüft und durch Jest-Mocks abgedeckt. Fehler zeigen sich erst
  im Development Build.
- **Hintergrund-Standort nicht angefordert:** Der Lauf startet in der offenen App und läuft als
  Vordergrunddienst (Android) bzw. Background-Mode (iOS) weiter; dafür braucht `expo-location` keine
  „immer“-Berechtigung. Dadurch entfällt in der Play Console die Hintergrund-Standort-Erklärung;
  stattdessen ist das Formular „Vordergrunddienste“ nötig (`docs/RELEASE.md` 2.8a). Soll ein Lauf auch
  ohne geöffnete App starten können, müsste das geändert werden.
- **Uhrzeit-Wahl** für Erinnerungen per +/- Buttons (keine zweite native Bibliothek, wie vereinbart).
- **Erinnerungstexte sind Momentaufnahmen:** „Noch 2,3 km“ stammt vom letzten Sync. Bei Schritt-Zielen
  steht nur „Tagesziel noch offen“, weil der Server keine Tagesschritte pro Challenge liefert.
- **Zwischenspeicher** des laufenden GPS-Laufs alle 30 s im verschlüsselten Gerätespeicher; bei
  einem Absturz gehen höchstens ~30 s verloren, der Lauf wird beim Start zur Fortsetzung angeboten.
- **iOS:** liefert über `expo-location` kein „mocked“-Flag; dort gelten nur die Plausibilitätsregeln
  (siehe `docs/SECURITY_NOTES.md` 8). iOS-Code weiterhin nicht auf einem Gerät getestet.
- Die Kartenkacheln kommen von `tiles.openfreemap.org` (in der Datenschutzerklärung erwähnt).
- `compileSdkVersion` ist unverändert 37.

---

# Ausbau-Auftrag (Branch `ausbau`, von `phase-8-gps`)

## Fortschritt
- [x] 1. Sicherheits-Check: `20261122090000_security_hardening.sql` (Rechte auf zwei Helfer-Funktionen entzogen, Default-Rechte für neue Tabellen/Funktionen geschlossen), `supabase/tests/11_security.test.sql` (prüft ALLE Tabellen/Funktionen generisch, auch spätere).
- [x] 2. Spielmodell: DB (`20261123090000_pool_ranked_donations.sql`, `20261123100000_my_result.sql`, pgTAP `12_modes`, alte Tests umgebaut) und App (Pool-Tab, Ranked ohne Einsatz, Einsatzwahl beim Beitritt, Spenden-Karten, Ergebnis mit Platz/Punkten). Profil-Einbindung der Spenden-Karten folgt in Teil 3.
