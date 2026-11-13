-- Ausbau 2 – appeals against rejected activities.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated');

-- A run that is too fast (rejected), a valid run, a manual run – all of Anna – and one of Ben.
insert into public.activity_workouts (id, user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'android', 'fast', 'running',
   now() - interval '3 days', now() - interval '3 days' + interval '20 minutes', 10000, 1200, false, false, 'too_fast'),
  ('a0000000-0000-4000-8000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000001', 'android', 'ok', 'running',
   now() - interval '2 days', now() - interval '2 days' + interval '30 minutes', 5000, 1800, false, true, null),
  ('a0000000-0000-4000-8000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000001', 'android', 'manual', 'running',
   now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 5000, 1800, true, false, 'manual_entry'),
  ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'android', 'ben-fast', 'running',
   now() - interval '3 days', now() - interval '3 days' + interval '20 minutes', 10000, 1200, false, false, 'too_fast');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

select is(
  (public.submit_appeal('a0000000-0000-4000-8000-000000000001', 'Das war ein Wettkampf mit Pacemakern.')).status,
  'open',
  'an appeal against a rejected run starts as open'
);
select throws_ok(
  $$ select public.submit_appeal('a0000000-0000-4000-8000-000000000001', 'Noch ein Einspruch gegen denselben Lauf.') $$,
  'P0001', 'appeal_exists', 'only one appeal per run'
);
select throws_ok(
  $$ select public.submit_appeal('a0000000-0000-4000-8000-000000000002', 'Dieser Lauf zählt doch schon längst.') $$,
  'P0001', 'workout_counts', 'a run that counts needs no appeal'
);
select throws_ok(
  $$ select public.submit_appeal('a0000000-0000-4000-8000-000000000003', 'Ich habe den Lauf von Hand eingetragen.') $$,
  'P0001', 'manual_entry_not_appealable', 'manual entries cannot be appealed'
);
select throws_ok(
  $$ select public.submit_appeal('b0000000-0000-4000-8000-000000000001', 'Das ist gar nicht mein Lauf, aber egal.') $$,
  'P0001', 'workout_not_found', 'nobody can appeal for the run of somebody else'
);
select throws_ok(
  $$ select public.submit_appeal('a0000000-0000-4000-8000-000000000001', 'kurz') $$,
  'P0001', 'invalid_appeal_message', 'the reason needs at least 10 characters'
);
select pg_temp.logout();

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.appeals), 1, 'users read their own appeals');
select throws_ok(
  $$ update public.appeals set status = 'accepted' $$,
  '42501', null, 'users cannot decide their own appeal'
);
select throws_ok(
  $$ insert into public.appeals (user_id, workout_id, message)
     values ('aaaaaaaa-0000-0000-0000-000000000001', 'a0000000-0000-4000-8000-000000000003', 'Direkt eingefügt ohne Prüfung.') $$,
  '42501', null, 'appeals cannot be written directly'
);
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is((select count(*)::int from public.appeals), 0, 'other people do not see the appeal');
select pg_temp.logout();

-- Operator decision ------------------------------------------------------------------------------------

select private.resolve_appeal((select id from public.appeals), true, 'Wettkampf bestätigt');

select results_eq(
  $$ select status, resolution_note, resolved_at is not null from public.appeals $$,
  $$ values ('accepted'::text, 'Wettkampf bestätigt'::text, true) $$,
  'accepting is recorded with the note'
);
select results_eq(
  $$ select is_valid, invalid_reason, appeal_accepted from public.activity_workouts
      where id = 'a0000000-0000-4000-8000-000000000001' $$,
  $$ values (true, null::text, true) $$,
  'an accepted appeal makes the run count'
);
select throws_ok(
  $$ select private.resolve_appeal((select id from public.appeals), false, 'zu spät') $$,
  'P0001', 'appeal_not_open', 'an appeal is decided only once'
);

-- A later sync of the same run does not undo the decision.
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_workouts(jsonb_build_array(jsonb_build_object(
  'platform', 'android', 'source_record_id', 'fast', 'source_name', 'watch', 'activity_type', 'running',
  'start_at', now() - interval '3 days', 'end_at', now() - interval '3 days' + interval '20 minutes',
  'distance_m', 10000, 'duration_s', 1200, 'was_user_entered', false)));
select is(
  (select is_valid from public.activity_workouts where id = 'a0000000-0000-4000-8000-000000000001'),
  true,
  'syncing the run again keeps the accepted decision'
);
select pg_temp.logout();

-- Rate limit -------------------------------------------------------------------------------------------

insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
select 'bbbbbbbb-0000-0000-0000-000000000002', 'android', 'r' || n, 'running',
       now() - interval '5 days' - make_interval(hours => n), now() - interval '5 days' - make_interval(hours => n) + interval '10 minutes',
       5000, 600, false, false, 'too_fast'
  from generate_series(1, 6) n;

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.submit_appeal(id, 'Ich habe diesen Lauf wirklich gemacht, ehrlich.')
  from public.activity_workouts where source_record_id in ('r1', 'r2', 'r3', 'r4', 'ben-fast');
select throws_ok(
  $$ select public.submit_appeal((select id from public.activity_workouts where source_record_id = 'r5'),
       'Ich habe diesen Lauf wirklich gemacht, ehrlich.') $$,
  'P0001', 'appeal_rate_limited', 'at most five appeals per day'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.submit_appeal(uuid, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.resolve_appeal(uuid, boolean, text)', 'execute'),
  'only signed-in users can appeal and only the operator can decide'
);

select * from finish();
rollback;
