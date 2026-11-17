# Echtgeld-Pfand mit Stripe – Schritt für Schritt

Stand: 17.11.2026. **Standardmäßig ist alles AUS.** Solange der Server-Schalter aus ist, arbeitet die App
wie bisher mit virtuellen Credits. Diese Anleitung ist für dich als Betreiber. Nutze zuerst nur
**Stripe-Testschlüssel** (`sk_test_…`, `pk_test_…`), niemals Live-Schlüssel ins Repository.

## So funktioniert es

- **Reservieren statt abbuchen:** Beim Setzen des Pfands wird der Betrag (1–50 €) auf der Karte nur
  reserviert (Stripe PaymentIntent mit `capture_method=manual`; Karte, Apple Pay, Google Pay über das
  PaymentSheet). Echtgeld-Ziele dauern höchstens 6 Tage (Stripe gibt eine Reservierung nach 7 Tagen
  frei; 6 Tage plus 12 Stunden Kulanzzeit bleiben darunter).
- **Ziel erreicht:** Die Reservierung wird aufgehoben, nichts wird abgebucht.
- **Ziel verfehlt:** Die Reservierung wird abgebucht. Das Pfand geht an PUSH, **wir spenden 90 %
  weiter** (10 % behält PUSH, einstellbar mit `private.settings.fee_bps`). Die App sammelt keine
  Spenden. Eine Spendenquittung für Nutzer gibt es nicht.
- **Reservierung vorher abgelaufen oder fehlgeschlagen:** Das Ziel gilt als „nicht gesichert“, es
  wird nichts abgebucht.
- **Spendenpflicht:** Für jedes abgebuchte Pfand legt die Datenbank einen Datensatz
  (`donation_obligations`: Betrag, Organisation, Monat) an. Monatsbericht im SQL-Editor:
  `select * from private.donation_report('2026-12-01');`
- Das Guthaben in Credits und das Ledger werden von Echtgeld **nicht** verändert.

## Aufbau

| Teil | Aufgabe |
|---|---|
| `supabase/migrations/20261202100000_real_money.sql` | Schalter, Testnutzerliste, Tabellen `payments`, `stripe_customers`, `stripe_events`, `donation_obligations`, Abrechnung |
| `create-pledge-intent` (Edge Function) | prüft Nutzer, Schalter, Betrag; legt Stripe-Customer und PaymentIntent an |
| `stripe-webhook` (Edge Function) | prüft die Signatur; Reservierung bestätigt → Ziel wird angelegt; idempotent über die Event-ID |
| `settle-payments` (Edge Function) | führt nach der Abrechnung `cancel` bzw. `capture` aus, mit Wiederholung (bis 10 Versuche) |
| App (`src/features/payments`) | PaymentSheet, Profil → „Zahlung & Pfand“ |

## Schritte

1. **Stripe-Konto** auf stripe.com anlegen (Testmodus reicht). Im Dashboard den Testmodus-Schalter
   aktiv lassen. Unter *Entwickler → API-Schlüssel* stehen `pk_test_…` (öffentlich) und `sk_test_…`
   (geheim).
2. **Migration anwenden** (nach Backup, nicht aus dem Repo mit `--remote` pushen; in der Supabase-
   Oberfläche oder mit deinem gewohnten Weg): `supabase/migrations/20261202100000_real_money.sql`.
   Lokal vorher testen: `npx supabase test db` (Datei `25_real_money.test.sql`).
3. **Secrets setzen** (nur als Supabase-Secrets, nie in `.env` der App oder im Repo):
   ```
   npx supabase secrets set STRIPE_SECRET_KEY=sk_test_... STRIPE_WEBHOOK_SECRET=whsec_... SETTLE_PAYMENTS_SECRET=<langes-zufälliges-passwort>
   ```
   Live-Schlüssel (`sk_live_…`) lehnt der Code ab, solange nicht zusätzlich
   `STRIPE_ALLOW_LIVE=yes` gesetzt ist. Das setzt du erst nach rechtlicher Prüfung.
4. **Edge Functions bereitstellen:** `npx supabase functions deploy create-pledge-intent stripe-webhook settle-payments`.
5. **Webhook eintragen:** Stripe-Dashboard → Entwickler → Webhooks → Endpunkt hinzufügen:
   `https://<projekt>.supabase.co/functions/v1/stripe-webhook`, Ereignisse
   `payment_intent.amount_capturable_updated`, `payment_intent.succeeded`,
   `payment_intent.canceled`, `payment_intent.payment_failed`. Das angezeigte Signing-Secret
   (`whsec_…`) ist `STRIPE_WEBHOOK_SECRET` (Schritt 3).
6. **Abrechnung planen:** `settle-payments` muss alle paar Minuten aufgerufen werden, z. B. per
   `pg_cron` + `pg_net` mit Header `Authorization: Bearer <SETTLE_PAYMENTS_SECRET>` (wie bei
   `send-push`, siehe `docs/PUSH.md`).
7. **App:** In `.env` `EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` setzen. Das PaymentSheet ist
   native Code: ein **neuer Build** ist nötig (Development oder Release). Für Apple Pay trägst du
   die Merchant-ID `merchant.com.pushchallenge.app` im Apple-Developer-Konto ein; Google Pay läuft im
   Testmodus.
8. **Schalter erst für Testnutzer:**
   ```sql
   insert into private.real_money_testers (user_id) values ('<user-uuid>');
   update private.settings set real_money_enabled = true;
   ```
   Teste mit Stripe-Testkarten (`4242 4242 4242 4242`): Ziel setzen → „Reserviert“; Ziel erreicht →
   „Nicht abgebucht“; Ziel verfehlt → „Abgebucht“ und ein Eintrag im Spendenbericht.
9. **Dann für alle** (erst nach rechtlicher Prüfung und Live-Schlüsseln):
   `update private.settings set real_money_open_to_all = true;`. Ausschalten jederzeit mit
   `update private.settings set real_money_enabled = false;` (laufende Reservierungen werden
   weiter abgerechnet).

## Bekannte Grenzen

- Die Datenbankfunktionen und Edge Functions sind geschrieben, aber nur gegen die Stripe-API-Beschreibung
  entworfen; die pgTAP-Tests (`25_real_money.test.sql`) und ein Testlauf mit echten Teststripe-Karten
  sind noch auszuführen.
- Die Echtgeld-Anlage eines Ziels setzt die Nutzerkennung im Datenbankaufruf (`request.jwt.claim.sub`);
  bitte im lokalen Test bestätigen.
- Betrugsschutz bleibt wie in `docs/SECURITY_NOTES.md`; vor Live-Betrieb sind zusätzliche Prüfungen
  (App Attest / Play Integrity, GPS-Routen) nötig.
- Rechtliches (Glücksspiel-/Zahlungsdienste-Einordnung, Spenden, Steuer) ist **nicht** geprüft:
  siehe `docs/RECHT_STRIPE_ENTWURF.md`.
