-- Ausbau 2 – run analytics: splits, profile, records, period statistics.
begin;
create extension if not exists pgtap with schema extensions;

select plan(18);

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

-- A straight track going north at p_speed m/s (one point every 3 s, 7th value = altitude that
-- rises half a metre per point), starting p_ago_s seconds ago.
create function pg_temp.track(p_n integer, p_speed double precision, p_ago_s integer)
returns jsonb
language sql
as $$
  select jsonb_agg(jsonb_build_array(
    52.5 + (p_speed * 3 * i) / 111194.9,
    13.4,
    (extract(epoch from now()) * 1000)::bigint - p_ago_s * 1000::bigint + i * 3000::bigint,
    5, 0, 0, 100 + i * 0.5
  ) order by i)
  from generate_series(0, p_n - 1) i;
$$;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated');

create temp table results (name text primary key, run_id uuid);
grant all on results to authenticated;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into results
select 'run', run_id from public.sync_gps_run(jsonb_build_object(
  'client_run_id', '11111111-1111-4111-8111-111111111111', 'points', pg_temp.track(400, 3, 7200)));

select ok(
  (select is_valid from public.get_my_gps_runs() limit 1),
  'a track with altitude as the 7th value is accepted'
);
select throws_ok(
  $$ select * from public.sync_gps_run(jsonb_build_object(
       'client_run_id', '22222222-2222-4222-8222-222222222222',
       'points', jsonb_build_array(
         jsonb_build_array(52.5, 13.4, 1000, 5, 0, 0, 'high'),
         jsonb_build_array(52.5001, 13.4, 4000, 5, 0, 0, 1)))) $$,
  '22023', 'invalid_gps_payload', 'an altitude that is not a number is rejected'
);

-- Splits ------------------------------------------------------------------------------------------

select is(
  (select count(*)::int from public.get_gps_run_splits((select run_id from results where name = 'run'))),
  4,
  '3.6 km give three full kilometres and a rest'
);
select ok(
  (select bool_and(seconds between 330 and 336 and pace_s_per_km between 330 and 336)
     from public.get_gps_run_splits((select run_id from results where name = 'run')) where km <= 3),
  'each full kilometre takes about 333 s at 3 m/s'
);
select ok(
  (select distance_m between 560 and 620 and pace_s_per_km between 330 and 336
     from public.get_gps_run_splits((select run_id from results where name = 'run')) where km = 4),
  'the last split is the rest (about 590 m) with its own pace'
);
select ok(
  (select bool_and(ascent_m is not null and ascent_m between 50 and 60)
     from public.get_gps_run_splits((select run_id from results where name = 'run')) where km <= 3),
  'the ascent per kilometre comes from the altitude (about 55 m per kilometre)'
);

-- Profile -----------------------------------------------------------------------------------------------

select ok(
  (select count(*) between 30 and 110 from public.get_gps_run_profile((select run_id from results where name = 'run'))),
  'the profile has about 100 points or less'
);
select ok(
  (select bool_and(altitude_m is not null and pace_s_per_km between 320 and 345)
     from public.get_gps_run_profile((select run_id from results where name = 'run'))),
  'every profile point has an altitude and the pace of that stretch'
);

-- Others get nothing ------------------------------------------------------------------------------------

select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.get_gps_run_splits((select run_id from results where name = 'run'))), 0,
  'splits of somebody else''s run are empty'
);
select is(
  (select count(*)::int from public.get_gps_run_profile((select run_id from results where name = 'run'))), 0,
  'the profile of somebody else''s run is empty'
);
select is(
  (select count(*)::int from public.get_my_records()), 0,
  'someone without runs has no records'
);
select pg_temp.logout();

-- Records ---------------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select kind from public.get_my_records() order by kind $$,
  $$ values ('best_week'::text), ('fastest_pace_1k'), ('longest_run') $$,
  'records: best week, fastest 1 km pace and longest run (the run is shorter than 5 km)'
);
select ok(
  (select value between 3585 and 3615 from public.get_my_records() where kind = 'longest_run'),
  'the longest run is the 3.6 km run'
);
select ok(
  (select value between 330 and 336 from public.get_my_records() where kind = 'fastest_pace_1k'),
  'the fastest pace is about 5:33 per kilometre'
);

-- Period statistics ---------------------------------------------------------------------------------------

select is(
  (select count(*)::int from public.get_my_period_stats('week', 8)), 8,
  'eight weeks are returned, also those without a run'
);
select results_eq(
  $$ select runs, distance_m between 3585 and 3615 from public.get_my_period_stats('month', 3) order by period_start desc limit 1 $$,
  $$ values (1, true) $$,
  'the current month counts the run'
);
select throws_ok(
  $$ select * from public.get_my_period_stats('year') $$,
  'P0001', 'invalid_period', 'only weeks and months exist'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.get_gps_run_splits(uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_records()', 'execute')
  and not has_function_privilege('authenticated', 'private.gps_steps(uuid, uuid)', 'execute'),
  'the analytics functions are closed to anonymous users and the helper to everybody'
);

select * from finish();
rollback;
