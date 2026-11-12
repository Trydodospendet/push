-- Phase 3 – health: sync functions, plausibility rules, progress and privacy.
begin;
create extension if not exists pgtap with schema extensions;

select plan(36);

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

-- One running workout as the app would send it.
create function pg_temp.w(
  p_id text, p_start timestamptz, p_dist integer, p_dur integer, p_manual boolean default false
)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'platform', 'android', 'source_record_id', p_id, 'source_name', 'com.test',
    'activity_type', 'running', 'start_at', p_start,
    'end_at', p_start + make_interval(secs => p_dur),
    'distance_m', p_dist, 'duration_s', p_dur, 'was_user_entered', p_manual);
$$;

create function pg_temp.d(p_date date, p_steps integer)
returns jsonb
language sql
as $$
  select jsonb_build_object('platform', 'android', 'date', p_date, 'steps', p_steps,
                            'excluded_sources', 0);
$$;

create function pg_temp.today()
returns date
language sql
as $$ select (now() at time zone 'Europe/Berlin')::date; $$;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- Three challenges that Anna and Ben join, then started by moving the period into the past.
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

insert into ids select 'single', (public.create_challenge('5 km am Stück', 'run_single', 5000, 500,
  pg_temp.today() + 1, 7, 'public')).id;
insert into ids select 'total', (public.create_challenge('8 km insgesamt', 'run_total', 8000, 500,
  pg_temp.today() + 1, 7, 'public')).id;
insert into ids select 'steps', (public.create_challenge('10k Schritte', 'steps_daily', 10000, 500,
  pg_temp.today() + 1, 5, 'public')).id;

select public.join_challenge(id) from ids;
select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.join_challenge(id) from ids;
select pg_temp.logout();

-- Periods: single/total run from 2 days ago to 5 days ahead; steps from 2 days ago for 5 days.
update public.challenges
   set status = 'active',
       starts_at = (pg_temp.today() - 2)::timestamp at time zone timezone,
       ends_at = (pg_temp.today() + 5)::timestamp at time zone timezone
 where id in (select id from ids where name in ('single', 'total'));
update public.challenges
   set status = 'active',
       starts_at = (pg_temp.today() - 2)::timestamp at time zone timezone,
       ends_at = (pg_temp.today() + 3)::timestamp at time zone timezone
 where id = (select id from ids where name = 'steps');

-- Workouts ---------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select is(
  public.sync_workouts(jsonb_build_array(
    pg_temp.w('run-ok', now() - interval '3 hours', 5000, 1800))),
  1,
  'a plausible run is accepted'
);

select results_eq(
  $$ select is_valid, invalid_reason, was_user_entered from public.activity_workouts
      where source_record_id = 'run-ok' $$,
  $$ values (true, null::text, false) $$,
  'a plausible run is stored as valid'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'single')),
  5000,
  'run_single progress is the longest valid run'
);

select public.sync_workouts(jsonb_build_array(
  pg_temp.w('run-manual', now() - interval '5 hours', 9000, 3600, true)));

select results_eq(
  $$ select is_valid, invalid_reason from public.activity_workouts where source_record_id = 'run-manual' $$,
  $$ values (false, 'manual_entry'::text) $$,
  'a manually entered run is invalid with reason manual_entry'
);

select public.sync_workouts(jsonb_build_array(
  pg_temp.w('run-fast', now() - interval '6 hours', 5000, 600),
  pg_temp.w('run-slow', now() - interval '8 hours', 1000, 1000),
  pg_temp.w('run-short', now() - interval '9 hours', 100, 30),
  pg_temp.w('run-future', now() + interval '1 hour', 5000, 1800)));

select results_eq(
  $$ select source_record_id, invalid_reason from public.activity_workouts
      where source_record_id in ('run-fast', 'run-slow', 'run-short', 'run-future')
      order by source_record_id $$,
  $$ values ('run-fast'::text, 'too_fast'::text), ('run-future', 'invalid_data'),
            ('run-short', 'invalid_data'), ('run-slow', 'too_slow') $$,
  'implausible pace, tiny and future workouts are flagged with a reason'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'single')),
  5000,
  'invalid workouts never change the progress'
);

select public.sync_workouts(jsonb_build_array(
  pg_temp.w('run-ok', now() - interval '3 hours', 5000, 1800)));

select is(
  (select count(*)::int from public.activity_workouts where source_record_id = 'run-ok'),
  1,
  'syncing the same workout again does not duplicate it'
);

select public.sync_workouts(jsonb_build_array(
  pg_temp.w('run-two', now() - interval '1 day', 4000, 1500),
  pg_temp.w('run-old', now() - interval '10 days', 3000, 1100)));

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'total')),
  9000,
  'run_total sums valid runs inside the period and ignores runs before it'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'single')),
  5000,
  'run_single still reports the longest run'
);

select results_eq(
  $$ select count(*)::int from public.activity_workouts $$,
  $$ values (8) $$,
  'all synced workouts, valid or not, are visible to their owner'
);

-- Input validation ---------------------------------------------------------------------------

select throws_ok(
  $$ select public.sync_workouts('{"a": 1}'::jsonb) $$,
  '22023', 'invalid_health_payload', 'the payload must be an array'
);

select throws_ok(
  $$ select public.sync_workouts((select jsonb_agg(pg_temp.w('bulk-' || n, now() - interval '3 hours', 5000, 1800))
                                    from generate_series(1, 501) n)) $$,
  '22023', 'health_batch_too_large', 'more than 500 workouts per call are rejected'
);

