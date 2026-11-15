# PUSH – Ablaufskript für Gerätetests

## Home

1. Öffne **Home**. Das wichtigste Ziel zeigt den synchronisierten Fortschritt sowie die Restzeit oder den geplanten Start. Tippe auf die Karte, um Regeln, Aktivität und Ergebnis zu sehen.
2. Unter **Ziel setzen** sind **Lauf aufzeichnen** und der Trainingsplan erreichbar. Bei einem laufenden Plan zeigt die Karte den nächsten offenen Lauf ab heute.
3. Die Schritte, Wochenstatistik und Erfolge stehen weiter unten. Pushy ist ein verschiebbares Symbol. Antippen wechselt zur Tempoansicht, das Kreuz blendet Pushy aus und der kleine Punkt zeigt ihn wieder an.

## Ein Ziel setzen

Ziel, Zeitraum und Einsatz stehen auf einer Seite.

1. **Ziel.** Wähle einen einzelnen Lauf, eine Gesamtstrecke, Schritte pro Tag oder Schritte insgesamt. Nimm einen Vorschlag oder gib einen eigenen Wert ein, etwa **3,5 km**. Unter der Auswahl steht, was für das Ziel zählt.
2. **Zeitraum.** Entscheide, ob du allein oder mit Freunden startest. Wähle eine Vorlage oder stelle Anfang und letzten Tag selbst ein. Die App zeigt den Zeitraum mit Wochentagen. Ein Freundesziel muss frühestens morgen starten. Nach dem Speichern steht der Einladungscode in den Zieldetails.
3. **Einsatz.** Wähle virtuelle Credits. Unter der Auswahl siehst du dein verfügbares Guthaben, sobald es geladen ist. Lege fest, ob du einen möglichen Gewinnanteil behältst oder einer Organisation zuordnest.
4. **Angaben prüfen.** Lies, wie viel jetzt abgebucht wird, wann der Einsatz gebunden ist und was beim Erreichen oder Verfehlen passiert. Mit **Angaben ändern** kannst du zurückgehen. Die Abbuchung erfolgt erst mit **Credits setzen**. Am Zielende zählt der bis dahin synchronisierte Stand.

## Laufen und Verlauf

1. Tippe auf **Pushy**, um GPS ohne Laufaufzeichnung zu prüfen. Erlaube den Standort. Tippe erneut auf die Anzeige, um die Vorschau zu schließen.
2. Öffne **Lauf aufzeichnen**. Beim Lauf stehen die aktuelle **Geschwindigkeit in km/h** und die **durchschnittliche Pace in min/km** getrennt im Bedienfeld. **—** steht für eine fehlende, ungenaue oder veraltete Messung. Bei gemessenem Stillstand steht **0**. Wenn das Gerät keine Geschwindigkeit liefert, kann die App sie über mehrere Sekunden aus ausreichend genauen Positionen schätzen.
3. Unter **Laufen** erscheinen die GPS-Aufzeichnungen, importierte Läufe und Schritte in der vertrauten Übersicht. Der Bericht eines importierten Laufs nennt den Grund, wenn er für ein Ziel ungültig ist.

## Welche Studien sind dafür relevant?

