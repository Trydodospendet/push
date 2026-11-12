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
