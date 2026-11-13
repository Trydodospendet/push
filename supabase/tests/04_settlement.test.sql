-- Phase 4 / Ausbau – pool settlement, lifecycle, ranking and scheduler.
begin;
create extension if not exists pgtap with schema extensions;

select plan(68);

-- Helpers ------------------------------------------------------------------------------

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

create function pg_temp.u(p_n integer)
returns uuid
language sql
as $$ select ('00000000-0000-4000-8000-00000000000' || p_n)::uuid; $$;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

create function pg_temp.c(p_name text)
returns uuid
language sql
as $$ select id from ids where name = p_name; $$;

-- A finished run_single challenge (goal 5 km) that is waiting for its settlement. Every
-- challenge gets its own past period (p_window), so the runs of one never count for another.
-- Joining goes through the real booking function while the challenge is still open.
create function pg_temp.finished(
  p_name text, p_window integer, p_stake bigint, p_fee integer, p_users integer[],
  p_mode text default 'pool', p_min integer default 2
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_n integer;
  v_start timestamptz := now() - make_interval(days => 3 * p_window + 4);
begin
  insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
    starts_at, ends_at, min_participants, max_participants, visibility, status, mode)
  values (pg_temp.u(p_users[1]), p_name, 'run_single', 5000, p_stake, p_fee,
    now() + interval '1 day', now() + interval '3 days', p_min,
    null, 'public', 'open', p_mode)
  returning id into v_id;

  foreach v_n in array p_users loop
    perform private.join(v_id, pg_temp.u(v_n));
  end loop;

  update public.challenges
     set starts_at = v_start, ends_at = v_start + interval '2 days', status = 'settling'
   where id = v_id;

  insert into ids values (p_name, v_id);
  return v_id;
end;
$$;

-- A valid, automatically recorded run inside the period of the challenge.
create function pg_temp.run(p_user integer, p_challenge text, p_distance integer)
returns void
language sql
as $$
  insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
    start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
  select pg_temp.u(p_user), 'android', gen_random_uuid()::text, 'running',
         c.starts_at + interval '1 hour', c.starts_at + interval '90 minutes',
         p_distance, 1800, false, true
    from public.challenges c where c.id = pg_temp.c(p_challenge);
$$;

create function pg_temp.entries(p_challenge text)
returns table (account text, user_n integer, type text, amount_cents bigint)
language sql
as $$
  select le.account,
         nullif(right(coalesce(le.user_id::text, '0'), 1), '0')::integer,
         le.type, le.amount_cents
    from public.ledger_entries le
   where le.challenge_id = pg_temp.c(p_challenge)
   order by le.account desc, 2, le.type;
$$;

-- Users 1..6, each with 100.00 credits -------------------------------------------------

insert into auth.users (id, email, aud, role)
select pg_temp.u(n), 'user' || n || '@pgtap.test', 'authenticated', 'authenticated'
  from generate_series(1, 6) n;

update public.profiles set display_name = 'Nutzer ' || right(id::text, 1);

-- Scheduler and permissions --------------------------------------------------------------

select is(
  (select count(*)::int from cron.job
    where jobname = 'advance-challenges' and schedule = '*/5 * * * *'
      and command = 'select public.advance_challenges()'),
  1,
  'pg_cron runs advance_challenges every 5 minutes'
);

select is(
  (select fee_bps from private.settings),
  0,
  'the configured fee is 0 by default'
);

select pg_temp.login(pg_temp.u(1));

select throws_ok(
  $$ select public.settle_challenge(gen_random_uuid()) $$,
  '42501', null, 'users cannot call settle_challenge'
);

select throws_ok(
  $$ select public.advance_challenges() $$,
  '42501', null, 'users cannot call advance_challenges'
);

select pg_temp.logout();

-- Reference example (CLAUDE.md 6.3): 4 × 10.00, 3 winners, no fee ------------------------

select pg_temp.finished('reference', 0, 1000, 0, array[1, 2, 3, 4]);
select pg_temp.run(1, 'reference', 5000);
select pg_temp.run(2, 'reference', 6000);
select pg_temp.run(3, 'reference', 21100);
select pg_temp.run(4, 'reference', 4999);

select ok(public.settle_challenge(pg_temp.c('reference')), 'the reference challenge is settled');

