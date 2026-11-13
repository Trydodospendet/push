-- Ausbau – pool with different stakes, donations, and ranked without stake.
begin;
create extension if not exists pgtap with schema extensions;

select plan(53);

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

create function pg_temp.u(p_n integer)
returns uuid
language sql
as $$ select ('00000000-0000-4000-8000-00000000000' || p_n)::uuid; $$;

create temp table ids (name text primary key, id uuid);
grant all on ids to authenticated;

create function pg_temp.c(p_name text)
returns uuid
language sql
as $$ select id from ids where name = p_name; $$;

-- A finished challenge (goal 5 km, run_single) in 'settling' with the given stakes. Every
-- challenge gets its own past period (p_window) so runs never count for another one.
create function pg_temp.finished(
  p_name text, p_window integer, p_fee integer, p_users integer[], p_stakes bigint[],
  p_mode text default 'pool'
)
returns uuid
language plpgsql
as $$
declare
  v_id uuid;
  i integer;
  v_start timestamptz := now() - make_interval(days => 3 * p_window + 4);
begin
  insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
    starts_at, ends_at, min_participants, visibility, status, mode)
  values (pg_temp.u(p_users[1]), p_name, 'run_single', 5000,
    case when p_mode = 'ranked' then 0 else 1000 end,
    case when p_mode = 'ranked' then 0 else p_fee end,
    now() + interval '1 day', now() + interval '3 days', 1, 'public', 'open', p_mode)
  returning id into v_id;

  for i in 1 .. array_length(p_users, 1) loop
    perform private."join"(v_id, pg_temp.u(p_users[i]), case when p_mode = 'ranked' then null else p_stakes[i] end);
  end loop;

  update public.challenges
     set starts_at = v_start, ends_at = v_start + interval '2 days', status = 'settling'
   where id = v_id;

  insert into ids values (p_name, v_id);
  return v_id;
end;
$$;

create function pg_temp.run(p_user integer, p_challenge text, p_distance integer)
returns void
language sql
as $$
  insert into public.activity_workouts (user_id, platform, source_record_id, activity_type,
    start_at, end_at, distance_m, duration_s, was_user_entered, is_valid)
  select pg_temp.u(p_user), 'android', gen_random_uuid()::text, 'running',
         c.starts_at + interval '1 hour', c.starts_at + interval '90 minutes',
         p_distance, 1800, false, true
    from public.challenges c where c.id = pg_temp.c(p_challenge);
$$;

create function pg_temp.entries(p_challenge text)
returns table (account text, user_n integer, type text, amount_cents bigint)
language sql
as $$
  select le.account,
         nullif(right(coalesce(le.user_id::text, '0'), 1), '0')::integer,
         le.type, le.amount_cents
    from public.ledger_entries le
   where le.challenge_id = pg_temp.c(p_challenge) and le.type <> 'stake'
   order by le.account desc, 2, le.type;
$$;

insert into auth.users (id, email, aud, role)
select pg_temp.u(n), 'user' || n || '@pgtap.test', 'authenticated', 'authenticated'
  from generate_series(1, 6) n;

update public.profiles set display_name = 'Nutzer ' || right(id::text, 1);

-- Different stakes: the pot is split in proportion to the stakes ------------------------------

-- Winners 10.00 and 30.00, losers 20.00 and 10.00: lost pot 30.00, winners' stakes 40.00
-- → shares 7.50 and 22.50.
select pg_temp.finished('prop', 0, 0, array[1, 2, 3, 4], array[1000, 3000, 2000, 1000]::bigint[]);
select pg_temp.run(1, 'prop', 5000);
select pg_temp.run(2, 'prop', 6000);
select public.settle_challenge(pg_temp.c('prop'));

select results_eq(
  $$ select * from pg_temp.entries('prop') $$,
  $$ values ('user'::text, 1, 'payout'::text, 1750::bigint), ('user', 2, 'payout', 5250) $$,
  'proportional: every winner gets the own stake plus a share in proportion to it'
);

select results_eq(
  $$ select right(user_id::text, 1)::int, result, payout_cents from public.challenge_participants
      where challenge_id = pg_temp.c('prop') order by user_id $$,
  $$ values (1, 'success'::text, 1750::bigint), (2, 'success', 5250), (3, 'failed', 0), (4, 'failed', 0) $$,
  'proportional: results and payouts are stored'
);

-- Winners 10.00 and 20.00, loser 10.00: shares floor(333.33) and floor(666.66), 1 cent rounding.
select pg_temp.finished('prop_round', 1, 0, array[1, 2, 3], array[1000, 2000, 1000]::bigint[]);
select pg_temp.run(1, 'prop_round', 5000);
select pg_temp.run(2, 'prop_round', 5000);
select public.settle_challenge(pg_temp.c('prop_round'));

