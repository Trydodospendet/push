# Auftrag: Design-Reset + Echtgeld-Pfand (17.11.2026)

Branch `ausbau`. Erst CLAUDE.md und docs/HANDOFF.md lesen. Ohne Rückfragen arbeiten.
**Reihenfolge: zuerst Teil A komplett (committen, pushen), dann Teil B.** Nach jedem Teil Typecheck, Lint, Jest.
Keinen `eas build`, kein `supabase db push --remote`.

---

## Teil A: Design-Reset (keine Funktionen ändern)

Verbindliche Vorlage: `docs/design/zielbild/*.dc.html` (Home, Lauf, Geschafft, Profil). Farben, Abstände,
Schriftgrößen und Aufbau möglichst genau so nachbauen. Feste Regeln für ALLE Bildschirme:

1. **Fell NUR für Pushy und die eine große Zahl** (Home und Lauf). Sonst nirgends.
   - Hauptknöpfe: flaches Lime `#C6FF00`, schwarzer Text, Höhe 56, voll abgerundet, weicher Glow nur beim
     Hauptknopf. `pill-*.webp` nicht mehr verwenden.
   - Tab-Leiste und Symbole (Flamme, Pokal, Herz): klare Linien-Icons (vorhandene Icon-Bibliothek, sonst
     lucide). Aktiv Lime, inaktiv `#6E6E6E`. Keine Fell-Icons.
2. **Pushy höchstens einmal pro Bildschirm**, nur auf Home, Lauf-Start und Ziel-geschafft. Im laufenden
   Lauf kein Pushy. Kleinen Pushy oben rechts und die Sprüche („Das kitzelt!“ usw.) entfernen. Antippen auf
   Home: schläft ein / wacht auf bleibt.
3. **Riesenwörter** (LOS, 3 KM, GESCHAFFT): nur noch auf Ziel-geschafft, Weiß 8 %, Pushy darf höchstens das
   untere Viertel verdecken. Sonst entfernen.
4. **Farben:** Hintergrund `#0A0A0A`, Karten `#151515` mit 1px `#222222`, Text Weiß, Nebentext `#9A9A9A`,
   ein Akzent Lime. Keine olivgrünen Verläufe; nur ein dezenter Lime-Schein oben auf Home.
5. **Abstände:** 8er-Raster, Bildschirmrand 20. Schrift Inter: Überschriften 3 Größen, Fließtext 15,
   Labels 11–12 in Großbuchstaben mit Sperrung.
6. **Aufräumen:** doppelte „STATISTIK“ entfernen. Lange Fragen nie als Knopf (Textlink oder FAQ). Leere
   Zustände: ein Satz plus ein Knopf.
7. **Karte im Lauf:** dunkler Kartenstil, Route und Position in Lime, Position mit Leuchtring.
8. Vor dem Commit Screenshots (Web oder Emulator) von Home, Laufen, Lauf, Ranked, Profil gegen die Vorlage
   prüfen. Safe Areas beachten, nichts abgeschnitten.

9. **Gewohnte Bedienmuster (Jakob's Law):** Nutzer kennen Instagram/TikTok/Strava, also nichts neu erfinden.
   Tab-Leiste: Home ganz links, Profil ganz rechts, maximal 4 Tabs, nur das Wichtigste. Auf jeder Liste und
   auf Home „Runterziehen = neu laden“. Android-Zurück-Geste und Wischen schließen Sheets. Tippflächen
   mindestens 44 px. Kurze Haptik bei wichtigen Aktionen. Ladezustände als Skeleton statt leerer Fläche.

---

## Teil B: Echtgeld-Pfand mit Stripe (standardmäßig AUS)

Der Nutzer erlaubt ausdrücklich, Echtgeld vorzubereiten. Regel in CLAUDE.md anpassen zu:
„Echtgeld nur hinter Server-Schalter, nur Stripe-Testschlüssel, niemals Live-Schlüssel ins Repo.“

Modell: Das Pfand geht an PUSH. Verfällt es, spenden **wir** 90 % weiter. Die App sammelt keine Spenden.

1. **Reservieren statt abbuchen:** Stripe PaymentIntent mit `capture_method=manual` (Karte, Apple Pay,
   Google Pay über PaymentSheet, `@stripe/stripe-react-native`). Ziel erreicht → PaymentIntent canceln.
   Ziel verfehlt → capture. Echtgeld-Ziele maximal 7 Tage. Läuft eine Reservierung vorher ab: Ziel als
   „nicht gesichert“ behandeln, nichts abbuchen.
2. **Server-Schalter:** `private.settings.real_money_enabled` (Standard false) plus Liste erlaubter
   Testnutzer. App fragt beim Start ab; aus = alles wie bisher mit Credits.
3. **Edge Functions:** `create-pledge-intent` (prüft Nutzer, Betrag 1–50 €, Ziel), `stripe-webhook`
   (Signatur prüfen, idempotent), Abrechnung beim Settlement über capture/cancel, idempotent mit
   Wiederholung. Stripe-Customer pro Nutzer. Schlüssel nur als Supabase-Secrets
   (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`).
4. **Datenbank:** Tabelle für Zahlungen (reserviert/aufgehoben/abgebucht/fehlgeschlagen, Betrag,
   PaymentIntent-ID), RLS nur eigene Zeilen. Ledger bleibt append-only. Spendenpflicht als eigener
   Datensatz (90 % je abgebuchtem Pfand, Organisation, Monat) für einen monatlichen Spendenbericht.
5. **App:** Pfand-Flow bei aktivem Echtgeld: „5 € werden reserviert, nicht abgebucht. Schaffst du dein Ziel,
   wird nichts abgebucht. Verfehlst du es, wird dein Pfand fällig; 90 % davon spenden wir an
   [Organisation].“ Profil: „Zahlung & Pfand“ mit Übersicht (wie in der Vorlage).
6. **Texte überall** (App, FAQ, Doku): „Das Pfand geht an uns, wir spenden 90 % weiter.“ Nie „die App
   sammelt Spenden“ oder „dein Pfand wird gespendet“. FAQ: keine Spendenquittung für Nutzer.
7. AGB-/Datenschutz-Ergänzungen für Stripe als Entwurf in `docs/` (für den Anwalt markiert).
8. **Tests** (Jest + pgTAP, Stripe-Testmodus): Reservierung, Erfolg (cancel), Misserfolg (capture),
   doppelte Webhooks, abgelaufene Reservierung, Schalter aus.
9. `docs/ECHTGELD.md`: Schritt-für-Schritt für den Nutzer (Stripe-Konto, Test- und Live-Schlüssel als
   Secret, Webhook eintragen, Schalter erst für Testnutzer, dann für alle).

Am Ende: HANDOFF.md aktualisieren, committen, pushen, in 10 Zeilen berichten und sagen, welche Befehle der
Nutzer ausführen muss (Migration, Secrets, Build).
