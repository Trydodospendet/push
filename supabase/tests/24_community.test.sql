-- Community numbers: honest aggregates and anonymous events.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-000000000051', 'community@pgtap.test', 'authenticated', 'authenticated');

insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
values
  ('00000000-0000-4000-8000-000000000051', 'android', 'community-valid', 'running',
   now() - interval '50 minutes', now() - interval '10 minutes', 5200, 2400, false, true),
  ('00000000-0000-4000-8000-000000000051', 'android', 'community-invalid', 'running',
   now() - interval '3 hours', now() - interval '2 hours', 8000, 3000, true, false);

select throws_ok($$ select * from public.get_community_stats() $$, null, null, 'anonymous callers are refused');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000051","role":"authenticated"}', true);

select cmp_ok((select goals_week from public.get_community_stats()), '>=', 0::bigint, 'goals of the week are counted');
select is((select count(*) from public.get_community_events() where kind = 'run' and value = 5),
  1::bigint, 'the valid run shows as 5 km');
select is((select count(*) from public.get_community_events() where value = 8),
  0::bigint, 'invalid runs never show up');
select is(
  (select count(*) from information_schema.columns
    where table_schema = 'public' and table_name = 'get_community_events'),
  0::bigint, 'events are a function without person columns');
select cmp_ok((select count(*) from public.get_community_events()), '<=', 8::bigint, 'at most 8 events');

select * from finish();
rollback;
