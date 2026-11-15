# PUSH – Ablaufskript für die überarbeitete App

## Heute

1. Öffne **Heute**. Oben stehen das Datum und das wichtigste Ziel. Die Karte zeigt den synchronisierten Fortschritt sowie die Restzeit oder den geplanten Start. Tippe die Karte an, um Regeln, Aktivität und Ergebnis zu sehen.
2. Ohne Ziel führt die hervorgehobene Karte zu **Ziel setzen**. Darunter sind **Lauf aufzeichnen** und der Trainingsplan erreichbar. Bei einem laufenden Plan zeigt die Karte den nächsten offenen Lauf ab heute, sobald er berechnet ist.
3. Weiter unten stehen die heutigen Schritte, der Verbindungsstatus bei Bedarf und Pushy. Die Animation folgt den Einstellungen der App und des Systems. Unter **Wochenstatistik und Erfolge** lassen sich die zusätzlichen Zahlen aufklappen.

## Ein Ziel setzen

1. **Ziel.** Wähle einen einzelnen Lauf, eine Gesamtstrecke, Schritte pro Tag oder Schritte insgesamt. Nimm einen Vorschlag oder gib einen eigenen Wert ein, etwa **3,5 km**. Unter der Auswahl steht, was für das Ziel zählt.
2. **Zeitraum.** Entscheide, ob du allein oder mit Freunden startest. Wähle eine Vorlage oder stelle Anfang und letzten Tag selbst ein. Die App zeigt den Zeitraum mit Wochentagen. Ein Freundesziel muss frühestens morgen starten. Nach dem Speichern steht der Einladungscode in den Zieldetails.
3. **Einsatz.** Wähle virtuelle Credits. Unter der Auswahl siehst du dein verfügbares Guthaben, sobald es geladen ist. Lege fest, ob du einen möglichen Gewinnanteil behältst oder einer Organisation zuordnest. Ziel und Zeitraum stehen zur Kontrolle auf derselben Seite.
4. **Angaben prüfen.** Lies, wie viel jetzt abgebucht wird, wann der Einsatz gebunden ist und was beim Erreichen oder Verfehlen passiert. Mit **Angaben ändern** kannst du zurückgehen. Die Abbuchung erfolgt erst mit **Credits setzen**. Am Zielende zählt der bis dahin synchronisierte Stand.

## Laufen und Verlauf

1. Öffne **Aktivität → Live-Tempo testen**, um GPS ohne Laufaufzeichnung zu prüfen. Erlaube dafür den Standort. Das Tempo wird beim Schließen der Vorschau oder Verlassen des Tabs abgeschaltet.
2. Öffne **Lauf aufzeichnen**. Beim Lauf stehen die aktuelle **Geschwindigkeit in km/h** und die **durchschnittliche Pace in min/km** getrennt im Bedienfeld. **—** steht für eine fehlende, ungenaue oder veraltete Messung. Bei gemessenem Stillstand steht **0**. Wenn das Gerät keine Geschwindigkeit liefert, kann die App sie über mehrere Sekunden aus ausreichend genauen Positionen schätzen.
3. Öffne nach dem Speichern den Filter **GPS-Läufe**. **Importierte Läufe** und **Schritte** haben eigene Filter. Der Bericht eines importierten Laufs nennt den Grund, wenn er für ein Ziel ungültig ist.
4. Unter **Ranked** lässt sich die Rangliste nach Tag, Woche und Monat filtern. **Freunde & Liga** ist direkt erreichbar. Im Profil sind Credits, Konto, App-Einstellungen und Hilfe gruppiert.

## Welche Studien sind dafür relevant?

- **Menüstruktur am Smartphone.** In einem Experiment mit einem Buchungsprototyp schnitten bei komplexeren Aufgaben gegliederte Menüs und die erwartete Reihenfolge besser ab. Für PUSH leite ich daraus die Reihenfolge Ziel, Zeitraum, Einsatz und die getrennten Bereiche im Profil ab. [Effects of Menu Arrangement and User Script on Task Using Smartphone Applications](https://www.koreascience.or.kr/article/JAKO202116047274077.do)
- **Visuelle Komplexität.** Tuch et al. (2012) untersuchten, wie Komplexität und Vertrautheit den ästhetischen Ersteindruck von Webseiten beeinflussen. Für PUSH spricht das für vertraute Tab-Bezeichnungen, eine hervorgehobene Zielkarte und weniger gleichzeitig sichtbare Statistik. Die Studie prüfte den Ersteindruck anhand von Website-Screenshots. [Tuch et al., The Role of Visual Complexity and Prototypicality](https://research.google/pubs/the-role-of-visual-complexity-and-prototypicality-regarding-first-impression-of-websites-working-towards-understanding-aesthetic-judgments/)
- **Fortschritt beobachten.** Harkin et al. (2016) werteten 138 randomisierte Studien mit 19.951 Teilnehmenden aus. Interventionen, die die Beobachtung des Zielfortschritts förderten, verbesserten im Mittel die Zielerreichung. Das stützt den sichtbaren Fortschritt auf der Startseite. Wie gut die konkrete PUSH-Oberfläche funktioniert, lässt sich mit den Aufgaben unten prüfen. [Harkin et al., Does Monitoring Goal Progress Promote Goal Attainment?](https://pubmed.ncbi.nlm.nih.gov/26479070/)

## Vergleich auf dem Gerät

- Leeres Konto öffnen. Ohne Erklärung ein persönliches Schrittziel für heute mit einem kleinen Einsatz vorbereiten und vor der Buchung erklären, was heute zählt und wann der Einsatz gebunden ist.
- Ein eigenes Laufziel mit Kommawert und Freunden vorbereiten. Zurückgehen, Zeitraum ändern und kontrollieren, dass der Zielwert erhalten bleibt. Für eine echte Testbuchung ein Testkonto nutzen.
- Draußen im Stand, beim Gehen und beim Laufen prüfen, wie schnell die Anzeige reagiert. Die Geschwindigkeit über einen gleichmäßigen Abschnitt mit einer Uhr oder Referenzmessung vergleichen. Pause, Fortsetzen und fehlende Freigabe prüfen.
- Mit großer Schrift und reduzierter Bewegung prüfen, ob alle Schritte und Einstellungen erreichbar sind. Für den Vergleich Fragen, Fehlversuche und benötigte Zeit je Aufgabe festhalten.

## Vorversion öffnen

Die Vorversion des Quellcodes liegt lokal und auf GitHub unter dem Tag `backup/pre-ux-redesign-2026-11-15` (Commit `0cf92c6`). Der PowerShell-Aufruf aus dem Projektordner legt den Stand neben dem aktuellen Projekt als `PUSH-vor-umbau` ab.

```powershell
.\scripts\preview-previous.ps1
```

Für einen eigenen Zielordner gibt es `-Destination`. Der Ordner erhält die in Git versionierten Dateien. Zum Start dort Abhängigkeiten per `npm ci` installieren und die lokale Konfiguration nach [Setup](SETUP.md) einrichten.

## Auf dem Gerät ausprobieren

Mit einem passenden Development Build lässt sich der neue Stand über einen Metro-Neustart mit `npm run start:cloud -- --clear` laden. Für die Play-Verteilung ist ein neuer Build nötig. Die lesende Prüfung am 15.11.2026 zeigte die bereits vorhandene Migration `20261130130000_immediate_results.sql` weiterhin als offen. Vor dem Speichern von Zielen gegen Produktion muss sie nach [Setup](SETUP.md#coach-header-und-endgültige-zielauswertung) eingespielt werden.
