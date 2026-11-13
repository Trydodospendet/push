-- Phase 8 – GPS runs: server-side distance, fraud rules, duplicates, privacy.
begin;
create extension if not exists pgtap with schema extensions;

select plan(30);

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

-- A straight track going north: one point every p_step_s seconds at p_speed m/s, starting
-- p_ago_s seconds ago at 52.5 N / 13.4 E. p_mock_at / p_jump_at / p_glitch_at pick a point index.
create function pg_temp.track(
  p_n integer, p_speed double precision, p_ago_s integer,
  p_step_s integer default 3, p_accuracy double precision default 5,
  p_mock_at integer default -1, p_jump_from integer default -1, p_glitch_at integer default -1,
  p_seg_from integer default -1
)
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_array(
    52.5 + (p_speed * p_step_s * i) / 111194.9
         + case when p_jump_from >= 0 and i >= p_jump_from then 0.5 else 0 end
         + case when i = p_glitch_at then 0.5 else 0 end,
    13.4,
    (extract(epoch from now()) * 1000)::bigint - p_ago_s * 1000::bigint + i * p_step_s * 1000::bigint,
    p_accuracy,
    case when p_seg_from >= 0 and i >= p_seg_from then 1 else 0 end,
    case when i = p_mock_at then 1 else 0 end
  ) order by i)
  from generate_series(0, p_n - 1) i;
$$;

create function pg_temp.run(p_id text, p_points jsonb)
returns jsonb
language sql
as $$ select jsonb_build_object('client_run_id', p_id, 'points', p_points); $$;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');

create temp table results (name text primary key, run_id uuid);
grant all on results to authenticated;

-- Anna: a clean 3.6 km run (400 points, 3 m/s = 5:33 min/km) --------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');

insert into results
select 'clean', run_id
  from public.sync_gps_run(pg_temp.run('11111111-1111-4111-8111-111111111111',
                                       pg_temp.track(400, 3, 7200)));

select ok(
  (select distance_m between 3585 and 3615 and is_valid and invalid_reason is null
     from public.get_my_gps_runs() where id = (select run_id from results where name = 'clean')),
  'the server measures about 3.6 km and accepts the run'
);
select is(
  (select duration_s from public.get_my_gps_runs() limit 1),
  1197,
  'the time is the moving time between the points (399 steps of 3 s)'
);
select is(
  (select count(*)::integer from public.activity_workouts
    where platform = 'gps' and is_valid and source_name = 'PUSH GPS'),
  1,
  'the run is mirrored as a valid workout'
);

select is(
  (select count(*)::integer from public.sync_gps_run(pg_temp.run('11111111-1111-4111-8111-111111111111',
                                                                  pg_temp.track(400, 3, 7200)))),
  1,
  'uploading the same run again returns it'
);
select is(
  (select count(*)::integer from public.get_my_gps_runs()),
  1,
  'but does not create a second one'
);

-- A single bad GPS point is ignored, not punished.
select ok(
  (select is_valid and distance_m between 3570 and 3620
     from public.sync_gps_run(pg_temp.run('22222222-2222-4222-8222-222222222222',
            pg_temp.track(400, 3, 20000, 3, 5, -1, -1, 100)))),
  'one glitch point does not invalidate the run and is not counted'
);

-- Pause: a new segment counts nothing for the gap.
select ok(
  (select is_valid and distance_m between 1180 and 1196 and duration_s between 592 and 596
     from public.sync_gps_run(pg_temp.run('33333333-3333-4333-8333-333333333333',
            pg_temp.track(200, 2, 30000, 3, 5, -1, -1, -1, 100)))),
  'a segment restart is not measured as movement'
);

select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('44444444-4444-4444-8444-444444444444',
        pg_temp.track(400, 3, 40000, 3, 5, 150)))),
  'mock_location',
  'a point flagged as mocked invalidates the run'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('55555555-5555-4555-8555-555555555555',
        pg_temp.track(400, 3, 50000, 3, 5, -1, 100)))),
  'gps_jump',
  'teleporting during the run invalidates it'
);
select ok(
  (select is_valid from public.sync_gps_run(pg_temp.run('66666666-6666-4666-8666-666666666666',
        pg_temp.track(300, 5, 60000)))),
  '5 m/s (3:20 min/km) is a fast but possible run and stays valid'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('77777777-7777-4777-8777-777777777777',
        pg_temp.track(200, 7, 70000)))),
  'too_fast',
  'cycling speed is rejected'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('88888888-8888-4888-8888-888888888888',
        pg_temp.track(200, 0.9, 80000)))),
  'too_slow',
  'walking pace is rejected as too slow'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('99999999-9999-4999-8999-999999999999',
        pg_temp.track(8, 3, 90000)))),
  'invalid_data',
  'a track with fewer than 10 points is rejected'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('aaaaaaaa-1111-4111-8111-111111111111',
        pg_temp.track(400, 3, 100000, 3, 80)))),
  'invalid_data',
  'points with poor accuracy are ignored, so nothing is left to measure'
);
select is(
  (select invalid_reason from public.sync_gps_run(pg_temp.run('bbbbbbbb-1111-4111-8111-111111111111',
        pg_temp.track(400, 3, 600)))),
  'invalid_data',
  'a run that ends in the future is rejected'
);