- **Menüstruktur am Smartphone.** In einem Experiment mit einem Buchungsprototyp schnitten bei komplexeren Aufgaben gegliederte Menüs und die erwartete Reihenfolge besser ab. Für PUSH leite ich daraus die Reihenfolge Ziel, Zeitraum, Einsatz und die getrennten Bereiche im Profil ab. [Effects of Menu Arrangement and User Script on Task Using Smartphone Applications](https://www.koreascience.or.kr/article/JAKO202116047274077.do)
- **Visuelle Komplexität.** Tuch et al. (2012) untersuchten, wie Komplexität und Vertrautheit den ästhetischen Ersteindruck von Webseiten beeinflussen. Für PUSH spricht das für vertraute Tab-Bezeichnungen, eine hervorgehobene Zielkarte und weniger gleichzeitig sichtbare Statistik. Die Studie prüfte den Ersteindruck anhand von Website-Screenshots. [Tuch et al., The Role of Visual Complexity and Prototypicality](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/)
- **Fortschritt beobachten.** Harkin et al. (2016) werteten 138 randomisierte Studien mit 19.951 Teilnehmenden aus. Interventionen, die die Beobachtung des Zielfortschritts förderten, verbesserten im Mittel die Zielerreichung. Das stützt den sichtbaren Fortschritt auf der Startseite. Wie gut die konkrete PUSH-Oberfläche funktioniert, lässt sich mit den Aufgaben unten prüfen. [Harkin et al., Does Monitoring Goal Progress Promote Goal Attainment?](https://pubmed.ncbi.nlm.nih.gov/26479070/)

## Vergleich auf dem Gerät

- Auf **Home** die Zielkarte, den Laufstart, den nächsten Trainingslauf und den verschiebbaren Pushy prüfen. Mit großer Schrift prüfen, ob der Zieltitel, die Eingabefelder und die Schaltflächen in ihren Rahmen bleiben.
- Im leeren Testkonto unter „Ziel setzen“ ein persönliches Tagesziel mit 8.000 Schritten und 1 Credit vorbereiten. In „Angaben prüfen“ kontrollieren, welche Schritte zählen und ab wann der Einsatz gebunden ist.
- Ein Freundesziel mit **3,5 km** vorbereiten und einen eigenen Zeitraum wählen. In „Angaben prüfen“ Wert, Zeitraum, Einsatz und Bindung ab Start kontrollieren. Über „Angaben ändern“ zurückgehen, das Enddatum ändern und den erhaltenen Kommawert prüfen. Nach den Migrationen mit einem Testkonto buchen und Guthaben sowie Einladungscode kontrollieren.
- Draußen Pushys Tempoanzeige öffnen. Rund 20 Sekunden stehen, dann gleichmäßig gehen und laufen. Den Bereich in km/h und gegebenenfalls den Wert einer Uhr im selben Abschnitt festhalten. In „Lauf aufzeichnen“ die Standortberechtigung ablehnen und danach erlauben. Bei ausgeschaltetem Standort muss beim Start ein Hinweis sichtbar bleiben. Nach „Pause“ und „Fortsetzen“ darf die App bis zur neuen Messung kein altes Tempo und keine Pausenzeit anzeigen.
- Mit großer Schrift und reduzierter Bewegung prüfen, ob alle Schritte und Einstellungen erreichbar sind. Für den Vergleich Fragen, Fehlversuche und benötigte Zeit je Aufgabe festhalten.

## Vorversion öffnen

Die Vorversion des Quellcodes liegt lokal und auf GitHub unter dem Tag `backup/pre-ux-redesign-2026-11-15` (Commit `0cf92c6`). Der PowerShell-Aufruf aus dem Projektordner legt den Stand neben dem aktuellen Projekt als `PUSH-vor-umbau` ab.

```powershell
.\scripts\preview-previous.ps1
```

Für einen eigenen Zielordner gibt es `-Destination`. Der Ordner erhält die in Git versionierten Dateien. Zum Start dort Abhängigkeiten per `npm ci` installieren und die lokale Konfiguration nach [Setup](SETUP.md) einrichten.

## Auf dem Gerät ausprobieren

Mit einem passenden Development Build lässt sich der neue Stand über einen Metro-Neustart mit `npm run start:cloud -- --clear` laden. Im selben WLAN lässt sich die im Terminal angezeigte Metro-Adresse auch im Expo Dev Launcher über „Enter URL manually“ eingeben. Der jüngste verfügbare Android-Development-Build stammt vom Commit `f8bb7ac`. Die Textanleitung ist auch für diesen Build verfügbar, die Videos benötigen das native Modul `expo-video`. Der Start dieses Builds mit dem neuen Bundle muss auf dem Gerät bestätigt werden. Für die Play-Verteilung ist ein neuer Build nötig.

Vor einer Produktionsbuchung sind `20261130130000_immediate_results.sql` und `20261130140000_book_friend_goal_owner.sql` erforderlich. Ablauf in [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung).
