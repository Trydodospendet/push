-- Phase 2 – challenges: challenges, participants, activity tables and the
-- create / join / join-by-code / leave functions.
--
-- Money rules (CLAUDE.md, section 4): stakes and refunds only move through
-- private.post_user_entry() inside SECURITY DEFINER functions. Clients can read, never write.

------------------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------------------

create table public.challenges (
  id uuid primary key default gen_random_uuid(),
  creator_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  goal_type text not null,
  -- Metres for run_single / run_total, steps per day for steps_daily.
  target_value integer not null,
  stake_cents bigint not null,
  -- Platform fee on the LOST pot only, in basis points (1000 = 10 %). Not settable by clients.
  fee_bps integer not null default 0,
  timezone text not null default 'Europe/Berlin',
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  sync_grace_hours integer not null default 24,
  min_participants integer not null default 2,
  max_participants integer null,
  visibility text not null,
  invite_code text unique null,
  status text not null default 'open',
  -- Maintained by join/leave; lets everybody see the size of a challenge without reading
  -- the participant rows (which are only visible to participants).
  participant_count integer not null default 0,
  pot_cents bigint generated always as (participant_count * stake_cents) stored,
  settled_at timestamptz null,
  created_at timestamptz not null default now(),
  constraint challenges_title_length check (char_length(title) between 3 and 60),
  constraint challenges_title_trimmed check (title = btrim(title)),
  constraint challenges_goal_type_valid check (
    goal_type in ('run_single', 'run_total', 'steps_daily')
  ),
  constraint challenges_target_value_range check (
    (goal_type = 'run_single' and target_value between 1000 and 100000)
    or (goal_type = 'run_total' and target_value between 1000 and 500000)
    or (goal_type = 'steps_daily' and target_value between 1000 and 50000)
  ),
  constraint challenges_stake_range check (stake_cents between 100 and 5000),
  constraint challenges_fee_range check (fee_bps between 0 and 10000),
  constraint challenges_duration check (
    ends_at >= starts_at + interval '1 day' and ends_at <= starts_at + interval '42 days'
  ),
  constraint challenges_sync_grace_range check (sync_grace_hours between 0 and 168),
  constraint challenges_min_participants check (min_participants >= 2),
  constraint challenges_max_participants check (
    max_participants is null or max_participants between min_participants and 1000
  ),
  constraint challenges_visibility_valid check (visibility in ('public', 'private')),
  constraint challenges_invite_code_matches_visibility check (
    (visibility = 'private' and invite_code ~ '^[A-HJ-NP-Z2-9]{6}$')
    or (visibility = 'public' and invite_code is null)
  ),
  constraint challenges_status_valid check (
    status in ('open', 'active', 'settling', 'settled', 'cancelled')
  ),
  constraint challenges_participant_count_valid check (
    participant_count >= 0
    and (max_participants is null or participant_count <= max_participants)
  )
);

create index challenges_discover_idx on public.challenges (status, visibility, starts_at);
create index challenges_creator_idx on public.challenges (creator_id);

create table public.challenge_participants (
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  stake_cents bigint not null,
  result text not null default 'pending',
  -- Computed by the server (phase 3), never by the client.
  progress_value integer not null default 0,
  payout_cents bigint null,
  joined_at timestamptz not null default now(),
  primary key (challenge_id, user_id),
  constraint challenge_participants_stake_positive check (stake_cents > 0),
  constraint challenge_participants_result_valid check (
    result in ('pending', 'success', 'failed', 'refunded')
  ),
  constraint challenge_participants_progress_not_negative check (progress_value >= 0),
  constraint challenge_participants_payout_not_negative check (
    payout_cents is null or payout_cents >= 0
  )
);

create index challenge_participants_user_idx on public.challenge_participants (user_id);

alter table public.ledger_entries
  add constraint ledger_entries_challenge_id_fkey
  foreign key (challenge_id) references public.challenges (id) on delete restrict;

create index ledger_entries_challenge_idx on public.ledger_entries (challenge_id);

-- Written by the sync functions in phase 3.
create table public.activity_workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  platform text not null,
  source_record_id text not null,
  source_name text null,
  activity_type text not null,
  start_at timestamptz not null,
  end_at timestamptz not null,
  distance_m integer not null,
  duration_s integer not null,
  was_user_entered boolean not null,
  is_valid boolean not null,
  invalid_reason text null,
  synced_at timestamptz not null default now(),
  constraint activity_workouts_platform_valid check (platform in ('ios', 'android')),
  constraint activity_workouts_activity_type_valid check (activity_type = 'running'),
  constraint activity_workouts_invalid_reason_valid check (
    (is_valid and invalid_reason is null)
    or (
      not is_valid
      and invalid_reason in ('manual_entry', 'too_fast', 'too_slow', 'invalid_data')
    )
  ),
  constraint activity_workouts_source_unique unique (user_id, platform, source_record_id)
);

create index activity_workouts_user_start_idx on public.activity_workouts (user_id, start_at);

create table public.activity_daily_steps (
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Local calendar date in the user's timezone.
  date date not null,
  steps integer not null,
  platform text null,
  -- False for implausible values (more than 80,000 steps); stored but never counted.
  is_valid boolean not null,
  synced_at timestamptz not null default now(),
  primary key (user_id, date),
  constraint activity_daily_steps_steps_not_negative check (steps >= 0),
  constraint activity_daily_steps_platform_valid check (
    platform is null or platform in ('ios', 'android')
  )
);

------------------------------------------------------------------------------------------
-- Helpers (internal)
------------------------------------------------------------------------------------------