select results_eq(
  $$ select * from pg_temp.entries('reference') $$,
  $$ values ('user'::text, 1, 'payout'::text, 1333::bigint), ('user', 1, 'stake', -1000),
            ('user', 2, 'payout', 1333), ('user', 2, 'stake', -1000),
            ('user', 3, 'payout', 1333), ('user', 3, 'stake', -1000),
            ('user', 4, 'stake', -1000),
            ('house', null, 'rounding', 1) $$,
  'reference: every winner gets 13.33, the house gets 1 cent rounding'
);

select results_eq(
  $$ select right(user_id::text, 1)::int, result, payout_cents, progress_value
       from public.challenge_participants
      where challenge_id = pg_temp.c('reference') order by user_id $$,
  $$ values (1, 'success'::text, 1333::bigint, 5000), (2, 'success', 1333, 6000),
            (3, 'success', 1333, 21100), (4, 'failed', 0, 4999) $$,
  'reference: exactly reaching the goal wins, 1 m short loses'
);

select results_eq(
  $$ select status, settled_at is not null from public.challenges where id = pg_temp.c('reference') $$,
  $$ values ('settled'::text, true) $$,
  'reference: the challenge is settled with a timestamp'
);

-- Idempotency ------------------------------------------------------------------------------

create temp table before_second_call as
select (select count(*) from public.ledger_entries) as entries,
       (select sum(balance_cents) from public.wallets) as balances;

select is(public.settle_challenge(pg_temp.c('reference')), false,
  'a second settle_challenge call does nothing');

select is(
  (select count(*) from public.ledger_entries),
  (select entries from before_second_call),
  'a second call books nothing'
);

select is(
  (select sum(balance_cents) from public.wallets),
  (select balances from before_second_call),
  'a second call changes no balance'
);

select throws_ok(
  $$ insert into public.ledger_entries (account, challenge_id, type, amount_cents)
     values ('house', pg_temp.c('reference'), 'rounding', 1) $$,
  '23505', null, 'the house share of a challenge cannot be booked twice'
);

select throws_ok(
  $$ select private.post_user_entry(pg_temp.u(1), 'payout', 1333, pg_temp.c('reference')) $$,
  '23505', null, 'a payout cannot be booked twice'
);

-- Fee > 0 ------------------------------------------------------------------------------------

-- 4 × 10.00, 1 winner, 10 % fee: lost 30.00, fee 3.00, winner gets 10.00 + 27.00.
select pg_temp.finished('fee', 1, 1000, 1000, array[1, 2, 3, 4]);
select pg_temp.run(2, 'fee', 7000);
select public.settle_challenge(pg_temp.c('fee'));

select results_eq(
  $$ select * from pg_temp.entries('fee') where type <> 'stake' $$,
  $$ values ('user'::text, 2, 'payout'::text, 3700::bigint), ('house', null, 'fee', 300) $$,
  'fee 10 %: the house gets 10 % of the lost pot, the winner the rest'
);

-- 3 × 10.01, 2 winners, 15 % fee: lost 10.01, fee floor(150.15) = 1.50, distributable 8.51,
-- bonus floor(4.255) = 4.25, rounding 1 cent.
select pg_temp.finished('fee_rounding', 2, 1001, 1500, array[1, 2, 3]);
select pg_temp.run(1, 'fee_rounding', 5000);
select pg_temp.run(3, 'fee_rounding', 5000);
select public.settle_challenge(pg_temp.c('fee_rounding'));

select results_eq(
  $$ select * from pg_temp.entries('fee_rounding') where type <> 'stake' $$,
  $$ values ('user'::text, 1, 'payout'::text, 1426::bigint), ('user', 3, 'payout', 1426),
            ('house', null, 'fee', 150), ('house', null, 'rounding', 1) $$,
  'fee and rounding: winners get the floor, every leftover cent goes to the house'
);

select is(
  (select min(payout_cents) from public.challenge_participants
    where result = 'success' and challenge_id in (pg_temp.c('fee'), pg_temp.c('fee_rounding'))),
  1426::bigint,
  'with a fee, winners still get at least their stake back'
);

-- Pool special cases ---------------------------------------------------------------------

select pg_temp.finished('all_win', 3, 500, 1000, array[1, 2, 3]);
select pg_temp.run(1, 'all_win', 5000);
select pg_temp.run(2, 'all_win', 5000);
select pg_temp.run(3, 'all_win', 5000);
select public.settle_challenge(pg_temp.c('all_win'));

select results_eq(
  $$ select * from pg_temp.entries('all_win') where type <> 'stake' $$,
  $$ values ('user'::text, 1, 'payout'::text, 500::bigint), ('user', 2, 'payout', 500),
            ('user', 3, 'payout', 500) $$,
  'all win: everybody gets exactly the stake back, the house gets nothing (even with a fee)'
);

