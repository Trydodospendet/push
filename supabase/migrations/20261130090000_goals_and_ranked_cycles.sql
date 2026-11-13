-- Ausbau 3 – personal goals and fixed ranked cycles.
--
--   goal    A personal goal (type, target, period, stake). One challenge row per goal, the owner is
--           the only participant. The stake is deducted at creation and can be refunded only
--           until the start (leave_challenge). From the start it is bound.
--           Settlement works per PERIOD ("window" = all goals with the same ends_at):
--             reached the goal  → the own stake back plus a share of the forfeited stakes of the
--                                 window: floor(distributable * stake / winner stakes)
--             missed the goal   → the stake is forfeited into the pot of the window
--             no minimum goal, fee_bps on the lost pot, rounding in favour of the house
--             nobody reached it → every stake goes to the house
--           Ledger: the sum of the bookings of EVERY goal stays 0 – the share of a winner is
--           booked as a house debit (type payout) on the winner's goal, the forfeited stakes as
--           house credits (forfeit / fee / rounding) on the failed goals.
--   ranked  Fixed cycles created by pg_cron: daily, weekly, monthly, each for "most km" and
--           "most steps". No stake. Users cannot create ranked challenges any more.

------------------------------------------------------------------------------------------
-- Constraints
------------------------------------------------------------------------------------------

alter table public.challenges drop constraint challenges_mode_valid;
alter table public.challenges drop constraint challenges_stake_by_mode;
alter table public.challenges drop constraint challenges_weekly_shape;

-- The old weekly keys ('2026-W47') become '<cycle>-km'.
update public.challenges
   set weekly_key = 'W' || weekly_key || '-km'
 where weekly_key ~ '^[0-9]{4}-W[0-9]{2}$';

alter table public.challenges
  add constraint challenges_mode_valid check (mode in ('ranked', 'pool', 'goal'));
alter table public.challenges
  add constraint challenges_stake_by_mode check (
    (mode = 'ranked' and stake_cents = 0 and fee_bps = 0)
    or (mode in ('pool', 'goal') and stake_cents between 100 and 5000)
  );
alter table public.challenges
  add constraint challenges_weekly_shape check (
    weekly_key is null
    or (creator_id is null and mode = 'ranked' and visibility = 'public'
        and weekly_key ~ '^(D[0-9]{4}-[0-9]{2}-[0-9]{2}|W[0-9]{4}-W[0-9]{2}|M[0-9]{4}-[0-9]{2})-(km|steps)$')
  );

------------------------------------------------------------------------------------------
-- Ranked: no creation by users, fixed cycles instead
------------------------------------------------------------------------------------------

-- Same as before, but only pools can be created (ranked is platform-only).
create or replace function public.create_challenge(
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
  v_challenge public.challenges;
begin
  select p.timezone into v_timezone from public.profiles p where p.id = v_user_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'profile_not_found';
  end if;

  v_today := (now() at time zone v_timezone)::date;

  if p_mode is null or p_mode <> 'pool' then
    raise exception using errcode = 'P0001', message = 'invalid_mode';
  end if;

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

  if p_stake_cents is null or p_stake_cents not between 100 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;

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
    v_user_id, v_title, p_goal_type, p_target_value, p_stake_cents,
    (select s.fee_bps from private.settings s), v_timezone,
    p_start_date::timestamp at time zone v_timezone,
    (p_start_date + p_duration_days)::timestamp at time zone v_timezone,
    1, p_max_participants, p_visibility,
    case when p_visibility = 'private' then private.generate_invite_code() end,
    'open', 'pool'
  )
  returning * into v_challenge;

  return v_challenge;
end;
$$;

drop function public.create_weekly_challenge(timestamptz);

-- Creates the missing ranked cycles for the next day, the next week (from Monday) and the next
-- month, each for km and steps. Returns the number of created challenges. p_now only exists so
-- tests can pick the day.
create function public.create_ranked_cycles(p_now timestamptz default now())
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  c_timezone constant text := 'Europe/Berlin';
  c_months constant text[] := array['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
    'August', 'September', 'Oktober', 'November', 'Dezember'];
  v_today date := (p_now at time zone c_timezone)::date;
  v_day date := v_today + 1;
  v_monday date := v_today + (8 - extract(isodow from v_today)::integer);
  v_month date := (date_trunc('month', v_today) + interval '1 month')::date;
  v_count integer := 0;
  v_added integer;
  v_kind text;
  v_metric text;
  v_start date;
  v_end date;
  v_key text;
  v_title text;
