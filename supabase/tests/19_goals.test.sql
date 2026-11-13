-- Ausbau 3 – personal goals: creation, bound stake, window settlement.
begin;
-- Preserve coverage of previously created goals with a synchronization grace period.
alter table public.challenges alter column sync_grace_hours set default 24;
create extension if not exists pgtap with schema extensions;

select plan(24);

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

insert into auth.users (id, email, aud, role)
select pg_temp.u(n), 'user' || n || '@pgtap.test', 'authenticated', 'authenticated'
  from generate_series(1, 6) n;
update public.profiles set display_name = 'Nutzer ' || right(id::text, 1);

-- A goal of user p_user, moved into the past window p_window (settling, grace over). Goals
-- with the same p_window share the period.
create function pg_temp.goal(
  p_name text, p_user integer, p_window integer, p_stake bigint, p_target integer default 5000
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_start timestamptz := date_trunc('day', now()) - make_interval(days => 10 * p_window + 20);
begin
  perform pg_temp.login(pg_temp.u(p_user));
  select id into v_id from public.create_goal('Ziel ' || p_name, 'run_total', p_target, p_stake, 'week');
  perform pg_temp.logout();
  insert into ids values (p_name, v_id);
  update public.challenges
     set starts_at = v_start, ends_at = v_start + interval '7 days', status = 'settling'
   where id = v_id;
  return v_id;
end;
$$;

create function pg_temp.run(p_name text, p_user integer, p_distance integer)
returns void
language sql
as $$
  insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
    start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
  select pg_temp.u(p_user), 'android', gen_random_uuid()::text, 'running',
         c.starts_at + interval '1 hour', c.starts_at + interval '90 minutes',
         p_distance, 1800, false, true
    from public.challenges c where c.id = pg_temp.c(p_name);
$$;

create function pg_temp.sum_of(p_name text)
returns bigint
language sql
as $$ select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries where challenge_id = pg_temp.c(p_name); $$;

-- Creation -----------------------------------------------------------------------------------------

select pg_temp.login(pg_temp.u(1));
select results_eq(
  $$ select mode, visibility, stake_cents, participant_count, status, max_participants
       from public.create_goal('Mein Wochenziel', 'run_total', 10000, 500, 'week') $$,
  $$ values ('goal'::text, 'private'::text, 500::bigint, 1, 'open'::text, 1) $$,
  'create_goal creates an open personal goal and the owner is the participant'
);
select is(
  (select balance_cents from public.wallets where user_id = pg_temp.u(1)), 9500::bigint,
  'the stake is bound at once'
);
select results_eq(
  $$ select extract(isodow from starts_at at time zone timezone)::integer,
            ends_at - starts_at
       from public.challenges where creator_id = pg_temp.u(1) and mode = 'goal' $$,
  $$ values (1, interval '7 days') $$,
  'a week goal starts on a Monday and lasts seven days'
);
select pg_temp.login(pg_temp.u(6));
select is(
  (select starts_at = now()
     from public.create_goal('Heutiges Tagesziel', 'run_total', 5000, 500, 'today')),
  true,
  'a daily goal starts immediately when it is created'
);
select is(
  (select (ends_at at time zone timezone)::date = (now() at time zone timezone)::date + 1
     from public.challenges where creator_id = pg_temp.u(6) and mode = 'goal'),
  true,
  'a daily goal ends at the next local midnight'
);
select pg_temp.logout();
select pg_temp.login(pg_temp.u(1));
select throws_ok($$ select public.create_goal('Zu wenig', 'run_total', 10000, 50, 'week') $$,
  'P0001', 'invalid_stake', 'the stake is limited to 1 to 50');
select throws_ok($$ select public.create_goal('Kein Zeitraum', 'run_total', 10000, 500, 'year') $$,
  'P0001', 'invalid_period', 'only day, week and month are periods');
select throws_ok($$ select public.create_goal('Zu kurz', 'run_total', 10, 500, 'day') $$,
  'P0001', 'invalid_target_value', 'the target value is limited');

-- Nobody else can join or see a goal -------------------------------------------------------------
select pg_temp.logout();
create temp table code as
  select invite_code from public.challenges where mode = 'goal' and creator_id = pg_temp.u(1);
grant all on code to authenticated;
select pg_temp.login(pg_temp.u(2));
select throws_ok(
  $$ select public.join_challenge_by_code((select invite_code from code)) $$,
  'P0001', 'invalid_invite_code', 'a goal cannot be joined by code'
);
select is((select count(*)::integer from public.challenges where mode = 'goal'), 0,
  'goals of others are not visible');

-- The stake is refunded until the start -----------------------------------------------------------
select pg_temp.login(pg_temp.u(1));
select is(
  public.leave_challenge((select id from public.challenges where creator_id = pg_temp.u(1) and mode = 'goal')),
  500::bigint, 'before the start the stake can be refunded'
);
select pg_temp.logout();

-- Window 0 --------------------------------------------------------------------------------------
-- A (u1, 10.00, reached), B (u2, 30.00, reached), C (u3, 20.00, missed), D (u4, 10.00, missed).
-- Lost pot 30.00, winners' stakes 40.00 → shares 7.50 / 22.50.
select pg_temp.goal('a', 1, 0, 1000);
select pg_temp.goal('b', 2, 0, 3000);
select pg_temp.goal('c', 3, 0, 2000);
select pg_temp.goal('d', 4, 0, 1000, 20000);
select pg_temp.run('a', 1, 5000);
select pg_temp.run('b', 2, 6000);
select pg_temp.run('d', 4, 6000);

select is(public.settle_challenge(pg_temp.c('c')), true, 'settling one goal settles the whole window');

select results_eq(
  $$ select name, status from ids join public.challenges on challenges.id = ids.id order by name $$,
  $$ values ('a','settled'::text), ('b','settled'), ('c','settled'), ('d','settled') $$,
  'every goal of the period is settled'
);

select results_eq(
  $$ select right(user_id::text, 1)::int, result, payout_cents from public.challenge_participants
      where challenge_id in (select id from ids) order by user_id $$,
  $$ values (1,'success'::text,1750::bigint), (2,'success',5250), (3,'failed',0), (4,'failed',0) $$,
  'winners get the stake plus a share in proportion to the stake, losers nothing'
);

select is(
  (select balance_cents from public.wallets where user_id = pg_temp.u(2)),
  (10000 - 3000 + 5250)::bigint,
  'the wallet of a winner is credited'
);

select results_eq(
  $$ select pg_temp.sum_of('a'), pg_temp.sum_of('b'), pg_temp.sum_of('c'), pg_temp.sum_of('d') $$,
  $$ values (0::bigint, 0::bigint, 0::bigint, 0::bigint) $$,
  'the bookings of every goal sum to 0'
);

select is(
  (select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries
    where account = 'house' and challenge_id in (select id from ids)),
  0::bigint, 'with an even division and no fee the house keeps nothing'
);

select is(public.settle_challenge(pg_temp.c('a')), false, 'a second settlement does nothing');
select is(
  (select count(*)::integer from public.ledger_entries
    where challenge_id in (select id from ids) and type = 'payout' and account = 'user'),
  2, 'and books nothing again'
);

-- Window 1: fee 10 % ------------------------------------------------------------------------------
select pg_temp.goal('e', 1, 1, 1000);
select pg_temp.goal('f', 2, 1, 2000);
select pg_temp.goal('g', 3, 1, 1000);
select pg_temp.run('e', 1, 5000);
select pg_temp.run('f', 2, 5000);
update public.challenges set fee_bps = 1000 where id in (pg_temp.c('e'), pg_temp.c('f'), pg_temp.c('g'));
select public.settle_challenge(pg_temp.c('g'));
-- lost 10.00, fee 1.00, distributable 9.00 over stakes 30.00 → shares 300 and 600.
select results_eq(
  $$ select right(user_id::text, 1)::int, payout_cents from public.challenge_participants
      where challenge_id in (pg_temp.c('e'), pg_temp.c('f'), pg_temp.c('g')) order by user_id $$,
  $$ values (1, 1300::bigint), (2, 2600), (3, 0) $$,
  'fee 10 %: it comes off the lost pot only'
);
select results_eq(
  $$ select type, amount_cents from public.ledger_entries
      where account = 'house' and challenge_id in (pg_temp.c('e'), pg_temp.c('f'), pg_temp.c('g'))
      order by type, amount_cents $$,
  $$ values ('fee'::text, 100::bigint), ('forfeit', 900), ('payout', -600), ('payout', -300) $$,
  'house: the fee stays, the rest passes through to the winners'
);
select results_eq(
  $$ select pg_temp.sum_of('e'), pg_temp.sum_of('f'), pg_temp.sum_of('g') $$,
  $$ values (0::bigint, 0::bigint, 0::bigint) $$,
  'every goal still sums to 0 with a fee'
);

-- Window 2: nobody reaches the goal ---------------------------------------------------------------
select pg_temp.goal('h', 1, 2, 1000);
select pg_temp.goal('i', 2, 2, 3000);
select public.settle_challenge(pg_temp.c('h'));
select results_eq(
  $$ select type, sum(amount_cents)::bigint from public.ledger_entries
      where account = 'house' and challenge_id in (pg_temp.c('h'), pg_temp.c('i')) group by type $$,
  $$ values ('forfeit'::text, 4000::bigint) $$,
  'nobody reached the goal: all stakes go to the house'
);

-- Window 3: alone and reached ---------------------------------------------------------------------
select pg_temp.goal('j', 5, 3, 2000);
select pg_temp.run('j', 5, 5000);
select public.settle_challenge(pg_temp.c('j'));
select is(
  (select payout_cents from public.challenge_participants where challenge_id = pg_temp.c('j')),
  2000::bigint, 'alone and reached: the stake comes back'
);

select * from finish();
rollback;
