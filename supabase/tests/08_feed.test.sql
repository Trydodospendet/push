-- Phase 7 – challenge feed and cheering.
begin;
create extension if not exists pgtap with schema extensions;

select plan(17);

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

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

-- A running ranked challenge (goal 5 km in total) with Anna and Ben; Carl is an outsider.
insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
  starts_at, ends_at, min_participants, visibility, status, mode)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Feed-Test', 'run_total', 5000, 500,
  now() - interval '2 days', now() + interval '5 days', 2, 'public', 'active', 'ranked');
insert into ids select 'ch', id from public.challenges where title = 'Feed-Test';

insert into public.challenge_participants (challenge_id, user_id, stake_cents)
select (select id from ids where name = 'ch'), u, 500
  from unnest(array['aaaaaaaa-0000-0000-0000-000000000001',
                    'bbbbbbbb-0000-0000-0000-000000000002']::uuid[]) as u;

-- A solo challenge never gets a feed.
insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents,
  starts_at, ends_at, min_participants, max_participants, visibility, status, mode)
values ('cccccccc-0000-0000-0000-000000000003', 'Allein', 'run_total', 5000, 500,
  now() - interval '2 days', now() + interval '5 days', 1, 1, 'private', 'active', 'solo');
insert into public.challenge_participants (challenge_id, user_id, stake_cents)
select id, 'cccccccc-0000-0000-0000-000000000003', 500 from public.challenges where title = 'Allein';

select is(
  (select count(*)::integer from public.challenge_feed where kind = 'joined'
     and challenge_id = (select id from ids where name = 'ch')),
  2,
  'joining writes one entry per participant'
);
select is(
  (select count(*)::integer from public.challenge_feed
    where challenge_id = (select id from public.challenges where title = 'Allein')),
  0,
  'solo challenges have no feed'
);

-- Visibility -----------------------------------------------------------------------------------

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select is(
  (select count(*)::integer from public.get_challenge_feed((select id from ids where name = 'ch'))),
  0,
  'an outsider reads nothing through get_challenge_feed'
);
select is(
  (select count(*)::integer from public.challenge_feed),
  0,
  'an outsider reads nothing directly either (RLS)'
);
select pg_temp.logout();

-- Runs and goal ----------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.sync_workouts(jsonb_build_array(
  pg_temp.w('a-run', now() - interval '1 day', 6000, 2000),
  pg_temp.w('a-manual', now() - interval '20 hours', 9000, 3000, true)));
select is(
  (select distance_m from public.challenge_feed where kind = 'ran'
     and challenge_id = (select id from ids where name = 'ch')),
  6000,
  'a valid run is written with its distance'
);
select is(
  (select count(*)::integer from public.challenge_feed where kind = 'ran'),
  1,
  'a manual run creates no entry'
);
select public.sync_workouts(jsonb_build_array(pg_temp.w('a-run', now() - interval '1 day', 6000, 2000)));
select is(
  (select count(*)::integer from public.challenge_feed where kind = 'ran'),
  1,
  'syncing the same run again does not duplicate the entry'
);
select pg_temp.logout();

select is(
  (select count(*)::integer from public.challenge_feed where kind = 'goal_reached'),
  1,
  'reaching the goal through the sync writes one entry'
);

update public.challenge_participants set progress_value = progress_value + 1
 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
select is(
  (select count(*)::integer from public.challenge_feed where kind = 'goal_reached'),
  1,
  'more progress does not repeat the goal entry'
);

-- Cheering -------------------------------------------------------------------------------------

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  public.cheer_feed_entry((select id from public.challenge_feed where kind = 'ran')),
  1,
  'a participant can cheer an entry'
);
select results_eq(
  $$ select cheer_count, cheered_by_me from public.get_challenge_feed(
       (select id from ids where name = 'ch')) where kind = 'ran' $$,
  $$ values (1, true) $$,
  'the feed shows the count and that I cheered'
);
select throws_ok(
  $$ select public.cheer_feed_entry((select id from public.challenge_feed where kind = 'ran')) $$,
  'P0001', 'already_cheered', 'each person can cheer an entry only once'
);
select throws_ok(
  $$ insert into public.challenge_feed (challenge_id, user_id, kind)
     values ((select id from ids where name = 'ch'), 'bbbbbbbb-0000-0000-0000-000000000002', 'joined') $$,
  '42501', null, 'clients cannot write feed entries'
);
select throws_ok(
  $$ insert into public.feed_cheers (feed_id, user_id)
     select id, 'bbbbbbbb-0000-0000-0000-000000000002' from public.challenge_feed limit 1 $$,
  '42501', null, 'clients cannot write cheers directly'
);
select pg_temp.logout();

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$ select public.cheer_feed_entry((select id from public.challenge_feed where kind = 'ran')) $$,
  'P0001', 'cannot_cheer_self', 'nobody cheers their own entry'
);
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select throws_ok(
  $$ select public.cheer_feed_entry((select id from public.challenge_feed where kind = 'ran')) $$,
  'P0001', 'feed_entry_not_found', 'an outsider cannot cheer'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.get_challenge_feed(uuid, integer)', 'execute')
  and not has_function_privilege('anon', 'public.cheer_feed_entry(uuid)', 'execute'),
  'anonymous users cannot call the feed functions'
);

select * from finish();
rollback;
