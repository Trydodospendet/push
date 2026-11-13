-- Ausbau – secret badges.
begin;
create extension if not exists pgtap with schema extensions;

select plan(11);

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

-- A valid run that started at local time p_time (Europe/Berlin) on p_day (days from today).
create function pg_temp.run_at(p_user uuid, p_day integer, p_time time, p_distance integer)
returns void
language sql
as $$
  insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
    start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
  select p_user, 'android', gen_random_uuid()::text, 'running', s.t,
         s.t + make_interval(secs => (p_distance * 0.36)::integer), p_distance,
         (p_distance * 0.36)::integer, false, true
    from (select (((now() at time zone 'Europe/Berlin')::date + p_day)::timestamp + p_time)
                 at time zone 'Europe/Berlin' as t) s;
$$;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated');

-- Anna: a marathon at 04:00 -----------------------------------------------------------------------

select pg_temp.run_at('aaaaaaaa-0000-0000-0000-000000000001', -3, time '04:00', 42200);
select private.award_badges('aaaaaaaa-0000-0000-0000-000000000001');

select results_eq(
  $$ select badge from public.user_badges
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' order by badge $$,
  $$ values ('early_bird'::text), ('marathon') $$,
  'a marathon that starts at 04:00 gives the marathon and early-bird badges (and nothing else)'
);

-- Ben: normal runs give no secrets, a run of 7.777 km does -----------------------------------------

select pg_temp.run_at('bbbbbbbb-0000-0000-0000-000000000002', -2, time '12:00', 42194);
select pg_temp.run_at('bbbbbbbb-0000-0000-0000-000000000002', -2, time '05:31', 5000);
select pg_temp.run_at('bbbbbbbb-0000-0000-0000-000000000002', -2, time '02:59', 5000);
select private.award_badges('bbbbbbbb-0000-0000-0000-000000000002');

select is(
  (select count(*)::int from public.user_badges
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
      and badge in ('marathon', 'early_bird', 'lucky_run', 'new_year')),
  0,
  '42.194 km, 05:31 and 02:59 are just outside the secrets'
);

select pg_temp.run_at('bbbbbbbb-0000-0000-0000-000000000002', -1, time '12:00', 7777);
select private.award_badges('bbbbbbbb-0000-0000-0000-000000000002');
select ok(
  exists (select 1 from public.user_badges
           where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and badge = 'lucky_run'),
  'a run of 7.777 km gives the lucky-run badge'
);

-- Boundaries of the early bird
select pg_temp.run_at('bbbbbbbb-0000-0000-0000-000000000002', -4, time '05:30', 5000);
select private.award_badges('bbbbbbbb-0000-0000-0000-000000000002');
select ok(
  exists (select 1 from public.user_badges
           where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' and badge = 'early_bird'),
  'a run at 05:30 still counts as before sunrise'
);

-- Manual and invalid runs never count -------------------------------------------------------------

insert into auth.users (id, email, aud, role)
values ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');
insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
values ('cccccccc-0000-0000-0000-000000000003', 'android', 'manual-marathon', 'running',
  now() - interval '5 days', now() - interval '5 days' + interval '4 hours', 42200, 14400,
  true, false, 'manual_entry');
select private.award_badges('cccccccc-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.user_badges where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  0,
  'a manually entered marathon gives nothing'
);

-- New year: a run on January 1st ------------------------------------------------------------------------

insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
values ('cccccccc-0000-0000-0000-000000000003', 'android', 'new-year', 'running',
  '2026-01-01 11:00:00+01', '2026-01-01 11:30:00+01', 5000, 1800, false, true);
select private.award_badges('cccccccc-0000-0000-0000-000000000003');
select ok(
  exists (select 1 from public.user_badges
           where user_id = 'cccccccc-0000-0000-0000-000000000003' and badge = 'new_year'),
  'a valid run on January 1st gives the new-year badge'
);

-- Logo tap --------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select public.claim_secret_badge('logo_tap') $$, 'the logo secret can be claimed');
select lives_ok($$ select public.claim_secret_badge('logo_tap') $$, 'and claimed again without harm');
select is(
  (select count(*)::int from public.user_badges where badge = 'logo_tap'), 1,
  'but only one badge exists'
);
select throws_ok(
  $$ select public.claim_secret_badge('marathon') $$,
  'P0001', 'unknown_secret', 'other secrets cannot be claimed'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.claim_secret_badge(text)', 'execute'),
  'anonymous users cannot claim secrets'
);

select * from finish();
rollback;