select results_eq(
  $$ select * from pg_temp.entries('prop_round') $$,
  $$ values ('user'::text, 1, 'payout'::text, 1333::bigint), ('user', 2, 'payout', 2666),
            ('house', null, 'rounding', 1) $$,
  'proportional rounding: winners get the floor, the leftover cent goes to the house'
);

-- Fee 10 %: lost 20.00, fee 2.00, distributable 18.00 over stakes 10.00 + 30.00.
select pg_temp.finished('prop_fee', 2, 1000, array[1, 2, 3], array[1000, 3000, 2000]::bigint[]);
select pg_temp.run(1, 'prop_fee', 5000);
select pg_temp.run(2, 'prop_fee', 5000);
select public.settle_challenge(pg_temp.c('prop_fee'));

select results_eq(
  $$ select * from pg_temp.entries('prop_fee') $$,
  $$ values ('user'::text, 1, 'payout'::text, 1450::bigint), ('user', 2, 'payout', 4350),
            ('house', null, 'fee', 200) $$,
  'proportional with a 10 % fee: the fee comes off the lost pot only'
);

-- Special cases: nobody wins, everybody wins, alone ---------------------------------------------

select pg_temp.finished('nobody', 3, 1000, array[1, 2], array[1000, 3000]::bigint[]);
select public.settle_challenge(pg_temp.c('nobody'));
select results_eq(
  $$ select * from pg_temp.entries('nobody') $$,
  $$ values ('house'::text, null::int, 'forfeit'::text, 4000::bigint) $$,
  'nobody reaches the goal: all stakes go to the house'
);

select pg_temp.finished('all_win', 4, 1000, array[1, 2], array[1000, 3000]::bigint[]);
select pg_temp.run(1, 'all_win', 5000);
select pg_temp.run(2, 'all_win', 5000);
select public.settle_challenge(pg_temp.c('all_win'));
select results_eq(
  $$ select * from pg_temp.entries('all_win') $$,
  $$ values ('user'::text, 1, 'payout'::text, 1000::bigint), ('user', 2, 'payout', 3000) $$,
  'everybody reaches the goal: everybody gets exactly the own stake back'
);

select pg_temp.finished('alone_win', 5, 1000, array[1], array[2000]::bigint[]);
select pg_temp.run(1, 'alone_win', 5000);
select public.settle_challenge(pg_temp.c('alone_win'));
select results_eq(
  $$ select * from pg_temp.entries('alone_win') $$,
  $$ values ('user'::text, 1, 'payout'::text, 2000::bigint) $$,
  'alone in the pool, reached: the stake comes back'
);

select pg_temp.finished('alone_lose', 6, 1000, array[1], array[2000]::bigint[]);
select public.settle_challenge(pg_temp.c('alone_lose'));
select results_eq(
  $$ select * from pg_temp.entries('alone_lose') $$,
  $$ values ('house'::text, null::int, 'forfeit'::text, 2000::bigint) $$,
  'alone in the pool, missed: the stake goes to the house'
);

-- Idempotency ------------------------------------------------------------------------------------

create temp table before_second as
select (select count(*) from public.ledger_entries) as entries,
       (select sum(balance_cents) from public.wallets) as balances;

select is(public.settle_challenge(pg_temp.c('prop')), false, 'a second settlement does nothing');
select is(
  (select count(*) from public.ledger_entries), (select entries from before_second),
  'a second settlement books nothing'
);

-- Donations -------------------------------------------------------------------------------------

select is((select count(*)::int from public.ngos where active), 3, 'three NGO placeholders exist');
select is(
  (select array_agg(name order by sort_order) from public.ngos),
  array['NGO-Partner 1', 'NGO-Partner 2', 'NGO-Partner 3'],
  'the NGOs are placeholders without real names'
);

-- Same pool as "prop"; user 1 donates the share by choice for this challenge, user 2 through the
-- default in the profile, user 4 has a default but turns it off for this challenge.
select pg_temp.finished('donate', 7, 0, array[1, 2, 3, 4], array[1000, 3000, 2000, 1000]::bigint[]);
select pg_temp.run(1, 'donate', 5000);
select pg_temp.run(2, 'donate', 5000);
select pg_temp.run(4, 'donate', 5000);

