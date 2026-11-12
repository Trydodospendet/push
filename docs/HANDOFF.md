# Handoff Phase 6 (Branch phase-6-design, WIP)

**Fertig (ungetestet außer DB):** Migration `20261117090000_stats.sql` (get_my_stats, get_my_week, get_potential_win) + pgTAP `06_stats` grün, DB-Typen neu erzeugt; Komponenten Avatar, ProgressRing, EmptyState; Intro-Pager + IntroProvider + Root-Gating (`app/_layout.tsx`, `onboarding/intro.tsx`, `how-it-works.tsx`); Stats-API, WeekChart, WinCelebration, home-sections; Leer-Zustände in Ranked, Solo, Wallet; de.ts-Texte.
**Offen:**
1. Home (`app/(tabs)/index.tsx`) umbauen: `ProgressSummary ring`, `StreakAndWeek`, `RecentWins`; Leer-Zustand mit `EmptyState`.
2. Challenge-Detail: Topf groß, Avatare (Teilnehmerliste, Leaderboard), `usePotentialWin`, Badge „Automatisch geprüft“.
3. Profil: Avatar, Bilanz (useMyStats), Eintrag „So funktioniert's“ → `/how-it-works`.
4. `<WinCelebration />` in `app/(tabs)/_layout.tsx` einbauen; `statsKeys.all` nach Sync invalidieren (health-provider).
5. Jest-Flow-Tests: `jest.mock('@/features/intro/storage')` ergänzen; ungenutzte de-Keys (emptyMine, emptyOpen, …) entfernen.
**Nächster Schritt:** `npm run typecheck`, `npm run lint`, `npm test`, `supabase test db`; Fehler beheben, dann Punkte 1–5, committen, pushen.
