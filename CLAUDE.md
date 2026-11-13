# PUSH – Projektüberblick und Arbeitsregeln

## Produkt

PUSH ist eine App für iOS und Android. Nutzer setzen virtuelle Credits auf persönliche Lauf- oder Schrittziele. Wer sein Ziel erreicht, erhält den Einsatz zurück und kann am Topf des Zeitraums beteiligt werden. Daneben gibt es feste Ranglisten ohne Einsatz sowie bestehende Gruppen-Challenges. Die App übernimmt Aktivitäten aus Apple Health bzw. Health Connect und unterstützt eigene GPS-Aufzeichnungen.

## Stack

- Expo, React Native, TypeScript (strict) und Expo Router. Native Module brauchen einen Development Build mit `expo-dev-client`.
- Supabase für Auth, Postgres, RLS, RPCs und `pg_cron`. Migrationen liegen in `supabase/migrations/`.
- Apple Health über `@kingstinct/react-native-healthkit`, Android Health Connect über `react-native-health-connect` und `expo-health-connect`.
- TanStack Query für Serverdaten, Zod für Validierung, Inter als Schrift.
- Jest für App-Tests, pgTAP für die Datenbank, ESLint und Prettier.

## Nicht verhandelbare Regeln

- Ausschließlich virtuelle Credits und kostenlose Tarife. Keine Integration für echtes Geld, Aufladungen oder Auszahlungen.
- Guthaben, Buchungen, Gewinner und Abrechnung berechnet Postgres in Transaktionen. Beträge als ganze Cent (`bigint`), Abrechnungen idempotent, Ledger nur ergänzen.
- RLS auf jeder Tabelle. Geschützte Daten nur über RPCs ändern. Bei `SECURITY DEFINER` den `search_path` festlegen und bei Nutzer-RPCs `auth.uid()` prüfen.
- Manuell eingetragene Gesundheitsdaten zählen nie.
- Keine Secrets im Code. `.env` lokal, `.env.example` als Vorlage. Service-Role-Key niemals in der App.
- Kein `any`, keine auskommentierten Codeblöcke, keine ungenutzten Abhängigkeiten. Vor neuen Bibliotheken Expo-Kompatibilität prüfen.
- App-Name zentral in `src/config/app.ts`, UI-Texte auf Deutsch in `src/i18n/de.ts`, Design-Tokens in `src/theme/`. Code, Bezeichner und reguläre Commits auf Englisch. Kommunikation auf Deutsch.
- `compileSdkVersion` in `app.json` bleibt 37. Kein `supabase db push --remote`, `eas build`, `eas env`, Merge in `main` oder Force-Push.

## Arbeitsweise

1. Diese Datei und [die aktuelle Übergabe](docs/HANDOFF.md) lesen. Aus der Spezifikation und dem Repository nur die für den Auftrag nötigen Abschnitte und Dateien lesen.
2. Git-Stand prüfen und auf dem aktuellen Branch bleiben. Bei Unklarheit die einfachste sinnvolle Lösung wählen, unter „Offene Fragen“ festhalten und weiterarbeiten.
3. Nach jedem fertigen Teil `npm run typecheck`, `npm run lint`, `npx jest` und `npx supabase test db` ausführen. Danach die Übergabe aktualisieren, committen und pushen.
4. Setup-Anleitung bei Änderungen am Setup pflegen. Zum Abschluss in einfachen Worten erklären, was auf dem Gerät oder in der Cloud noch zu tun ist und ob ein Build nötig ist.

## Wo steht was?

[Ursprüngliche MVP-Spezifikation](docs/SPEC.md) mit unverändertem Wortlaut und ursprünglicher Nummerierung:

| Abschnitt | Inhalt |
|---|---|
| §1–4 | Produkt, MVP-Entscheidungen, ursprünglicher Stack und Grundregeln |
| §5 | Tabellen, RLS und RPCs |
| §6 | Challenge-Lebenszyklus, Zieltypen, Fortschritt und Abrechnung |
| §7 | Health-Integration, Validierung und Betrugsschutz |
| §8–10 | Screens, Design-System und Projektstruktur |
| §11–12 | Ursprüngliche Phasen, Abnahmekriterien und Arbeitsweise |

Diese Datei hat Vorrang bei Arbeitsregeln. Spätere Produktentscheidungen und der aktuelle Stand stehen in der Übergabe und ihrem Archiv.

- [Aktuelle Übergabe](docs/HANDOFF.md) und [bisherige Übergabe im Original](docs/HANDOFF_ARCHIV.md)
- [Lokales Setup und Development Builds](docs/SETUP.md) und [Testanleitung](docs/TESTING.md)
- [Sicherheit und Grenzen](docs/SECURITY_NOTES.md), [Server-Push](docs/PUSH.md) und [Veröffentlichung](docs/RELEASE.md)
