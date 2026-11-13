-- Plays a pool, a pool for one, a ranked challenge and three personal goals of one period in
-- time-lapse up to the settlement.
-- LOCAL DEVELOPMENT ONLY. Needs the seed users (run `npm run db:reset` first).
--
-- Run (see docs/SETUP.md, section 5.9):
--   Get-Content supabase\scripts\simulate_challenge.sql | docker exec -i supabase_db_push psql -U postgres -d postgres
--
-- What happens:
--   Pool "Simulation 5 km": Anna stakes 10.00, Ben and Clara 5.00 each.
--     Anna runs 6.2 km, Ben 5.1 km, Clara enters 10 km by hand (does not count).
--     → Clara's 5.00 is shared in proportion to the stakes: Anna gets 10.00 + 3.33, Ben
--       5.00 + 1.66 (1 cent rounding goes to the house). Anna donates her share to NGO 1.
--   Pool for one "Simulation Solo" (stake 3.00, 10 km in total) by Ben: 5.1 + 4 = 9.1 km → the
--     3.00 go to the house.
--   Personal goals for tomorrow ("Ziel"): Anna 5 km (stake 3.00), Ben 10 km (5.00), Clara 5 km
--     (5.00). Anna reaches hers (6.2 km), Ben (9.1 km) and Clara (nothing) miss. Both missed
--     stakes (10.00) go to Anna, the only winner of the period: she gets 3.00 + 10.00.
--     Every goal sums to 0 in the ledger (the winner's share is a house debit).
--   Ranked "Simulation Rangliste" (no stake, most kilometres): Ben 1st (9.1 km), Anna 2nd → rank points,
--     no credits move.
-- Everything is booked by the real functions; the script only moves the clock (dates).

begin;

\set ON_ERROR_STOP on
\pset footer off

create function pg_temp.as_user(p_email text)
returns void
language sql
as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', (select id from auth.users where email = p_email),
                      'role', 'authenticated')::text, true);
$$;

-- Activities at the given point in time, synced the way the app does it.
create function pg_temp.run(p_email text, p_id text, p_start timestamptz, p_m integer,
  p_manual boolean default false)
returns integer
language sql
as $$
  select pg_temp.as_user(p_email);
  select public.sync_workouts(jsonb_build_array(jsonb_build_object(
    'platform', 'android', 'source_record_id', p_id, 'source_name', 'Simulation',
    'activity_type', 'running', 'start_at', p_start,
    'end_at', p_start + make_interval(secs => p_m * 6 / 10),
    'distance_m', p_m, 'duration_s', p_m * 6 / 10, 'was_user_entered', p_manual)));
$$;

create temp table sim (name text primary key, id uuid);

\echo '== 1. Anlegen und beitreten (Challenges starten morgen) =='

select pg_temp.as_user('ben@example.com');
insert into sim select 'ranked', (public.create_challenge('Simulation 5 km', 'run_single', 5000,
  500, (now() at time zone 'Europe/Berlin')::date + 1, 3, 'public')).id;
insert into sim select 'solo', (public.create_challenge('Simulation Solo', 'run_total', 10000,
  300, (now() at time zone 'Europe/Berlin')::date + 1, 3, 'private')).id;

select public.join_challenge((select id from sim where name = 'ranked'));
select public.join_challenge((select id from sim where name = 'solo'));
select pg_temp.as_user('anna@example.com');
select public.join_challenge((select id from sim where name = 'ranked'), 1000);
select public.set_challenge_donation((select id from sim where name = 'ranked'), true,
  '00000000-0000-4000-a000-000000000001');
select pg_temp.as_user('clara@example.com');
select public.join_challenge((select id from sim where name = 'ranked'));

-- Personal goals: the stake is booked at once.
select pg_temp.as_user('anna@example.com');
insert into sim select 'ziel_anna', (public.create_goal('Simulation Ziel Anna', 'run_total', 5000, 300, 'day')).id;
select pg_temp.as_user('ben@example.com');
insert into sim select 'ziel_ben', (public.create_goal('Simulation Ziel Ben', 'run_total', 10000, 500, 'day')).id;
select pg_temp.as_user('clara@example.com');
insert into sim select 'ziel_clara', (public.create_goal('Simulation Ziel Clara', 'run_total', 5000, 500, 'day')).id;
select set_config('request.jwt.claims', '', true);

