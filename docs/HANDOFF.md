# Übergabe – Branch `ausbau`

## Fertig

- Phasen 6–8: Design, Community, Erinnerungen, Abzeichen und GPS-Aufzeichnung.
- Ausbau 1–2: Sicherheitsprüfung, Pool und Ranked, Profil und Anmeldung, Laufstatistik, Einsprüche, Freunde, Trainingspläne und Vorbereitung für Server-Push.
- Ausbau 3: Persönliche Ziele mit virtuellen Credits und Abrechnung pro Zeitraum, Tab „Aktivität“, feste Ranglisten und getrennte Registrierung/Anmeldung.
- Pool- und FAQ-Texte präzisiert: Die Übersicht zählt Personen und Credits in offenen oder laufenden Zielen; ob jemand gerade tatsächlich läuft, wird nicht behauptet. Setup-Test prüft ausdrücklich, dass ein Einsatz nach dem Start nicht zurückziehbar ist.
- Projektregeln gekürzt, alte MVP-Spezifikation und bisherige Übergabe unverändert gesichert, Claude-Lesesperren eingerichtet.
- Typecheck, Lint und 538 lokale Datenbankprüfungen grün. Jest parallel meldete 30 Fehler, seriell mit `npx jest --runInBand` waren alle 283 Tests grün.
- Zielbild erneut geprüft (13.11.2026): Home führt über „Ziel setzen“, erklärt den Ablauf beim ersten Öffnen und zeigt ein wichtigstes plus weitere Ziele. Freunde/Liga sind unter Ranked; Aktivität ist als Tab erreichbar, zeigt Health-Daten und GPS-Läufe und bietet Android-Strecken an. Ziele binden Credits ab Start; die Fensterabrechnung verteilt verfallene Einsätze anteilig, zieht `fee_bps` ab und bucht Rundungsreste ans Haus.
- Lokale Prüfungen am 13.11.2026 erfolgreich: `npm run typecheck`, `npm run lint`, `npx jest --runInBand` (41 Suiten, 283 Tests) und `npx supabase test db` (19 Dateien, 538 Prüfungen). Jest meldet weiterhin nur doppelte manuelle Mock-Namen für `storage`.
- Alle Details und frühere Prüfergebnisse stehen im [Archiv](HANDOFF_ARCHIV.md).

## Offen

- GPS im Hintergrund, Benachrichtigungen, Karte, Aktivität und Health-Connect-Strecken auf echten Geräten prüfen. iOS liefert hier keine Strecken aus Health.
- Auf echten Geräten zusätzlich bestätigen, dass der Tab „Aktivität“ direkt antippbar ist und die Zustände „keine Aktivitäten“, „Verbindung fehlt“ und „Sync fehlgeschlagen“ verständlich erscheinen.
- Android-Widget zurückgestellt. Rechtstexte vor Veröffentlichung prüfen lassen.

## Nächster Schritt

- Gerätetests nach [Setup §5.11–5.12](SETUP.md) und [Testanleitung G–H](TESTING.md). Wer noch einen Build von vor Ausbau 2 hat, braucht wegen der nativen Module einen neuen Development Build. Ausbau 3 und die Doku-Änderung brauchen keinen zusätzlichen Build.

## Offene Fragen

- Android-Widget später mit Gerätetest? Android-App-Links mit Play-Signatur ergänzen?
- Reicht die monatliche Gesamtliga oder sind Divisionen und andere Ranked-Punkte gewünscht?
- Sollen Trainingstage wählbar sein? Aktuell gelten Di/Do/Sa und mindestens 80 % der Strecke.
- Persönliche Ziele starten frühestens morgen und nutzen feste Zeiträume. Alte Gruppen-Pools sind weiter per Code erreichbar. Weitere Annahmen stehen im [Archiv](HANDOFF_ARCHIV.md).
- Verteilung bei Rundung: ganzzahlige Credits werden proportional zum Einsatz verteilt; nicht verteilbare Rest-Credits gehen ans Haus. Die bestehende Gebühren- und Spendenlogik bleibt aktiv.

## Cloud-Aufgaben

1. Nach dem lokalen Test Supabase-Backup prüfen und die ausstehenden Migrationen bis `20261130090000_goals_and_ranked_cycles` einspielen. In `cron.job` die Jobs `advance-challenges` und `create-ranked-cycles` prüfen.
2. Privaten Bucket `avatars` und seine Regeln prüfen (512 KB, JPEG/PNG/WebP). E-Mail-Login und Passwortlänge 8 setzen, doppelte Bestätigung für E-Mail-Wechsel ausschalten, OTP auf 6 Stellen und 3600 s prüfen.
3. Vorlagen aus `supabase/templates/` für Anmeldung, Registrierung und E-Mail-Wechsel übernehmen. Anschließend mit `npm run start:cloud` und echten E-Mails testen.
4. Server-Push nach [PUSH.md](PUSH.md) einrichten (Firebase, EAS-Datei, Edge Function und Cron). Sentry ist optional.
5. Einladungsseite `docs/legal/i.html` und aktualisierten Datenschutz auf Netlify veröffentlichen. Datenschutz bei Bedarf um die lokale Health-Connect-Streckenanzeige ergänzen und das Vordergrunddienst-Formular der Play Console ausfüllen ([Release §2.8a](RELEASE.md)).
6. Bei Bedarf die NGO-Platzhalter in Supabase ersetzen und Einsprüche wie im [Archiv](HANDOFF_ARCHIV.md) beschrieben bearbeiten.
