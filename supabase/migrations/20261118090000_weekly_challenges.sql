-- Phase 7, part 2 – weekly challenges.
-- Every Sunday pg_cron creates one public ranked challenge for the coming week (Monday 00:00
-- to Monday 00:00, Europe/Berlin). The week is identified by weekly_key (e.g. '2026-W47')
-- which is unique, so running the job twice never creates a second challenge.

alter table public.challenges add column weekly_key text null;

alter table public.challenges
  add constraint challenges_weekly_key_unique unique (weekly_key);

-- Weekly challenges belong to the platform (no creator) and are always public and ranked.
alter table public.challenges
  add constraint challenges_weekly_shape check (
    weekly_key is null
    or (creator_id is null and mode = 'ranked' and visibility = 'public'
        and weekly_key ~ '^[0-9]{4}-W[0-9]{2}$')
  );

-- Creates the challenge of the next week if it does not exist yet. Returns its id, or NULL
-- if it already existed. p_now only exists so tests can pick the day; the job passes nothing.
create function public.create_weekly_challenge(p_now timestamptz default now())
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_timezone constant text := 'Europe/Berlin';
  v_today date := (p_now at time zone c_timezone)::date;
  -- The Monday after today: Sunday → tomorrow, any other day → the coming Monday.
  v_monday date := v_today + (8 - extract(isodow from v_today)::integer);
  v_id uuid;
begin
  insert into public.challenges (
    creator_id, title, goal_type, target_value, stake_cents, fee_bps, timezone,
    starts_at, ends_at, min_participants, max_participants, visibility, invite_code,
    status, mode, weekly_key
  )
  values (
    null,
    '10 km diese Woche',
    'run_total',
    10000,
    500,
    (select s.fee_bps from private.settings s),
    c_timezone,
    v_monday::timestamp at time zone c_timezone,
    (v_monday + 7)::timestamp at time zone c_timezone,
    2,
    null,
    'public',
    null,
    'open',
    'ranked',
    to_char(v_monday, 'IYYY"-W"IW')
  )
  on conflict (weekly_key) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- Only the scheduler (and operators) create weekly challenges; clients cannot.
revoke all on function public.create_weekly_challenge(timestamptz) from public, anon, authenticated;

-- Sundays 08:00 UTC (09:00 or 10:00 in Berlin): plenty of time to join before Monday.
select cron.schedule('create-weekly-challenge', '0 8 * * 0', 'select public.create_weekly_challenge()');
