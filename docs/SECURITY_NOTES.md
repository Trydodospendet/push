# PUSH – Sicherheitsnotizen

Bekannte Grenzen des MVP (nur virtuelle Credits). Jeder Punkt muss gelöst sein, **bevor echtes Geld
ins Spiel kommt**.

## 1. Startguthaben wird vor bestätigter Anmeldung vergeben

**Stand (Phase 1):** Der Trigger `public.handle_new_user()` legt Profil, Wallet und das
Startguthaben (`signup_bonus`, 10.000 Cent) an, sobald Supabase einen Eintrag in `auth.users`
erzeugt. Bei der Anmeldung per E-Mail-Code passiert das schon, wenn jemand **einen Code anfordert**,
nicht erst, wenn der Code eingegeben und damit die E-Mail-Adresse bestätigt wurde.

**Folge:** Wer viele (auch fremde oder ausgedachte) Adressen eingibt, erzeugt viele Konten mit
Guthaben, ohne eine davon zu besitzen. Für virtuelle Credits ist das akzeptiert
(Entscheidung vom 12.11.2026).

**Vor echtem Geld (Startguthaben):** Ein Startguthaben – oder jede andere Gutschrift ohne Gegenleistung – darf erst
nach **bestätigter Anmeldung** vergeben werden (z. B. wenn `auth.users.email_confirmed_at` bzw.
`last_sign_in_at` gesetzt wird, oder per RPC nach dem ersten erfolgreichen Login), höchstens einmal
pro verifizierter Person (siehe auch KYC/Altersprüfung, nicht Teil des MVP). Unbestätigte Konten
sollten nach einer Frist automatisch gelöscht werden.

## 2. Gesundheitsdaten kommen vom Client (bekannte Grenze)

**Stand (Phase 3):** Die App liest Läufe und Tagesschritte aus Health Connect / Apple Health und lädt
sie über `sync_workouts` und `sync_daily_steps` hoch. Der Server prüft Plausibilität (Tempo zwischen
2:30 und 15:00 min/km, Mindestdauer, keine Zukunft, höchstens 80.000 Schritte pro Tag, Zeitfenster
45 Tage, höchstens 500 Läufe pro Aufruf) und rechnet den Fortschritt selbst. Er kann aber **nicht
prüfen, ob die hochgeladenen Daten echt sind**. Ein manipulierter Client oder eine App, die Läufe
fälscht und als „automatisch aufgezeichnet“ in Health Connect schreibt, bleibt unerkannt. Das Feld
`was_user_entered` wird vom Client gemeldet.

**Für virtuelle Credits akzeptiert.** **Vor echtem Geld nötig:** GPS-Routen als Beleg,
Geräte-/App-Attestierung (Apple App Attest, Play Integrity), Prüfung der Quell-App
(`source_name`/`dataOrigin`) gegen eine Liste vertrauenswürdiger Apps, Auffälligkeitserkennung
(z. B. identische Läufe, unmögliche Wechsel zwischen Orten).

## 3. Manuelle Schritte unter Android

Health Connect liefert Schritt-Summen pro Quell-App, nicht pro Eintrag. Wenn eine App an einem Tag
einen manuellen Schritt-Eintrag hat (`recordingMethod = MANUAL_ENTRY`), schließt PUSH diese App für
den **ganzen Tag** aus (`excluded_sources` in `activity_daily_steps`). Das verhindert Betrug, kann
aber echte Schritte dieser App unterschlagen. Entscheidung des Auftraggebers. Alternative für später:
nur die manuellen Zeitfenster abziehen (braucht Einzelwerte statt Summen).

## 4. Nicht geprüft: Apple Health

Der iOS-Teil (`src/features/health/healthkit.ts`) ist implementiert, wurde aber auf **keinem Gerät**
getestet (kein Mac/iPhone vorhanden). Insbesondere ungeprüft: ob die Statistik-Abfrage mit dem Filter
„nicht `HKWasUserEntered`“ auch Einträge ohne dieses Metadatenfeld mitzählt, und dass
Schritt-Duplikate zwischen iPhone und Watch durch die Statistik entfernt werden. Vor dem ersten
iOS-Test mit echten Nutzern prüfen.

## 5. Fortschritt anderer Teilnehmer

Teilnehmer sehen von anderen nur „geschafft / offen“. Die Spalte `challenge_participants.progress_value`
ist für Clients gesperrt (Spaltenrecht); den eigenen Fortschritt liefert `get_my_progress()`.

**Seit Phase 4:** Die Rangliste in Ranked (`get_leaderboard`) verrät die **Reihenfolge** der
Teilnehmer (wer weiter ist), aber keine Werte. Das ist bewusst so gewollt (Auftrag Phase 4).

## 6. Abrechnung und Haus-Konto (Phase 4)

- `settle_challenge` und `advance_challenges` sind für App-Nutzer **nicht aufrufbar** (nur
  Datenbank/`pg_cron`). Sonst könnte jemand eine Challenge während der Kulanzzeit abrechnen und
  späte Synchronisierungen anderer abschneiden. Zusätzlich prüft `settle_challenge` selbst, dass
  die Kulanzzeit vorbei ist.
- Doppelte Abrechnung ist dreifach verhindert: Statusprüfung unter Zeilensperre (`FOR UPDATE`),
  Unique-Index für `stake/payout/refund` je Person und Challenge, Unique-Index für Haus-Buchungen
  (`fee/rounding/forfeit`) je Challenge.
- Das Haus-Konto existiert nur als Ledger-Buchungen (`account = 'house'`) und ist für Nutzer
  unsichtbar. Verfallene Einsätze (Solo verfehlt, niemand gewinnt) gehen vollständig ans Haus –
  **Produktentscheidung, vor echtem Geld rechtlich prüfen** (Glücksspielrecht, Verbraucherschutz).