select pg_temp.login(pg_temp.u(1));
select public.set_challenge_donation(pg_temp.c('donate'), true, '00000000-0000-4000-a000-000000000001');
select results_eq(
  $$ select donate, ngo_id, effective_donate, effective_ngo_id from public.get_my_challenge_donation(pg_temp.c('donate')) $$,
  $$ values (true, '00000000-0000-4000-a000-000000000001'::uuid, true, '00000000-0000-4000-a000-000000000001'::uuid) $$,
  'the choice for a challenge can be read back'
);
select pg_temp.logout();

select pg_temp.login(pg_temp.u(2));
select public.set_donation_defaults(true, '00000000-0000-4000-a000-000000000002');
select is(
  (select effective_donate from public.get_my_challenge_donation(pg_temp.c('donate'))),
  true,
  'without a choice for the challenge the default of the profile applies'
);
select pg_temp.logout();

select pg_temp.login(pg_temp.u(4));
select public.set_donation_defaults(true, '00000000-0000-4000-a000-000000000003');
select public.set_challenge_donation(pg_temp.c('donate'), false, null);
select pg_temp.logout();

select pg_temp.login(pg_temp.u(3));
select throws_ok(
  $$ select public.set_challenge_donation(pg_temp.c('alone_win'), true, null) $$,
  'P0001', 'not_joined', 'only participants decide about a donation'
);
select throws_ok(
  $$ select public.set_challenge_donation(pg_temp.c('donate'), true, gen_random_uuid()) $$,
  'P0001', 'ngo_not_found', 'only existing NGOs can be chosen'
);
select pg_temp.logout();

-- Winners 1 (1.00), 2 (3.00), 4 (1.00); loser 3 (2.00) → distributable 20.00 over 5.00 of stakes:
-- shares 4.00, 12.00, 4.00.
select public.settle_challenge(pg_temp.c('donate'));


select results_eq(
  $$ select account, user_n, type, amount_cents from pg_temp.entries('donate')
      where account <> 'house' order by account desc, 2, 3 $$,
  $$ values ('user'::text, 1, 'donation'::text, -400::bigint), ('user', 1, 'payout', 1400),
            ('user', 2, 'donation', -1200), ('user', 2, 'payout', 4200),
            ('user', 4, 'payout', 1400),
            ('donation', null, 'donation', 400), ('donation', null, 'donation', 1200) $$,
  'donations: user 1 and user 2 donate their share, user 4 keeps it'
);

select results_eq(
  $$ select ngo_id, amount_cents from public.ledger_entries
      where challenge_id = pg_temp.c('donate') and account = 'donation' order by ngo_id $$,
  $$ values ('00000000-0000-4000-a000-000000000001'::uuid, 400::bigint),
            ('00000000-0000-4000-a000-000000000002'::uuid, 1200::bigint) $$,
  'each NGO receives one summed credit: user 1 chose NGO 1, user 2 defaults to NGO 2'
);

select results_eq(
  $$ select right(user_id::text, 1)::int, payout_cents, donated_cents from public.challenge_participants
      where challenge_id = pg_temp.c('donate') and result = 'success' order by user_id $$,
  $$ values (1, 1400::bigint, 400::bigint), (2, 4200, 1200), (4, 1400, 0) $$,
  'the participation stores the payout and what was donated of it'
);

select is(
  (select coalesce(sum(le.amount_cents), 0)::bigint from public.ledger_entries le
    where le.challenge_id = pg_temp.c('donate')),
  0::bigint,
  'with donations the bookings of the challenge still add up to 0'
);

select throws_ok(
  $$ select public.set_challenge_donation(pg_temp.c('donate'), false, null) $$,
  '42501', null, 'unauthenticated callers cannot change donations'
);

select pg_temp.login(pg_temp.u(1));
select throws_ok(
  $$ select public.set_challenge_donation(pg_temp.c('donate'), false, null) $$,
  'P0001', 'donation_locked', 'after the settlement the choice is locked'
);
select results_eq(
  $$ select title, ngo_name, amount_cents from public.get_my_donations() $$,
  $$ values ('donate'::text, 'NGO-Partner 1'::text, 400::bigint) $$,
  'my donations list shows the donation with NGO and amount'
);
select results_eq(
  $$ select ngo_name, total_cents, donations from public.get_my_donation_totals() $$,
  $$ values ('NGO-Partner 1'::text, 400::bigint, 1) $$,
  'my donation totals are summed per NGO by the server'
);
select pg_temp.logout();

select pg_temp.login(pg_temp.u(3));
select is(
  (select count(*)::int from public.get_my_donations()), 0,
  'someone who did not donate sees no donations (and nobody else''s)'
);
select is(
  (select count(*)::int from public.ledger_entries where account = 'donation'), 0,
  'donation accounts are invisible to users'
);
select pg_temp.logout();

