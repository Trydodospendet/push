# Übergabe – Branch `ausbau`

## Pfand-Modell statt Pool (16.11.2026)

- Neue Migration `20261201090000_pledge_model.sql`: Ziel erreicht → eigenes Pfand vollständig zurück (`payout` = Pfand). Ziel verfehlt → `private.settings.fee_bps` (Standard 10 %) ans Haus (`fee`), der Rest (90 %) als Spende an die gewählte Organisation (Konto `donation`). Je Ziel Summe 0, idempotent über den Status unter Zeilensperre. Die Pool-Aufteilung unter Gewinnern und die Fensterabrechnung (`settle_goal_window`) sind entfernt; jede Challenge wird einzeln abgerechnet (Pool und Ziel gleich).
- Spendenanteil konfigurierbar über `private.settings.fee_bps` (Hausanteil, wird beim Anlegen ins Ziel kopiert; die Spende ist der Rest). Offene/aktive Ziele werden in der Migration auf den aktuellen Wert gesetzt.
- Neue RPC `get_community_donations()` (Summe der Spenden im aktuellen Monat, ohne Namen). `get_my_donations`/`get_my_donation_totals` lesen aus der Teilnahme. `create_goal_with_preferences` hat jetzt optionale Organisation (Standard: Profil, sonst erste aktive; wird beim Anlegen festgehalten). Alte App-Builds funktionieren weiter.
- App: Texte auf „Pfand“, kein Gewinnanteil mehr, Organisation statt Spenden-Schalter, Zähler „Gemeinsam gespendet diesen Monat“ unter Profil → Spenden. Ergebnis „Pfand zurück“ bzw. „Dein Pfand wurde gespendet an …“.
- Cloud-Schritt (nur durch den Nutzer): Migration `20261201090000_pledge_model.sql` auf Produktion anwenden (Backup davor). Bis dahin rechnet die Cloud nach dem alten Modell ab.
- pgTAP: bestehende Abrechnungstests angepasst, neue Datei `23_pledge.test.sql`; `18_social` war am Montag wochentagsabhängig und ist repariert.

## Laufstart: falsche Route anhand des Screenshots behoben (15.11.2026)

- Der Screenshot zeigt die Detailseite „Lauf“, nicht den Aufnahmebildschirm. Home, Aktivität und Verbindungen verlinkten auf `/run/index`. Expo Router deutet `index` dort als Lauf-ID; ohne passenden Lauf erscheint irreführend der Verlaufsfehler, obwohl die API erfolgreich antwortet. Die vorige Empfehlung, nach oben zu scrollen, war deshalb falsch.
- Alle drei Einstiegspunkte öffnen jetzt `/run`. Ein Navigationstest reproduzierte vor der Korrektur den fehlenden Startbutton; nach der Korrektur wird „Lauf starten“ sichtbar. Regressionstests decken alle drei Einstiegspunkte ab.
- Typecheck, Lint, 294 Jest-Tests und 564 lokale Datenbanktests erfolgreich.
- Keine Supabase-Änderung erforderlich. Die Korrektur muss noch in einen neuen Android-Release und in den internen Play-Test; der veröffentlichte Build 6 enthält den Fehler weiterhin. GPS-Berechtigung, Aufzeichnung, Pause/Fortsetzen und Speichern am echten Handy bleiben danach zu prüfen.

## Laufaufzeichnung und Verlauf nachgeprüft (15.11.2026)

- Auf dem Handy gemeldet: „Deine Läufe konnten nicht geladen werden“, darunter „Erneut versuchen“. Diese Schaltfläche lädt den Verlauf neu. Die Aufnahme beginnt auf derselben Seite oben mit „Lauf starten“.
- Produktion mit einem synthetischen Testkonto geprüft. Die GPS-Aufzeichnung ließ sich speichern, im eigenen Verlauf aufrufen und als Strecke laden. Die Testtransaktion wurde vollständig zurückgerollt. Die beobachteten Android-Verlaufsanfragen lieferten HTTP 200 mit einer leeren JSON-Liste.
- Offen sind die Fehlermeldung auf dem Handy trotz erfolgreicher Serverantwort und der tatsächliche Ablauf nach „Lauf starten“. Es war kein Android-Gerät per ADB verbunden. Keine App- oder Datenbankänderung für diesen Befund.

## Zielbuchung in Produktions-Supabase aktiviert (15.11.2026)