- Die Gebühr (`private.settings.fee_bps`) wird beim Erstellen in die Challenge kopiert und ändert
  sich danach nicht mehr.

## 7. Konto löschen (Phase 5)

- `delete_my_account()` löscht nur das **eigene** Konto (`auth.uid()`). Die eigentliche Arbeit macht
  `private.delete_account(user_id)`; diese Funktion ist für App-Nutzer nicht aufrufbar und dient
  dem Betreiber für Löschanfragen per E-Mail (SQL Editor in Supabase, siehe `docs/RELEASE.md`).
- **Einsatz-Regel:** Noch nicht gestartete Challenges (`open`) werden erstattet. In laufenden
  Challenges (`active`, `settling`) verfällt der Einsatz: Die Teilnahme bleibt als anonyme,
  verlorene Zeile im Topf und wird normal abgerechnet. Sonst würde den Gewinnern Geld fehlen, und
  die Summe aller Buchungen einer Challenge wäre nicht mehr 0. **Vor echtem Geld rechtlich prüfen**
  (verfallender Einsatz bei Kontolöschung).
- Gelöscht werden Auth-Nutzer, Profil, Wallet (Restguthaben verfällt – virtuelle Credits),
  Läufe und Tagesschritte. Ledger-Buchungen und Teilnahmen bleiben mit `user_id = NULL`
  (anonymisiert). Der Ledger bleibt append-only; nur dieses Anonymisieren ist erlaubt.
- Von anderen erstellte Challenges laufen weiter; selbst erstellte behalten `creator_id = NULL`.
- **Restrisiko:** Bei sehr kleinen Challenges (z. B. 2 Personen) kann ein anderer Teilnehmer aus der
  Teilnehmerliste („Gelöschtes Konto“) erraten, wer gelöscht hat. Gesundheitsdaten sind nicht mehr
  vorhanden.
- Lokal auf dem Handy werden die Sitzung und der Health-Status gelöscht. Die
  Health-Connect-Berechtigung selbst entzieht die App nicht automatisch; der Nutzer wird darauf
  hingewiesen.

## 8. GPS-Läufe (Phase 8)

**Was der Server prüft** (`public.sync_gps_run`, Migration `20261121090000_gps_runs.sql`):

- Distanz und Zeit werden **aus den Rohpunkten neu berechnet**; Zahlen vom Handy werden nicht benutzt.
- Punkte mit Genauigkeit über 50 m werden ignoriert. Ein Schritt schneller als 12 m/s (unter
  2:19 min/km) ist ein „Sprung“ und wird nicht gezählt; drei oder mehr Sprünge machen den Lauf
  ungültig (`gps_jump`). Ein Punkt, den das Handy als „mocked“ meldet, macht ihn ungültig
  (`mock_location`).
- Dieselben Tempogrenzen wie bei Health-Läufen (schneller als 2:30 oder langsamer als 15:00 min/km)
  plus: mehr als 10 % der Strecke schneller als 2:05 min/km ist `too_fast` (Fahrrad).
- Höchstens 20.000 Punkte pro Lauf und 30 Läufe pro 24 Stunden. Ein Lauf kann nicht nachträglich
  geändert werden (feste `client_run_id`).
- **Keine doppelte Zählung:** Überlappt ein gültiger Health-Lauf einen GPS-Lauf um mindestens die
  Hälfte des kürzeren, zählt nur der Health-Lauf (der GPS-Lauf wird `duplicate`). Das wird nach jedem
  Sync neu entschieden.

**Datenschutz:** Die Rohstrecke (`gps_runs.route`) hat keinen direkten Client-Zugriff (RLS ohne
Policy, keine Grants). Nur der Besitzer bekommt sie über `get_gps_run_route`, und dort **ohne die
ersten und letzten 200 m**; unter 400 m gibt es keine Karte. Andere Teilnehmer sehen nur die Distanz.

**Bekannte Grenzen (nicht gelöst):**

- Die Mock-Erkennung nutzt das Flag `mocked` von Android. **iOS liefert dieses Flag über
  `expo-location` nicht**; dort bleiben nur die Plausibilitätsregeln.
- Ein manipulierter Client kann eine **erfundene, aber glaubwürdige Strecke** hochladen (gleichmäßiges
  Tempo, echte Koordinaten). Die Regeln begrenzen das, beweisen aber nichts. Für virtuelle Credits
  akzeptiert. **Vor echtem Geld:** App Attest (iOS) / Play Integrity (Android), Abgleich mit
  Bewegungssensoren, höhere Hürden für Wiederholungen derselben Strecke.
- Ein Lauf wird erst nach Ende hochgeladen. Stürzt die App ab, bleibt ein Zwischenstand (alle 30 s)
  verschlüsselt auf dem Handy und wird beim nächsten Start zur Fortsetzung angeboten.

## 9. Feed, Wochen-Challenge, Abzeichen (Phase 7)

- Der Feed (`challenge_feed`) wird nur von Triggern geschrieben und ist nur für Teilnehmer lesbar;
  Einträge enthalten Name, Art, bei Läufen die Distanz. Anfeuern: einmal pro Person und Eintrag
  (Primärschlüssel), nicht bei eigenen Einträgen.
- Wochen-Challenges legt nur `pg_cron` an (`create_weekly_challenge`, für Clients gesperrt); der
  eindeutige `weekly_key` verhindert Doppelte.
- Abzeichen und Level werden ausschließlich im Server vergeben; Clients können nur lesen und ein
  Abzeichen als „gesehen“ markieren.