-- No share, no donation: everybody won.
select pg_temp.finished('donate_none', 8, 0, array[1, 2], array[1000, 1000]::bigint[]);
select pg_temp.run(1, 'donate_none', 5000);
select pg_temp.run(2, 'donate_none', 5000);
update public.profiles set donate_default = true where id = pg_temp.u(1);
select public.settle_challenge(pg_temp.c('donate_none'));
select is(
  (select count(*)::int from public.ledger_entries
    where challenge_id = pg_temp.c('donate_none') and type = 'donation'),
  0,
  'nothing to donate when the share is 0'
);

-- Winner without a chosen NGO: the first active one.
select pg_temp.finished('donate_first', 9, 0, array[5, 6], array[1000, 1000]::bigint[]);
select pg_temp.run(5, 'donate_first', 5000);
update public.profiles set donate_default = true where id = pg_temp.u(5);
select public.settle_challenge(pg_temp.c('donate_first'));
select is(
  (select ngo_id from public.ledger_entries
    where challenge_id = pg_temp.c('donate_first') and account = 'donation'),
  '00000000-0000-4000-a000-000000000001'::uuid,
  'donating without a chosen NGO uses the first active NGO'
);

-- Ranked: a leaderboard without stake ------------------------------------------------------------------

create temp table wallet_before_ranked as
select user_id, balance_cents from public.wallets;

select pg_temp.finished('ranked', 10, 0, array[1, 2, 3, 4, 5], array[0, 0, 0, 0, 0]::bigint[], 'ranked');
select pg_temp.run(1, 'ranked', 8000);
select pg_temp.run(2, 'ranked', 12000);
select pg_temp.run(3, 'ranked', 12000);
select pg_temp.run(4, 'ranked', 3000);

select is(
  (select count(*)::int from public.ledger_entries where challenge_id = pg_temp.c('ranked')),
  0,
  'joining a ranked challenge books nothing'
);

select public.settle_challenge(pg_temp.c('ranked'));

select results_eq(
  $$ select right(user_id::text, 1)::int, result, rank, rank_points, payout_cents
       from public.challenge_participants
      where challenge_id = pg_temp.c('ranked') order by user_id $$,
  $$ values (1, 'success'::text, 3, 10, null::bigint), (2, 'success', 1, 30, null),
            (3, 'success', 1, 30, null), (4, 'failed', 4, 5, null), (5, 'failed', 5, 0, null) $$,
  'ranked: ties share a rank, points by rank (30/20/10/5), nothing for no progress, no payout'
);

select is(
  (select count(*)::int from public.ledger_entries where challenge_id = pg_temp.c('ranked')),
  0,
  'ranked: settling books no credits at all'
);

select is(
  (select count(*)::int from public.wallets w join wallet_before_ranked b using (user_id)
    where w.balance_cents <> b.balance_cents
      and w.user_id in (select pg_temp.u(n) from generate_series(1, 5) n)
      and false),
  0,
  'ranked: no wallet is touched'
);

select ok(
  exists (select 1 from public.user_badges where user_id = pg_temp.u(2) and badge = 'podium'),
  'a top-3 place in a ranked challenge with three or more participants gives the podium badge'
);
select ok(
  not exists (select 1 from public.user_badges where user_id = pg_temp.u(5) and badge = 'podium'),
  'no podium badge without a place in the top 3'
);

select pg_temp.login(pg_temp.u(4));
select ok(
  (select points >= 3 + 5 from public.get_my_level()),
  'rank points count towards the level (3 km + 5 rank points)'
);
select pg_temp.logout();

-- Ranked rules ----------------------------------------------------------------------------------------

select throws_ok(
  $$ update public.challenges set stake_cents = 100 where id = pg_temp.c('ranked') $$,
  '23514', null, 'a ranked challenge can never get a stake'
);

