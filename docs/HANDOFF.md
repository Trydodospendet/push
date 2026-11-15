# Übergabe – Branch `ausbau`

## Überarbeitete App-Oberfläche (15.11.2026)

- Vorversion als Git-Tag `backup/pre-ux-redesign-2026-11-15` auf GitHub und als separater Checkout `PUSH-vor-umbau` auf dem Desktop gesichert. Ablauf, Studien, Gerätetests und PowerShell-Skript stehen im [Ablaufskript](UX-REDESIGN.md).
- „Heute“ bündelt wichtigstes Ziel, Laufstart, Trainingsplan und Schritte. Wochenstatistik und Erfolge lassen sich aufklappen. Pushy hat eine feste, dezent animierte Karte. Aktivität und Ranked haben Filter, das Profil hat benannte Einstellungsgruppen.
- „Ziel setzen“ führt durch Zielwert, Zeitraum und Credits mit Prüfung vor der Buchung. Die Produktions-Migrationsliste führt `20261130130000_immediate_results.sql` weiterhin als offen. Der fehlende Endpunkt wird jetzt verständlich gemeldet. Anwendung wie in [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung).
- GPS-Tempo nutzt die vom Standortdienst gelieferte Geschwindigkeit oder schätzt sie aus aktuellen, genauen Positionen. Fehlende Messungen erscheinen als Strich. Vorschau unter Aktivität, während der Aufzeichnung im Laufpanel getrennt von der Durchschnittspace. Vergleich mit einem echten Gerät steht aus.
- Typecheck, Lint, 288 Jest-Tests und 555 lokale DB-Tests erfolgreich. Der Android-JavaScript-Export ist möglich. Metro-Neustart für einen passenden Development Build, neuer Build für die Play-Verteilung.

## Start am selben Tag (15.11.2026)

- Trainingspläne starten über „Heute starten“ mit einem Lauf am selben Kalendertag. Die nächsten beiden Läufe liegen zwei und vier Tage später. Bereits gespeicherte Pläne behalten ihren Rhythmus. Bei einem früher geplanten Start in der Zukunft bietet die App „Heute starten“ an. Mit aktuellem Development Build genügt ein Metro-Neustart. Für die Verteilung über Play muss die aktualisierte App in einen neuen Build.
- „Etwas ist schiefgelaufen. Bitte versuche es erneut.“ beim Speichern unter „Ziel setzen“: Der aktuelle Zielbildschirm ruft `create_goal_with_preferences` auf. Eine lesende Cloud-Abfrage bestätigt, dass die Funktion fehlt. Der Produktions-Dry-run listet genau `20261130130000_immediate_results.sql`, die diese Funktion bereitstellt. Nach Backup-Prüfung muss der Nutzer die Migration wie in [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung) einspielen und „Heute“ auf dem Gerät bestätigen.
- App-Flow-Tests an die bereits produktiven achtstelligen E-Mail-Codes angepasst. Typecheck, Lint, 285 Jest-Tests (mit 30 Sekunden Testlimit) und 555 lokale DB-Tests bestanden. Gerätetest steht aus.

## Videos in der App

- Unter Profil → „So funktioniert’s“ lassen sich zwei kurze Videos zu Schrittzielen öffnen und offline abspielen. Die App-Versionen liegen in `assets/guide-videos/`. Das Render-Skript `marketing/push-shorts/render.py` erzeugt sie mit `--in-app`.
- `expo-video` ist neu und benötigt einen neuen nativen Android-/iOS-Build. Auf einem Gerät Wiedergabe, Vollbild, Wechsel zwischen den beiden Clips und Schließen des Players prüfen.
- Für die GPS-Vordergrunddienst-Erklärung in Google Play ist eine Aufnahme der tatsächlichen Android-Funktion erforderlich. Aufnahme und Prüflink stehen aus. Ablauf in [Release §2.8a](RELEASE.md).

## Aktueller Stand: Coach und sofortige Ergebnisse (14.11.2026)

- Produktions-Supabase versendet derzeit achtstellige E-Mail-OTPs. Die App akzeptiert daher achtstellige Codes (`SIGN_IN_CODE_LENGTH = 8`); der bisherige sechsstellige Wert führte beim Gerätetest dazu, dass gültige Codes nicht eingegeben werden konnten. Für die Verteilung ist ein neuer Android-Build nötig. Die Supabase-Einstellung und die App müssen künftig gleich bleiben.