-- A ranked challenge (the platform creates them; here one is inserted directly).
with c as (
  insert into public.challenges (creator_id, title, goal_type, target_value, stake_cents, fee_bps,
    starts_at, ends_at, min_participants, visibility, status, mode)
  values (null, 'Simulation Rangliste', 'run_total', 5000, 0, 0,
    ((now() at time zone 'Europe/Berlin')::date + 1)::timestamp at time zone 'Europe/Berlin',
    ((now() at time zone 'Europe/Berlin')::date + 4)::timestamp at time zone 'Europe/Berlin',
    2, 'public', 'open', 'ranked')
  returning id)
insert into sim select 'rangliste', id from c;
select pg_temp.as_user('ben@example.com');
select public.join_challenge((select id from sim where name = 'rangliste'));
select pg_temp.as_user('anna@example.com');
select public.join_challenge((select id from sim where name = 'rangliste'));
select set_config('request.jwt.claims', '', true);

select c.title, c.mode, c.status, c.participant_count as teilnehmer, c.pot_cents as topf_cent
  from public.challenges c join sim on sim.id = c.id order by c.title;

\echo '== 2. Zeitraffer: der Zeitraum hat vor 2 Tagen begonnen -> advance_challenges =='

update public.challenges
   set starts_at = now() - interval '2 days', ends_at = now() + interval '1 day'
 where id in (select id from sim);

select public.advance_challenges() as geaenderte_challenges;

select c.title, c.status from public.challenges c join sim on sim.id = c.id order by c.title;

\echo '== 3. Laeufe werden synchronisiert =='

select pg_temp.run('anna@example.com', 'sim-anna', now() - interval '30 hours', 6200);
select pg_temp.run('ben@example.com', 'sim-ben', now() - interval '20 hours', 5100);
select pg_temp.run('clara@example.com', 'sim-clara', now() - interval '10 hours', 10000, true);
select pg_temp.run('ben@example.com', 'sim-ben-solo', now() - interval '5 hours', 4000);
select set_config('request.jwt.claims', '', true);

select p.display_name as name, w.distance_m as meter, w.is_valid as gueltig, w.invalid_reason as grund
  from public.activity_workouts w join public.profiles p on p.id = w.user_id
 where w.source_name = 'Simulation' order by w.start_at;

\echo '== 4. Zeitraffer: Zeitraum vorbei -> settling (Kulanzzeit fuer spaete Syncs) =='

update public.challenges
   set ends_at = now() - interval '1 minute'
 where id in (select id from sim);

select public.advance_challenges() as geaenderte_challenges;
select c.title, c.status from public.challenges c join sim on sim.id = c.id order by c.title;

\echo '== 5. Zeitraffer: Kulanzzeit vorbei -> Abrechnung =='

update public.challenges set sync_grace_hours = 0 where id in (select id from sim);

select public.advance_challenges() as geaenderte_challenges;

select c.title, c.status, p.display_name as name, cp.result as ergebnis,
       cp.stake_cents as einsatz_cent, cp.payout_cents as auszahlung_cent,
       cp.donated_cents as gespendet_cent, cp.rank as platz, cp.rank_points as punkte
  from public.challenge_participants cp
  join public.challenges c on c.id = cp.challenge_id
  join public.profiles p on p.id = cp.user_id
 where c.id in (select id from sim)
 order by c.title, cp.result desc, p.display_name;

\echo '== 6. Buchungen (Summe je Challenge muss 0 sein) =='

select c.title, le.account as konto, coalesce(p.display_name, 'Haus') as name, le.type as art,
       le.amount_cents as betrag_cent
  from public.ledger_entries le
  join public.challenges c on c.id = le.challenge_id
  left join public.profiles p on p.id = le.user_id
 where c.id in (select id from sim)
 order by c.title, le.account desc, le.type, name;

select c.title, sum(le.amount_cents) as summe_cent
  from public.ledger_entries le join public.challenges c on c.id = le.challenge_id
 where c.id in (select id from sim) group by c.title order by c.title;

\echo '== 7. Zweiter Aufruf von settle_challenge aendert nichts (Idempotenz) =='

select public.settle_challenge(id) as erneut_abgerechnet from sim order by name;

\echo '== 8. Spenden der NGOs (Summe je NGO) =='

select n.name, sum(le.amount_cents) as erhalten_cent
  from public.ledger_entries le join public.ngos n on n.id = le.ngo_id
 where le.account = 'donation' and le.challenge_id in (select id from sim) group by n.name;

commit;

\echo 'Fertig. In der App: Pool bzw. Ranked -> Abgeschlossen, das Wallet und Profil -> Spenden.'