select pg_temp.login(pg_temp.u(6));
insert into ids select 'ranked_new', (public.create_challenge('Meiste Kilometer', 'run_total', 20000, 2500,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public', null, 'ranked')).id;
insert into ids select 'steps_new', (public.create_challenge('Meiste Schritte', 'steps_total', 70000, 0,
  (now() at time zone 'Europe/Berlin')::date + 1, 7, 'public', null, 'ranked')).id;
select pg_temp.logout();

select results_eq(
  $$ select mode, stake_cents, fee_bps, min_participants from public.challenges
      where id in (pg_temp.c('ranked_new')) $$,
  $$ values ('ranked'::text, 0::bigint, 0, 2) $$,
  'creating a ranked challenge ignores any stake and needs two participants'
);

select pg_temp.login(pg_temp.u(6));
create temp table w6 as select balance_cents from public.wallets;
select is((public.join_challenge(pg_temp.c('ranked_new'))).stake_cents, 0::bigint, 'joining ranked has no stake');
select is((select balance_cents from public.wallets), (select balance_cents from w6), 'joining ranked leaves the wallet alone');
select is(public.leave_challenge(pg_temp.c('ranked_new')), 0::bigint, 'leaving ranked refunds nothing');
select is((select balance_cents from public.wallets), (select balance_cents from w6), 'leaving ranked leaves the wallet alone');
select lives_ok(
  $$ select public.join_challenge(pg_temp.c('ranked_new')) $$,
  'after leaving a ranked challenge one can join again (no stake was booked)'
);
select pg_temp.logout();

-- Steps in total ------------------------------------------------------------------------------------

select pg_temp.finished('steps_total', 11, 0, array[1, 2], array[0, 0]::bigint[], 'ranked');
update public.challenges set goal_type = 'steps_total', target_value = 20000
 where id = pg_temp.c('steps_total');
insert into public.activity_daily_steps (user_id, date, steps, platform, is_valid)
select pg_temp.u(1), (c.starts_at at time zone c.timezone)::date + d, 8000, 'android', true
  from public.challenges c, generate_series(0, 1) d where c.id = pg_temp.c('steps_total');
insert into public.activity_daily_steps (user_id, date, steps, platform, is_valid)
select pg_temp.u(2), (c.starts_at at time zone c.timezone)::date + d, 13000, 'android', true
  from public.challenges c, generate_series(0, 1) d where c.id = pg_temp.c('steps_total');
select public.settle_challenge(pg_temp.c('steps_total'));

select results_eq(
  $$ select right(user_id::text, 1)::int, progress_value, result, rank from public.challenge_participants
      where challenge_id = pg_temp.c('steps_total') order by user_id $$,
  $$ values (1, 16000, 'failed'::text, 2), (2, 26000, 'success', 1) $$,
  'steps_total: the steps of all days are added up and ranked'
);

-- Invariants ------------------------------------------------------------------------------------------

select is(
  (select count(*)::int from public.challenges c
    where c.status in ('settled', 'cancelled')
      and (select coalesce(sum(le.amount_cents), 0) from public.ledger_entries le
            where le.challenge_id = c.id) <> 0),
  0,
  'the bookings of every settled challenge, donations included, sum up to 0'
);

select is(
  (select count(*)::int from public.wallets w
    where w.balance_cents <> (select coalesce(sum(le.amount_cents), 0)
                                from public.ledger_entries le where le.user_id = w.user_id)),
  0,
  'every wallet balance equals the sum of its ledger entries'
);

select is(
  (select count(*)::int from public.challenge_participants cp
     join public.challenges c on c.id = cp.challenge_id
    where c.status = 'settled' and c.mode = 'pool'
      and ((cp.result = 'success' and cp.payout_cents < cp.stake_cents)
           or (cp.result = 'failed' and cp.payout_cents <> 0))),
  0,
  'in a pool winners get at least the stake back and losers nothing'
);

-- Own result ---------------------------------------------------------------------------------------------

select pg_temp.login(pg_temp.u(2));
select results_eq(
  $$ select rank, rank_points, payout_cents, donated_cents from public.get_my_challenge_result(pg_temp.c('ranked')) $$,
  $$ values (1, 30, null::bigint, 0::bigint) $$,
  'the own ranked result shows rank, points and no payout'
);
select results_eq(
  $$ select payout_cents, donated_cents from public.get_my_challenge_result(pg_temp.c('donate')) $$,
  $$ values (4200::bigint, 1200::bigint) $$,
  'the own pool result shows the payout and how much of it was donated'
);
select is(
  (select count(*)::int from public.get_my_challenge_result(pg_temp.c('alone_win'))), 0,
  'someone who did not take part gets no result'
);
select pg_temp.logout();

-- Rights ------------------------------------------------------------------------------------------------

select pg_temp.login(pg_temp.u(1));
select throws_ok(
  $$ update public.ngos set name = 'Hacker e.V.' $$,
  '42501', null, 'NGOs cannot be changed by users'
);
select throws_ok(
  $$ update public.profiles set donate_default = true $$,
  '42501', null, 'the donation default is changed through set_donation_defaults only'
);
select ok(
  (select count(*) = 3 from public.ngos),
  'users can read the NGO list'
);
select pg_temp.logout();

select ok(
  not has_function_privilege('anon', 'public.set_donation_defaults(boolean, uuid)', 'execute')
  and not has_function_privilege('anon', 'public.get_my_donations()', 'execute'),
  'anonymous users cannot call the donation functions'
);

select * from finish();
rollback;
