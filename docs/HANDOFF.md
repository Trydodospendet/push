# Handoff (Stand: laufende Nacht-Session)

## Fertig
- Phase 8 Teil A (DB): `20261121090000_gps_runs.sql` (sync_gps_run mit Server-Nachrechnung, Betrugsregeln, Dedupe mit Health, Route ohne 200 m an den Enden), pgTAP `10_gps`.

- Phase 6 (Design) – in main.
- Phase 7 komplett (Branch `phase-7-community`):
  1. Lokale Erinnerungen (`src/features/reminders/`), Profil-Karte, Datenschutz.
  2. Wochen-Challenge (`20261118090000_weekly_challenges.sql`, pgTAP `07_weekly`), Ranked-Tab.
  3. Feed + Anfeuern (`20261119090000_feed.sql`, pgTAP `08_feed`, `src/features/feed/`), Datenschutz.
  4. Abzeichen + Level (`20261120090000_badges.sql`, pgTAP `09_badges`, `src/features/badges/`).

## Offen

- Phase 8 Teile B–E: Kernlogik (TS), Aufzeichnung, Karte, Datenschutz/Docs.

## Nächster Schritt

Phase 8 Teil B: GPS-Kernlogik in TypeScript + Tests.

## Offene Fragen

(keine)
