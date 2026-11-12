-- Phase 4 – two modes (solo, ranked), lifecycle and settlement.
--
--   solo:   one person sets a goal and a stake. Reached → stake back (payout). Missed → the
--           stake goes to the house account (forfeit).
--   ranked: shared pool (CLAUDE.md 6.3). Winners get their stake back plus an equal share of
--           the losers' stakes; fee and rounding go to the house. Nobody wins → forfeit.
--
-- The house account only exists in the ledger (account = 'house', user_id null). Money rules
-- (CLAUDE.md, section 4): all bookings happen here, in SECURITY DEFINER functions, in one
-- transaction, append-only, integer cents.

------------------------------------------------------------------------------------------
-- Configuration
------------------------------------------------------------------------------------------

-- One row. fee_bps is copied into every new ranked challenge, so the fee of a challenge
-- never changes after people joined. Change it with:
--   update private.settings set fee_bps = 1000;   -- 10 % of the lost pot
create table private.settings (
  id boolean primary key default true,
  fee_bps integer not null default 0,
  updated_at timestamptz not null default now(),
  constraint settings_single_row check (id),
  constraint settings_fee_range check (fee_bps between 0 and 10000)
);

alter table private.settings enable row level security;
revoke all on private.settings from public, anon, authenticated;

insert into private.settings default values;

------------------------------------------------------------------------------------------
-- Modes
------------------------------------------------------------------------------------------

alter table public.challenges add column mode text not null default 'ranked';

alter table public.challenges
  add constraint challenges_mode_valid check (mode in ('solo', 'ranked'));

-- Solo challenges are private, have exactly one participant (the creator), no invite code
-- and no fee. Ranked challenges keep the phase 2 rules. min_participants may be lowered to
-- 1 for ranked challenges by an operator; the app always creates them with 2.
alter table public.challenges drop constraint challenges_min_participants;
alter table public.challenges
  add constraint challenges_participants_by_mode check (
    (mode = 'solo' and min_participants = 1 and max_participants = 1
      and visibility = 'private' and invite_code is null and fee_bps = 0)
    or (mode = 'ranked' and min_participants >= 1)
  );

alter table public.challenges drop constraint challenges_invite_code_matches_visibility;
alter table public.challenges
  add constraint challenges_invite_code_matches_visibility check (
    mode = 'solo'
    or (visibility = 'private' and invite_code ~ '^[A-HJ-NP-Z2-9]{6}$')
    or (visibility = 'public' and invite_code is null)
  );

create index challenges_due_idx on public.challenges (status, starts_at, ends_at);

------------------------------------------------------------------------------------------
-- House bookings
------------------------------------------------------------------------------------------

-- At most one fee, rounding and forfeit entry per challenge: a second settlement cannot
-- book the house share twice.
create unique index ledger_entries_one_house_entry_per_challenge
  on public.ledger_entries (challenge_id, type)
  where account = 'house';