begin
  foreach v_kind in array array['D', 'W', 'M'] loop
    foreach v_metric in array array['km', 'steps'] loop
      if v_kind = 'D' then
        v_start := v_day;
        v_end := v_day + 1;
        v_key := 'D' || to_char(v_start, 'YYYY-MM-DD');
        v_title := case v_metric when 'km' then 'Meiste km am ' else 'Meiste Schritte am ' end
                   || to_char(v_start, 'DD.MM.');
      elsif v_kind = 'W' then
        v_start := v_monday;
        v_end := v_monday + 7;
        v_key := 'W' || to_char(v_start, 'IYYY"-W"IW');
        v_title := case v_metric when 'km' then 'Meiste km in KW ' else 'Meiste Schritte in KW ' end
                   || to_char(v_start, 'IW');
      else
        v_start := v_month;
        v_end := (v_month + interval '1 month')::date;
        v_key := 'M' || to_char(v_start, 'YYYY-MM');
        v_title := case v_metric when 'km' then 'Meiste km im ' else 'Meiste Schritte im ' end
                   || c_months[extract(month from v_start)::integer];
      end if;
      v_key := v_key || '-' || v_metric;

      insert into public.challenges (
        creator_id, title, goal_type, target_value, stake_cents, fee_bps, timezone,
        starts_at, ends_at, min_participants, max_participants, visibility, invite_code,
        status, mode, weekly_key
      )
      values (
        null, v_title,
        case v_metric when 'km' then 'run_total' else 'steps_total' end,
        case v_metric when 'km' then 1000 else 5000 end,
        0, 0, c_timezone,
        v_start::timestamp at time zone c_timezone,
        v_end::timestamp at time zone c_timezone,
        2, null, 'public', null, 'open', 'ranked', v_key
      )
      on conflict (weekly_key) do nothing;
      get diagnostics v_added = row_count;
      v_count := v_count + v_added;
    end loop;
  end loop;

  return v_count;
end;
$$;

revoke all on function public.create_ranked_cycles(timestamptz) from public, anon, authenticated;

select cron.unschedule('create-weekly-challenge');
select cron.schedule('create-ranked-cycles', '0 12 * * *', 'select public.create_ranked_cycles()');

------------------------------------------------------------------------------------------
-- Personal goals
------------------------------------------------------------------------------------------