select throws_ok(
  $$ select * from public.sync_gps_run('{"client_run_id": "nope", "points": []}') $$,
  '22023', 'invalid_gps_payload', 'a malformed run id is rejected'
);
select throws_ok(
  $$ select * from public.sync_gps_run(jsonb_build_object(
       'client_run_id', 'cccccccc-1111-4111-8111-111111111111',
       'points', jsonb_build_array(jsonb_build_array(95, 13.4, 1000, 5, 0, 0),
                                   jsonb_build_array(52.5, 13.4, 2000, 5, 0, 0)))) $$,
  '22023', 'invalid_gps_payload', 'a latitude outside the globe is rejected'
);
select throws_ok(
  $$ select * from public.sync_gps_run(jsonb_build_object(
       'client_run_id', 'dddddddd-1111-4111-8111-111111111111',
       'points', (select jsonb_agg(jsonb_build_array(52.5, 13.4, i, 5, 0, 0))
                    from generate_series(1, 20001) i))) $$,
  '22023', 'gps_batch_too_large', 'more than 20,000 points are rejected'
);

-- Privacy: the route without the first and last 200 m ------------------------------------------

select ok(
  (select count(*) > 0 and min(lat) >= 52.5 + 0.00179 and max(lat) <= 52.5 + 0.0324 - 0.00179
     from public.get_gps_run_route((select run_id from results where name = 'clean'))),
  'the route starts and ends 200 m inside the real track'
);
select ok(
  (select count(*) between 352 and 356
     from public.get_gps_run_route((select run_id from results where name = 'clean'))),
  'about 23 points of 9 m each are cut at both ends'
);
select throws_ok(
  $$ select * from public.gps_runs $$,
  '42501', null, 'the raw tracks cannot be read directly'
);
select pg_temp.logout();

-- Ben cannot see Anna's route or runs ------------------------------------------------------------

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::integer from public.get_gps_run_route((select run_id from results where name = 'clean'))),
  0,
  'other people get no route'
);
select is(
  (select count(*)::integer from public.get_my_gps_runs()),
  0,
  'other people do not see the run list either'
);

-- A short run has no route to show at all.
select ok(
  (select is_valid from public.sync_gps_run(pg_temp.run('eeeeeeee-1111-4111-8111-111111111111',
       pg_temp.track(40, 2.5, 5000)))),
  'a short run (about 300 m) is valid'
);
select is(
  (select count(*)::integer from public.get_gps_run_route(
     (select id from public.get_my_gps_runs() limit 1))),
  0,
  'a run under 400 m shows no route (both ends would be hidden)'
);
select pg_temp.logout();

-- Duplicates with health runs ---------------------------------------------------------------------

-- Carl records with GPS, then the same run arrives from Health Connect: health wins.
select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select ok(
  (select is_valid from public.sync_gps_run(pg_temp.run('ffffffff-1111-4111-8111-111111111111',
        pg_temp.track(400, 3, 7200)))),
  'the GPS run is valid on its own'
);
select public.sync_workouts(jsonb_build_array(jsonb_build_object(
  'platform', 'android', 'source_record_id', 'hc-1', 'source_name', 'com.watch',
  'activity_type', 'running', 'start_at', now() - interval '7195 seconds',
  'end_at', now() - interval '6000 seconds',
  'distance_m', 3600, 'duration_s', 1195, 'was_user_entered', false)));
select results_eq(
  $$ select platform, is_valid, invalid_reason from public.activity_workouts
      where user_id = 'cccccccc-0000-0000-0000-000000000003' order by platform $$,
  $$ values ('android', true, null), ('gps', false, 'duplicate') $$,
  'the same run from Health Connect and GPS counts once (health wins)'
);
select pg_temp.logout();

-- Counting for challenges --------------------------------------------------------------------------

insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
  starts_at, ends_at, min_participants, visibility, status, mode)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'GPS-Test', 'run_total', 5000, 500,
  now() - interval '3 days', now() + interval '4 days', 2, 'public', 'active', 'pool');
insert into public.challenge_participants (challenge_id, user_id, stake_cents)
select id, 'aaaaaaaa-0000-0000-0000-000000000001', 500 from public.challenges where title = 'GPS-Test';

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_gps_run(pg_temp.run('abababab-1111-4111-8111-111111111111',
  pg_temp.track(300, 3, 5000)));
select pg_temp.logout();

select ok(
  (select progress_value between 15500 and 15600
     from public.challenge_participants
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  'GPS runs count towards the challenge like any other run (all valid runs of the test: about 15.5 km)'
);

-- Access ---------------------------------------------------------------------------------------

select ok(
  not has_function_privilege('anon', 'public.sync_gps_run(jsonb)', 'execute')
  and not has_function_privilege('anon', 'public.get_gps_run_route(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_gps_runs(integer)', 'execute'),
  'anonymous users cannot call the GPS functions'
);
select ok(
  not has_function_privilege('authenticated', 'private.dedupe_gps_workouts(uuid)', 'execute'),
  'clients cannot trigger the duplicate check themselves'
);

select * from finish();
rollback;
