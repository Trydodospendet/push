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
- [x] 3. Profil und Kontrolle: Migration `20261124090000_profile_controls.sql` (Avatar-Bucket privat mit RLS, anonym in Ranglisten per RLS, Datenexport), pgTAP `13_profile` + Storage-Checks in `11_security`; App: `app/settings/*` (Konto, Privatsphäre, Benachrichtigungen, Spenden, Health & GPS, Darstellung, Daten), neues Profil mit Gruppen, Einstellungen Animationen/Haptik (`src/features/preferences`). Passwort-Anmeldung auf dem Login folgt in Teil 4.
- [x] 4. Anmelde-Bildschirme: animierte Code-Felder (`src/features/auth/code-input.tsx`: Pop, Lime-Glow, Schütteln, Erfolg, Einfügen per Langdruck), Countdown, Anmeldung mit Passwort oder Code, Passwort vergessen per Code; neue dunkle E-Mail-Vorlagen `supabase/templates/sign-in-code.html` und `email-change-code.html` (Config angepasst).
- [x] 5. Grafiken: eigene SVG-Illustrationen (`src/components/art.tsx`, 17 Motive) in Einführung (5 Seiten), neuer Anleitung (`src/features/intro/guide.tsx`, 8 Schritte) und Leer-Zuständen; Skeleton-Ladezustände, `CountUp`, `Confetti`, `FadeIn`, `GlowBackdrop`, Haptik (Buttons, Chips, Erfolge); alles beachtet "Bewegung reduzieren" + eigenen Schalter.
- [x] 6. Easter Eggs (geheime Abzeichen, im Profil als "???"): Marathon (Lauf ab 42,195 km), Frühaufsteher (Start 03:00–05:30), Neujahrslauf (Lauf am 1.1.), Glückszahl (7,777 km), Gut getippt (Logo im Profil 7x tippen, `claim_secret_badge`) – Migration `20261125090000_secret_badges.sql`, pgTAP `14_secret_badges`.
- [x] 7. Qualitätsdurchgang (Teil 1): ErrorBoundary, Kontrast (`textMuted` heller: #8A8A8A, bewusste Abweichung von CLAUDE.md §9), Schriftgrößen-Obergrenze 1,5x, `steps_total` überall (Fortschritt, Aktivitätsliste, Erinnerungen), Simulationsskript auf Pool/Ranked/Spenden umgestellt.

## Cloud-Aufgaben für morgen (nichts davon wurde ausgeführt)

Reihenfolge einhalten. Alles in der Supabase-Cloud bzw. in den Dashboards; ich habe nichts
hochgeladen, kein `db push`, kein `eas build`, kein `eas env`.

1. **Backup**: Im Supabase-Dashboard unter Database → Backups prüfen, dass ein aktuelles Backup
   existiert (die Migration `20261123090000` wandelt vorhandene Challenges um: alte „Ranked“-Pools
   werden „Pool“, alte „Solo“-Ziele werden Pools mit Einladungscode, Wochen-Schlüssel werden
   gelöscht).
2. **Migrationen hochladen** (vom Projektordner, mit dem verknüpften Projekt):
   `supabase db push` – es kommen alle Dateien ab `20261118090000_weekly_challenges.sql` bis zur
   letzten (siehe Liste in `supabase/migrations/`). Danach im SQL-Editor prüfen:
   `select jobname, schedule from cron.job;` (Jobs `advance-challenges`, `create-weekly-challenge`).
3. **Storage**: Nach der Migration muss unter Storage der Bucket **avatars** existieren, **nicht
   öffentlich**, Limit 512 KB, erlaubte Typen jpeg/png/webp (die Migration legt ihn an). Prüfen, dass
   unter Policies vier Regeln „avatars: …“ stehen.
4. **Auth-Einstellungen** (Authentication → Providers → Email / Sign In):
   - Passwort-Anmeldung zulassen (Email-Provider an), **Minimale Passwortlänge 8**.
   - **„Secure email change“ / doppelte Bestätigung ausschalten** (die App erwartet einen Code
     an der neuen Adresse; siehe `supabase/config.toml`: `double_confirm_changes = false`).
   - OTP-Länge 6 (wie bisher), Ablauf 3600 s.
5. **E-Mail-Vorlagen** (Authentication → Email Templates), Inhalt aus den Dateien kopieren:
   - _Confirm signup_ und _Magic Link_: `supabase/templates/sign-in-code.html`, Betreff „Dein Anmeldecode“.
   - _Change Email Address_: `supabase/templates/email-change-code.html`, Betreff „Neue E-Mail-Adresse bestätigen“.
     Danach einen Test-Code anfordern und die E-Mail ansehen (dunkel, Lime-Code).
6. **Neue App-Version**: Die App braucht einen **neuen Development Build** (neue native Bausteine:
   expo-notifications, expo-location, expo-task-manager, maplibre, expo-image-picker,
   expo-image-manipulator, expo-haptics, react-native-svg). `eas build` erst nach dem Test mit den
   lokalen Daten.
7. **Spenden**: Die drei NGOs sind Platzhalter (Tabelle `ngos`). Sobald es echte Partner gibt:
   Namen in der Tabelle ändern (Studio → Table Editor), nichts in der App.
8. **Play Console**: Datenschutz-Seite (`docs/legal/privacy.html`) neu veröffentlichen (Feed,
   GPS, Karten, Benachrichtigungen, Profilbild, Spenden sind ergänzt) und die Hinweise aus `docs/RELEASE.md` 2.8a (Vordergrunddienst-Formular).

**Hinweis Datenschutz:** Die Datenschutzerklärung (App und `docs/legal/privacy.html`) nennt jetzt
auch Profilbild, Anonymität in Ranglisten, Spenden-Buchungen und den Datenexport. Vor der
Veröffentlichung wie alle Rechtstexte prüfen lassen.

## Status Ausbau 1

NACHT-AUFTRAG ERLEDIGT

---

# Ausbau 2 (gleicher Branch `ausbau`)

## Fortschritt Ausbau 2

- [x] 9. Lauf-Erlebnis: Karte vollflächig hinter den Inhalten mit eigenem dunklem Stil (`src/features/gps/map-style.ts`, aus OpenFreeMap „fiord“ umgefärbt), Strecke als leuchtende Lime-Linie die sich aufbaut, Kamera folgt/gleitet, wegziehbares Werte-Panel (`src/components/draggable-panel.tsx`), Live-Lauf mit großen Zahlen und letztem km, Splits pro km, Höhenprofil, Tempo-Diagramm, persönliche Rekorde, Lauf-Verlauf mit Mini-Karten (nur Form ohne Koordinaten), Wochen-/Monatsstatistik. DB: `20261126090000_run_analytics.sql` (Höhe als 7. Punktwert, Splits, Profil, Rekorde, Periodenstatistik), `20261126100000_run_shapes.sql`; pgTAP `15_run_analytics`.
- [x] 13. Vertrauen: Einsprüche (`20261127090000_appeals.sql`, `20261127100000_appeal_gps.sql`, pgTAP `16_appeals`; Entscheidung durch den Betreiber per SQL `select private.resolve_appeal('<id>', true, 'Notiz');`, angenommene Einsprüche überstehen neue Syncs), Hilfe/FAQ + Support (`app/help.tsx`, E-Mail kontakt@puschdich.de), Einspruch-Knopf bei nicht zählenden Läufen (Challenge-Läufe und GPS-Lauf).
- [x] 15. Absturz-Überwachung vorbereitet: `src/lib/monitoring.ts` (Sentry, **nur aktiv mit `EXPO_PUBLIC_SENTRY_DSN`**, ohne Nutzerdaten/Breadcrumbs, Test vorhanden; Datenschutz ergänzt); Akku-Optimierung-Bildschirm `app/battery.tsx` (Samsung, Xiaomi, Huawei, OnePlus, Pixel) mit Link im GPS-Lauf und in den FAQ.
