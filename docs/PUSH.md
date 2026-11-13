# Push-Nachrichten vom Server – Einrichtung

Stand: **vorbereitet, nicht eingeschaltet**. Die App und die Datenbank sind fertig; es fehlen
Schritte in Firebase, Expo/EAS und Supabase, die nur du ausführen kannst. Bis dahin passiert
nichts (die lokalen Erinnerungen funktionieren unabhängig davon).

## Wie es funktioniert

1. Die App registriert beim Einschalten (Profil → Benachrichtigungen → _Push-Nachrichten_) den
   Expo-Push-Token des Handys (`register_push_token`).
2. Ereignisse in der Datenbank schreiben Nachrichten in die Tabelle `push_outbox` (Migration
   `20261128090000_push_outbox.sql`): _Dein Ergebnis ist da_ (Abrechnung), _… feuert dich an_
   (Anfeuern) und Freundschaftsanfragen. Jede Art lässt sich in der App ausschalten.
3. Die Edge Function `supabase/functions/send-push` schickt wartende Nachrichten an Expos
   Push-Dienst (der über Firebase Cloud Messaging an Android zustellt), markiert sie als gesendet
   und löscht ungültige Tokens.
4. Tippt jemand auf die Nachricht, öffnet die App die Challenge (`data.url`).

Eine Nachricht enthält nur Titel, kurzen Text und einen Link `/challenge/<id>` – keine
Gesundheitsdaten, keine Beträge.

## Das musst du einrichten

### 1. Firebase (für Android-Push)

1. <https://console.firebase.google.com> → _Projekt hinzufügen_ (z. B. „PUSH“), Analytics aus.
2. _Projekteinstellungen → Allgemein → Android-App hinzufügen_: Paketname `com.pushchallenge.app`.
   Die Datei **`google-services.json`** herunterladen.
3. Die Datei in den Projektordner legen (neben `app.json`) und in `app.json` unter `expo.android`
   eintragen: `"googleServicesFile": "./google-services.json"`. **Nicht committen** (die Datei steht
   schon in `.gitignore`).
4. In Firebase: _Projekteinstellungen → Dienstkonten_ → **Neuen privaten Schlüssel generieren**
   (JSON). Dieser Schlüssel gehört zu Expo (Schritt 2).

### 2. Expo / EAS

1. `eas login`, dann `eas credentials` → Android → _Google Service Account Key for Push
   Notifications (FCM V1)_ → die JSON aus Firebase hochladen.
2. Das Projekt ist schon verknüpft (`extra.eas.projectId` in `app.json`).
3. **Neuen Build erstellen** (`eas build`), weil `google-services.json` in die App gehört.
4. Optional (empfohlen): _Push-Sicherheit_ auf <https://expo.dev> aktivieren und einen Access Token
   erzeugen; dann in der Edge Function den Header `Authorization: Bearer <Token>` beim Aufruf von
   Expo ergänzen.

### 3. Supabase

1. Die Migration hochladen (gehört zu den Migrationen in `docs/HANDOFF.md`, „Cloud-Aufgaben“).
2. Edge Function bereitstellen:

   ```powershell
   supabase functions deploy send-push --no-verify-jwt
   ```

3. Geheimnis setzen (Wert selbst ausdenken, lang und zufällig; **nie committen**):

   ```powershell
   supabase secrets set SEND_PUSH_SECRET=EIN-LANGES-ZUFAELLIGES-GEHEIMNIS
   ```

   `SUPABASE_URL` und `SUPABASE_SERVICE_ROLE_KEY` stellt Supabase der Function selbst bereit.

4. Die Function jede Minute aufrufen lassen. Im SQL-Editor (einmalig; `pg_net` ist in Supabase
   Cloud vorhanden, sonst unter _Database → Extensions_ aktivieren):

   ```sql
   select cron.schedule(
     'send-push',
     '* * * * *',
     $$ select net.http_post(
          url := 'https://DEIN-PROJEKT.supabase.co/functions/v1/send-push',
          headers := jsonb_build_object('Authorization', 'Bearer EIN-LANGES-ZUFAELLIGES-GEHEIMNIS')
        ) $$
   );
   ```

   Das Geheimnis steht dadurch im Cron-Job; nur Betreiber haben Zugriff auf `cron.job`.

### 4. Testen

1. Neuen Build installieren, Profil → Benachrichtigungen → _Push-Nachrichten_ einschalten.
2. Mit einem zweiten Konto in einer gemeinsamen Challenge einen Feed-Eintrag anfeuern.
3. Nach ca. einer Minute kommt „… feuert dich an“. Bleibt es aus: im SQL-Editor
   `select * from push_outbox order by created_at desc;` – steht in `error` etwas (z. B.
   `DeviceNotRegistered` oder `InvalidCredentials`), fehlt ein Schritt oben.

## Datenschutz

Die Datenschutzerklärung muss Expo (Push-Dienst) und Google/Firebase (Zustellung) als Empfänger
nennen, sobald das eingeschaltet wird – vor dem Start in `docs/legal/privacy.html` und in
`src/i18n/de.ts` (Abschnitt 6) ergänzen.
