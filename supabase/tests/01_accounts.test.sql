-- Phase 1 – accounts: sign-up trigger, RLS, display name RPC and the append-only ledger.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

-- Test users ---------------------------------------------------------------------------

insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'anna@example.com', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'ben@example.com', 'authenticated', 'authenticated');

-- Schema -------------------------------------------------------------------------------

select ok(
  (select bool_and(c.relrowsecurity)
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'),
  'RLS is enabled on every table in public'
);

select ok(
  (select bool_and(p.prosecdef and p.proconfig @> array['search_path=""'])
     from pg_proc p
    where p.oid in (
      'public.handle_new_user()'::regprocedure,
      'public.get_my_profile()'::regprocedure,
      'public.set_display_name(text)'::regprocedure
    )),
  'RPC functions are SECURITY DEFINER with a fixed, empty search_path'
);

-- Sign-up trigger ----------------------------------------------------------------------

select ok(
  exists (select 1 from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'sign-up creates a profile'
);

select matches(
  (select display_name from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  '^Läufer [0-9]{4}$',
  'the new profile gets a placeholder display name'
);

select is(
  (select onboarded_at from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  null,
  'a new profile is not onboarded yet'
);

select is(
  (select timezone from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  'Europe/Berlin',
  'the default timezone is Europe/Berlin'
);

select is(
  (select balance_cents from public.wallets where user_id = '11111111-1111-1111-1111-111111111111'),
  10000::bigint,
  'sign-up credits 10,000 cents to the wallet'
);

select results_eq(
  $$ select account, type, amount_cents, challenge_id
       from public.ledger_entries
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  $$ values ('user'::text, 'signup_bonus'::text, 10000::bigint, null::uuid) $$,
  'sign-up books exactly one signup_bonus entry of 10,000 cents'
);

select is(
  (select balance_cents from public.wallets where user_id = '11111111-1111-1111-1111-111111111111'),
  (select sum(amount_cents)::bigint from public.ledger_entries
    where user_id = '11111111-1111-1111-1111-111111111111'),
  'the wallet balance equals the sum of the ledger entries'
);

select throws_ok(
  $$ select private.post_user_entry('11111111-1111-1111-1111-111111111111', 'signup_bonus', 10000) $$,
  '23505',
  null,
  'a second signup_bonus for the same user is rejected'
);

select throws_ok(
  $$ select private.post_user_entry('11111111-1111-1111-1111-111111111111', 'stake', -10001) $$,
  'P0001',
  'insufficient_funds',
  'a booking that would make the balance negative is rejected'
);

-- Ledger is append-only (even for the table owner) -------------------------------------

select throws_ok(
  $$ update public.ledger_entries set amount_cents = 99999
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'ledger_is_append_only',
  'ledger entries cannot be updated'
);

select throws_ok(
  $$ delete from public.ledger_entries
      where user_id = '11111111-1111-1111-1111-111111111111' $$,
  'P0001',
  'ledger_is_append_only',
  'ledger entries cannot be deleted'
);

select throws_ok(
  $$ truncate public.ledger_entries $$,
  'P0001',
  'ledger_is_append_only',
  'the ledger cannot be truncated'
);

-- Anonymous visitors -------------------------------------------------------------------

set local role anon;
set local request.jwt.claims = '{"role":"anon"}';

select throws_ok(
  $$ select display_name from public.profiles $$,
  '42501',
  null,
  'anon cannot read profiles'
);

select throws_ok(
  $$ select balance_cents from public.wallets $$,
  '42501',
  null,
  'anon cannot read wallets'
);

select throws_ok(
  $$ select public.set_display_name('Hacker') $$,
  '42501',
  null,
  'anon cannot call set_display_name'
);

reset role;

-- Signed in as Anna --------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claims =
  '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select is(
  (select count(*)::int from public.profiles
    where id in ('11111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222')),
  2,
  'signed-in users can read every display name, including other users'
);

select throws_ok(
  $$ select timezone from public.profiles $$,
  '42501',
  null,
  'other profile columns than id and display_name are not readable directly'
);

select is(
  (public.get_my_profile()).id,
  '11111111-1111-1111-1111-111111111111'::uuid,
  'get_my_profile returns the caller''s own profile'
);

select results_eq(
  $$ select user_id, balance_cents from public.wallets $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid, 10000::bigint) $$,
  'users only see their own wallet'
);

select results_eq(
  $$ select distinct user_id from public.ledger_entries $$,
  $$ values ('11111111-1111-1111-1111-111111111111'::uuid) $$,
  'users only see their own ledger entries'
);

select throws_ok(
  $$ update public.wallets set balance_cents = 999999 $$,
  '42501',
  null,
  'users cannot update wallets'
);

select throws_ok(
  $$ insert into public.wallets (user_id, balance_cents)
     values ('11111111-1111-1111-1111-111111111111', 1) $$,
  '42501',
  null,
  'users cannot insert wallets'
);

select throws_ok(
  $$ insert into public.ledger_entries (account, user_id, type, amount_cents)
     values ('user', '11111111-1111-1111-1111-111111111111', 'signup_bonus', 100000) $$,
  '42501',
  null,
  'users cannot insert ledger entries'
);

select throws_ok(
  $$ update public.profiles set display_name = 'Direkt'
      where id = '11111111-1111-1111-1111-111111111111' $$,
  '42501',
  null,
  'users cannot update profiles directly'
);

select throws_ok(
  $$ select private.post_user_entry('11111111-1111-1111-1111-111111111111', 'payout', 100000) $$,
  '42501',
  null,
  'users cannot call the internal booking helper'
);

select throws_ok(
  $$ select public.set_display_name('  ab  ') $$,
  'P0001',
  'invalid_display_name',
  'display names shorter than 3 characters (after trimming) are rejected'
);

select throws_ok(
  $$ select public.set_display_name(repeat('x', 25)) $$,
  'P0001',
  'invalid_display_name',
  'display names longer than 24 characters are rejected'
);

select throws_ok(
  $$ select public.set_display_name(null) $$,
  'P0001',
  'invalid_display_name',
  'a missing display name is rejected'
);

select is(
  (public.set_display_name('  Anna Lauf  ')).display_name,
  'Anna Lauf',
  'set_display_name trims and stores the name'
);

select isnt(
  (public.get_my_profile()).onboarded_at,
  null,
  'set_display_name completes onboarding'
);

reset role;

select matches(
  (select display_name from public.profiles where id = '22222222-2222-2222-2222-222222222222'),
  '^Läufer [0-9]{4}$',
  'set_display_name only changes the caller''s own profile'
);

-- Account deletion keeps the ledger, anonymised ----------------------------------------

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*)::int from public.wallets where user_id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting the auth user removes the wallet'
);

select is(
  (select count(*)::int from public.ledger_entries where user_id is null and account = 'user'),
  1,
  'deleting the auth user keeps the ledger entries, anonymised'
);

select is(
  (select count(*)::int from public.profiles where id = '11111111-1111-1111-1111-111111111111'),
  0,
  'deleting the auth user removes the profile'
);

select * from finish();
rollback;
