-- Phase 2 – challenges: create, join, join by code, leave, balances and RLS.
begin;
create extension if not exists pgtap with schema extensions;

select plan(63);

-- Helpers ------------------------------------------------------------------------------

-- Acts as the given user for the following statements (like a request with that JWT).
create function pg_temp.login(p_user_id uuid)
returns void
language sql
as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.logout()
returns void
language sql
as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Test users: Anna, Ben and Clara (who will be almost broke) ---------------------------

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'clara@pgtap.test', 'authenticated', 'authenticated');

select private.post_user_entry('cccccccc-0000-0000-0000-000000000003', 'stake', -9950);

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- create_challenge -----------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

insert into ids
select 'public', (public.create_challenge(
  '5 km am Stück', 'run_single', 5000, 1000,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).id;

insert into ids
select 'private', (public.create_challenge(
  'Team Schritte', 'steps_daily', 10000, 500,
  (now() at time zone 'Europe/Berlin')::date + 2, 14, 'private')).id;

insert into ids
select 'small', (public.create_challenge(
  'Nur zu zweit', 'run_total', 20000, 100,
  (now() at time zone 'Europe/Berlin')::date + 1, 3, 'public', 2)).id;

select results_eq(
  $$ select status, visibility, invite_code, participant_count, pot_cents, creator_id, fee_bps
       from public.challenges where id = (select id from ids where name = 'public') $$,
  $$ values ('open'::text, 'public'::text, null::text, 0, 0::bigint,
             'aaaaaaaa-0000-0000-0000-000000000001'::uuid, 0) $$,
  'a new public challenge is open, has no invite code and no participants'
);

select is(
  (select starts_at from public.challenges where id = (select id from ids where name = 'public')),
  ((now() at time zone 'Europe/Berlin')::date + 1)::timestamp at time zone 'Europe/Berlin',
  'the challenge starts at local midnight of the chosen start date'
);

select is(
  (select (ends_at at time zone timezone)::date - (starts_at at time zone timezone)::date
     from public.challenges where id = (select id from ids where name = 'public')),
  7,
  'the challenge lasts the chosen number of whole local days'
);

select matches(
  (select invite_code from public.challenges where id = (select id from ids where name = 'private')),
  '^[A-HJ-NP-Z2-9]{6}$',
  'a private challenge gets a 6-character invite code'
);

select is(
  (select count(*)::int from public.challenge_participants),
  0,
  'the creator does not join automatically'
);

select throws_ok(
  $$ select public.create_challenge('ab', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_title', 'titles need at least 3 characters'
);

select throws_ok(
  $$ select public.create_challenge('Schwimmen', 'swim', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_goal_type', 'only running and step goals are allowed'
);

select throws_ok(
  $$ select public.create_challenge('Kurz', 'run_single', 999, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_target_value', 'runs need at least 1 km'
);

select throws_ok(
  $$ select public.create_challenge('Viele Schritte', 'steps_daily', 50001, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_target_value', 'step goals are capped at 50,000 per day'
);

select throws_ok(
  $$ select public.create_challenge('Billig', 'run_single', 5000, 99,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_stake', 'stakes below 1.00 are rejected'
);

select throws_ok(
  $$ select public.create_challenge('Teuer', 'run_single', 5000, 5001,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public') $$,
  'P0001', 'invalid_stake', 'stakes above 50.00 are rejected'
);

select throws_ok(
  $$ select public.create_challenge('Heute', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date, 7, 'public') $$,
  'P0001', 'invalid_start_date', 'challenges cannot start today'
);

select throws_ok(
  $$ select public.create_challenge('Zu spät', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 31, 7, 'public') $$,
  'P0001', 'invalid_start_date', 'challenges start within the next 30 days'
);

select throws_ok(
  $$ select public.create_challenge('Null Tage', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 0, 'public') $$,
  'P0001', 'invalid_duration', 'challenges last at least 1 day'
);

select throws_ok(
  $$ select public.create_challenge('Zu lang', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 43, 'public') $$,
  'P0001', 'invalid_duration', 'challenges last at most 42 days'
);

select throws_ok(
  $$ select public.create_challenge('Geheim', 'run_single', 5000, 1000,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'secret') $$,
  'P0001', 'invalid_visibility', 'visibility must be public or private'
);

-- Clients cannot write challenge data directly -----------------------------------------

select throws_ok(
  $$ insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
       starts_at, ends_at, visibility, status)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'Direkt', 'run_single', 5000, 1000,
       now() + interval '1 day', now() + interval '8 days', 'public', 'open') $$,
  '42501', null, 'users cannot insert challenges directly'
);

select throws_ok(
  $$ update public.challenges set status = 'settled' $$,
  '42501', null, 'users cannot change the challenge status'
);

select throws_ok(
  $$ insert into public.challenge_participants (challenge_id, user_id, stake_cents)
     values ((select id from ids where name = 'public'),
             'aaaaaaaa-0000-0000-0000-000000000001', 1) $$,
  '42501', null, 'users cannot insert participants directly'
);

select throws_ok(
  $$ update public.challenge_participants set result = 'success' $$,
  '42501', null, 'users cannot change participant results'
);

select throws_ok(
  $$ insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
       start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'android', 'x', 'running',
       now(), now(), 5000, 1800, false, true) $$,
  '42501', null, 'users cannot insert workouts directly'
);

select throws_ok(
  $$ insert into public.activity_daily_steps (user_id, date, steps, is_valid)
     values ('aaaaaaaa-0000-0000-0000-000000000001', current_date, 99999, true) $$,
  '42501', null, 'users cannot insert daily steps directly'
);

-- join_challenge ---------------------------------------------------------------------------

select lives_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'Anna joins the public challenge'
);

select is(
  (select balance_cents from public.wallets),
  9000::bigint,
  'joining deducts the stake from the wallet'
);

select results_eq(
  $$ select type, amount_cents from public.ledger_entries
      where challenge_id = (select id from ids where name = 'public') $$,
  $$ values ('stake'::text, -1000::bigint) $$,
  'joining books a negative stake entry for the challenge'
);

select results_eq(
  $$ select participant_count, pot_cents from public.challenges
      where id = (select id from ids where name = 'public') $$,
  $$ values (1, 1000::bigint) $$,
  'participant count and pot are updated'
);

select results_eq(
  $$ select stake_cents, result, payout_cents from public.challenge_participants
      where challenge_id = (select id from ids where name = 'public') $$,
  $$ values (1000::bigint, 'pending'::text, null::bigint) $$,
  'the participant row starts as pending'
);

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'already_joined', 'joining twice is rejected'
);

select lives_ok(
  $$ select public.join_challenge((select id from ids where name = 'private')) $$,
  'the creator can join her private challenge by id'
);

select lives_ok(
  $$ select public.join_challenge((select id from ids where name = 'small')) $$,
  'Anna joins the challenge limited to two participants'
);

-- Ben: visibility, private challenges and invite codes -----------------------------------

select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.challenges
    where visibility = 'private' and id in (select id from ids)),
  0,
  'private challenges are invisible to others'
);