- Dezenter Glow ergänzt: SVG-Farbverlauf hinter Pushy und allen Coach-Stufen, leichte Akzentschatten an aktiven Hauptbuttons und Fortschrittsbalken. Pushy heißt sichtbar so statt „Ei“, zeigt bei fehlendem Standort schlicht `0 km/h`, blendet die Sprechblase in der Tempoansicht aus und wechselt ihre Motivation. Dezente Blick-, Sprung-, Wackel- und Saltoanimationen berücksichtigen die Systemoption für reduzierte Bewegung. Dekoration fängt keine Berührungen ab; kein neues Modul oder Build nötig.
- Die Trainingsplan-Einführung erhält zusätzlich pro Seite eine schwebende, sanft skalierende Grafik mit Akzentglow; damit wirken die Einführungsseiten nicht wie reine Textkarten.

- Firebase-Projekt `push-aeaf3`, Android-App `com.pushchallenge.app` registriert. Nutzer hat `google-services.json` heruntergeladen; Projekt/Paket geprüft, lokal im Projekt abgelegt und in `app.json` verknüpft. Datei bleibt Git-ignoriert. Neuer Android-Build nötig.
- `.easignore` übernimmt die Git-Ausschlüsse und nimmt nur die Android-Konfiguration wieder auf; private Admin-Schlüssel bleiben ausgeschlossen. Expo-Konfiguration erkennt Paket und Datei, EAS-Anmeldung `darab2004` bestätigt. Typecheck/Lint und 555 DB-Tests bestanden. Jest-Gesamtlauf: 282 bestanden, 3 Fehler in goals-flow (Timeout/Ladezustand); betroffene Suite separat mit 30 Sekunden Testlimit: 4/4 bestanden. Keine Tests oder App-Logik für diese Konfigurationsänderung angepasst.
- FCM V1 bei Expo eingerichtet (14.11.2026): vom Nutzer heruntergeladenen Dienstkonto-Schlüssel auf Projekt `push-aeaf3` geprüft, über `eas credentials --platform android` im Profil development hochgeladen. CLI bestätigt Upload und Zuordnung zu `com.pushchallenge.app`. Private JSON bleibt außerhalb des Repositories im Downloads-Ordner. Früherer nicht heruntergeladener Schlüssel mit Endung `9481f132` sollte später im Google-Dienstkonto bereinigt werden. Neuer Android-Build, Gerätetest und der Cron-Aufruf bleiben offen.
- Server-Push in Produktion eingerichtet: Cron-Job `send-push` ruft die gleichnamige Edge Function jede Minute über `pg_net` auf. Das frisch erzeugte Versandgeheimnis liegt im Vault als `push_dispatch_secret` und in der Edge Function als `SEND_PUSH_SECRET`. Der Android-Gerätetest steht aus. Vor der Einrichtung waren keine Geräte registriert.

- Nutzerentscheidung: Am Zielende endgültig abrechnen; verspätete Synchronisierung zählt nicht. Neue Migration 20261130130000_immediate_results.sql friert den gespeicherten Fortschritt am Ende ein, setzt die Kulanzzeit auf null und den Abrechnungsjob auf zehn Sekunden. Neue sofortige Ziele werden direkt aktiv. Alte Abrechnungstests behalten ausdrücklich ihre historische Kulanzzeit; neue Cutoff-Tests prüfen die neue Regel.
- Gewinnverwendung wird bei Teilnahme festgehalten, kann vor Beginn gewählt und ab Start nicht mehr geändert werden. Profiländerungen beeinflussen laufende Ziele nicht.
- Header mit Zielfortschritt, Zielsetzen unter dem aktiven Ziel, abgeschlossene Ziele separat. Heutige Schritte und Wochen-Schrittsumme zusätzlich zu gemessenen Laufkilometern; laufende App synchronisiert Health regelmäßig.
- Trainingsplan-Einführung mit Wischseiten, Grafiken und Übergängen. Header und scrollbar begrenzte Bestätigungsfenster berücksichtigen Kameraaussparungen; Karten erhalten dezente Schatten.
- Kleiner verschiebbarer Laufhase in Akzentfarbe mit Sprechblase, Blickbewegung, Schwindelanimation, Ausblenden und Tempoansicht. Entwicklungsstufen nach 2/7/30/90 aktiven Tagen ab erster Coach-Nutzung; lokaler Speicher pro Konto. GPS-Tempo erfordert Standortfreigabe, läuft nur im Vordergrund und speichert keine Strecke. Begrüßung nutzt Fortschrittsdifferenzen und Zielergebnisse.
- Typecheck, Lint, 285 Jest-Tests (42 Suites), 555 pgTAP-Tests (21 Dateien) erfolgreich. Oberfläche und GPS-Tempo noch auf dem Gerät prüfen.
- Cloud-Dry-run listet nur 20261130130000_immediate_results.sql. Flexible Ziele sind inzwischen angewendet. Cloud-Push bleibt gemäß CLAUDE.md dem Nutzer vorbehalten.
- Push offen: Zustellung mit dem installierten Play-Build prüfen. Lokale Testnachricht ist unter Profil → Benachrichtigungen verfügbar.
- Browser-Einrichtung wurde bisher durch Computer-Use gestoppt, weil die aktuelle Chrome-URL nicht verlässlich erkannt wurde. Erneuter Versuch nach Nutzerfortsetzung; persönliche Anmeldung nicht automatisieren.

