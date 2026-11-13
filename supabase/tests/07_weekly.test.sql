-- Ausbau 3 – fixed ranked cycles (daily, weekly, monthly; km and steps).
begin;
create extension if not exists pgtap with schema extensions;

select plan(13);

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

-- The migration already created cycles for "now"; use a date far away for exact checks.
-- Wednesday 2031-03-12 → day 13.03., week from Monday 17.03. (KW 12), month April 2031.
select is(public.create_ranked_cycles('2031-03-12 12:00:00+00'), 6, 'one run creates six cycles');

select results_eq(
  $$ select weekly_key from public.challenges where weekly_key like '%2031%' order by weekly_key $$,
  $$ values ('D2031-03-13-km'), ('D2031-03-13-steps'), ('M2031-04-km'), ('M2031-04-steps'),
            ('W2031-W12-km'), ('W2031-W12-steps') $$,
  'daily, weekly and monthly, each for km and steps'
);

select results_eq(
  $$ select goal_type, target_value, stake_cents, fee_bps, mode, visibility, status,
            creator_id is null, min_participants
       from public.challenges where weekly_key = 'W2031-W12-km' $$,
  $$ values ('run_total', 1000, 0::bigint, 0, 'ranked', 'public', 'open', true, 2) $$,
  'a ranked cycle is public and has no stake'
);

select results_eq(
  $$ select goal_type from public.challenges where weekly_key = 'M2031-04-steps' $$,
  $$ values ('steps_total') $$,
  'steps cycles count steps'
);

select results_eq(
  $$ select starts_at, ends_at from public.challenges where weekly_key = 'D2031-03-13-km' $$,
  $$ values ('2031-03-12 23:00:00+00'::timestamptz, '2031-03-13 23:00:00+00'::timestamptz) $$,
  'the day runs from 00:00 to 00:00 (Berlin time)'
);

select results_eq(
  $$ select starts_at, ends_at from public.challenges where weekly_key = 'W2031-W12-km' $$,
  $$ values ('2031-03-16 23:00:00+00'::timestamptz, '2031-03-23 23:00:00+00'::timestamptz) $$,
  'the week runs from Monday to the next Monday'
);

select results_eq(
  $$ select starts_at, ends_at, title from public.challenges where weekly_key = 'M2031-04-km' $$,
  $$ values ('2031-03-31 22:00:00+00'::timestamptz, '2031-04-30 22:00:00+00'::timestamptz,
             'Meiste km im April') $$,
  'the month runs over the calendar month (summer time)'
);

select is(public.create_ranked_cycles('2031-03-12 20:00:00+00'), 0, 'a second run the same day creates nothing');
select is(public.create_ranked_cycles('2031-03-13 12:00:00+00'), 2, 'the next day only adds the next day');

insert into auth.users (id, email, aud, role) values ('00000000-0000-4000-8000-000000000001', 'u1@pgtap.test', 'authenticated', 'authenticated');
select pg_temp.login('00000000-0000-4000-8000-000000000001');
select throws_ok($$ select public.create_ranked_cycles() $$, '42501', null,
  'signed-in users cannot create ranked cycles');
select throws_ok(
  $$ select public.create_challenge('Eigene Ranked', 'run_total', 5000, 0, current_date + 2, 3, 'public', null, 'ranked') $$,
  'P0001', 'invalid_mode', 'users cannot create ranked challenges any more');
select pg_temp.logout();

select is(
  (select count(*)::integer from cron.job where jobname = 'create-ranked-cycles' and schedule = '0 12 * * *'),
  1, 'pg_cron creates the cycles every day'
);
select is(
  (select count(*)::integer from cron.job where jobname = 'create-weekly-challenge'),
  0, 'the old weekly job is gone'
);

select * from finish();
rollback;