select is(
  (select count(*)::int from public.challenges
    where visibility = 'public' and id in (select id from ids)),
  2,
  'public challenges are visible to everybody'
);

select is(
  (select count(*)::int from public.challenge_participants),
  0,
  'participants are invisible before joining'
);

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'private')) $$,
  'P0001', 'challenge_not_found', 'private challenges cannot be joined by id without the code'
);

select throws_ok(
  $$ select public.join_challenge_by_code('ZZZZZZ') $$,
  'P0001', 'invalid_invite_code', 'an unknown invite code is rejected'
);

select pg_temp.logout();
create temp table invite as
select invite_code as code from public.challenges where id = (select id from ids where name = 'private');
grant select on invite to authenticated;
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (public.get_challenge_by_code(lower((select code from invite)))).title,
  'Team Schritte',
  'a challenge can be previewed with its invite code before joining'
);

select throws_ok(
  $$ select public.get_challenge_by_code('ZZZZZZ') $$,
  'P0001', 'invalid_invite_code', 'previewing an unknown code fails'
);

select is(
  (select count(*)::int from public.challenge_participants
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0,
  'previewing does not join'
);

select is(
  (public.join_challenge_by_code(' ' || lower((select code from invite)) || ' ')).challenge_id,
  (select id from ids where name = 'private'),
  'joining by code ignores case and surrounding spaces'
);

select is(
  (select count(*)::int from public.challenges
    where visibility = 'private' and id in (select id from ids)),
  1,
  'after joining, the private challenge is visible'
);

select lives_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'Ben joins the public challenge'
);

