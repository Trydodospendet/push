-- Ausbau – profile controls: anonymity, avatar storage, data export.
begin;
create extension if not exists pgtap with schema extensions;

select plan(21);

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

-- An active ranked challenge with Anna and Ben, a run of Ben in the feed.
insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
  starts_at, ends_at, min_participants, visibility, status, mode)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Rangliste', 'run_total', 5000, 0, 0,
  now() - interval '2 days', now() + interval '5 days', 2, 'public', 'active', 'ranked');
insert into public.challenge_participants (challenge_id, user_id, stake_cents)
select c.id, u, 0 from public.challenges c,
  unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002']::uuid[]) u
 where c.title = 'Rangliste';

-- Anonymity -------------------------------------------------------------------------------------

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_ranking_visibility(true);
select pg_temp.logout();

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select display_name from public.get_leaderboard((select id from public.challenges where title = 'Rangliste')) order by display_name $$,
  $$ values ('Anna Lauf'::text), ('Anonym') $$,
  'an anonymous participant shows as Anonym in the ranking, the own name stays'
);
select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0,
  'the name of an anonymous person cannot be read directly either'
);
select is(
  (select count(*)::int from public.challenge_feed f
    where f.user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
      and exists (select 1 from public.profiles p where p.id = f.user_id)),
  0,
  'a join through profiles finds no name of an anonymous person'
);
select is(
  (select display_name from public.get_challenge_feed((select id from public.challenges where title = 'Rangliste'))
    where not is_mine limit 1),
  'Anonym',
  'the feed shows Anonym for anonymous people'
);
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select display_name from public.get_leaderboard((select id from public.challenges where title = 'Rangliste'))
    where is_me),
  'Ben Renner',
  'anonymous people still see their own name'
);
select is(
  (select count(*)::int from public.profiles where id = 'bbbbbbbb-0000-0000-0000-000000000002'), 1,
  'and can read their own profile'
);
select pg_temp.logout();

select pg_temp.login('cccccccc-0000-0000-0000-000000000003');
select is(
  (select count(*)::int from public.profiles where id in ('aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002', 'cccccccc-0000-0000-0000-000000000003')), 2,
  'everybody else sees the names of the people who are not anonymous (Anna and Carl)'
);
select throws_ok(
  $$ select public.set_ranking_visibility(null) $$,
  'P0001', 'invalid_setting', 'the setting needs a value'
);
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_ranking_visibility(false);
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select is(
  (select count(*)::int from public.get_leaderboard((select id from public.challenges where title = 'Rangliste'))
    where display_name = 'Ben Renner'),
  1,
  'switching anonymity off shows the name again'
);
select pg_temp.logout();

-- Avatar storage ---------------------------------------------------------------------------------

select is(
  (select public from storage.buckets where id = 'avatars'), false,
  'the avatar bucket is private'
);
select is(
  (select file_size_limit from storage.buckets where id = 'avatars'), 524288::bigint,
  'avatars are limited to 512 KB'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  'a user can upload into the own folder'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'bbbbbbbb-0000-0000-0000-000000000002/avatar.jpg', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'but not into the folder of somebody else'
);
select throws_ok(
  $$ insert into storage.objects (bucket_id, name, owner_id)
     values ('avatars', 'loose-file.jpg', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '42501', null, 'and not outside any folder'
);
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select is(
  (select count(*)::int from storage.objects where bucket_id = 'avatars'), 0,
  'other people cannot see the file'
);
select pg_temp.logout();

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok(
  $$ select public.set_avatar_path('aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg') $$,
  'the avatar path of the own folder is accepted'
);
select throws_ok(
  $$ select public.set_avatar_path('bbbbbbbb-0000-0000-0000-000000000002/avatar.jpg') $$,
  'P0001', 'invalid_avatar_path', 'a path in somebody else''s folder is rejected'
);
select throws_ok(
  $$ select public.set_avatar_path('aaaaaaaa-0000-0000-0000-000000000001/../x.jpg') $$,
  'P0001', 'invalid_avatar_path', 'path tricks are rejected'
);
select pg_temp.logout();

-- Export ------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select results_eq(
  $$ select export_my_data->>'email', jsonb_array_length(export_my_data->'participations'),
            (export_my_data->'profile'->>'avatar_path') from public.export_my_data() $$,
  $$ values ('anna@pgtap.test'::text, 1, 'aaaaaaaa-0000-0000-0000-000000000001/avatar.jpg'::text) $$,
  'the export contains the own email, participations and profile'
);
select ok(
  not (public.export_my_data()::text like '%bbbbbbbb-0000-0000-0000-000000000002%'),
  'the export holds nothing of other people'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.export_my_data(boolean)', 'execute')
  and not has_function_privilege('anon', 'public.set_ranking_visibility(boolean)', 'execute'),
  'anonymous users cannot call the profile functions'
);

select * from finish();
rollback;
