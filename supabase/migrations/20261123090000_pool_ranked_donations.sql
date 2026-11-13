-- Ausbau, part 2 – new game model.
--
--   ranked  Pure leaderboard, NO stake, no credits move. Rank, points and badges only.
--           (the weekly challenge is ranked now)
--   pool    The former "ranked" pool and "solo" in one mode: several participants, same goal,
--           same period. Everybody pays a stake into one pot.
--             reached the goal  → the own stake back, plus a share of the stakes of those who
--                                 did not: share = floor(distributable * stake / winner stakes)
--             missed the goal   → the stake goes into the pot
--             fee               → fee_bps of the lost pot to the house (as before)
--             rounding          → always to the house (winners get the floor)
--             nobody reached it → every stake goes to the house (forfeit)
--             alone in the pool → reached: stake back, missed: stake to the house
--           The sum of all bookings of a challenge stays 0.
--   donation  Each winner decides whether the SHARE (not the stake) is donated to an NGO.
--           Default in the profile, changeable per challenge until the settlement. A donation
--           is two ledger entries: the user's debit and a credit on the NGO's account.
--
-- Existing data: old "ranked" challenges (with stakes) become "pool", old "solo" challenges
-- become pools that others can join with an invite code. Old weekly challenges lose their
-- weekly key (they were pools with stakes); new ones are ranked without stake.

------------------------------------------------------------------------------------------
-- NGOs (placeholders)
------------------------------------------------------------------------------------------

create table public.ngos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  sort_order integer not null,
  active boolean not null default true,
  constraint ngos_name_length check (char_length(name) between 3 and 60)
);

alter table public.ngos enable row level security;
revoke all on public.ngos from anon, authenticated;
grant select on public.ngos to authenticated;
create policy "ngos: signed-in users read the active list"
  on public.ngos for select
  to authenticated
  using (active);

-- Placeholders only: no real names or logos until partners are agreed.
insert into public.ngos (id, slug, name, sort_order) values
  ('00000000-0000-4000-a000-000000000001', 'ngo-partner-1', 'NGO-Partner 1', 1),
  ('00000000-0000-4000-a000-000000000002', 'ngo-partner-2', 'NGO-Partner 2', 2),
  ('00000000-0000-4000-a000-000000000003', 'ngo-partner-3', 'NGO-Partner 3', 3);

alter table public.profiles
  add column donate_default boolean not null default false,
  add column default_ngo_id uuid null references public.ngos (id) on delete set null;

------------------------------------------------------------------------------------------
-- Challenges: modes ranked / pool, new goal type
------------------------------------------------------------------------------------------

alter table public.challenges drop constraint challenges_mode_valid;
alter table public.challenges drop constraint challenges_participants_by_mode;
alter table public.challenges drop constraint challenges_invite_code_matches_visibility;
alter table public.challenges drop constraint challenges_stake_range;
alter table public.challenges drop constraint challenges_goal_type_valid;
alter table public.challenges drop constraint challenges_target_value_range;
alter table public.challenges drop constraint challenges_weekly_shape;

update public.challenges set weekly_key = null where weekly_key is not null;
update public.challenges set mode = 'pool' where mode = 'ranked';
update public.challenges
   set mode = 'pool',
       max_participants = null,
       invite_code = private.generate_invite_code()
 where mode = 'solo';

alter table public.challenges
  add constraint challenges_mode_valid check (mode in ('ranked', 'pool'));
alter table public.challenges
  add constraint challenges_goal_type_valid check (
    goal_type in ('run_single', 'run_total', 'steps_daily', 'steps_total')
  );
alter table public.challenges
  add constraint challenges_target_value_range check (
    (goal_type = 'run_single' and target_value between 1000 and 100000)
    or (goal_type = 'run_total' and target_value between 1000 and 500000)
    or (goal_type = 'steps_daily' and target_value between 1000 and 50000)
    or (goal_type = 'steps_total' and target_value between 5000 and 2000000)
  );
alter table public.challenges
  add constraint challenges_stake_by_mode check (
    (mode = 'ranked' and stake_cents = 0 and fee_bps = 0)
    or (mode = 'pool' and stake_cents between 100 and 5000)
  );
alter table public.challenges
  add constraint challenges_participants_by_mode check (min_participants >= 1);
