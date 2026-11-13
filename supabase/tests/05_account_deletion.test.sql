-- Phase 5 – deleting an account: refunds, forfeits, anonymised ledger, settlement still adds up.
begin;
create extension if not exists pgtap with schema extensions;

select plan(26);

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

create function pg_temp.c(p_name text)
returns uuid
language sql
as $$ select id from ids where name = p_name; $$;

-- An open run_single challenge (5 km, 10.00 stake) that starts tomorrow. Joining goes through
-- the real booking function.
create function pg_temp.challenge(p_name text, p_mode text, p_creator integer, p_users integer[])
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  v_n integer;
begin
  insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
    starts_at, ends_at, min_participants, max_participants, visibility, status, mode)
  values (pg_temp.u(p_creator), p_name, 'run_single', 5000, 1000,
    now() + interval '1 day', now() + interval '3 days',
    case when p_mode = 'solo' then 1 else 2 end,
    null, 'public', 'open', 'pool')
  returning id into v_id;

  foreach v_n in array p_users loop
    perform private.join(v_id, pg_temp.u(v_n));
  end loop;

  insert into ids values (p_name, v_id);
  return v_id;
end;
$$;

create function pg_temp.ledger_sum(p_name text)
returns bigint
language sql
as $$
  select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries
   where challenge_id = pg_temp.c(p_name);
$$;

-- Users 1..3 with 100.00 credits each ------------------------------------------------------

insert into auth.users (id, email, aud, role)
select pg_temp.u(n), 'user' || n || '@pgtap.test', 'authenticated', 'authenticated'
  from generate_series(1, 3) n;

-- User 1 is involved in every kind of challenge:
--   open_ranked    open, user 1 and 2 joined                → refund, participation removed
--   open_solo      open pool of user 1 alone                → refund, participation removed
--   running_ranked settling, users 1–3 joined, user 2 ran   → stake forfeited into the pot
--   running_solo   active solo of user 1                    → stake forfeited
--   created_only   open, created by user 1, only user 3     → keeps running without creator
select pg_temp.challenge('open_ranked', 'ranked', 1, array[1, 2]);
select pg_temp.challenge('open_solo', 'solo', 1, array[1]);
select pg_temp.challenge('running_ranked', 'ranked', 2, array[1, 2, 3]);
select pg_temp.challenge('running_solo', 'solo', 1, array[1]);
select pg_temp.challenge('created_only', 'ranked', 1, array[3]);

update public.challenges
   set starts_at = now() - interval '3 days', ends_at = now() - interval '2 days',
       status = 'settling'
 where id = pg_temp.c('running_ranked');

update public.challenges
   set starts_at = now() - interval '1 day', ends_at = now() + interval '1 day', status = 'active'
 where id = pg_temp.c('running_solo');

insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
select pg_temp.u(n), 'android', 'run-' || n, 'running',
       c.starts_at + interval '1 hour', c.starts_at + interval '90 minutes', 6000, 1800, false, true
  from public.challenges c, unnest(array[1, 2]) n
 where c.id = pg_temp.c('running_ranked');

insert into public.activity_daily_steps (user_id, date, steps, platform, is_valid)
values (pg_temp.u(1), current_date - 1, 9000, 'android', true);

-- Permissions ----------------------------------------------------------------------------

set local role anon;
select throws_ok(
  $$ select public.delete_my_account() $$,
  '42501', null, 'anonymous callers cannot delete accounts'
);
reset role;

select set_config('role', 'authenticated', true), set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select public.delete_my_account() $$,
  '42501', 'not_authenticated', 'a request without user cannot delete anything'
);
select pg_temp.logout();

select pg_temp.login(pg_temp.u(1));
select throws_ok(
  format('select private.delete_account(%L)', pg_temp.u(2)),
  '42501', null, 'users cannot delete other accounts through the operator function'
);
select pg_temp.logout();

-- Delete user 1 --------------------------------------------------------------------------

select pg_temp.login(pg_temp.u(1));
select lives_ok($$ select public.delete_my_account() $$, 'user 1 deletes the account');
select pg_temp.logout();

select is((select count(*)::int from auth.users where id = pg_temp.u(1)), 0,
  'the auth user is deleted');
