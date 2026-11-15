begin;
create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-000000000032', 'friend-booking@pgtap.test', 'authenticated', 'authenticated');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000032","role":"authenticated"}', true);

create temp table before_booking as
select balance_cents from public.wallets where user_id = auth.uid();

create temp table friend_goal as
select *
  from public.create_goal_with_preferences(
    'Mit Freunden 3,5 km', 'run_total', 3500, 5000,
    (now() at time zone 'Europe/Berlin')::date + 1,
    (now() at time zone 'Europe/Berlin')::date + 3,
    true, true, '00000000-0000-4000-a000-000000000001'
  );

select is((select target_value from friend_goal), 3500, 'the decimal target is stored in metres');
select is((select length(invite_code) from friend_goal), 6, 'the goal has an invite code');
select is((select participant_count from friend_goal), 1, 'the creator is already a participant');
select is(
  (select balance_cents from before_booking) - (select balance_cents from public.wallets where user_id = auth.uid()),
  5000::bigint, 'the selected stake was deducted once'
);
select is(
  (select effective_donate from public.get_my_challenge_donation((select id from friend_goal))),
  true, 'the creator participates with the donation choice from the confirmation'
);
select lives_ok($$select public.create_goal_with_preferences(
  'Further personal goal', 'run_total', 3500, 100,
  (now() at time zone 'Europe/Berlin')::date + 1,
  (now() at time zone 'Europe/Berlin')::date + 3, false, false, null
)$$, 'a separate personal goal can use the remaining balance');
select throws_ok($$select public.create_goal_with_preferences(
  'Cannot afford this goal', 'run_total', 3500, 5000,
  (now() at time zone 'Europe/Berlin')::date + 1,
  (now() at time zone 'Europe/Berlin')::date + 3, true, false, null
)$$, 'P0001', 'insufficient_funds', 'a friend goal requires sufficient funds');
select is(
  (select count(*) from public.challenges where creator_id = auth.uid() and title = 'Cannot afford this goal'),
  0::bigint, 'the failed debit leaves no friend goal behind'
);
select is(
  public.leave_challenge((select id from friend_goal)),
  5000::bigint, 'the creator can withdraw before the start and recover the stake'
);

select * from finish();
rollback;
