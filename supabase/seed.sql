-- Local test data, loaded by `npm run db:reset`. Never runs against production.
--
-- Test users (sign in with the email, the code arrives in Mailpit at http://127.0.0.1:54324):
--   anna@example.com  – "Anna"
--   ben@example.com   – "Ben"
--   clara@example.com – "Clara"
-- Private challenge invite code: LAUF26
--
-- All bookings go through the real functions, so wallets and ledger stay consistent.

-- Users ----------------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email, '',
  now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(),
  '', '', '', '', '', '', '', ''
from (values
  ('a0000000-0000-4000-8000-000000000001'::uuid, 'anna@example.com'),
  ('b0000000-0000-4000-8000-000000000002'::uuid, 'ben@example.com'),
  ('c0000000-0000-4000-8000-000000000003'::uuid, 'clara@example.com')
) as u (id, email);

insert into auth.identities (
  id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at
)
select gen_random_uuid(), u.id, u.id::text, 'email',
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       now(), now(), now()
  from auth.users u
 where u.email in ('anna@example.com', 'ben@example.com', 'clara@example.com');

-- Runs the given statement as the given user (auth.uid() returns that id).
create function pg_temp.as_user(p_user_id uuid)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text, false);
$$;

-- Display names ----------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.set_display_name('Anna');
select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
select public.set_display_name('Ben');
select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
select public.set_display_name('Clara');

-- Challenges -------------------------------------------------------------------------------

create temp table seed_challenges (name text primary key, id uuid);

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
insert into seed_challenges
select 'five_k', (public.create_challenge('5 km am Stück', 'run_single', 5000, 1000,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).id;
insert into seed_challenges
select 'office', (public.create_challenge('Büro-Lauftreff', 'run_total', 10000, 500,
  (now() at time zone 'Europe/Berlin')::date + 3, 7, 'private')).id;

select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
insert into seed_challenges
select 'steps', (public.create_challenge('10.000 Schritte täglich', 'steps_daily', 10000, 500,
  (now() at time zone 'Europe/Berlin')::date + 2, 7, 'public')).id;

select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
insert into seed_challenges
select 'half', (public.create_challenge('Halbmarathon-Woche', 'run_total', 21100, 2000,
  (now() at time zone 'Europe/Berlin')::date + 1, 14, 'public', 10)).id;

select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
insert into seed_challenges
select 'big_stake', (public.create_challenge('Großer Einsatz', 'run_single', 10000, 5000,
  (now() at time zone 'Europe/Berlin')::date + 2, 7, 'public')).id;

select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
insert into seed_challenges
select 'weekend', (public.create_challenge('10 km am Wochenende', 'run_single', 10000, 2000,
  (now() at time zone 'Europe/Berlin')::date + 3, 3, 'public')).id;

-- A fixed, easy-to-type invite code for manual tests.
update public.challenges set invite_code = 'LAUF26'
 where id = (select id from seed_challenges where name = 'office');

-- Participants -----------------------------------------------------------------------------

select pg_temp.as_user('a0000000-0000-4000-8000-000000000001');
select public.join_challenge((select id from seed_challenges where name = 'five_k'));
select public.join_challenge((select id from seed_challenges where name = 'office'));
select public.join_challenge((select id from seed_challenges where name = 'half'));
-- Leaves Anna with 15.00 credits: too little for the 20.00 stake of "10 km am Wochenende".
select public.join_challenge((select id from seed_challenges where name = 'big_stake'));

select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
select public.join_challenge((select id from seed_challenges where name = 'five_k'));
select public.join_challenge((select id from seed_challenges where name = 'steps'));
select public.join_challenge_by_code('LAUF26');

select pg_temp.as_user('c0000000-0000-4000-8000-000000000003');
select public.join_challenge((select id from seed_challenges where name = 'half'));

-- Solo: Ben bets 5.00 on himself (the stake is booked when the solo goal is created).
select pg_temp.as_user('b0000000-0000-4000-8000-000000000002');
select public.create_challenge('Mein 10-km-Lauf', 'run_single', 10000, 500,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'private', null, 'solo');

select set_config('request.jwt.claims', '', false);
