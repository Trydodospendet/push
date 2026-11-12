-- Phase 6 – statistics for home and profile, and the possible win of a challenge.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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

create function pg_temp.today()
returns date
language sql
as $$ select (now() at time zone 'Europe/Berlin')::date; $$;

-- Local noon of a day (today + offset). Today is capped so a short run that started then has
-- already ended (the server rejects runs that end in the future).
create function pg_temp.at(p_offset integer)
returns timestamptz
language sql
as $$
  select case
    when p_offset = 0 then
      least(now() - interval '4 minutes',
            (pg_temp.today()::timestamp + interval '12 hours') at time zone 'Europe/Berlin')
    else ((pg_temp.today() + p_offset)::timestamp + interval '12 hours') at time zone 'Europe/Berlin'
  end;
$$;

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

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');

-- Anna: runs today and yesterday, no activity 3 days ago, a run 4 days ago.
-- Two days ago she only walked 9,000 steps, which still counts as an active day.
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('a-today', pg_temp.at(0), 500, 180),
  pg_temp.w('a-yesterday', pg_temp.at(-1), 3000, 1000),
  pg_temp.w('a-old', pg_temp.at(-4), 2000, 700),
  pg_temp.w('a-manual', pg_temp.at(-3), 9000, 3600, true)));
select public.sync_daily_steps(jsonb_build_array(
  pg_temp.d(pg_temp.today() - 2, 9000),
  pg_temp.d(pg_temp.today() - 3, 7999)));

select is(
  (select streak_days from public.get_my_stats()),
  3,
  'streak counts consecutive days with a valid run or enough steps'
);
select is(
  (select total_distance_m from public.get_my_stats()),
  5500::bigint,
  'total distance sums valid runs only (manual entries are left out)'
);
select is(
  (select count(*)::integer from public.get_my_week()),
  7,
  'the week always has seven days'
);
select results_eq(
  $$ select day, distance_m from public.get_my_week()
      where day in (pg_temp.today(), pg_temp.today() - 1, pg_temp.today() - 3) order by day $$,
  $$ values (pg_temp.today() - 3, 0), (pg_temp.today() - 1, 3000), (pg_temp.today(), 500) $$,
  'the week shows valid metres per local day and ignores manual runs'
);
select pg_temp.logout();

-- Ben: one valid run yesterday, an invalid manual run today. The streak survives until the
-- day is over.
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('b-yesterday', pg_temp.at(-1), 4000, 1500),
  pg_temp.w('b-manual', pg_temp.at(0), 4000, 1500, true)));
select is(
  (select streak_days from public.get_my_stats()),
  1,
  'without activity today the streak still counts up to yesterday'
);
select pg_temp.logout();

-- Carl: nothing at all.
select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select results_eq(
  $$ select streak_days, total_distance_m, wins, total_won_cents from public.get_my_stats() $$,
  $$ values (0, 0::bigint, 0, 0::bigint) $$,
  'a new user has empty statistics'
);
select pg_temp.logout();

-- Possible win ---------------------------------------------------------------------------------

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids select 'pub', (public.create_challenge('Offen', 'run_total', 5000, 500,
  pg_temp.today() + 1, 7, 'public')).id;
insert into ids select 'priv', (public.create_challenge('Privat', 'run_total', 5000, 500,
  pg_temp.today() + 1, 7, 'private')).id;
insert into ids select 'solo', (public.create_challenge('Allein', 'run_total', 5000, 500,
  pg_temp.today() + 1, 7, 'private', null, 'solo')).id;
select public.join_challenge(id) from ids where name in ('pub', 'priv');
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.join_challenge(id) from ids where name = 'pub';
select pg_temp.logout();

update public.challenges set fee_bps = 1000 where id = (select id from ids where name = 'pub');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  public.get_potential_win((select id from ids where name = 'pub')),
  950::bigint,
  'participant: stake 500 + (500 lost - 10 % fee) when the one other participant fails'
);
select is(
  public.get_potential_win((select id from ids where name = 'solo')),
  500::bigint,
  'solo: the possible win is just the stake back'
);
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select is(
  public.get_potential_win((select id from ids where name = 'pub')),
  1400::bigint,
  'non-participant is counted as one more participant: 500 + (1000 - 100)'
);
select is(
  public.get_potential_win((select id from ids where name = 'priv')),
  null::bigint,
  'a private challenge is invisible to outsiders'
);
select is(
  public.get_potential_win('00000000-0000-0000-0000-000000000000'),
  null::bigint,
  'an unknown challenge returns nothing'
);
select pg_temp.logout();

-- Wins ---------------------------------------------------------------------------------------

-- Settle the fixture by hand: Anna won 950 for a 500 stake, Ben lost.
update public.challenges set status = 'settled', settled_at = now()
 where id = (select id from ids where name = 'pub');
update public.challenge_participants
   set result = 'success', payout_cents = 950
 where challenge_id = (select id from ids where name = 'pub')
   and user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.challenge_participants
   set result = 'failed'
 where challenge_id = (select id from ids where name = 'pub')
   and user_id = 'bbbbbbbb-0000-0000-0000-000000000002';

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select wins, total_won_cents from public.get_my_stats() $$,
  $$ values (1, 450::bigint) $$,
  'a win counts with the bonus on top of the stake'
);
select is(
  public.get_potential_win((select id from ids where name = 'pub')),
  null::bigint,
  'a finished challenge has no possible win'
);
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select results_eq(
  $$ select wins, total_won_cents from public.get_my_stats() $$,
  $$ values (0, 0::bigint) $$,
  'a lost challenge adds no win'
);
select pg_temp.logout();

-- Access ---------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select set_config('request.jwt.claims', '', true);
select throws_ok(
  $$ select * from public.get_my_stats() $$,
  '42501',
  'not_authenticated',
  'statistics need a signed-in user'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.get_my_week()', 'execute'),
  'anonymous users cannot call get_my_week'
);

select * from finish();
rollback;
