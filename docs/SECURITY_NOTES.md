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

**Vor echtem Geld:** Ein Startguthaben – oder jede andere Gutschrift ohne Gegenleistung – darf erst
nach **bestätigter Anmeldung** vergeben werden (z. B. wenn `auth.users.email_confirmed_at` bzw.
`last_sign_in_at` gesetzt wird, oder per RPC nach dem ersten erfolgreichen Login), höchstens einmal
pro verifizierter Person (siehe auch KYC/Altersprüfung, nicht Teil des MVP). Unbestätigte Konten
sollten nach einer Frist automatisch gelöscht werden.