create function private.post_house_entry(p_type text, p_amount_cents bigint, p_challenge_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_amount_cents = 0 then
    return;
  end if;
  insert into public.ledger_entries (account, user_id, challenge_id, type, amount_cents)
  values ('house', null, p_challenge_id, p_type, p_amount_cents);
end;
$$;

revoke all on function private.post_house_entry(text, bigint, uuid) from public;

------------------------------------------------------------------------------------------
-- create_challenge with a mode
------------------------------------------------------------------------------------------

drop function public.create_challenge(text, text, integer, bigint, date, integer, text, integer);

-- Creates an open challenge. Ranked: the creator does NOT join automatically. Solo: the
-- challenge is private and the creator joins in the same transaction (the stake is booked
-- right away; not enough credits → nothing is created). For solo, p_visibility is ignored.
create function public.create_challenge(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_start_date date,
  p_duration_days integer,
  p_visibility text,
  p_max_participants integer default null,
  p_mode text default 'ranked'
)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_title text := btrim(coalesce(p_title, ''));
  v_timezone text;
  v_today date;
  v_solo boolean;
  v_challenge public.challenges;
begin
  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  if p_mode is null or p_mode not in ('solo', 'ranked') then
    raise exception using errcode = 'P0001', message = 'invalid_mode';
  end if;
  v_solo := p_mode = 'solo';

  if char_length(v_title) not between 3 and 60 or v_title ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'invalid_title';
  end if;

  if p_goal_type is null or p_goal_type not in ('run_single', 'run_total', 'steps_daily') then
    raise exception using errcode = 'P0001', message = 'invalid_goal_type';
  end if;

  if p_target_value is null
     or (p_goal_type = 'run_single' and p_target_value not between 1000 and 100000)
     or (p_goal_type = 'run_total' and p_target_value not between 1000 and 500000)
     or (p_goal_type = 'steps_daily' and p_target_value not between 1000 and 50000) then
    raise exception using errcode = 'P0001', message = 'invalid_target_value';
  end if;

  if p_stake_cents is null or p_stake_cents not between 100 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;

  -- Earliest tomorrow (nobody could join a challenge that already started), latest in 30 days.
  if p_start_date is null or p_start_date <= v_today or p_start_date > v_today + 30 then
    raise exception using errcode = 'P0001', message = 'invalid_start_date';
  end if;

  if p_duration_days is null or p_duration_days not between 1 and 42 then
    raise exception using errcode = 'P0001', message = 'invalid_duration';
  end if;

  if not v_solo and (p_visibility is null or p_visibility not in ('public', 'private')) then
    raise exception using errcode = 'P0001', message = 'invalid_visibility';
  end if;

  if p_max_participants is not null
     and (v_solo or p_max_participants not between 2 and 1000) then
    raise exception using errcode = 'P0001', message = 'invalid_max_participants';
  end if;

  insert into public.challenges (
    creator_id, title, goal_type, target_value, stake_cents, fee_bps, timezone,
    starts_at, ends_at, min_participants, max_participants, visibility, invite_code,
    status, mode
  )
  values (
    v_user_id,
    v_title,
    p_goal_type,
    p_target_value,
    p_stake_cents,
    case when v_solo then 0 else (select s.fee_bps from private.settings s) end,
    v_timezone,
    p_start_date::timestamp at time zone v_timezone,
    (p_start_date + p_duration_days)::timestamp at time zone v_timezone,
    case when v_solo then 1 else 2 end,
    case when v_solo then 1 else p_max_participants end,
    case when v_solo then 'private' else p_visibility end,
    case when not v_solo and p_visibility = 'private' then private.generate_invite_code() end,
    'open',
    p_mode
  )
  returning * into v_challenge;

  if v_solo then
    perform private.join(v_challenge.id, v_user_id);
    select c.* into v_challenge from public.challenges c where c.id = v_challenge.id;
  end if;

  return v_challenge;
end;
$$;

revoke all on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer, text)
  from public, anon;
grant execute on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer, text)
  to authenticated;

------------------------------------------------------------------------------------------
-- Lifecycle (CLAUDE.md 6.1)
------------------------------------------------------------------------------------------

-- Number of local days of a challenge (= days needed for steps_daily).
create function private.challenge_days(c public.challenges)
returns integer
language sql
stable
set search_path = ''
as $$
  select (c.ends_at at time zone c.timezone)::date - (c.starts_at at time zone c.timezone)::date;
$$;

revoke all on function private.challenge_days(public.challenges) from public;