select pg_temp.finished('nobody', 4, 500, 1000, array[1, 2, 3]);
select pg_temp.run(1, 'nobody', 1000);
select public.settle_challenge(pg_temp.c('nobody'));

select results_eq(
  $$ select * from pg_temp.entries('nobody') where type <> 'stake' $$,
  $$ values ('house'::text, null::int, 'forfeit'::text, 1500::bigint) $$,
  'nobody wins: all stakes go to the house as forfeit (no fee split)'
);

select results_eq(
  $$ select result, payout_cents from public.challenge_participants
      where challenge_id = pg_temp.c('nobody') group by 1, 2 $$,
  $$ values ('failed'::text, 0::bigint) $$,
  'nobody wins: everybody failed with payout 0'
);

-- Alone in a pool (min_participants 1).
select pg_temp.finished('single_win', 5, 2000, 1000, array[5], 'pool', 1);
select pg_temp.run(5, 'single_win', 8000);
select public.settle_challenge(pg_temp.c('single_win'));

select results_eq(
  $$ select * from pg_temp.entries('single_win') $$,
  $$ values ('user'::text, 5, 'payout'::text, 2000::bigint), ('user', 5, 'stake', -2000) $$,
  'single participant who wins: stake back'
);

select pg_temp.finished('single_lose', 6, 2000, 1000, array[5], 'pool', 1);
select public.settle_challenge(pg_temp.c('single_lose'));

select results_eq(
  $$ select * from pg_temp.entries('single_lose') $$,
  $$ values ('user'::text, 5, 'stake'::text, -2000::bigint),
            ('house', null, 'forfeit', 2000) $$,
  'single participant who loses: the stake goes to the house'
);

-- Steps: every day of the period must reach the target -----------------------------------

select pg_temp.finished('steps', 7, 500, 0, array[1, 2]);
update public.challenges set goal_type = 'steps_daily', target_value = 10000
 where id = pg_temp.c('steps');

-- Two days in the period; user 1 makes both, user 2 only one (and an implausible day).
insert into public.activity_daily_steps (user_id, date, steps, platform, is_valid)
select pg_temp.u(1), (c.starts_at at time zone c.timezone)::date + d, 12000, 'android', true
  from public.challenges c, generate_series(0, 1) d where c.id = pg_temp.c('steps');
insert into public.activity_daily_steps (user_id, date, steps, platform, is_valid)
select pg_temp.u(2), (c.starts_at at time zone c.timezone)::date + d,
       case d when 0 then 10000 else 90000 end, 'android', d = 0
  from public.challenges c, generate_series(0, 1) d where c.id = pg_temp.c('steps');

select public.settle_challenge(pg_temp.c('steps'));

select results_eq(
  $$ select right(user_id::text, 1)::int, result, payout_cents from public.challenge_participants
      where challenge_id = pg_temp.c('steps') order by user_id $$,
  $$ values (1, 'success'::text, 1000::bigint), (2, 'failed', 0) $$,
  'steps_daily: only all days count, implausible days never count'
);

-- Manual entries never count ---------------------------------------------------------------

select pg_temp.finished('manual', 8, 500, 0, array[1, 2]);
select pg_temp.run(1, 'manual', 6000);
insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
select pg_temp.u(2), 'android', 'manual-run', 'running', c.starts_at + interval '1 hour',
       c.starts_at + interval '2 hours', 10000, 3600, true, false, 'manual_entry'
  from public.challenges c where c.id = pg_temp.c('manual');
select public.settle_challenge(pg_temp.c('manual'));

select results_eq(
  $$ select right(user_id::text, 1)::int, result from public.challenge_participants
      where challenge_id = pg_temp.c('manual') order by user_id $$,
  $$ values (1, 'success'::text), (2, 'failed') $$,
  'a manually entered run does not win'
);

-- Settlement guards --------------------------------------------------------------------------

select pg_temp.finished('in_grace', 9, 500, 0, array[1, 2]);
update public.challenges set starts_at = now() - interval '2 days', ends_at = now() - interval '1 hour'
 where id = pg_temp.c('in_grace');

select is(public.settle_challenge(pg_temp.c('in_grace')), false,
  'no settlement during the sync grace period');

select is(
  (select count(*)::int from public.ledger_entries
    where challenge_id = pg_temp.c('in_grace') and type <> 'stake'),
  0,
  'nothing is booked during the grace period'
);