-- Used by RLS policies. SECURITY DEFINER avoids recursive policy evaluation on
-- challenge_participants.
create function private.is_participant(p_challenge_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.challenge_participants cp
     where cp.challenge_id = p_challenge_id
       and cp.user_id = (select auth.uid())
  );
$$;

revoke all on function private.is_participant(uuid) from public;
grant usage on schema private to authenticated;
grant execute on function private.is_participant(uuid) to authenticated;

-- 6 characters without easily confused ones (no I, O, 0, 1).
create function private.generate_invite_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.challenges c where c.invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke all on function private.generate_invite_code() from public;

-- Shared by join_challenge and join_challenge_by_code. The caller passes the challenge id;
-- this function locks the challenge row (serialises joins for max_participants), then the
-- wallet row (inside post_user_entry), and books the stake.
create function private.join(p_challenge_id uuid, p_user_id uuid)
returns public.challenge_participants
language plpgsql
set search_path = ''
as $$
declare
  v_challenge public.challenges;
  v_participant public.challenge_participants;
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

  -- The unique index allows only one stake per user and challenge, so leaving is final.
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

  perform private.post_user_entry(p_user_id, 'stake', -v_challenge.stake_cents, p_challenge_id);

  insert into public.challenge_participants (challenge_id, user_id, stake_cents)
  values (p_challenge_id, p_user_id, v_challenge.stake_cents)
  returning * into v_participant;

  update public.challenges
     set participant_count = participant_count + 1
   where id = p_challenge_id;

  return v_participant;
end;
$$;

revoke all on function private.join(uuid, uuid) from public;

create function private.require_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  return auth.uid();
end;
$$;

revoke all on function private.require_uid() from public;

------------------------------------------------------------------------------------------
-- RPC functions for the app
------------------------------------------------------------------------------------------

-- Creates an open challenge. The period is given as a local start date plus a number of
-- days, so that it always covers whole days in the challenge timezone (important for
-- steps_daily). The creator does NOT join automatically.
create function public.create_challenge(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_start_date date,
  p_duration_days integer,
  p_visibility text,
  p_max_participants integer default null
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
  v_challenge public.challenges;
begin
  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  v_today := (now() at time zone v_timezone)::date;

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

  if p_visibility is null or p_visibility not in ('public', 'private') then
    raise exception using errcode = 'P0001', message = 'invalid_visibility';
  end if;

  if p_max_participants is not null and p_max_participants not between 2 and 1000 then
    raise exception using errcode = 'P0001', message = 'invalid_max_participants';
  end if;

  insert into public.challenges (
    creator_id, title, goal_type, target_value, stake_cents, timezone,
    starts_at, ends_at, max_participants, visibility, invite_code, status
  )
  values (
    v_user_id,
    v_title,
    p_goal_type,
    p_target_value,
    p_stake_cents,
    v_timezone,
    p_start_date::timestamp at time zone v_timezone,
    (p_start_date + p_duration_days)::timestamp at time zone v_timezone,
    p_max_participants,
    p_visibility,
    case when p_visibility = 'private' then private.generate_invite_code() end,
    'open'
  )
  returning * into v_challenge;

  return v_challenge;
end;
$$;

-- Joins a challenge by id. Private challenges can only be joined by id by their creator;
-- everybody else needs the invite code.
create function public.join_challenge(p_challenge_id uuid)
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

  return private.join(p_challenge_id, v_user_id);
end;
$$;

create function public.join_challenge_by_code(p_code text)
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

  return private.join(v_challenge_id, v_user_id);
end;
$$;

-- Leaves an open challenge before it starts and refunds the full stake. Leaving is final:
-- the ledger allows only one stake per user and challenge.
create function public.leave_challenge(p_challenge_id uuid)
returns public.ledger_entries
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

  return private.post_user_entry(v_user_id, 'refund', v_participant.stake_cents, p_challenge_id);
end;
$$;

revoke all on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer)
  from public, anon;
revoke all on function public.join_challenge(uuid) from public, anon;
revoke all on function public.join_challenge_by_code(text) from public, anon;
revoke all on function public.leave_challenge(uuid) from public, anon;
grant execute on function public.create_challenge(text, text, integer, bigint, date, integer, text, integer)
  to authenticated;
grant execute on function public.join_challenge(uuid) to authenticated;
grant execute on function public.join_challenge_by_code(text) to authenticated;
grant execute on function public.leave_challenge(uuid) to authenticated;

------------------------------------------------------------------------------------------
-- Row level security and grants
------------------------------------------------------------------------------------------

alter table public.challenges enable row level security;
alter table public.challenge_participants enable row level security;
alter table public.activity_workouts enable row level security;
alter table public.activity_daily_steps enable row level security;

revoke all on public.challenges, public.challenge_participants,
  public.activity_workouts, public.activity_daily_steps
  from anon, authenticated;

grant select on public.challenges to authenticated;
create policy "challenges: public ones, own ones and joined ones are readable"
  on public.challenges for select
  to authenticated
  using (
    visibility = 'public'
    or creator_id = (select auth.uid())
    or private.is_participant(id)
  );

grant select on public.challenge_participants to authenticated;
create policy "challenge_participants: readable by participants of the same challenge"
  on public.challenge_participants for select
  to authenticated
  using (private.is_participant(challenge_id));

grant select on public.activity_workouts to authenticated;
create policy "activity_workouts: users read their own workouts"
  on public.activity_workouts for select
  to authenticated
  using (user_id = (select auth.uid()));

grant select on public.activity_daily_steps to authenticated;
create policy "activity_daily_steps: users read their own steps"
  on public.activity_daily_steps for select
  to authenticated
  using (user_id = (select auth.uid()));