-- open → active (enough participants) or cancelled (everybody gets a refund).
create function private.start_challenge(p_challenge_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  c public.challenges;
  p public.challenge_participants;
begin
  select * into c from public.challenges where id = p_challenge_id for update;
  if c.id is null or c.status <> 'open' or now() < c.starts_at then
    return;
  end if;

  if c.participant_count >= c.min_participants then
    update public.challenges set status = 'active' where id = c.id;
    return;
  end if;

  for p in
    select * from public.challenge_participants
     where challenge_id = c.id and result = 'pending'
     order by user_id
  loop
    perform private.post_user_entry(p.user_id, 'refund', p.stake_cents, c.id);
    update public.challenge_participants
       set result = 'refunded', payout_cents = p.stake_cents
     where challenge_id = c.id and user_id = p.user_id;
  end loop;

  update public.challenges set status = 'cancelled' where id = c.id;
end;
$$;

revoke all on function private.start_challenge(uuid) from public;

------------------------------------------------------------------------------------------
-- Settlement (CLAUDE.md 6.3)
------------------------------------------------------------------------------------------

-- Settles a challenge exactly once. Returns false (and changes nothing) unless the challenge
-- is 'settling' and the sync grace period is over – a second call is therefore a no-op.
--
--   S = stake, W = winners, L = losers
--   lost_pot = L * S, fee = floor(lost_pot * fee_bps / 10000), distributable = lost_pot - fee
--   W > 0: bonus = floor(distributable / W), every winner gets S + bonus,
--          fee and rounding (= distributable - bonus * W) go to the house.
--   W = 0: all stakes go to the house (forfeit).
--
-- Solo is the same formula with one participant: reached → S back, missed → forfeit S.
-- Rounding is always in favour of the house (winners get the floor).
create function public.settle_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_days integer;
  v_winners bigint;
  v_losers bigint;
  v_lost_pot bigint;
  v_fee bigint;
  v_distributable bigint;
  v_bonus bigint;
  v_rounding bigint;
  v_user_id uuid;
begin
  select * into c from public.challenges where id = p_challenge_id for update;

  if c.id is null
     or c.status <> 'settling'
     or now() < c.ends_at + make_interval(hours => c.sync_grace_hours) then
    return false;
  end if;

  -- 1. Final progress from the synced activities, then success / failed.
  perform private.recompute_health_progress(c.id);
  v_days := private.challenge_days(c);

  update public.challenge_participants cp
     set result = case
           when (c.goal_type = 'steps_daily' and cp.progress_value >= v_days)
             or (c.goal_type <> 'steps_daily' and cp.progress_value >= c.target_value)
             then 'success'
           else 'failed'
         end
   where cp.challenge_id = c.id and cp.result = 'pending';

  select count(*) filter (where result = 'success'), count(*) filter (where result = 'failed')
    into v_winners, v_losers
    from public.challenge_participants
   where challenge_id = c.id;

  -- 2. Integer arithmetic in cents.
  v_lost_pot := v_losers * c.stake_cents;

  if v_winners > 0 then
    v_fee := (v_lost_pot * c.fee_bps) / 10000;
    v_distributable := v_lost_pot - v_fee;
    v_bonus := v_distributable / v_winners;
    v_rounding := v_distributable - v_bonus * v_winners;

    -- 3. Bookings. Fixed order (by user id) keeps wallet locks deadlock-free.
    for v_user_id in
      select user_id from public.challenge_participants
       where challenge_id = c.id and result = 'success'
       order by user_id
    loop
      perform private.post_user_entry(v_user_id, 'payout', c.stake_cents + v_bonus, c.id);
    end loop;

    update public.challenge_participants
       set payout_cents = c.stake_cents + v_bonus
     where challenge_id = c.id and result = 'success';

    perform private.post_house_entry('fee', v_fee, c.id);
    perform private.post_house_entry('rounding', v_rounding, c.id);
  else
    perform private.post_house_entry('forfeit', v_lost_pot, c.id);
  end if;

  update public.challenge_participants
     set payout_cents = 0
   where challenge_id = c.id and result = 'failed';

  update public.challenges set status = 'settled', settled_at = now() where id = c.id;
  return true;
end;
$$;

-- Moves every due challenge one or more steps forward. Runs every 5 minutes (pg_cron) and
-- is safe to run at any time and in parallel: every step locks its challenge and re-checks.
create function public.advance_challenges()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_changed integer := 0;
begin
  for v_id in
    select id from public.challenges
     where status = 'open' and starts_at <= now()
     order by id
  loop
    perform private.start_challenge(v_id);
    v_changed := v_changed + 1;
  end loop;

  for v_id in
    select id from public.challenges
     where status = 'active' and ends_at <= now()
     order by id
  loop
    update public.challenges set status = 'settling'
     where id = v_id and status = 'active' and ends_at <= now();
    v_changed := v_changed + 1;
  end loop;

  for v_id in
    select id from public.challenges
     where status = 'settling' and ends_at + make_interval(hours => sync_grace_hours) <= now()
     order by id
  loop
    if public.settle_challenge(v_id) then
      v_changed := v_changed + 1;
    end if;
  end loop;

  return v_changed;
end;
$$;

-- Only the scheduler (and operators) may move challenges or settle them.
revoke all on function public.settle_challenge(uuid) from public, anon, authenticated;
revoke all on function public.advance_challenges() from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Ranking (ranked mode, display only)
------------------------------------------------------------------------------------------

-- Participants see the order and who reached the goal, never the progress values of others
-- (no health details). Equal progress shares a rank. Nothing is paid by rank.
create function public.get_leaderboard(p_challenge_id uuid)
returns table (rank integer, user_id uuid, display_name text, is_me boolean, goal_reached boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by cp.progress_value desc))::integer,
         cp.user_id,
         p.display_name,
         cp.user_id = (select auth.uid()),
         case
           when c.goal_type = 'steps_daily' then cp.progress_value >= private.challenge_days(c)
           else cp.progress_value >= c.target_value
         end
    from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
    join public.profiles p on p.id = cp.user_id
   where c.id = p_challenge_id
     and c.mode = 'ranked'
     and c.status in ('active', 'settling', 'settled')
     and private.is_participant(c.id)
   order by 1, p.display_name;
$$;

revoke all on function public.get_leaderboard(uuid) from public, anon;
grant execute on function public.get_leaderboard(uuid) to authenticated;

------------------------------------------------------------------------------------------
-- Scheduler
------------------------------------------------------------------------------------------

create extension if not exists pg_cron with schema pg_catalog;

select cron.schedule('advance-challenges', '*/5 * * * *', 'select public.advance_challenges()');
