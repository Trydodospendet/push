-- Real-money pledge (Stripe test mode): switch, reservation, reached → cancel, missed → capture,
-- duplicate webhooks, expired reservation. No call to Stripe happens here: the Edge Functions
-- are simulated by calling the same database functions they call.
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users (id, email, aud, role)
values ('00000000-0000-4000-8000-000000000061', 'rm1@pgtap.test', 'authenticated', 'authenticated'),
       ('00000000-0000-4000-8000-000000000062', 'rm2@pgtap.test', 'authenticated', 'authenticated'),
       ('00000000-0000-4000-8000-000000000063', 'rm3@pgtap.test', 'authenticated', 'authenticated');

create temp table goal_json as
select jsonb_build_object(
  'title', 'Echtgeld Ziel', 'goal_type', 'run_total', 'target_value', 5000,
  'start_date', (now() at time zone 'Europe/Berlin')::date,
  'end_date', (now() at time zone 'Europe/Berlin')::date + 1,
  'with_friends', false
) as g;

-- 1. Switch off (default): nothing works.
select is(private.real_money_allowed('00000000-0000-4000-8000-000000000061'), false, 'off by default');
select throws_ok(
  $$ select public.rm_register_payment('00000000-0000-4000-8000-000000000061', 'pi_off', 500, (select g from goal_json)) $$,
  'P0001', 'real_money_disabled', 'a reservation is refused while the switch is off');

-- 2. On, but only for listed testers.
update private.settings set real_money_enabled = true;
insert into private.real_money_testers (user_id)
values ('00000000-0000-4000-8000-000000000061'), ('00000000-0000-4000-8000-000000000062');
select is(private.real_money_allowed('00000000-0000-4000-8000-000000000063'), false, 'not listed: still off');
select is(private.real_money_allowed('00000000-0000-4000-8000-000000000061'), true, 'listed tester: on');

-- 3. Too long (7 days) is refused.
select throws_ok(
  $$ select public.rm_register_payment('00000000-0000-4000-8000-000000000061', 'pi_long', 500,
       (select g || jsonb_build_object('end_date', (now() at time zone 'Europe/Berlin')::date + 6) from goal_json)) $$,
  'P0001', 'real_money_too_long', 'more than 6 days is refused');

-- 4. Reserve: the goal exists after Stripe confirmed, the wallet is untouched.
select public.rm_register_payment('00000000-0000-4000-8000-000000000061', 'pi_reached', 500, (select g from goal_json));
select public.rm_register_payment('00000000-0000-4000-8000-000000000062', 'pi_missed', 500, (select g from goal_json));
select is(public.rm_apply_intent_event('evt_1', 'payment_intent.amount_capturable_updated', 'pi_reached'), 'ok', 'reservation confirmed');
select count(*) as ignored from (select public.rm_apply_intent_event('evt_2', 'payment_intent.amount_capturable_updated', 'pi_missed')) as x;
select is(
  (select status from public.payments where payment_intent_id = 'pi_reached'), 'reserved', 'payment is reserved');
select is(
  (select balance_cents from public.wallets where user_id = '00000000-0000-4000-8000-000000000061'),
  10000::bigint, 'the wallet is not debited');
select is(
  (select count(*) from public.ledger_entries where type = 'stake' and challenge_id in (select challenge_id from public.payments)),
  0::bigint, 'no credit booking for the stake');

-- 5. A duplicate webhook changes nothing.
select is(public.rm_apply_intent_event('evt_1', 'payment_intent.amount_capturable_updated', 'pi_reached'), 'duplicate', 'duplicate event');
select is((select count(*) from public.challenges where id in (select challenge_id from public.payments)), 2::bigint, 'still exactly two goals');

-- 6. Settlement: user 61 reached the goal, user 62 did not.
update public.challenges
   set starts_at = now() - interval '3 days', ends_at = now() - interval '2 days', status = 'settling', sync_grace_hours = 24
 where id in (select challenge_id from public.payments);
insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
  start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
values ('00000000-0000-4000-8000-000000000061', 'android', 'rm-run', 'running',
  now() - interval '2 days 12 hours', now() - interval '2 days 11 hours', 6000, 2400, false, true);
select public.settle_challenge(challenge_id) from public.payments order by payment_intent_id;
select is(
  (select pending_action from public.payments where payment_intent_id = 'pi_reached'), 'cancel', 'reached: cancel the reservation');
select is(
  (select pending_action from public.payments where payment_intent_id = 'pi_missed'), 'capture', 'missed: capture the reservation');

-- 7. The Edge Function reports success: captured with the donation duty (90 / 10).
select public.rm_action_done((select id from public.payments where payment_intent_id = 'pi_missed'), true);
select public.rm_action_done((select id from public.payments where payment_intent_id = 'pi_reached'), true);
select public.rm_action_done((select id from public.payments where payment_intent_id = 'pi_missed'), true);
select results_eq(
  $$ select captured_cents, house_cents, donation_cents from public.donation_obligations $$,
  $$ values (500::bigint, 50::bigint, 450::bigint) $$,
  'a captured pledge records the donation duty once');

-- 8. An expired reservation is "not secured": cancelled by Stripe, nothing is charged.
select public.rm_register_payment('00000000-0000-4000-8000-000000000061', 'pi_expired', 500, (select g from goal_json));
select count(*) as ignored from (select public.rm_apply_intent_event('evt_3', 'payment_intent.amount_capturable_updated', 'pi_expired')) as x;
select count(*) as ignored from (select public.rm_apply_intent_event('evt_4', 'payment_intent.canceled', 'pi_expired')) as x;
select is(
  (select status || '/' || coalesce(pending_action, '-') from public.payments where payment_intent_id = 'pi_expired'),
  'expired/-', 'expired reservation: no action, nothing charged');

select * from finish();
rollback;