select is((select count(*)::int from public.profiles where id = pg_temp.u(1)), 0,
  'the profile is deleted');
select is((select count(*)::int from public.wallets where user_id = pg_temp.u(1)), 0,
  'the wallet is deleted');
select is(
  (select count(*)::int from public.activity_workouts where user_id = pg_temp.u(1))
  + (select count(*)::int from public.activity_daily_steps where user_id = pg_temp.u(1)),
  0, 'workouts and daily steps are deleted');
select is((select count(*)::int from public.ledger_entries where user_id = pg_temp.u(1)), 0,
  'no ledger entry points to the user any more');
select is(
  (select count(*)::int from public.ledger_entries where account = 'user' and user_id is null),
  7, 'the 7 ledger entries of user 1 are kept anonymised');
select is(
  (select count(*)::int from public.challenge_participants where user_id = pg_temp.u(1)), 0,
  'no participation points to the user any more');

-- Open ranked: refund, participation removed.
select is(
  (select participant_count from public.challenges where id = pg_temp.c('open_ranked')), 1,
  'open ranked: user 1 left the challenge');
select is(pg_temp.ledger_sum('open_ranked'), -1000::bigint,
  'open ranked: the stake of user 1 was refunded (only user 2 is still in)');

-- Open pool of one: refund, the empty pool is cancelled at its start.
select is(
  (select participant_count from public.challenges where id = pg_temp.c('open_solo')), 0,
  'open pool of one: user 1 left the pool');
select is(pg_temp.ledger_sum('open_solo'), 0::bigint, 'open pool of one: the stake was refunded');

-- Created challenge keeps running for the others.
select results_eq(
  $$ select status, creator_id is null, participant_count from public.challenges
      where id = pg_temp.c('created_only') $$,
  $$ values ('open'::text, true, 1) $$,
  'a challenge created by user 1 keeps running without a creator');

-- Running ranked: forfeited, settles with the stake in the pot.
select results_eq(
  $$ select result, payout_cents from public.challenge_participants
      where challenge_id = pg_temp.c('running_ranked') and user_id is null $$,
  $$ values ('failed'::text, 0::bigint) $$,
  'running ranked: the anonymous participation is failed');
select is(
  (select participant_count from public.challenges where id = pg_temp.c('running_ranked')), 3,
  'running ranked: the participant count stays');

select ok(public.settle_challenge(pg_temp.c('running_ranked')), 'running ranked settles');
select is(
  (select payout_cents from public.challenge_participants
    where challenge_id = pg_temp.c('running_ranked') and user_id = pg_temp.u(2)),
  3000::bigint, 'running ranked: the winner gets the forfeited stake of user 1 as well');
select is(pg_temp.ledger_sum('running_ranked'), 0::bigint,
  'running ranked: all bookings still add up to 0');

-- Running solo: forfeited to the house at settlement.
select is(
  (select result from public.challenge_participants
    where challenge_id = pg_temp.c('running_solo')),
  'failed', 'running solo: the anonymous participation is failed');

update public.challenges
   set starts_at = now() - interval '3 days', ends_at = now() - interval '2 days',
       status = 'settling'
 where id = pg_temp.c('running_solo');
select public.settle_challenge(pg_temp.c('running_solo'));

select results_eq(
  $$ select account, type, amount_cents from public.ledger_entries
      where challenge_id = pg_temp.c('running_solo') order by account $$,
  $$ values ('house'::text, 'forfeit'::text, 1000::bigint), ('user', 'stake', -1000) $$,
  'running solo: the stake goes to the house and the bookings add up to 0');

-- The ledger stays append-only.
select throws_ok(
  $$ update public.ledger_entries set amount_cents = 1
      where account = 'user' and user_id is null and type = 'signup_bonus' $$,
  'P0001', 'ledger_is_append_only', 'anonymised entries cannot be changed');

-- Deletion requests by email: the operator deletes by address.
select lives_ok(
  $$ select private.delete_account((select id from auth.users where email = 'user3@pgtap.test')) $$,
  'the operator deletes an account by email address');
select is((select count(*)::int from public.profiles where id = pg_temp.u(3)), 0,
  'the operator deletion removed the profile');

select * from finish();
rollback;
