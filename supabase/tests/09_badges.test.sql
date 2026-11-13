-- Phase 7 – badges and levels.
begin;
create extension if not exists pgtap with schema extensions;

select plan(20);

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

-- Local noon, p_offset days from today.
create function pg_temp.at(p_offset integer)
returns timestamptz
language sql
as $$
  select (((now() at time zone 'Europe/Berlin')::date + p_offset)::timestamp + interval '12 hours')
         at time zone 'Europe/Berlin';
$$;

create function pg_temp.w(p_id text, p_start timestamptz, p_dist integer, p_dur integer,
                          p_manual boolean default false)
returns jsonb
language sql
as $$
  select jsonb_build_object(
    'platform', 'android', 'source_record_id', p_id, 'source_name', 'com.test',
    'activity_type', 'running', 'start_at', p_start,
    'end_at', p_start + make_interval(secs => p_dur),
    'distance_m', p_dist, 'duration_s', p_dur, 'was_user_entered', p_manual);
$$;

-- A finished challenge in which the user took part.
create function pg_temp.finished_challenge(p_title text, p_user uuid, p_result text,
                                           p_status text default 'settled')
returns void
language plpgsql
as $$
declare
  v_id uuid;
begin
  insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
    starts_at, ends_at, min_participants, visibility, status, mode)
  values (p_user, p_title, 'run_total', 5000, 500,
    now() - interval '10 days', now() - interval '5 days', 2, 'public', p_status, 'pool')
  returning id into v_id;
  insert into public.challenge_participants (challenge_id, user_id, stake_cents)
  values (v_id, p_user, 500);
  if p_result <> 'pending' then
    update public.challenge_participants set result = p_result,
      payout_cents = case when p_result = 'success' then 500 end
     where challenge_id = v_id and user_id = p_user;
  end if;
end;
$$;

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');

-- Level maths -----------------------------------------------------------------------------------

select results_eq(
  $$ select private.level_for_points(p) from unnest(array[0, 49, 50, 149, 150, 299, 300]::bigint[]) p $$,
  $$ values (1), (1), (2), (2), (3), (3), (4) $$,
  'levels start at 0, 50, 150, 300 points'
);

-- Anna: a lost challenge first, then a won one, then seven days of runs ---------------------------

select pg_temp.finished_challenge('Verloren', 'aaaaaaaa-0000-0000-0000-000000000001', 'failed');
select is(
  (select array_agg(badge order by badge) from public.user_badges
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  array['first_challenge'],
  'joining a challenge gives the first-challenge badge, a loss gives no win badge'
);

select pg_temp.finished_challenge('Gewonnen', 'aaaaaaaa-0000-0000-0000-000000000001', 'success');
select ok(
  exists (select 1 from public.user_badges
           where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' and badge = 'first_win'),
  'the first win gives the first-win badge'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('a1', pg_temp.at(-1), 8000, 2800),
  pg_temp.w('a2', pg_temp.at(-2), 8000, 2800),
  pg_temp.w('a3', pg_temp.at(-3), 8000, 2800),
  pg_temp.w('a4', pg_temp.at(-4), 8000, 2800),
  pg_temp.w('a5', pg_temp.at(-5), 8000, 2800),
  pg_temp.w('a6', pg_temp.at(-6), 8000, 2800)));
select is(
  (select count(*)::integer from public.user_badges where badge in ('streak_7', 'km_50')),
  0,
  'six days and 48 km are not enough for the streak or 50 km badge'
);
select public.sync_workouts(jsonb_build_array(pg_temp.w('a7', pg_temp.at(-7), 8000, 2800)));
select results_eq(
  $$ select badge from public.user_badges order by badge $$,
  $$ values ('first_challenge'), ('first_win'), ('km_50'), ('streak_7') $$,
  'seven days in a row and 56 km give the streak and 50 km badges'
);
select public.sync_workouts(jsonb_build_array(pg_temp.w('a7', pg_temp.at(-7), 8000, 2800)));
select is(
  (select count(*)::integer from public.user_badges),
  4,
  'syncing again does not award anything twice'
);

select results_eq(
  $$ select points, level, level_start_points, next_level_points from public.get_my_level() $$,
  $$ values (106::bigint, 2, 50::bigint, 150::bigint) $$,
  'level 2 from 56 km and one win (56 + 50 points)'
);

-- Seen -------------------------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.user_badges where seen_at is null),
  4,
  'new badges are unseen'
);
select public.mark_badge_seen('km_50');
select public.mark_badge_seen('km_50');
select is(
  (select array_agg(badge) from public.user_badges where seen_at is not null),
  array['km_50'],
  'marking a badge as seen affects only that badge'
);
select pg_temp.logout();

-- Ben: manual runs never count -------------------------------------------------------------------

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('b1', pg_temp.at(-1), 90000, 30000, true),
  pg_temp.w('b2', pg_temp.at(-2), 90000, 30000, true)));
select is(
  (select count(*)::integer from public.user_badges),
  0,
  'manual runs give no badges (and the table shows only my own rows)'
);
select results_eq(
  $$ select points, level from public.get_my_level() $$,
  $$ values (0::bigint, 1) $$,
  'manual runs give no points'
);
select pg_temp.logout();

-- Carl: ten challenges ----------------------------------------------------------------------------

select pg_temp.finished_challenge('Challenge ' || n, 'cccccccc-0000-0000-0000-000000000003', 'pending',
                                  'active')
  from generate_series(1, 9) n;
select is(
  (select array_agg(badge) from public.user_badges
    where user_id = 'cccccccc-0000-0000-0000-000000000003'),
  array['first_challenge'],
  'nine challenges are not enough for the ten-challenge badge'
);
select pg_temp.finished_challenge('Challenge 10', 'cccccccc-0000-0000-0000-000000000003', 'pending',
                                  'active');
select ok(
  exists (select 1 from public.user_badges
           where user_id = 'cccccccc-0000-0000-0000-000000000003' and badge = 'challenges_10'),
  'the tenth challenge gives its badge'
);

-- Steps count for points ----------------------------------------------------------------------

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select public.sync_daily_steps(jsonb_build_array(
  jsonb_build_object('platform', 'android', 'date', (now() at time zone 'Europe/Berlin')::date - 1,
                     'steps', 12500, 'excluded_sources', 0)));
select is(
  (select points from public.get_my_level()),
  12::bigint,
  '12,500 valid steps are 12 points'
);

-- Access ---------------------------------------------------------------------------------------

select throws_ok(
  $$ insert into public.user_badges (user_id, badge)
     values ('cccccccc-0000-0000-0000-000000000003', 'km_100') $$,
  '42501', null, 'clients cannot give themselves a badge'
);
select throws_ok(
  $$ update public.user_badges set seen_at = null $$,
  '42501', null, 'clients cannot change badges directly'
);
select is(
  (select count(*)::integer from public.user_badges
    where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'),
  0,
  'badges of other users are not readable'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.get_my_level()', 'execute')
  and not has_function_privilege('anon', 'public.mark_badge_seen(text)', 'execute'),
  'anonymous users cannot call the badge functions'
);
select ok(
  not has_function_privilege('authenticated', 'private.award_badges(uuid)', 'execute'),
  'clients cannot award badges themselves'
);
select is(
  (select count(*)::integer from pg_trigger where tgname in ('award_on_join', 'award_on_result')),
  2,
  'joining and results trigger the badge check'
);

select * from finish();
rollback;