- Nach ausdrücklichem Auftrag die beiden Migrationen `20261130130000_immediate_results.sql` und `20261130140000_book_friend_goal_owner.sql` in Produktion angewendet. Vorher wurden Schema und Daten der App sowie der bisherige Abrechnungsjob lokal unter `%LOCALAPPDATA%\PUSH\production-backups` gesichert. Die Sicherung liegt außerhalb des Repositorys.
- Ein persönliches Tagesziel mit 8.000 Schritten und ein Freundesziel mit 3,5 km wurden auf Produktion in einer zurückgerollten Testtransaktion geprüft. Pro Ziel wurde genau 1 virtueller Credit abgebucht, das Freundesziel enthielt die eigene Teilnahme und einen Einladungscode. Die Testdaten wurden vollständig zurückgerollt.
- Die Speicherfunktion ist über die API erreichbar und verlangt Anmeldung. `advance-challenges` läuft alle zehn Sekunden, der Produktions-Dry-run hat keine offenen Migrationen. Build 6 kann für die Buchung am Handy verwendet werden. Gerätetest mit einem angemeldeten Testkonto steht noch aus.

## Android-Release 6 im internen Google-Play-Test (15.11.2026)

- Google Play zeigt **6 (1.0.0)** als neuesten Release und **Für interne Tester verfügbar**. [Installationslink für Tester](https://play.google.com/apps/internaltest/4698843839792601650).
- Das signierte AAB `PUSH-v1.0.0-6.aab` liegt im Projektordner. Paketname, Versionscode 6, Signatur und Produktions-Supabase wurden geprüft. Die veröffentlichte App entspricht exakt Commit `8f5d2c6` und dem GitHub-Tag `android/internal/v6`.
- Der [Release-Ablauf](RELEASE.md#android-release-mit-github-abgleichen) beschreibt die Zuordnung von GitHub-Stand und Play-Version für künftige Updates. Typecheck, Lint, 291 Jest-Tests und 564 lokale Datenbanktests waren erfolgreich.
- Bei der Veröffentlichung fehlten die Zielmigrationen noch. Sie sind inzwischen angewendet, siehe oben. Zielbuchung, GPS-Messung und große Schrift am Gerät bleiben Teil der Abnahme.

## Frühere Oberfläche mit gezielten Korrekturen (15.11.2026)

- Oberfläche von `0cf92c6` als Basis. Tab-Navigation, Header, Laufübersicht, Ranked, Profil und verschiebbarer Pushy sind wieder wie vor dem Umbau. Home zeigt den Zielfortschritt, einen direkten Laufstart und bei aktivem Trainingsplan den nächsten offenen Lauf. Lange Zieltitel und Auswahltexte bleiben innerhalb ihrer Rahmen.
- „Ziel setzen“ ist wieder ein Formular auf einer Seite. Tagesziele, eigene Werte wie 3,5 km und Freundesziele bleiben möglich. „Angaben prüfen“ erklärt Zeitraum, Zielregel, Einsatz und Bindung. „Angaben ändern“ behält die Eingaben. Der lesende Produktions-Dry-run listet weiterhin beide erforderlichen Zielmigrationen. Echte Zielbuchungen stehen bis zur Anwendung nach [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung) aus.
- Pushy und die Laufaufzeichnung verwenden dieselbe Tempo-Berechnung. Die App wechselt erst nach erfolgreichem Start des Standortdienstes zur Laufansicht. Bei deaktiviertem Standort bleibt ein Hinweis sichtbar. Schlägt Fortsetzen fehl, bleibt der Lauf pausiert. Die GPS-Messwerte und das Layout mit großer Schrift müssen am Android-Gerät nach [Ablaufskript](UX-REDESIGN.md#vergleich-auf-dem-gerät) bestätigt werden.
- Typecheck, Lint, 291 Jest-Tests und 564 lokale Datenbanktests erfolgreich. Der interne Play-Test enthält Build 5. Die Änderungen benötigen für die Play-Verteilung ein neues AAB.

## Android-Release 5 im internen Google-Play-Test (15.11.2026)

- `PUSH-v1.0.0-5.aab` liegt im Projektordner. Der vollständige Android-Release von `f6fe360` wurde lokal mit Gradle und SDK 37 gebaut und mit dem Upload-Schlüssel von Version 4 signiert. Paket `com.pushchallenge.app`, Versionscode 5 und Produktions-Supabase im Bundle geprüft. Für diesen Release ist kein Metro nötig.
- Google Play zeigt **5 (1.0.0)** als neuesten Release und **Für interne Tester verfügbar**. Die Werbe-ID-Deklaration wurde passend zur App auf **Nein** korrigiert. [Interner Einladungslink](https://play.google.com/apps/internaltest/4698843839792601650).
- Für weitere Releases den nächsten freien Versionscode in der Play Console prüfen. Der EAS-Zähler stand vor dem lokalen Build noch auf 4.
- Typecheck, Lint, 288 Jest-Tests und 564 lokale PostgreSQL-Tests erfolgreich. Installation auf einem Testhandy und GPS-Vergleich im Freien stehen noch aus. Für echte Zielbuchungen fehlen in Produktion weiterhin die beiden unten dokumentierten Migrationen.

## Nachprüfung von Zielbuchung und GPS (15.11.2026)

- „Angaben prüfen“ zeigt zusätzlich die Zielregel und bei einem heutigen Tagesziel den Zeitraum bis Mitternacht. Bei Schritten steht dort auch, dass bereits erfasste Schritte zählen. System-Zurück geht im Entwurf einen Schritt zurück und erhält die Eingaben. Bestätigungsfenster folgen reduzierter Bewegung, und Buttons können bei großer Schrift umbrechen.
- Lokal reproduziert: Beim Freundesziel wurde der Einrichtungsschritt abgeschlossen, ohne den Einsatz des Erstellers zu buchen. `20261130140000_book_friend_goal_owner.sql` übernimmt die Buchung zusammen mit Zielanlage und eigener Teilnahme. Lokale Tests bestätigen 3,5 km, Einladungscode, einmalige Abbuchung, Gewinnverwendung, Rückgabe vor Start und vollständigen Rollback bei fehlendem Guthaben. Das persönliche Schrittziel startete in einer lokalen, zurückgerollten Testbuchung sofort und endete zur nächsten lokalen Mitternacht.
- Die lesende Produktionsabfrage fand die RPC `create_goal_with_preferences` noch nicht. Der Dry-run nennt `20261130130000_immediate_results.sql` und `20261130140000_book_friend_goal_owner.sql`. Die aktiven Cron-Jobs `advance-challenges` und `create-ranked-cycles` laufen derzeit alle fünf Minuten bzw. täglich um 12 Uhr laut Cron-Ausdruck. Die Backup-Liste meldete keine physischen Backups und deaktiviertes PITR. Vor dem Produktionslauf eine aktuelle Sicherung prüfen oder bereitstellen, danach beide Zielarten mit einem Testkonto nach [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung) buchen.
- Laufuhr und GPS-Status warten nach „Fortsetzen“ auf den ersten Punkt aus dem neuen Abschnitt. Jest prüft die Tempo-Umrechnung, Stillstand, ungenaue Messungen und die Trennung der Abschnitte. GPS-Werte im Freien und Vergleich mit einer Uhr sowie große Schrift und reduzierte Bewegung auf dem Gerät stehen offen. Die Aufgaben stehen im [Ablaufskript](UX-REDESIGN.md#vergleich-auf-dem-gerät).
- Metro wurde im Cloud-Modus mit Cache-Reset gestartet. Der jüngste in EAS verfügbare Android-Development-Build ist `f6a42466-8b39-48ca-9e89-1f15064619f0` (Commit `f8bb7ac`). Die Textanleitung lädt unabhängig vom erst später hinzugekommenen nativen Videomodul. Start des neuen Bundles auf dem Handy prüfen. Die Videos und die Play-Verteilung benötigen einen neuen Build.
- Typecheck, Lint, 288 Jest-Tests (43 Suites), 564 lokale DB-Tests (22 Dateien) und Android-JavaScript-Export erfolgreich. Vorversion lokal und auf GitHub unter `backup/pre-ux-redesign-2026-11-15` sowie im separaten Checkout bei `0cf92c6` bestätigt.

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

1. Beide Zielarten auf dem Handy mit einem Testkonto buchen. Die Produktionsmigrationen, die Speicherfunktion und der Cron-Zeitplan wurden geprüft.
2. Privaten Bucket `avatars` und seine Regeln prüfen (512 KB, JPEG/PNG/WebP). E-Mail-Login und Passwortlänge 8 setzen, doppelte Bestätigung für E-Mail-Wechsel ausschalten und die OTP-Einstellung auf 8 Stellen prüfen.
3. Vorlagen aus `supabase/templates/` für Anmeldung, Registrierung und E-Mail-Wechsel übernehmen. Anschließend mit `npm run start:cloud` und echten E-Mails testen.
4. Server-Push auf einem installierten Android-Build mit Firebase-Konfiguration prüfen. Firebase, EAS-Zugangsdaten, Edge Function und Cron sind eingerichtet. Sentry ist optional.
5. Einladungsseite `docs/legal/i.html` und aktualisierten Datenschutz auf Netlify veröffentlichen. Datenschutz bei Bedarf um die lokale Health-Connect-Streckenanzeige ergänzen und das Vordergrunddienst-Formular der Play Console ausfüllen ([Release §2.8a](RELEASE.md)).
6. Bei Bedarf die NGO-Platzhalter in Supabase ersetzen und Einsprüche wie im [Archiv](HANDOFF_ARCHIV.md) beschrieben bearbeiten.