## Vorheriger Ausbau: freie Ziele und Navigation

- Cloud-Schema read-only geprüft: `create_goal` in der Cloud setzt bei heute `starts_at = now()` und ruft danach `private.join` auf. Das erklärt `challenge_not_open`; die bisherige Migrationsliste hatte diese Funktionsabweichung nicht erkannt.
- Neue Migration `20261130120000_flexible_goals.sql`: Eigentümer-Buchung atomar bei Erstellung, neue RPC für Start-/Enddatum und private Freundesziele. Beispiel 3 km / heute / 20 Credits lokal geprüft. Cloud-Anwendung steht aus; Dry-run listet genau diese eine Migration.
- Eigene Kilometer (auch Kommazahlen) und Schritte, Datumseingaben, Freundesziele per Einladungscode. Start innerhalb 30 Tagen, Dauer bis 31 Tage; Freundesziele starten frühestens morgen, damit Freunde vor Start beitreten können.
- Vier Tabs: Home, Laufen, Ranked, Profil. Wallet und Community sind separate Unterseiten im Profil. Laufen zeigt letzte GPS-Strecke plus Verlauf und Detailkarten.
- Demo mit 20 Personen in den Ranked-Details, nach Zeitraum und km/Schritten angepasst; weiterhin nur Development und keine echten Konten/Buchungen.
- Trainingsplan: drei Einstiegsseiten, Konfetti/Motivation nach erfolgreichem Speichern, aktiver Plan auf Home.
- GPS-Fehler auf dem Gerät weiterhin nicht reproduziert/behoben bestätigt. Cloud-Funktion und Grants vorhanden, lokale GPS-Tests grün. Nutzer meldete keinen technischen Zusatztext. Fehlertext wird jetzt auch ohne `__DEV__` angezeigt; nach Cache-Neustart genaue Meldung erheben. Keine fremden Strecken auslesen.
- Prüfungen: Typecheck und Lint erfolgreich; 283 Jest-Tests erfolgreich (40 Suites im Gesamtlauf, letzte betroffene App-Flow-Suite separat erneut grün), 547 pgTAP-Prüfungen in 20 Dateien erfolgreich.
- Weitere Vorschläge stehen in [IDEEN.md](IDEEN.md), nicht ohne Nutzerentscheidung umsetzen.

## Fertig