-- Creates a personal goal and binds the stake. p_period: 'day' (tomorrow), 'week' (the coming
-- Monday to Sunday), 'month' (the coming calendar month). It cannot start today, so nobody can
-- set a goal after having done the activity. Until the start the stake can be refunded with
-- leave_challenge; from the start it is bound.
create function public.create_goal(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_period text
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
  v_start date;
  v_end date;
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

  if p_stake_cents is null or p_stake_cents not between 100 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;

  if p_period = 'day' then
    v_start := v_today + 1;
    v_end := v_start + 1;
  elsif p_period = 'week' then
    v_start := v_today + (8 - extract(isodow from v_today)::integer);
    v_end := v_start + 7;
  elsif p_period = 'month' then
    v_start := (date_trunc('month', v_today) + interval '1 month')::date;
    v_end := (v_start + interval '1 month')::date;
  else
    raise exception using errcode = 'P0001', message = 'invalid_period';
  end if;

  if (select count(*) from public.challenges c
       where c.creator_id = v_user_id and c.mode = 'goal' and c.status in ('open', 'active')) >= 10 then
    raise exception using errcode = 'P0001', message = 'too_many_goals';
  end if;

  insert into public.challenges (
    creator_id, title, goal_type, target_value, stake_cents, fee_bps, timezone,
    starts_at, ends_at, min_participants, max_participants, visibility, invite_code,
    status, mode
  )
  values (
    v_user_id, v_title, p_goal_type, p_target_value, p_stake_cents,
    (select s.fee_bps from private.settings s), v_timezone,
    v_start::timestamp at time zone v_timezone,
    v_end::timestamp at time zone v_timezone,
    1, 1, 'private', private.generate_invite_code(), 'open', 'goal'
  )
  returning * into v_challenge;

  perform private."join"(v_challenge.id, v_user_id, p_stake_cents);

  select * into v_challenge from public.challenges where id = v_challenge.id;
  return v_challenge;
end;
$$;

revoke all on function public.create_goal(text, text, integer, bigint, text) from public, anon;
grant execute on function public.create_goal(text, text, integer, bigint, text) to authenticated;

-- Personal goals cannot be joined by others.
create or replace function public.join_challenge_by_code(p_code text, p_stake_cents bigint default null)
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
   where c.invite_code = upper(btrim(coalesce(p_code, '')))
     and c.mode <> 'goal';

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_invite_code';
  end if;

  return private."join"(v_challenge_id, v_user_id, p_stake_cents);
end;
$$;

------------------------------------------------------------------------------------------
-- Settlement: pools as before, goals per period
------------------------------------------------------------------------------------------

alter function public.settle_challenge(uuid) rename to settle_single;
alter function public.settle_single(uuid) set schema private;
revoke all on function private.settle_single(uuid) from public, anon, authenticated;

create function private.settle_goal_window(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  g public.challenges;
  p public.challenge_participants;
  v_days integer;
  v_winner_stakes bigint;
  v_winners bigint;
  v_lost_pot bigint;
  v_fee_bps integer;
  v_fee bigint := 0;
  v_distributable bigint := 0;
  v_share bigint;
  v_paid_shares bigint := 0;
  v_rounding bigint := 0;
  v_fee_left bigint;
  v_round_left bigint;
  v_f bigint;
  v_r bigint;
  v_donate boolean;
  v_ngo uuid;
  v_donated bigint;
  v_stake bigint;
begin
  select ends_at into c.ends_at from public.challenges where id = p_challenge_id;
  if c.ends_at is null then
    return false;
  end if;

  -- One settlement per window at a time (also keeps the lock order deadlock-free).
  perform pg_advisory_xact_lock(hashtextextended('goal-window:' || c.ends_at::text, 0));

  select * into c from public.challenges where id = p_challenge_id for update;
  if c.id is null
     or c.status <> 'settling'
     or now() < c.ends_at + make_interval(hours => c.sync_grace_hours) then
    return false;
  end if;

  -- 1. Final progress and results of every goal of the window.
  for g in
    select * from public.challenges
     where mode = 'goal' and ends_at = c.ends_at and status = 'settling'
       and now() >= ends_at + make_interval(hours => sync_grace_hours)
     order by id
       for update
  loop
    perform private.recompute_health_progress(g.id);
    v_days := private.challenge_days(g);
    update public.challenge_participants cp
       set result = case
             when (g.goal_type = 'steps_daily' and cp.progress_value >= v_days)
               or (g.goal_type <> 'steps_daily' and cp.progress_value >= g.target_value)
               then 'success'
             else 'failed'
           end
     where cp.challenge_id = g.id and cp.result = 'pending';
  end loop;

  -- 2. The pot of the window.
  select coalesce(sum(cp.stake_cents) filter (where cp.result = 'success'), 0),
         coalesce(sum(cp.stake_cents) filter (where cp.result = 'failed'), 0),
         count(*) filter (where cp.result = 'success'),
         coalesce(max(ch.fee_bps), 0)
    into v_winner_stakes, v_lost_pot, v_winners, v_fee_bps
    from public.challenges ch
    join public.challenge_participants cp on cp.challenge_id = ch.id
   where ch.mode = 'goal' and ch.ends_at = c.ends_at and ch.status = 'settling'
     and now() >= ch.ends_at + make_interval(hours => ch.sync_grace_hours)
     and (cp.result = 'failed' or (cp.result = 'success' and cp.user_id is not null));

  if v_winners > 0 then
    v_fee := (v_lost_pot * v_fee_bps) / 10000;
    v_distributable := v_lost_pot - v_fee;

    for p in
      select cp.* from public.challenge_participants cp
        join public.challenges ch on ch.id = cp.challenge_id
       where ch.mode = 'goal' and ch.ends_at = c.ends_at and ch.status = 'settling'
         and now() >= ch.ends_at + make_interval(hours => ch.sync_grace_hours)
         and cp.result = 'success' and cp.user_id is not null
       order by cp.challenge_id, cp.user_id
    loop
      v_share := (v_distributable * p.stake_cents) / v_winner_stakes;
      perform private.post_user_entry(p.user_id, 'payout', p.stake_cents + v_share, p.challenge_id);
      -- The share comes out of the forfeited stakes, which the house holds.
      perform private.post_house_entry('payout', -v_share, p.challenge_id);

      v_donated := 0;
      v_ngo := null;
      if v_share > 0 then
        select coalesce(p.donate, pr.donate_default), coalesce(p.ngo_id, pr.default_ngo_id)
          into v_donate, v_ngo
          from public.profiles pr
         where pr.id = p.user_id;

        if v_donate then
          if v_ngo is null or not exists (select 1 from public.ngos n where n.id = v_ngo and n.active) then
            select n.id into v_ngo from public.ngos n where n.active order by n.sort_order limit 1;
          end if;
          if v_ngo is not null then
            v_donated := v_share;
            perform private.post_user_entry(p.user_id, 'donation', -v_donated, p.challenge_id, v_ngo);
            perform private.post_donation_entry(v_ngo, v_donated, p.challenge_id);
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

    v_rounding := v_distributable - v_paid_shares;
  end if;

  -- 3. The forfeited stakes go to the house: fee and rounding first, the rest as forfeit
  --    (= exactly what the winners received as shares).
  v_fee_left := v_fee;
  v_round_left := v_rounding;
  for p in
    select cp.* from public.challenge_participants cp
      join public.challenges ch on ch.id = cp.challenge_id
     where ch.mode = 'goal' and ch.ends_at = c.ends_at and ch.status = 'settling'
       and now() >= ch.ends_at + make_interval(hours => ch.sync_grace_hours)
       and cp.result = 'failed'
     order by cp.challenge_id, cp.user_id
  loop
    v_stake := p.stake_cents;
    v_f := least(v_stake, v_fee_left);
    v_fee_left := v_fee_left - v_f;
    v_r := least(v_stake - v_f, v_round_left);
    v_round_left := v_round_left - v_r;
    perform private.post_house_entry('fee', v_f, p.challenge_id);
    perform private.post_house_entry('rounding', v_r, p.challenge_id);
    perform private.post_house_entry('forfeit', v_stake - v_f - v_r, p.challenge_id);
    update public.challenge_participants set payout_cents = 0 where id = p.id;
  end loop;

  update public.challenges
     set status = 'settled', settled_at = now()
   where mode = 'goal' and ends_at = c.ends_at and status = 'settling'
     and now() >= ends_at + make_interval(hours => sync_grace_hours);

  return true;
end;
$$;

revoke all on function private.settle_goal_window(uuid) from public, anon, authenticated;

create function public.settle_challenge(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_mode text;
begin
  select c.mode into v_mode from public.challenges c where c.id = p_challenge_id;
  if v_mode is null then
    return false;
  elsif v_mode = 'goal' then
    return private.settle_goal_window(p_challenge_id);
  end if;
  return private.settle_single(p_challenge_id);
end;
$$;

revoke all on function public.settle_challenge(uuid) from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Reading: pool overview and the pot of a goal's period
------------------------------------------------------------------------------------------

-- App-wide numbers: people and bound credits in pools and goals that are not settled yet.
-- Aggregates only, no names. (Whether somebody is running right now cannot be known: GPS runs
-- are uploaded after the run, so there is deliberately no such number.)
create function public.get_pool_overview()
returns table (people integer, goals integer, bound_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct cp.user_id)::integer,
         count(distinct c.id)::integer,
         coalesce(sum(cp.stake_cents), 0)::bigint
    from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
   where private.require_uid() is not null
     and c.mode in ('pool', 'goal')
     and c.status in ('open', 'active', 'settling')
     and cp.user_id is not null;
$$;

revoke all on function public.get_pool_overview() from public, anon;
grant execute on function public.get_pool_overview() to authenticated;

-- The period of a goal the caller owns: how many goals and how many credits are in it.
create function public.get_goal_window(p_challenge_id uuid)
returns table (goals integer, stakes_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(distinct o.id)::integer, coalesce(sum(cp.stake_cents), 0)::bigint
    from public.challenges c
    join public.challenges o on o.mode = 'goal' and o.ends_at = c.ends_at
                             and o.status in ('open', 'active', 'settling', 'settled')
    join public.challenge_participants cp on cp.challenge_id = o.id and cp.user_id is not null
   where c.id = p_challenge_id
     and c.mode = 'goal'
     and private.is_participant(c.id);
$$;

revoke all on function public.get_goal_window(uuid) from public, anon;
grant execute on function public.get_goal_window(uuid) to authenticated;

-- First cycles right away.
select public.create_ranked_cycles();