select pg_temp.finished('still_active', 10, 500, 0, array[1, 2]);
update public.challenges set status = 'active' where id = pg_temp.c('still_active');

select is(public.settle_challenge(pg_temp.c('still_active')), false,
  'an active challenge is not settled directly');

select is(public.settle_challenge(gen_random_uuid()), false,
  'an unknown challenge is ignored');

-- Pool for one ------------------------------------------------------------------------------

-- User 6 spends 40.00 elsewhere first, so that a second large stake does not fit.
select private.post_user_entry(pg_temp.u(6), 'stake', -4000);
select pg_temp.login(pg_temp.u(6));

insert into ids select 'solo_open', (public.create_challenge('Mein Ziel', 'run_single', 5000, 2500,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'private')).id;

select results_eq(
  $$ select mode, visibility, min_participants, max_participants, fee_bps, participant_count
       from public.challenges where title = 'Mein Ziel' $$,
  $$ values ('pool'::text, 'private'::text, 1, null::int, 0, 0) $$,
  'a pool can run with one person; creating it books nothing'
);

select is((select balance_cents from public.wallets), 6000::bigint, 'creating a pool books no stake');

select is(
  (public.join_challenge(pg_temp.c('solo_open'))).stake_cents,
  2500::bigint,
  'joining takes the stake of the challenge by default'
);

select is((select balance_cents from public.wallets), 3500::bigint, 'the stake is booked when joining');