- Phasen 6–8: Design, Community, Erinnerungen, Abzeichen und GPS-Aufzeichnung.
- Ausbau 1–2: Sicherheitsprüfung, Pool und Ranked, Profil und Anmeldung, Laufstatistik, Einsprüche, Freunde, Trainingspläne und Vorbereitung für Server-Push.
- Ausbau 3: Persönliche Ziele mit virtuellen Credits und Abrechnung pro Zeitraum, Tab „Aktivität“, feste Ranglisten und getrennte Registrierung/Anmeldung.
- Pool- und FAQ-Texte präzisiert: Die Übersicht zählt Personen und Credits in offenen oder laufenden Zielen; ob jemand gerade tatsächlich läuft, wird nicht behauptet. Setup-Test prüft ausdrücklich, dass ein Einsatz nach dem Start nicht zurückziehbar ist.
- Projektregeln gekürzt, alte MVP-Spezifikation und bisherige Übergabe unverändert gesichert, Claude-Lesesperren eingerichtet.
- Typecheck, Lint, 283 Jest-Tests und 540 lokale pgTAP-Prüfungen grün. Jest meldet nur doppelte manuelle Mock-Namen für `storage`.
- Zielbild erneut geprüft (13.11.2026): Home führt über „Ziel setzen“, erklärt den Ablauf beim ersten Öffnen und zeigt ein wichtigstes plus weitere Ziele. Freunde/Liga sind unter Ranked; Aktivität ist als Tab erreichbar, zeigt Health-Daten und GPS-Läufe und bietet Android-Strecken an. Ziele binden Credits ab Start; die Fensterabrechnung verteilt verfallene Einsätze anteilig, zieht `fee_bps` ab und bucht Rundungsreste ans Haus.
- Gerätestart mit `npm run start:cloud` bestätigt. Veraltete Stack-Routen für `invite/[code]` und `join/[code]` korrigiert. Ranked zeigt nur im Development Build eine lokale Vorschau mit 20 fiktiven Profilbildern und 400 Credits Beispiel-Guthaben je Person; keine Demo-Konten oder Einsätze werden gespeichert.
- Beitritt per Einladungscode blendet Challenge-Starts und -Enden vorab aus. Nach erfolgreichem Setzen eines Ziels oder Beitreten erscheint eine kurze animierte Begrüßung mit wechselndem Motivationsspruch.
- Profil-Query-Key in eigenes Modul verschoben; damit ist der Auth-/Account-Importzyklus behoben.
- Tagesziele starten ab Bestätigung bis zur lokalen Mitternacht. Bereits erfasste Schritte des Tages zählen mit; der Einsatz ist sofort gebunden. Migrationen `20261130100000_goal_today` und `20261130110000_goal_same_day_duration` ergänzen Funktion und Laufzeitregel.
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
- Sollen Trainingstage wählbar sein? Neue Pläne starten mit dem ersten Lauf am selben Tag und setzen die beiden weiteren Läufe zwei und vier Tage nach Wochenbeginn an. Mindestens 80 % der Strecke innerhalb derselben Planwoche zählen weiterhin.
- Tagesziele können ab sofort bis Mitternacht laufen; Woche und Monat nutzen feste Zeiträume. Alte Gruppen-Pools sind weiter per Code erreichbar. Weitere Annahmen stehen im [Archiv](HANDOFF_ARCHIV.md).
- Verteilung bei Rundung: ganzzahlige Credits werden proportional zum Einsatz verteilt; nicht verteilbare Rest-Credits gehen ans Haus. Die bestehende Gebühren- und Spendenlogik bleibt aktiv.

## Cloud-Aufgaben

1. Supabase-Backup prüfen und `20261130130000_immediate_results.sql` einspielen. Der Dry-run vom 15.11.2026 listete genau diese Migration. In `cron.job` die Jobs `advance-challenges` und `create-ranked-cycles` prüfen.
2. Privaten Bucket `avatars` und seine Regeln prüfen (512 KB, JPEG/PNG/WebP). E-Mail-Login und Passwortlänge 8 setzen, doppelte Bestätigung für E-Mail-Wechsel ausschalten und die OTP-Einstellung auf 8 Stellen prüfen.
3. Vorlagen aus `supabase/templates/` für Anmeldung, Registrierung und E-Mail-Wechsel übernehmen. Anschließend mit `npm run start:cloud` und echten E-Mails testen.
4. Server-Push auf einem installierten Android-Build mit Firebase-Konfiguration prüfen. Firebase, EAS-Zugangsdaten, Edge Function und Cron sind eingerichtet. Sentry ist optional.
5. Einladungsseite `docs/legal/i.html` und aktualisierten Datenschutz auf Netlify veröffentlichen. Datenschutz bei Bedarf um die lokale Health-Connect-Streckenanzeige ergänzen und das Vordergrunddienst-Formular der Play Console ausfüllen ([Release §2.8a](RELEASE.md)).
6. Bei Bedarf die NGO-Platzhalter in Supabase ersetzen und Einsprüche wie im [Archiv](HANDOFF_ARCHIV.md) beschrieben bearbeiten.
