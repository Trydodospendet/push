-- Phase 7 – weekly challenges.
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

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

-- Sunday 2026-11-15, 09:00 Berlin → the week of Monday 2026-11-16 (ISO week 47).
select isnt(
  public.create_weekly_challenge('2026-11-15 08:00:00+00'),
  null::uuid,
  'the Sunday run creates the challenge'
);

select results_eq(
  $$ select title, goal_type, target_value, stake_cents, mode, visibility, status,
            creator_id is null, weekly_key, min_participants
       from public.challenges where weekly_key = '2026-W47' $$,
  $$ values ('10 km diese Woche', 'run_total', 10000, 500::bigint, 'ranked', 'public', 'open',
             true, '2026-W47', 2) $$,
  'it is a public ranked 10 km challenge with a 5.00 credit stake'
);

select results_eq(
  $$ select starts_at, ends_at from public.challenges where weekly_key = '2026-W47' $$,
  $$ values ('2026-11-15 23:00:00+00'::timestamptz, '2026-11-22 23:00:00+00'::timestamptz) $$,
  'it runs from Monday 00:00 to the next Monday 00:00 (Berlin time)'
);

select is(
  public.create_weekly_challenge('2026-11-15 08:00:00+00'),
  null::uuid,
  'a second run in the same week creates nothing'
);
select is(
  public.create_weekly_challenge('2026-11-15 20:30:00+00'),
  null::uuid,
  'a later run on the same Sunday creates nothing'
);
select is(
  (select count(*)::integer from public.challenges where weekly_key = '2026-W47'),
  1,
  'there is exactly one challenge for the week'
);

select isnt(
  public.create_weekly_challenge('2026-11-22 08:00:00+00'),
  null::uuid,
  'the next Sunday creates the next week'
);
select is(
  (select weekly_key from public.challenges where weekly_key = '2026-W48'),
  '2026-W48',
  'the next week has its own key'
);

select is(
  (select to_char('2026-12-28'::date, 'IYYY"-W"IW')),
  '2026-W53',
  'the key follows the ISO year at year ends'
);

select pg_temp.login('00000000-0000-4000-8000-000000000001');
select throws_ok(
  $$ select public.create_weekly_challenge() $$,
  '42501',
  null,
  'signed-in users cannot create weekly challenges'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.create_weekly_challenge(timestamptz)', 'execute'),
  'anonymous users cannot call create_weekly_challenge'
);

select is(
  (select count(*)::integer from cron.job where jobname = 'create-weekly-challenge'
     and schedule = '0 8 * * 0'),
  1,
  'pg_cron runs the job every Sunday'
);

select * from finish();
rollback;