select throws_ok(
  $$ select public.sync_workouts(jsonb_build_array(
       pg_temp.w('run-ancient', now() - interval '46 days', 5000, 1800))) $$,
  '22023', 'health_outside_window', 'workouts older than 45 days are rejected'
);

select throws_ok(
  $$ select public.sync_workouts(jsonb_build_array(
       jsonb_set(pg_temp.w('run-bad', now() - interval '3 hours', 5000, 1800), '{platform}', '"web"'))) $$,
  '22023', 'invalid_health_payload', 'unknown platforms are rejected'
);

select throws_ok(
  $$ select public.sync_workouts(jsonb_build_array(
       jsonb_set(pg_temp.w('run-bad', now() - interval '3 hours', 5000, 1800), '{distance_m}', '5000.5'))) $$,
  '22023', 'invalid_health_payload', 'fractional distances are rejected'
);

select throws_ok(
  $$ select public.sync_workouts(jsonb_build_array(
       jsonb_set(pg_temp.w('run-bad', now() - interval '3 hours', 5000, 1800), '{distance_m}', '99999999999'))) $$,
  '22023', 'invalid_health_payload', 'huge numbers are rejected instead of overflowing'
);

select throws_ok(
  $$ select public.sync_workouts(jsonb_build_array(
       jsonb_set(pg_temp.w('run-bad', now() - interval '3 hours', 5000, 1800), '{was_user_entered}', '"false"'))) $$,
  '22023', 'invalid_health_payload', 'the manual flag must be a real boolean'
);

-- Daily steps ------------------------------------------------------------------------------

select is(
  public.sync_daily_steps(jsonb_build_array(
    pg_temp.d(pg_temp.today() - 2, 12000),
    pg_temp.d(pg_temp.today() - 1, 9000),
    pg_temp.d(pg_temp.today(), 15000))),
  3,
  'three days of steps are accepted'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'steps')),
  2,
  'steps_daily counts the days that reached the target'
);

select public.sync_daily_steps(jsonb_build_array(pg_temp.d(pg_temp.today() - 1, 11000)));

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'steps')),
  3,
  'a newer value overwrites the old one for the same day'
);

select public.sync_daily_steps(jsonb_build_array(pg_temp.d(pg_temp.today() - 2, 90000)));

select results_eq(
  $$ select steps, is_valid from public.activity_daily_steps where date = pg_temp.today() - 2 $$,
  $$ values (90000, false) $$,
  'more than 80,000 steps are stored but flagged as implausible'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'steps')),
  2,
  'implausible days do not count'
);

select throws_ok(
  $$ select public.sync_daily_steps(jsonb_build_array(pg_temp.d(pg_temp.today() + 1, 5000))) $$,
  '22023', 'health_outside_window', 'future days are rejected'
);

select throws_ok(
  $$ select public.sync_daily_steps(jsonb_build_array(pg_temp.d(pg_temp.today() - 45, 5000))) $$,
  '22023', 'health_outside_window', 'days older than 45 days are rejected'
);

select throws_ok(
  $$ select public.sync_daily_steps(jsonb_build_array(pg_temp.d(pg_temp.today(), -5))) $$,
  '22023', 'invalid_health_payload', 'negative steps are rejected'
);

select throws_ok(
  $$ select public.sync_daily_steps('[]'::jsonb || (select jsonb_agg(pg_temp.d(pg_temp.today(), 1))
                                                       from generate_series(1, 46))) $$,
  '22023', 'health_batch_too_large', 'at most 45 days per call'
);

-- Privacy and access -------------------------------------------------------------------------

select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.activity_workouts),
  0,
  'Ben cannot read Anna''s workouts'
);

select is(
  (select count(*)::int from public.activity_daily_steps),
  0,
  'Ben cannot read Anna''s steps'
);

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'single')),
  0,
  'Ben''s own progress is independent of Anna''s'
);

select throws_ok(
  $$ select progress_value from public.challenge_participants $$,
  '42501', null, 'participants cannot read the progress of others'
);

select is(
  (select count(*)::int from public.challenge_participants
    where challenge_id = (select id from ids where name = 'single')),
  2,
  'participants still see each other and their result'
);

select throws_ok(
  $$ select public.recompute_progress('00000000-0000-0000-0000-000000000000') $$,
  '42501', 'not_joined', 'recompute_progress needs a participation'
);

select lives_ok(
  $$ select public.recompute_progress((select id from ids where name = 'single')) $$,
  'a participant can recompute progress'
);

select pg_temp.logout();
set local role anon;

select throws_ok(
  $$ select public.sync_workouts('[]'::jsonb) $$,
  '42501', null, 'anon cannot sync workouts'
);

select throws_ok(
  $$ select public.get_my_progress() $$,
  '42501', null, 'anon cannot read progress'
);

reset role;

-- After the grace period nothing changes anymore -----------------------------------------------

update public.challenges
   set starts_at = now() - interval '5 days', ends_at = now() - interval '3 days'
 where id = (select id from ids where name = 'single');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('run-late', now() - interval '4 days', 20000, 7000)));

select is(
  (select progress_value from public.get_my_progress()
    where challenge_id = (select id from ids where name = 'single')),
  5000,
  'progress is frozen once the sync grace period is over'
);

select pg_temp.logout();

select * from finish();
rollback;