alter table public.challenges
  add constraint challenges_invite_code_matches_visibility check (
    (visibility = 'private' and invite_code ~ '^[A-HJ-NP-Z2-9]{6}$')
    or (visibility = 'public' and invite_code is null)
  );
alter table public.challenges
  add constraint challenges_weekly_shape check (
    weekly_key is null
    or (creator_id is null and mode = 'ranked' and visibility = 'public'
        and weekly_key ~ '^[0-9]{4}-W[0-9]{2}$')
  );

------------------------------------------------------------------------------------------
-- Participants: stake may be 0 (ranked), donation choice, rank
------------------------------------------------------------------------------------------

alter table public.challenge_participants drop constraint challenge_participants_stake_positive;
alter table public.challenge_participants
  add constraint challenge_participants_stake_not_negative check (stake_cents >= 0);

alter table public.challenge_participants
  -- NULL = use the default of the profile.
  add column donate boolean null,
  add column ngo_id uuid null references public.ngos (id) on delete set null,
  add column donated_cents bigint not null default 0,
  -- Ranked only, set at the settlement.
  add column rank integer null,
  add column rank_points integer not null default 0,
  add constraint challenge_participants_donated_not_negative check (donated_cents >= 0),
  add constraint challenge_participants_rank_points_not_negative check (rank_points >= 0);

------------------------------------------------------------------------------------------
-- Ledger: donation accounts
------------------------------------------------------------------------------------------

alter table public.ledger_entries drop constraint ledger_entries_account_valid;
alter table public.ledger_entries drop constraint ledger_entries_type_valid;
alter table public.ledger_entries
  add column ngo_id uuid null references public.ngos (id) on delete restrict;
alter table public.ledger_entries
  add constraint ledger_entries_account_valid check (account in ('user', 'house', 'donation'));
alter table public.ledger_entries
  add constraint ledger_entries_type_valid check (
    type in ('signup_bonus', 'stake', 'payout', 'refund', 'fee', 'rounding', 'forfeit', 'donation')
  );
alter table public.ledger_entries
  add constraint ledger_entries_donation_has_ngo check (
    (ngo_id is null or type = 'donation')
    and (account <> 'donation' or ngo_id is not null)
    and (type <> 'donation' or ngo_id is not null)
  );

