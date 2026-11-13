-- Ausbau 2 – social: friends, runs of friends, kudos, comments, groups, league.
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

insert into auth.users (id, email, aud, role)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated'),
  ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');
update public.profiles set display_name = 'Anna Lauf' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Ben Renner' where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.profiles set display_name = 'Carl Sprint' where id = 'cccccccc-0000-0000-0000-000000000003';

create temp table codes (name text primary key, code text);
grant all on codes to authenticated;
create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

insert into public.activity_workouts (id, user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
values
  ('a0000000-0000-4000-8000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000001', 'android', 'a1', 'running',
   now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 5000, 1800, false, true),
  ('b0000000-0000-4000-8000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'android', 'b1', 'running',
   now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 7000, 2400, false, true);

-- Friends ---------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into codes select 'anna', public.get_my_friend_code();
select matches((select code from codes where name = 'anna'), '^[A-HJ-NP-Z2-9]{8}$', 'everybody has an 8-character friend code');
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(public.send_friend_request((select code from codes where name = 'anna')), 'pending', 'a request with a valid code is pending');
select throws_ok($$ select public.send_friend_request('ZZZZZZZZ') $$, 'P0001', 'invalid_friend_code', 'an unknown code is rejected');
select throws_ok($$ select public.send_friend_request((select public.get_my_friend_code())) $$, 'P0001', 'cannot_friend_self', 'nobody befriends themselves');
select throws_ok($$ select public.send_friend_request((select code from codes where name = 'anna')) $$, 'P0001', 'request_exists', 'only one open request');
select is(
  (select count(*)::int from public.get_my_friends()), 0, 'a pending request is not a friendship yet'
);
select pg_temp.logout();

select is(
  (select count(*)::int from public.push_outbox where kind = 'friend'), 0,
  'no push message without a registered phone (the outbox rules apply)'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select display_name from public.get_friend_requests() $$,
  $$ values ('Ben Renner'::text) $$,
  'the addressee sees the request with the name'
);
select is(
  (select count(*)::int from public.get_friend_runs()), 1, 'before accepting only the own runs are visible'
);
select public.respond_friend_request((select id from public.get_friend_requests() limit 1), true);
select results_eq(
  $$ select display_name from public.get_my_friends() $$,
  $$ values ('Ben Renner'::text) $$,
  'after accepting both are friends'
);
select throws_ok($$ select public.respond_friend_request(gen_random_uuid(), true) $$, 'P0001', 'request_not_found', 'only real open requests can be answered');
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select is((select count(*)::int from public.get_my_friends()), 0, 'strangers have no friends');
select is((select count(*)::int from public.get_friend_runs()), 0, 'and see no runs of others');
select pg_temp.logout();

-- Runs of friends, kudos, comments -------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.get_friend_runs()), 2, 'friends see each other''s valid runs');
select ok(
  (select bool_and(distance_m > 0) from public.get_friend_runs()),
  'a run shows distance and time only'
);
select lives_ok($$ select public.give_kudos('b0000000-0000-4000-8000-000000000001') $$, 'kudos for a friend''s run');
select lives_ok($$ select public.give_kudos('b0000000-0000-4000-8000-000000000001') $$, 'giving kudos twice does no harm');
select throws_ok($$ select public.give_kudos('a0000000-0000-4000-8000-000000000001') $$, 'P0001', 'cannot_cheer_self', 'no kudos for yourself');
select lives_ok($$ select public.add_run_comment('b0000000-0000-4000-8000-000000000001', 'Stark gelaufen!') $$, 'a comment on a friend''s run');
select throws_ok($$ select public.add_run_comment('b0000000-0000-4000-8000-000000000001', '   ') $$, 'P0001', 'invalid_comment', 'an empty comment is rejected');
select results_eq(
  $$ select kudos_count, comment_count, kudos_by_me from public.get_friend_runs() where workout_id = 'b0000000-0000-4000-8000-000000000001' $$,
  $$ values (1, 1, true) $$,
  'counts of kudos and comments'
);
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select throws_ok($$ select public.give_kudos('b0000000-0000-4000-8000-000000000001') $$, 'P0001', 'run_not_found', 'strangers cannot react to a run');
select is((select count(*)::int from public.get_run_comments('b0000000-0000-4000-8000-000000000001')), 0, 'and cannot read its comments');
select pg_temp.logout();

-- Switching sharing off hides the runs
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_share_runs(false);
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is((select count(*)::int from public.get_friend_runs()), 1, 'a friend who stopped sharing is gone from the feed');
select pg_temp.logout();

-- Groups -----------------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
insert into ids select 'group', (public.create_group('Laufgruppe Nord')).id;
insert into codes select 'group', invite_code from public.get_my_groups();
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select public.join_group((select code from codes where name = 'group'));
select throws_ok($$ select public.join_group('NOPE99') $$, 'P0001', 'invalid_group_code', 'an unknown group code is rejected');
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from public.get_group_board((select id from ids where name = 'group'))), 0,
  'non-members see no group board'
);
select pg_temp.logout();

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select rank, display_name, distance_m from public.get_group_board((select id from ids where name = 'group'), 'week') order by rank, display_name $$,
  $$ values (1, 'Anna Lauf'::text, 5000::bigint), (2, 'Carl Sprint', 0) $$,
  'the group board ranks the kilometres of the members'
);
select pg_temp.logout();

-- League ---------------------------------------------------------------------------------------------------------

insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
  starts_at, ends_at, min_participants, visibility, status, mode, settled_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Liga-Test', 'run_total', 5000, 0, 0,
  now() - interval '9 days', now() - interval '2 days', 2, 'public', 'settled', 'ranked', now());
insert into public.challenge_participants (challenge_id, user_id, stake_cents, result, rank, rank_points)
select c.id, v.u, 0, 'success', v.r, v.p from public.challenges c,
  (values ('bbbbbbbb-0000-0000-0000-000000000002'::uuid, 1, 30), ('aaaaaaaa-0000-0000-0000-000000000001'::uuid, 2, 20)) v (u, r, p)
 where c.title = 'Liga-Test';

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select rank, display_name, points from public.get_season_board() where points in (20, 30) order by rank $$,
  $$ values (1, 'Ben Renner'::text, 30::bigint), (2, 'Anna Lauf', 20::bigint) $$,
  'the monthly league ranks the rank points of settled ranked challenges'
);
select pg_temp.logout();
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_ranking_visibility(true);
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select display_name from public.get_season_board() where points = 30), 'Anonym',
  'anonymous players show as Anonym in the league'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.get_season_board(integer)', 'execute')
  and not has_function_privilege('authenticated', 'private.can_see_run(uuid)', 'execute'),
  'the social functions are closed to anonymous users and the helpers to everybody'
);

select * from finish();
rollback;
