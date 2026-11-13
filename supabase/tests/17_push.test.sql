-- Ausbau 2 – push preparation: tokens, preferences, outbox triggers.
begin;
create extension if not exists pgtap with schema extensions;

select plan(16);

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
  ('bbbbbbbb-0000-0000-0000-000000000002', 'ben@pgtap.test', 'authenticated', 'authenticated');
update public.profiles set display_name = 'Anna Lauf' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set display_name = 'Ben Renner' where id = 'bbbbbbbb-0000-0000-0000-000000000002';

-- Tokens ------------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select lives_ok($$ select public.register_push_token('ExponentPushToken[anna-phone_1]', 'android') $$, 'a token can be registered');
select lives_ok($$ select public.register_push_token('ExponentPushToken[anna-phone_1]', 'android') $$, 'registering it again is fine');
select throws_ok($$ select public.register_push_token('not-a-token', 'android') $$, 'P0001', 'invalid_push_token', 'only Expo push tokens are accepted');
select throws_ok($$ select public.register_push_token('ExponentPushToken[x]', 'windows') $$, 'P0001', 'invalid_push_token', 'only Android and iOS are accepted');
select throws_ok($$ select * from public.push_tokens $$, '42501', null, 'tokens cannot be read by clients');
select throws_ok($$ select * from public.push_outbox $$, '42501', null, 'the outbox cannot be read by clients');
select pg_temp.logout();

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.register_push_token('ExponentPushToken[anna-phone_1]', 'android');
select pg_temp.logout();
select is(
  (select user_id from public.push_tokens where token = 'ExponentPushToken[anna-phone_1]'),
  'bbbbbbbb-0000-0000-0000-000000000002'::uuid,
  'signing in with another account moves the token of the phone'
);

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.register_push_token('ExponentPushToken[anna-phone_2]', 'android');
select pg_temp.logout();

-- Cheer message --------------------------------------------------------------------------------------

insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
  starts_at, ends_at, min_participants, visibility, status, mode)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'Push-Test', 'run_total', 5000, 0, 0,
  now() - interval '2 days', now() + interval '5 days', 2, 'public', 'active', 'ranked');
insert into public.challenge_participants (challenge_id, user_id, stake_cents)
select c.id, u, 0 from public.challenges c,
  unnest(array['aaaaaaaa-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000002']::uuid[]) u
 where c.title = 'Push-Test';

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.cheer_feed_entry(
  (select id from public.challenge_feed where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1));
select pg_temp.logout();

select results_eq(
  $$ select kind, title, body, data->>'url' is not null from public.push_outbox
      where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' $$,
  $$ values ('cheer'::text, 'Ben Renner feuert dich an'::text, 'Weiter so!'::text, true) $$,
  'a cheer writes a message for the owner of the entry'
);
select is(
  (select count(*)::int from public.push_outbox where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  0,
  'nothing is written for the person who cheered'
);

-- Preferences ---------------------------------------------------------------------------------------

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.set_push_preferences(true, false, true);
select pg_temp.logout();

delete from public.feed_cheers;
delete from public.push_outbox;
select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.cheer_feed_entry(
  (select id from public.challenge_feed where user_id = 'aaaaaaaa-0000-0000-0000-000000000001' limit 1));
select pg_temp.logout();
select is(
  (select count(*)::int from public.push_outbox), 0,
  'a switched-off kind writes no message'
);

select pg_temp.login('bbbbbbbb-0000-0000-0000-000000000002');
select public.set_push_preferences(true, true, true);
select pg_temp.logout();
select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select public.set_push_preferences(true, true, true);
select public.set_ranking_visibility(true);
select public.cheer_feed_entry(
  (select id from public.challenge_feed where user_id = 'bbbbbbbb-0000-0000-0000-000000000002' limit 1));
select pg_temp.logout();
select is(
  (select title from public.push_outbox where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'),
  'Jemand feuert dich an',
  'an anonymous cheerer stays anonymous in the message'
);

-- Result message ------------------------------------------------------------------------------------

delete from public.push_outbox;
update public.challenge_participants set result = 'success'
 where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.challenge_participants set result = 'failed'
 where user_id = 'bbbbbbbb-0000-0000-0000-000000000002';
select results_eq(
  $$ select kind, title from public.push_outbox order by user_id $$,
  $$ values ('result'::text, 'Dein Ergebnis ist da'::text), ('result', 'Dein Ergebnis ist da') $$,
  'the settlement writes a result message for every participant'
);

-- Users without a phone get nothing -----------------------------------------------------------------------

insert into auth.users (id, email, aud, role)
values ('cccccccc-0000-0000-0000-000000000003', 'carl@pgtap.test', 'authenticated', 'authenticated');
delete from public.push_outbox;
select private.enqueue_push('cccccccc-0000-0000-0000-000000000003', 'result', 'x', 'y');
select is((select count(*)::int from public.push_outbox), 0, 'no registered phone, no message');

-- Housekeeping ----------------------------------------------------------------------------------------------

insert into public.push_outbox (user_id, kind, title, body, sent_at, created_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'result', 'alt', 'alt', now() - interval '8 days', now() - interval '9 days'),
       ('aaaaaaaa-0000-0000-0000-000000000001', 'result', 'neu', 'neu', now(), now());
select private.clean_push();
select results_eq(
  $$ select title from public.push_outbox $$,
  $$ values ('neu'::text) $$,
  'sent messages older than 7 days are removed'
);

select ok(
  not has_function_privilege('anon', 'public.register_push_token(text, text)', 'execute')
  and not has_function_privilege('authenticated', 'private.enqueue_push(uuid, text, text, text, jsonb)', 'execute'),
  'only signed-in users can register a phone; nobody can write messages directly'
);
select is(
  (select count(*)::int from cron.job where jobname = 'clean-push'), 1,
  'a daily job cleans the outbox'
);

select * from finish();
rollback;