select results_eq(
  $$ select p.display_name from public.challenge_participants cp
       join public.profiles p on p.id = cp.user_id
      where cp.challenge_id = (select id from ids where name = 'public')
      order by p.display_name $$,
  $$ select display_name from public.profiles
      where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002')
      order by display_name $$,
  'participants see each other with their display names'
);

select is(
  (select balance_cents from public.wallets),
  8500::bigint,
  'Ben paid 5.00 + 10.00 in stakes'
);

select lives_ok(
  $$ select public.join_challenge((select id from ids where name = 'small')) $$,
  'Ben takes the second place of the small challenge'
);

-- Clara: not enough credits, full challenge -------------------------------------------------

select pg_temp.logout();
select pg_temp.login('cccccccc-0000-0000-0000-000000000003');

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'insufficient_funds', 'joining without enough credits fails'
);

select is(
  (select balance_cents from public.wallets),
  50::bigint,
  'a failed join does not change the balance'
);

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'small')) $$,
  'P0001', 'challenge_full', 'max_participants is enforced'
);

select pg_temp.logout();

select is(
  (select count(*)::int from public.challenge_participants
    where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  0,
  'failed joins create no participant rows'
);

select is(
  (select participant_count from public.challenges where id = (select id from ids where name = 'public')),
  2,
  'failed joins do not change the participant count'
);

-- leave_challenge --------------------------------------------------------------------------

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (public.leave_challenge((select id from ids where name = 'public'))).amount_cents,
  1000::bigint,
  'leaving books a refund of the full stake'
);

select is(
  (select balance_cents from public.wallets),
  9400::bigint,
  'the refund is credited to the wallet (10,000 - 5.00 - 1.00 still staked)'
);

select is(
  (select count(*)::int from public.challenge_participants
    where challenge_id = (select id from ids where name = 'public')
      and user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0,
  'leaving removes the participant row'
);

select throws_ok(
  $$ select public.leave_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'not_joined', 'leaving twice is rejected'
);

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'cannot_rejoin', 'rejoining after leaving is rejected (one stake per challenge)'
);

select pg_temp.logout();

select is(
  (select participant_count from public.challenges where id = (select id from ids where name = 'public')),
  1,
  'leaving decrements the participant count'
);

-- After the start ----------------------------------------------------------------------------

update public.challenges
   set starts_at = now() - interval '1 hour', ends_at = now() + interval '6 days'
 where id = (select id from ids where name = 'public');

-- Give Clara enough credits so that only the start time can make the join fail.
select private.post_user_entry('cccccccc-0000-0000-0000-000000000003', 'refund', 5000);
select pg_temp.login('cccccccc-0000-0000-0000-000000000003');

select throws_ok(
  $$ select public.join_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'challenge_not_open', 'joining after the start fails'
);

select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select throws_ok(
  $$ select public.leave_challenge((select id from ids where name = 'public')) $$,
  'P0001', 'challenge_not_open', 'leaving after the start fails'
);

select pg_temp.logout();

update public.challenges set status = 'cancelled'
 where id = (select id from ids where name = 'private');

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');

select throws_ok(
  $$ select public.join_challenge_by_code((select code from invite)) $$,
  'P0001', 'challenge_not_open', 'joining a challenge that is not open fails'
);

-- Anonymous visitors -----------------------------------------------------------------------

select pg_temp.logout();
set local role anon;

select throws_ok(
  $$ select id from public.challenges $$,
  '42501', null, 'anon cannot read challenges'
);

select throws_ok(
  $$ select public.join_challenge_by_code('ABCDEF') $$,
  '42501', null, 'anon cannot join challenges'
);

reset role;

-- Money invariants ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.wallets w
    where w.balance_cents <> (select coalesce(sum(le.amount_cents), 0)
                                from public.ledger_entries le where le.user_id = w.user_id)),
  0,
  'every wallet balance equals the sum of its ledger entries'
);

select is(
  (select count(*)::int from public.challenges c
    where c.pot_cents <> -(select coalesce(sum(le.amount_cents), 0)
                             from public.ledger_entries le where le.challenge_id = c.id)),
  0,
  'every pot equals the stakes minus refunds booked for the challenge'
);

select is(
  (select count(*)::int from public.challenges c
    where c.participant_count <> (select count(*) from public.challenge_participants cp
                                   where cp.challenge_id = c.id)),
  0,
  'participant_count always matches the participant rows'
);

select * from finish();
rollback;
