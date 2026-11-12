-- Phase 1 – accounts: profiles, wallets, the append-only ledger and the sign-up trigger.
--
-- Access model (CLAUDE.md, sections 4 and 5.2):
--   * RLS is enabled on every table.
--   * Clients never write wallets or the ledger directly. All money moves through
--     private.post_user_entry(), which is only reachable from SECURITY DEFINER functions.
--   * The Data API roles get explicit, minimal grants; everything else is revoked.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  timezone text not null default 'Europe/Berlin',
  -- Set once the user picked a display name during onboarding. Until then the profile
  -- carries a generated placeholder name, so display_name can stay NOT NULL.
  onboarded_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint profiles_display_name_length check (char_length(display_name) between 3 and 24),
  constraint profiles_display_name_trimmed check (display_name = btrim(display_name)),
  constraint profiles_display_name_printable check (display_name !~ '[[:cntrl:]]')
);

comment on table public.profiles is 'One row per auth user. Created by public.handle_new_user().';

create table public.wallets (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  balance_cents bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint wallets_balance_not_negative check (balance_cents >= 0)
);

comment on table public.wallets is
  'Cached balance per user. Always equals the sum of the user''s ledger entries.';

create table public.ledger_entries (
  id uuid primary key default gen_random_uuid(),
  account text not null,
  -- NULL for the house account, and for user entries after the account was deleted
  -- (the ledger is kept and anonymised, never deleted).
  user_id uuid null references public.profiles (id) on delete set null,
  -- The foreign key to public.challenges is added together with that table (phase 2).
  challenge_id uuid null,
  type text not null,
  amount_cents bigint not null,
  created_at timestamptz not null default now(),
  constraint ledger_entries_account_valid check (account in ('user', 'house')),
  constraint ledger_entries_type_valid check (
    type in ('signup_bonus', 'stake', 'payout', 'refund', 'fee', 'rounding', 'forfeit')
  ),
  constraint ledger_entries_house_has_no_user check (account = 'user' or user_id is null),
  constraint ledger_entries_amount_not_zero check (amount_cents <> 0)
);

comment on table public.ledger_entries is
  'Append-only money ledger. Positive amounts are credits, negative amounts are debits.';

-- Prevents double bookings (CLAUDE.md, section 5.1).
create unique index ledger_entries_one_per_challenge_and_type
  on public.ledger_entries (user_id, challenge_id, type)
  where type in ('stake', 'payout', 'refund');

-- The sign-up bonus is booked at most once per user.
create unique index ledger_entries_one_signup_bonus
  on public.ledger_entries (user_id)
  where type = 'signup_bonus';

create index ledger_entries_user_created_idx
  on public.ledger_entries (user_id, created_at desc);

------------------------------------------------------------------------------------------
-- Ledger is append-only
------------------------------------------------------------------------------------------

-- Blocks UPDATE and DELETE for every role, including the table owner. The only permitted
-- change is the anonymisation done by the foreign key (user_id -> NULL) when an account
-- is deleted; every other column must stay untouched.
create function private.protect_ledger_entries()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE'
     and old.user_id is not null
     and new.user_id is null
     and new.id = old.id
     and new.account = old.account
     and new.challenge_id is not distinct from old.challenge_id
     and new.type = old.type
     and new.amount_cents = old.amount_cents
     and new.created_at = old.created_at then
    return new;
  end if;

  raise exception using
    errcode = 'P0001',
    message = 'ledger_is_append_only',
    detail = format('%s on public.ledger_entries is not allowed.', tg_op);
end;
$$;

create trigger ledger_entries_append_only
  before update or delete on public.ledger_entries
  for each row execute function private.protect_ledger_entries();

create trigger ledger_entries_no_truncate
  before truncate on public.ledger_entries
  for each statement execute function private.protect_ledger_entries();

------------------------------------------------------------------------------------------
-- Booking helper (internal)
------------------------------------------------------------------------------------------

-- The single place where a user's money moves: locks the wallet row, adjusts the balance
-- and appends the matching ledger entry in the caller's transaction. Raises
-- 'insufficient_funds' instead of letting the balance go negative.
create function private.post_user_entry(
  p_user_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_challenge_id uuid default null
)
returns public.ledger_entries
language plpgsql
set search_path = ''
as $$
declare
  v_balance bigint;
  v_entry public.ledger_entries;
begin
  select w.balance_cents
    into v_balance
    from public.wallets w
   where w.user_id = p_user_id
     for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'wallet_not_found';
  end if;

  if v_balance + p_amount_cents < 0 then
    raise exception using errcode = 'P0001', message = 'insufficient_funds';
  end if;

  update public.wallets
     set balance_cents = v_balance + p_amount_cents,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.ledger_entries (account, user_id, challenge_id, type, amount_cents)
  values ('user', p_user_id, p_challenge_id, p_type, p_amount_cents)
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function private.post_user_entry(uuid, text, bigint, uuid) from public;

------------------------------------------------------------------------------------------
-- Sign-up: profile + wallet + 100.00 credits
------------------------------------------------------------------------------------------

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, 'Läufer ' || lpad(floor(random() * 10000)::int::text, 4, '0'));

  insert into public.wallets (user_id) values (new.id);

  perform private.post_user_entry(new.id, 'signup_bonus', 10000);

  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

------------------------------------------------------------------------------------------
-- RPC functions for the app
------------------------------------------------------------------------------------------

-- Returns the caller's full profile. Other users' profiles only expose id and display_name.
create function public.get_my_profile()
returns public.profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  select p.* into v_profile from public.profiles p where p.id = auth.uid();

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return v_profile;
end;
$$;

-- Sets the caller's display name (3–24 characters after trimming) and completes onboarding.
create function public.set_display_name(p_display_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := btrim(coalesce(p_display_name, ''));
  v_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if char_length(v_name) not between 3 and 24 or v_name ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'invalid_display_name';
  end if;

  update public.profiles
     set display_name = v_name,
         onboarded_at = coalesce(onboarded_at, now())
   where id = auth.uid()
  returning * into v_profile;

  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  return v_profile;
end;
$$;

revoke all on function public.get_my_profile() from public, anon;
revoke all on function public.set_display_name(text) from public, anon;
grant execute on function public.get_my_profile() to authenticated;
grant execute on function public.set_display_name(text) to authenticated;

------------------------------------------------------------------------------------------
-- Row level security and grants
------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.wallets enable row level security;
alter table public.ledger_entries enable row level security;

revoke all on public.profiles, public.wallets, public.ledger_entries from anon, authenticated;

-- Everybody signed in may read every display name (participant lists). Only id and
-- display_name are granted; the caller's own full row comes from get_my_profile().
grant select (id, display_name) on public.profiles to authenticated;
create policy "profiles: signed-in users read display names"
  on public.profiles for select
  to authenticated
  using (true);

grant select on public.wallets to authenticated;
create policy "wallets: users read their own wallet"
  on public.wallets for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.ledger_entries to authenticated;
create policy "ledger_entries: users read their own entries"
  on public.ledger_entries for select
  to authenticated
  using (account = 'user' and user_id = (select auth.uid()));