insert into ids select 'too_dear', (public.create_challenge('Zu teuer', 'run_single', 5000, 5000,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).id;

select throws_ok(
  $$ select public.join_challenge(pg_temp.c('too_dear')) $$,
  'P0001', 'insufficient_funds', 'a pool needs enough credits'
);

select is(
  (public.join_challenge(pg_temp.c('too_dear'), 1000)).stake_cents,
  1000::bigint,
  'everybody can choose the own stake when joining'
);

insert into ids select 'stake_limits', (public.create_challenge('Einsatzgrenzen', 'run_single', 5000, 500,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).id;

select throws_ok(
  $$ select public.join_challenge(pg_temp.c('stake_limits'), 99) $$,
  'P0001', 'invalid_stake', 'a stake below 1.00 is rejected'
);

select throws_ok(
  $$ select public.join_challenge(pg_temp.c('stake_limits'), 5001) $$,
  'P0001', 'invalid_stake', 'a stake above 50.00 is rejected'
);

select throws_ok(
  $$ select public.create_challenge('Falsch', 'run_single', 5000, 500,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public', null, 'duel') $$,
  'P0001', 'invalid_mode', 'only ranked and pool exist'
);

select throws_ok(
  $$ select public.create_challenge('Falsch', 'run_single', 5000, 500,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public', null, 'solo') $$,
  'P0001', 'invalid_mode', 'solo is gone: it is a pool for one now'
);

select pg_temp.logout();
select pg_temp.login(pg_temp.u(1));

select throws_ok(
  $$ select public.join_challenge(pg_temp.c('solo_open')) $$,
  'P0001', 'challenge_not_found', 'a private pool is closed to others without its invite code'
);

select pg_temp.logout();

select pg_temp.finished('solo_win', 11, 1500, 0, array[6], 'pool', 1);
select pg_temp.run(6, 'solo_win', 5200);
select public.settle_challenge(pg_temp.c('solo_win'));

select results_eq(
  $$ select * from pg_temp.entries('solo_win') $$,
  $$ values ('user'::text, 6, 'payout'::text, 1500::bigint), ('user', 6, 'stake', -1500) $$,
  'alone in the pool, reached: the stake comes back'
);

select pg_temp.finished('solo_lose', 12, 1500, 0, array[6], 'pool', 1);
select pg_temp.run(6, 'solo_lose', 3000);
select public.settle_challenge(pg_temp.c('solo_lose'));

select results_eq(
  $$ select * from pg_temp.entries('solo_lose') $$,
  $$ values ('user'::text, 6, 'stake'::text, -1500::bigint), ('house', null, 'forfeit', 1500) $$,
  'alone in the pool, missed: the stake goes to the house account'
);

select results_eq(
  $$ select result, payout_cents from public.challenge_participants
      where challenge_id in (pg_temp.c('solo_win'), pg_temp.c('solo_lose'))
      order by result desc $$,
  $$ values ('success'::text, 1500::bigint), ('failed', 0) $$,
  'alone in the pool: result and payout are stored'
);

select pass('placeholder for the ranked-stake check (see 12_modes.test.sql)');

-- The house account is invisible to users ------------------------------------------------

select pg_temp.login(pg_temp.u(6));

select is(
  (select count(*)::int from public.ledger_entries where account = 'house'),
  0,
  'users cannot read house entries'
);

select results_eq(
  $$ select type, amount_cents from public.ledger_entries
      where challenge_id = pg_temp.c('solo_lose') $$,
  $$ values ('stake'::text, -1500::bigint) $$,
  'a user sees only the own stake of a lost pool'
);

select pg_temp.logout();

-- Configured fee -----------------------------------------------------------------------------

update private.settings set fee_bps = 500;
select pg_temp.login(pg_temp.u(1));

select is(
  (public.create_challenge('Mit Gebühr', 'run_single', 5000, 500,
     (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).fee_bps,
  500,
  'new pools take the configured fee'
);

select throws_ok(
  $$ select public.create_challenge('Rangliste ohne Gebühr', 'run_single', 5000, 500,
       (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public', null, 'ranked') $$,
  'P0001', 'invalid_mode',
  'ranked challenges cannot be created by users'
);

select is(
  (public.create_challenge('Standard', 'run_single', 5000, 500,
     (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public')).mode,
  'pool',
  'pool is the default mode'
);

select pg_temp.logout();
update private.settings set fee_bps = 0;

-- Lifecycle with advance_challenges ----------------------------------------------------------

-- Settle everything that is still due from above, so the steps below start from a clean state.
select public.advance_challenges();

-- Too few participants at the start → cancelled with refunds.
select pg_temp.login(pg_temp.u(2));
insert into ids select 'lonely', (public.create_challenge('Allein', 'run_single', 5000, 700,
  (now() at time zone 'Europe/Berlin')::date + 1, 3, 'public')).id;
select public.join_challenge(pg_temp.c('lonely'));

-- Enough participants → active.
insert into ids select 'duo', (public.create_challenge('Zu zweit', 'run_single', 5000, 700,
  (now() at time zone 'Europe/Berlin')::date + 1, 3, 'public')).id;
select public.join_challenge(pg_temp.c('duo'));
select pg_temp.logout();
select pg_temp.login(pg_temp.u(3));
select public.join_challenge(pg_temp.c('duo'));
select pg_temp.logout();

-- An operator raised the minimum of "Allein" to 2: with one person alone it is cancelled.
update public.challenges set min_participants = 2 where id = pg_temp.c('lonely');

-- A pool whose only participant left before the start → cancelled, the stake was refunded.
select pg_temp.login(pg_temp.u(4));
insert into ids select 'solo_left', (public.create_challenge('Doch nicht', 'run_single', 5000, 300,
  (now() at time zone 'Europe/Berlin')::date + 1, 3, 'private')).id;
select public.join_challenge(pg_temp.c('solo_left'));
select is(public.leave_challenge(pg_temp.c('solo_left')), 300::bigint, 'leaving refunds the full stake');
select pg_temp.logout();

-- (The whole test is one transaction, so now() stays the same: runs are dated relative to
-- starts_at and the period is moved further into the past below.)
update public.challenges
   set starts_at = now() - interval '1 day', ends_at = now() + interval '2 days'
 where id in (pg_temp.c('lonely'), pg_temp.c('duo'), pg_temp.c('solo_left'), pg_temp.c('solo_open'));

create temp table balance_before_cancel as
select balance_cents from public.wallets where user_id = pg_temp.u(2);

select ok(public.advance_challenges() >= 4, 'advance_challenges starts the due challenges');

select results_eq(
  $$ select status from public.challenges
      where id in (pg_temp.c('lonely'), pg_temp.c('duo'), pg_temp.c('solo_left'), pg_temp.c('solo_open'))
      order by title $$,
  $$ values ('cancelled'::text), ('cancelled'), ('active'), ('active') $$,
  'Allein (below the minimum) and Doch nicht (nobody left) are cancelled; Mein Ziel and Zu zweit are active'
);

select results_eq(
  $$ select * from pg_temp.entries('lonely') $$,
  $$ values ('user'::text, 2, 'refund'::text, 700::bigint), ('user', 2, 'stake', -700) $$,
  'cancelled: the stake is refunded'
);

select is(
  (select balance_cents from public.wallets where user_id = pg_temp.u(2)),
  (select balance_cents + 700 from balance_before_cancel),
  'cancelled: the refund is credited to the wallet'
);

select results_eq(
  $$ select result, payout_cents from public.challenge_participants
      where challenge_id = pg_temp.c('lonely') $$,
  $$ values ('refunded'::text, 700::bigint) $$,
  'cancelled: the participant is marked as refunded'
);

select is(public.advance_challenges(), 0, 'a second run changes nothing');

select is(
  (select count(*)::int from public.ledger_entries where challenge_id = pg_temp.c('lonely')),
  2,
  'a second run refunds nothing twice'
);

-- Ranking while the challenge runs.
select pg_temp.run(3, 'duo', 2000);
select private.recompute_health_progress(pg_temp.c('duo'));

select pg_temp.login(pg_temp.u(2));

select results_eq(
  $$ select rank, display_name, is_me, goal_reached from public.get_leaderboard(pg_temp.c('duo')) $$,
  $$ values (1, 'Nutzer 3'::text, false, false), (2, 'Nutzer 2', true, false) $$,
  'the ranking orders by progress and shows who reached the goal'
);

select throws_ok(
  $$ select progress_value from public.challenge_participants $$,
  '42501', null, 'the ranking does not open the progress values of others'
);

select pg_temp.logout();
select pg_temp.login(pg_temp.u(5));

select is(
  (select count(*)::int from public.get_leaderboard(pg_temp.c('duo'))),
  0,
  'non-participants get no ranking'
);

select pg_temp.logout();
select pg_temp.login(pg_temp.u(6));

select is(
  (select count(*)::int from public.get_leaderboard(pg_temp.c('solo_open'))),
  1,
  'a pool of one has a ranking of one'
);

select pg_temp.logout();

select pg_temp.run(2, 'duo', 5500);
select private.recompute_health_progress(pg_temp.c('duo'));
select pg_temp.login(pg_temp.u(3));

select results_eq(
  $$ select rank, display_name, goal_reached from public.get_leaderboard(pg_temp.c('duo')) $$,
  $$ values (1, 'Nutzer 2'::text, true), (2, 'Nutzer 3', false) $$,
  'the ranking follows the progress'
);

select pg_temp.logout();

-- End of the period → settling; still in the grace period → nothing paid yet.
update public.challenges
   set starts_at = now() - interval '2 days', ends_at = now() - interval '1 hour'
 where id = pg_temp.c('duo');

select public.advance_challenges();

select is(
  (select status from public.challenges where id = pg_temp.c('duo')),
  'settling',
  'after the end the challenge waits for late syncs'
);

-- Grace period over → settled by the scheduler.
update public.challenges set sync_grace_hours = 0 where id = pg_temp.c('duo');
select public.advance_challenges();

select results_eq(
  $$ select * from pg_temp.entries('duo') $$,
  $$ values ('user'::text, 2, 'payout'::text, 1400::bigint), ('user', 2, 'stake', -700),
            ('user', 3, 'stake', -700) $$,
  'the scheduler settles the challenge after the grace period'
);

select is(
  (select status from public.challenges where id = pg_temp.c('duo')),
  'settled',
  'the challenge is settled'
);

select pg_temp.login(pg_temp.u(3));

select results_eq(
  $$ select rank, display_name, goal_reached from public.get_leaderboard(pg_temp.c('duo')) $$,
  $$ values (1, 'Nutzer 2'::text, true), (2, 'Nutzer 3', false) $$,
  'the final ranking stays visible'
);

select pg_temp.logout();

-- Money invariants ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.challenges c
    where c.status in ('settled', 'cancelled')
      and (select coalesce(sum(le.amount_cents), 0) from public.ledger_entries le
            where le.challenge_id = c.id) <> 0),
  0,
  'the bookings of every settled or cancelled challenge sum up to 0'
);

select is(
  (select count(*)::int from public.challenges
    where status in ('settled', 'cancelled') and id in (select id from ids)),
  15,
  'all finished challenges were checked'
);

select is(
  (select count(*)::int from public.wallets w
    where w.balance_cents <> (select coalesce(sum(le.amount_cents), 0)
                                from public.ledger_entries le where le.user_id = w.user_id)),
  0,
  'every wallet balance equals the sum of its ledger entries'
);

select is(
  (select count(*)::int from public.challenge_participants cp
     join public.challenges c on c.id = cp.challenge_id
    where c.status = 'settled'
      and (cp.result not in ('success', 'failed')
           or (cp.result = 'success' and cp.payout_cents < cp.stake_cents)
           or (cp.result = 'failed' and cp.payout_cents <> 0))),
  0,
  'after settlement everybody won (at least the stake back) or lost (0)'
);

select * from finish();
rollback;