-- One donation per user and challenge (the user's side) …
drop index public.ledger_entries_one_per_challenge_and_type;
create unique index ledger_entries_one_per_challenge_and_type
  on public.ledger_entries (user_id, challenge_id, type)
  where type in ('stake', 'payout', 'refund', 'donation');

-- … and one summed credit per NGO and challenge (the NGO's side; donors stay anonymous there).
create unique index ledger_entries_one_donation_per_ngo_and_challenge
  on public.ledger_entries (challenge_id, ngo_id, type)
  where account = 'donation';

create index ledger_entries_ngo_idx on public.ledger_entries (ngo_id) where ngo_id is not null;

-- post_user_entry gets an optional NGO for the user's side of a donation.
drop function private.post_user_entry(uuid, text, bigint, uuid);
create function private.post_user_entry(
  p_user_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_challenge_id uuid default null,
  p_ngo_id uuid default null
)
returns public.ledger_entries
language plpgsql
set search_path = ''
as $$
declare
  v_balance bigint;
  v_entry public.ledger_entries;
begin
  select w.balance_cents
    into v_balance
    from public.wallets w
   where w.user_id = p_user_id
     for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'wallet_not_found';
  end if;

  if v_balance + p_amount_cents < 0 then
    raise exception using errcode = 'P0001', message = 'insufficient_funds';
  end if;

  update public.wallets
     set balance_cents = v_balance + p_amount_cents,
         updated_at = now()
   where user_id = p_user_id;

  insert into public.ledger_entries (account, user_id, challenge_id, type, amount_cents, ngo_id)
  values ('user', p_user_id, p_challenge_id, p_type, p_amount_cents, p_ngo_id)
  returning * into v_entry;

  return v_entry;
end;
$$;

revoke all on function private.post_user_entry(uuid, text, bigint, uuid, uuid) from public;

create function private.post_donation_entry(p_ngo_id uuid, p_amount_cents bigint, p_challenge_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_amount_cents = 0 then
    return;
  end if;
  insert into public.ledger_entries (account, user_id, challenge_id, type, amount_cents, ngo_id)
  values ('donation', null, p_challenge_id, 'donation', p_amount_cents, p_ngo_id);
end;
$$;

revoke all on function private.post_donation_entry(uuid, bigint, uuid) from public;

------------------------------------------------------------------------------------------
-- Joining and leaving
------------------------------------------------------------------------------------------

drop function private."join"(uuid, uuid);
create function private."join"(p_challenge_id uuid, p_user_id uuid, p_stake_cents bigint default null)
returns public.challenge_participants
language plpgsql
set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_participant public.challenge_participants;
  v_stake bigint;
begin
  select c.* into v_challenge
    from public.challenges c
   where c.id = p_challenge_id
     for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'challenge_not_found';
  end if;

  if v_challenge.status <> 'open' or now() >= v_challenge.starts_at then
    raise exception using errcode = 'P0001', message = 'challenge_not_open';
  end if;

  if exists (
    select 1 from public.challenge_participants cp
     where cp.challenge_id = p_challenge_id and cp.user_id = p_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'already_joined';
  end if;

  -- The unique index allows only one stake per user and challenge, so leaving a pool is final.
  if exists (
    select 1 from public.ledger_entries le
     where le.challenge_id = p_challenge_id and le.user_id = p_user_id and le.type = 'stake'
  ) then
    raise exception using errcode = 'P0001', message = 'cannot_rejoin';
  end if;

  if v_challenge.max_participants is not null
     and v_challenge.participant_count >= v_challenge.max_participants then
    raise exception using errcode = 'P0001', message = 'challenge_full';
  end if;

  -- Ranked: no stake at all. Pool: everybody chooses the own stake (default: the one of the
  -- challenge), within the same limits as a challenge.
  v_stake := case when v_challenge.mode = 'ranked' then 0
                  else coalesce(p_stake_cents, v_challenge.stake_cents) end;
  if v_challenge.mode = 'pool' and v_stake not between 100 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;

  if v_stake > 0 then
    perform private.post_user_entry(p_user_id, 'stake', -v_stake, p_challenge_id);
  end if;

  insert into public.challenge_participants (challenge_id, user_id, stake_cents)
  values (p_challenge_id, p_user_id, v_stake)
  returning * into v_participant;

  update public.challenges
     set participant_count = participant_count + 1
   where id = p_challenge_id;

  return v_participant;
end;
$$;

revoke all on function private."join"(uuid, uuid, bigint) from public;

drop function public.join_challenge(uuid);
drop function public.join_challenge_by_code(text);

create function public.join_challenge(p_challenge_id uuid, p_stake_cents bigint default null)
returns public.challenge_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if not exists (
    select 1 from public.challenges c
     where c.id = p_challenge_id
       and (c.visibility = 'public' or c.creator_id = v_user_id)
  ) then
    raise exception using errcode = 'P0001', message = 'challenge_not_found';
  end if;

  return private."join"(p_challenge_id, v_user_id, p_stake_cents);
end;
$$;

create function public.join_challenge_by_code(p_code text, p_stake_cents bigint default null)
returns public.challenge_participants
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_challenge_id uuid;
begin
  select c.id into v_challenge_id
    from public.challenges c
   where c.invite_code = upper(btrim(coalesce(p_code, '')));

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_invite_code';
  end if;

  return private."join"(v_challenge_id, v_user_id, p_stake_cents);
end;
$$;

revoke all on function public.join_challenge(uuid, bigint) from public, anon;
revoke all on function public.join_challenge_by_code(text, bigint) from public, anon;
grant execute on function public.join_challenge(uuid, bigint) to authenticated;
grant execute on function public.join_challenge_by_code(text, bigint) to authenticated;

-- Leaves an open challenge before it starts. A pool stake is refunded in full (leaving a pool
-- is final); a ranked challenge has no stake. Returns the refunded amount in cents.
drop function public.leave_challenge(uuid);
create function public.leave_challenge(p_challenge_id uuid)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_challenge public.challenges;
  v_participant public.challenge_participants;
begin
  select c.* into v_challenge
    from public.challenges c
   where c.id = p_challenge_id
     for update;

  select cp.* into v_participant
    from public.challenge_participants cp
   where cp.challenge_id = p_challenge_id and cp.user_id = v_user_id;

  if v_challenge.id is null or v_participant.user_id is null then
    raise exception using errcode = 'P0001', message = 'not_joined';
  end if;

  if v_challenge.status <> 'open' or now() >= v_challenge.starts_at then
    raise exception using errcode = 'P0001', message = 'challenge_not_open';
  end if;

  delete from public.challenge_participants
   where challenge_id = p_challenge_id and user_id = v_user_id;

  update public.challenges
     set participant_count = participant_count - 1
   where id = p_challenge_id;

  if v_participant.stake_cents > 0 then
    perform private.post_user_entry(v_user_id, 'refund', v_participant.stake_cents, p_challenge_id);
  end if;
  return v_participant.stake_cents;
end;
$$;

revoke all on function public.leave_challenge(uuid) from public, anon;
grant execute on function public.leave_challenge(uuid) to authenticated;

------------------------------------------------------------------------------------------
-- Creating challenges
------------------------------------------------------------------------------------------

-- Ranked: no stake (p_stake_cents is ignored), at least 2 participants.
-- Pool: stake 1.00–50.00 as the suggestion for everybody, a pool can run with one person.
-- The creator does NOT join automatically in either mode.
drop function public.create_challenge(text, text, integer, bigint, date, integer, text, integer, text);
create function public.create_challenge(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_start_date date,
  p_duration_days integer,
  p_visibility text,
  p_max_participants integer default null,
  p_mode text default 'pool'
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
  v_ranked boolean;
  v_challenge public.challenges;
begin
  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  if p_mode is null or p_mode not in ('ranked', 'pool') then
    raise exception using errcode = 'P0001', message = 'invalid_mode';
  end if;
  v_ranked := p_mode = 'ranked';

  if char_length(v_title) not between 3 and 60 or v_title ~ '[[:cntrl:]]' then
    raise exception using errcode = 'P0001', message = 'invalid_title';
  end if;

  if p_goal_type is null
     or p_goal_type not in ('run_single', 'run_total', 'steps_daily', 'steps_total') then
    raise exception using errcode = 'P0001', message = 'invalid_goal_type';
  end if;

  if p_target_value is null
     or (p_goal_type = 'run_single' and p_target_value not between 1000 and 100000)
     or (p_goal_type = 'run_total' and p_target_value not between 1000 and 500000)
     or (p_goal_type = 'steps_daily' and p_target_value not between 1000 and 50000)
     or (p_goal_type = 'steps_total' and p_target_value not between 5000 and 2000000) then
    raise exception using errcode = 'P0001', message = 'invalid_target_value';
  end if;

  if not v_ranked and (p_stake_cents is null or p_stake_cents not between 100 and 5000) then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;

  -- Earliest tomorrow (nobody could join a challenge that already started), latest in 30 days.
  if p_start_date is null or p_start_date <= v_today or p_start_date > v_today + 30 then
    raise exception using errcode = 'P0001', message = 'invalid_start_date';
  end if;

  if p_duration_days is null or p_duration_days not between 1 and 42 then
    raise exception using errcode = 'P0001', message = 'invalid_duration';
  end if;

  if p_visibility is null or p_visibility not in ('public', 'private') then
    raise exception using errcode = 'P0001', message = 'invalid_visibility';
  end if;

  if p_max_participants is not null and p_max_participants not between 2 and 1000 then
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
    case when v_ranked then 0 else p_stake_cents end,
    case when v_ranked then 0 else (select s.fee_bps from private.settings s) end,
    v_timezone,
    p_start_date::timestamp at time zone v_timezone,
    (p_start_date + p_duration_days)::timestamp at time zone v_timezone,
    case when v_ranked then 2 else 1 end,
    p_max_participants,
    p_visibility,
    case when p_visibility = 'private' then private.generate_invite_code() end,
    'open',
    p_mode
  )
  returning * into v_challenge;

  return v_challenge;
end;
$$;

revoke all on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer, text)
  from public, anon;
grant execute on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer, text)
  to authenticated;

-- The weekly challenge: ranked, no stake.
create or replace function public.create_weekly_challenge(p_now timestamptz default now())
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
    0,
    0,
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

------------------------------------------------------------------------------------------
-- Lifecycle
------------------------------------------------------------------------------------------

create or replace function private.start_challenge(p_challenge_id uuid)
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
    if p.stake_cents > 0 then
      perform private.post_user_entry(p.user_id, 'refund', p.stake_cents, c.id);
    end if;
    update public.challenge_participants
       set result = 'refunded', payout_cents = p.stake_cents
     where challenge_id = c.id and user_id = p.user_id;
  end loop;

  update public.challenges set status = 'cancelled' where id = c.id;
end;
$$;

------------------------------------------------------------------------------------------
-- Progress: the new goal type
------------------------------------------------------------------------------------------

create or replace function private.recompute_health_progress(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge_id for update;
  if c.id is null or c.status not in ('active', 'settling') then return; end if;
  update public.challenge_participants cp set progress_value = case c.goal_type
    when 'run_single' then coalesce((
      select max(w.distance_m) from public.activity_workouts w
      where w.user_id = cp.user_id and w.is_valid and not w.was_user_entered
        and w.start_at >= c.starts_at and w.start_at < c.ends_at), 0)
    when 'run_total' then least(2147483647, coalesce((
      select sum(w.distance_m) from public.activity_workouts w
      where w.user_id = cp.user_id and w.is_valid and not w.was_user_entered
        and w.start_at >= c.starts_at and w.start_at < c.ends_at), 0))::integer
    when 'steps_daily' then (
      select count(*)::integer from public.activity_daily_steps s
      join public.profiles p on p.id = s.user_id
      where s.user_id = cp.user_id and p.timezone = c.timezone and s.is_valid
        and s.steps >= c.target_value
        and s.date >= (c.starts_at at time zone c.timezone)::date
        and s.date < (c.ends_at at time zone c.timezone)::date)
    when 'steps_total' then least(2147483647, coalesce((
      select sum(s.steps) from public.activity_daily_steps s
      join public.profiles p on p.id = s.user_id
      where s.user_id = cp.user_id and p.timezone = c.timezone and s.is_valid
        and s.date >= (c.starts_at at time zone c.timezone)::date
        and s.date < (c.ends_at at time zone c.timezone)::date), 0))::integer
    else 0 end
  where cp.challenge_id = c.id;
end;
$$;

------------------------------------------------------------------------------------------
-- Settlement
------------------------------------------------------------------------------------------

-- Settles a challenge exactly once. Returns false (and changes nothing) unless the challenge
-- is 'settling' and the sync grace period is over – a second call is therefore a no-op.
--
-- Ranked: results (goal reached or not), rank and rank points. No credits move.
--
-- Pool (S_i = stake of participant i, all integer cents):
--   winners W = reached the goal, losers L = missed it
--   lost_pot = sum of the stakes of L
--   fee = floor(lost_pot * fee_bps / 10000), distributable = lost_pot - fee
--   W empty:  every stake goes to the house (forfeit)
--   otherwise share_i = floor(distributable * S_i / sum of the stakes of W)
--             winner i gets S_i + share_i; fee and rounding (= distributable - sum of shares)
--             go to the house; a winner who donates gives share_i to the NGO
--   with equal stakes this is the old formula: bonus = floor(distributable / W).
create or replace function public.settle_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  p public.challenge_participants;
  v_days integer;
  v_winner_stakes bigint;
  v_winners bigint;
  v_lost_pot bigint;
  v_fee bigint;
  v_distributable bigint;
  v_share bigint;
  v_paid_shares bigint := 0;
  v_donate boolean;
  v_ngo uuid;
  v_donated bigint;
  r record;
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

  -- 2a. Ranked: rank and points, nothing is booked.
  if c.mode = 'ranked' then
    for r in
      select cp.id,
             rank() over (order by cp.progress_value desc) as rk,
             cp.progress_value
        from public.challenge_participants cp
       where cp.challenge_id = c.id
    loop
      update public.challenge_participants
         set rank = r.rk,
             rank_points = case
               when r.progress_value = 0 then 0
               when r.rk = 1 then 30
               when r.rk = 2 then 20
               when r.rk = 3 then 10
               else 5
             end
       where id = r.id;
    end loop;

    update public.challenges set status = 'settled', settled_at = now() where id = c.id;

    -- A podium place only counts once the challenge is settled, so check the badges now.
    for r in
      select cp.user_id from public.challenge_participants cp
       where cp.challenge_id = c.id and cp.user_id is not null
       order by cp.user_id
    loop
      perform private.award_badges(r.user_id);
    end loop;
    return true;
  end if;

  -- 2b. Pool: integer arithmetic in cents.
  select coalesce(sum(cp.stake_cents) filter (where cp.result = 'success'), 0),
         coalesce(sum(cp.stake_cents) filter (where cp.result = 'failed'), 0),
         count(*) filter (where cp.result = 'success')
    into v_winner_stakes, v_lost_pot, v_winners
    from public.challenge_participants cp
   where cp.challenge_id = c.id;

  if v_winners > 0 then
    v_fee := (v_lost_pot * c.fee_bps) / 10000;
    v_distributable := v_lost_pot - v_fee;

    -- Fixed order (by user id) keeps wallet locks deadlock-free.
    for p in
      select * from public.challenge_participants
       where challenge_id = c.id and result = 'success'
       order by user_id
    loop
      v_share := (v_distributable * p.stake_cents) / v_winner_stakes;
      perform private.post_user_entry(p.user_id, 'payout', p.stake_cents + v_share, c.id);

      v_donated := 0;
      v_ngo := null;
      if v_share > 0 then
        select coalesce(p.donate, pr.donate_default),
               coalesce(p.ngo_id, pr.default_ngo_id)
          into v_donate, v_ngo
          from public.profiles pr
         where pr.id = p.user_id;

        if v_donate then
          -- Nobody picked an NGO yet: the first active one.
          if v_ngo is null or not exists (select 1 from public.ngos n where n.id = v_ngo and n.active) then
            select n.id into v_ngo from public.ngos n where n.active order by n.sort_order limit 1;
          end if;
          if v_ngo is not null then
            v_donated := v_share;
            perform private.post_user_entry(p.user_id, 'donation', -v_donated, c.id, v_ngo);
          end if;
        end if;
      end if;

      update public.challenge_participants
         set payout_cents = p.stake_cents + v_share,
             donated_cents = v_donated,
             ngo_id = case when v_donated > 0 then v_ngo else ngo_id end
       where id = p.id;

      v_paid_shares := v_paid_shares + v_share;
    end loop;

    perform private.post_house_entry('fee', v_fee, c.id);
    perform private.post_house_entry('rounding', v_distributable - v_paid_shares, c.id);

    -- One summed credit per NGO.
    for r in
      select cp.ngo_id, sum(cp.donated_cents) as total
        from public.challenge_participants cp
       where cp.challenge_id = c.id and cp.donated_cents > 0
       group by cp.ngo_id
       order by cp.ngo_id
    loop
      perform private.post_donation_entry(r.ngo_id, r.total::bigint, c.id);
    end loop;
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

revoke all on function public.settle_challenge(uuid) from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Reading: leaderboard, possible win
------------------------------------------------------------------------------------------

create or replace function public.get_leaderboard(p_challenge_id uuid)
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
     and c.status in ('active', 'settling', 'settled')
     and private.is_participant(c.id)
   order by 1, p.display_name;
$$;

-- The most a participant can get back: the own stake plus the whole distributable pot of the
-- others, which is the case when everybody else misses the goal. Same formula as the
-- settlement. For someone who has not joined yet the stake of the challenge is used. Null for
-- ranked challenges (no money), for challenges that are not visible to the caller and for
-- finished ones.
create or replace function public.get_potential_win(p_challenge_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_challenge public.challenges%rowtype;
  v_own_stake bigint;
  v_others bigint;
  v_fee bigint;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found or v_challenge.status not in ('open', 'active') or v_challenge.mode <> 'pool' then
    return null;
  end if;
  if v_challenge.visibility = 'private'
     and v_challenge.creator_id is distinct from v_uid
     and not private.is_participant(v_challenge.id) then
    return null;
  end if;

  select cp.stake_cents into v_own_stake
    from public.challenge_participants cp
   where cp.challenge_id = p_challenge_id and cp.user_id = v_uid;
  v_own_stake := coalesce(v_own_stake, v_challenge.stake_cents);

  select coalesce(sum(cp.stake_cents), 0) into v_others
    from public.challenge_participants cp
   where cp.challenge_id = p_challenge_id and cp.user_id is distinct from v_uid;
  v_fee := (v_others * v_challenge.fee_bps) / 10000;

  return v_own_stake + (v_others - v_fee);
end;
$$;

------------------------------------------------------------------------------------------
-- Donations
------------------------------------------------------------------------------------------

create function public.set_donation_defaults(p_donate boolean, p_ngo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if p_donate is null then
    raise exception using errcode = 'P0001', message = 'invalid_donation_setting';
  end if;
  if p_ngo_id is not null
     and not exists (select 1 from public.ngos n where n.id = p_ngo_id and n.active) then
    raise exception using errcode = 'P0001', message = 'ngo_not_found';
  end if;
  update public.profiles
     set donate_default = p_donate, default_ngo_id = p_ngo_id
   where id = v_user_id;
end;
$$;

-- NULL for p_donate = "use my default". Changeable until the settlement is done.
create function public.set_challenge_donation(p_challenge_id uuid, p_donate boolean, p_ngo_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_status text;
begin
  select c.status into v_status from public.challenges c where c.id = p_challenge_id for update;
  if not exists (
    select 1 from public.challenge_participants cp
     where cp.challenge_id = p_challenge_id and cp.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'not_joined';
  end if;
  if v_status not in ('open', 'active', 'settling') then
    raise exception using errcode = 'P0001', message = 'donation_locked';
  end if;
  if p_ngo_id is not null
     and not exists (select 1 from public.ngos n where n.id = p_ngo_id and n.active) then
    raise exception using errcode = 'P0001', message = 'ngo_not_found';
  end if;

  update public.challenge_participants
     set donate = p_donate, ngo_id = p_ngo_id
   where challenge_id = p_challenge_id and user_id = v_user_id;
end;
$$;

-- The caller's choice for one challenge, and what would happen right now.
create function public.get_my_challenge_donation(p_challenge_id uuid)
returns table (donate boolean, ngo_id uuid, effective_donate boolean, effective_ngo_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.donate,
         cp.ngo_id,
         coalesce(cp.donate, pr.donate_default),
         coalesce(cp.ngo_id, pr.default_ngo_id)
    from public.challenge_participants cp
    join public.profiles pr on pr.id = cp.user_id
   where cp.challenge_id = p_challenge_id
     and cp.user_id = private.require_uid();
$$;

create function public.get_my_donations()
returns table (
  challenge_id uuid,
  title text,
  ngo_id uuid,
  ngo_name text,
  amount_cents bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select le.challenge_id, c.title, le.ngo_id, n.name, -le.amount_cents, le.created_at
    from public.ledger_entries le
    join public.ngos n on n.id = le.ngo_id
    left join public.challenges c on c.id = le.challenge_id
   where le.user_id = private.require_uid() and le.type = 'donation'
   order by le.created_at desc;
$$;

create function public.get_my_donation_totals()
returns table (ngo_id uuid, ngo_name text, total_cents bigint, donations integer)
language sql
stable
security definer
set search_path = ''
as $$
  select le.ngo_id, n.name, sum(-le.amount_cents)::bigint, count(*)::integer
    from public.ledger_entries le
    join public.ngos n on n.id = le.ngo_id
   where le.user_id = private.require_uid() and le.type = 'donation'
   group by le.ngo_id, n.name
   order by n.name;
$$;

revoke all on function public.set_donation_defaults(boolean, uuid),
  public.set_challenge_donation(uuid, boolean, uuid),
  public.get_my_challenge_donation(uuid),
  public.get_my_donations(),
  public.get_my_donation_totals()
  from public, anon;
grant execute on function public.set_donation_defaults(boolean, uuid) to authenticated;
grant execute on function public.set_challenge_donation(uuid, boolean, uuid) to authenticated;
grant execute on function public.get_my_challenge_donation(uuid) to authenticated;
grant execute on function public.get_my_donations() to authenticated;
grant execute on function public.get_my_donation_totals() to authenticated;

------------------------------------------------------------------------------------------
-- Account deletion, feed, points and badges follow the new modes
------------------------------------------------------------------------------------------

create or replace function private.delete_account(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  c public.challenges;
  p public.challenge_participants;
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'account_not_found';
  end if;

  -- Fixed lock order (challenge id), like settlement and sync.
  for c in
    select ch.* from public.challenges ch
      join public.challenge_participants cp on cp.challenge_id = ch.id
     where cp.user_id = v_user_id
     order by ch.id
       for update of ch
  loop
    select * into p from public.challenge_participants
     where challenge_id = c.id and user_id = v_user_id;

    if c.status = 'open' then
      if p.stake_cents > 0 then
        perform private.post_user_entry(v_user_id, 'refund', p.stake_cents, c.id);
      end if;
      delete from public.challenge_participants where id = p.id;
      update public.challenges
         set participant_count = participant_count - 1
       where id = c.id;
    elsif c.status in ('active', 'settling') and p.result = 'pending' then
      update public.challenge_participants
         set result = 'failed', payout_cents = 0
       where id = p.id;
    end if;
  end loop;

  -- Cascades: profile → wallet, workouts, daily steps, feed, badges, GPS runs.
  -- Set null: ledger entries, participations, created challenges.
  delete from auth.users where id = v_user_id;
end;
$$;

create or replace function private.feed_on_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    insert into public.challenge_feed (challenge_id, user_id, kind)
    values (new.challenge_id, new.user_id, 'joined')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.feed_on_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_needed integer;
begin
  if new.user_id is null or new.progress_value is not distinct from old.progress_value then
    return new;
  end if;
  select * into c from public.challenges where id = new.challenge_id;
  v_needed := case when c.goal_type = 'steps_daily' then private.challenge_days(c)
                   else c.target_value end;
  if new.progress_value >= v_needed and old.progress_value < v_needed then
    insert into public.challenge_feed (challenge_id, user_id, kind)
    values (new.challenge_id, new.user_id, 'goal_reached')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create or replace function private.feed_on_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_valid or new.was_user_entered
     or (tg_op = 'UPDATE' and old.is_valid) then
    return new;
  end if;
  insert into public.challenge_feed (challenge_id, user_id, kind, distance_m, ref_id)
  select c.id, new.user_id, 'ran', new.distance_m, new.id
    from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id and cp.user_id = new.user_id
   where c.goal_type in ('run_single', 'run_total')
     and c.status in ('active', 'settling')
     and new.start_at >= c.starts_at and new.start_at < c.ends_at
  on conflict do nothing;
  return new;
end;
$$;

-- Points: 1 per kilometre, 1 per 1,000 steps, 50 per reached goal, plus the rank points of
-- ranked challenges.
create or replace function private.user_points(p_user_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(w.distance_m) from public.activity_workouts w
                    where w.user_id = p_user_id and w.is_valid and not w.was_user_entered), 0) / 1000
       + coalesce((select sum(s.steps) from public.activity_daily_steps s
                    where s.user_id = p_user_id and s.is_valid), 0) / 1000
       + 50 * (select count(*) from public.challenge_participants cp
                where cp.user_id = p_user_id and cp.result = 'success')
       + coalesce((select sum(cp.rank_points) from public.challenge_participants cp
                    where cp.user_id = p_user_id), 0);
$$;

alter table public.user_badges drop constraint user_badges_badge_valid;
alter table public.user_badges
  add constraint user_badges_badge_valid check (
    badge in ('first_challenge', 'first_win', 'streak_7', 'streak_30',
              'km_50', 'km_100', 'challenges_10', 'podium')
  );

create or replace function private.award_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenges integer;
  v_wins integer;
  v_distance bigint;
  v_streak integer;
  v_podium boolean;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer into v_challenges
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
   where cp.user_id = p_user_id and c.status <> 'cancelled';

  select count(*)::integer into v_wins
    from public.challenge_participants cp
   where cp.user_id = p_user_id and cp.result = 'success';

  select coalesce(sum(w.distance_m), 0) into v_distance
    from public.activity_workouts w
   where w.user_id = p_user_id and w.is_valid and not w.was_user_entered;

  v_streak := private.user_streak(p_user_id);

  -- A podium place needs at least three participants.
  select exists (
    select 1 from public.challenge_participants cp
      join public.challenges c on c.id = cp.challenge_id
     where cp.user_id = p_user_id and c.mode = 'ranked' and c.status = 'settled'
       and cp.rank <= 3 and cp.progress_value > 0 and c.participant_count >= 3
  ) into v_podium;

  insert into public.user_badges (user_id, badge)
  select p_user_id, b.badge
    from (values
      ('first_challenge', v_challenges >= 1),
      ('challenges_10', v_challenges >= 10),
      ('first_win', v_wins >= 1),
      ('streak_7', v_streak >= 7),
      ('streak_30', v_streak >= 30),
      ('km_50', v_distance >= 50000),
      ('km_100', v_distance >= 100000),
      ('podium', v_podium)
    ) as b (badge, earned)
   where b.earned
  on conflict do nothing;
end;
$$;

create trigger award_on_rank
  after update of rank on public.challenge_participants
  for each row
  when (old.rank is distinct from new.rank)
  execute function private.award_on_participation();
