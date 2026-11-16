-- Pledge model: reached → pledge back; missed → 90 % donated, 10 % to the house.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-000000000041', 'pledge1@pgtap.test', 'authenticated', 'authenticated'),
       ('00000000-0000-4000-8000-000000000042', 'pledge2@pgtap.test', 'authenticated', 'authenticated');

create temp table goals (name text primary key, id uuid);
grant all on goals to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000041","role":"authenticated"}', true);
insert into goals select 'a', (public.create_goal('Ziel A', 'run_total', 5000, 500, 'week')).id;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000042","role":"authenticated"}', true);
insert into goals select 'b', (public.create_goal('Ziel B', 'run_total', 5000, 500, 'week')).id;
reset role;

update public.challenges
   set starts_at = now() - interval '9 days', ends_at = now() - interval '2 days', status = 'settling',
       sync_grace_hours = 24
 where id in (select id from goals);
insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
values ('00000000-0000-4000-8000-000000000041', 'android', 'pledge-run', 'running',
  now() - interval '8 days', now() - interval '8 days' + interval '40 minutes', 6000, 2400, false, true);

select is(public.settle_challenge((select id from goals where name = 'a')), true, 'the reached goal settles');
select is(public.settle_challenge((select id from goals where name = 'b')), true, 'the missed goal settles');

select is(
  (select balance_cents from public.wallets where user_id = '00000000-0000-4000-8000-000000000041'),
  10000::bigint, 'reached: the pledge is back in full, nothing more'
);
select is(
  (select balance_cents from public.wallets where user_id = '00000000-0000-4000-8000-000000000042'),
  9500::bigint, 'missed: the pledge is gone'
);
select results_eq(
  $$ select account, type, amount_cents from public.ledger_entries
      where challenge_id = (select id from goals where name = 'b') and type <> 'stake' order by account $$,
  $$ values ('donation'::text, 'donation'::text, 450::bigint), ('house', 'fee', 50) $$,
  'missed: 90 % donated, 10 % to the house'
);
select is(
  (select coalesce(sum(amount_cents), 0)::bigint from public.ledger_entries
    where challenge_id in (select id from goals)),
  0::bigint, 'the bookings of both goals sum to 0'
);

create temp table before_second as select count(*) as entries from public.ledger_entries;
select is(public.settle_challenge((select id from goals where name = 'b')), false, 'a second call does nothing');
select is((select count(*) from public.ledger_entries), (select entries from before_second),
  'a second call books nothing');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000042","role":"authenticated"}', true);
select results_eq(
  $$ select title, amount_cents from public.get_my_donations() $$,
  $$ values ('Ziel B'::text, 450::bigint) $$,
  'the loser sees what was donated'
);
select cmp_ok(public.get_community_donations(), '>=', 450::bigint, 'the community counter includes this month''s donation');
reset role;
select is(
  (select donated_cents from public.challenge_participants
    where challenge_id = (select id from goals where name = 'a')),
  0::bigint, 'a winner donated nothing'
);

select * from finish();
rollback;
