-- Phase 6 – numbers for the home screen, the profile and the challenge detail.
-- Everything here is read-only and derived from existing tables. Nothing is booked or stored.

-- A day counts for the streak with a valid run or at least this many valid steps (the lowest
-- step preset of the app).
create function private.streak_min_steps()
returns integer
language sql
immutable
set search_path = ''
as $$ select 8000; $$;

------------------------------------------------------------------------------------------
-- Own statistics
------------------------------------------------------------------------------------------

-- streak_days:     consecutive active days up to today (or up to yesterday if today has no
--                  activity yet, so the streak does not break before the day is over)
-- total_distance_m: all valid runs ever synced
-- wins / total_won_cents: settled challenges that were won; "won" is the bonus on top of the
--                  stake (payout - stake), so a solo win earns 0 and never counts as profit
create function public.get_my_stats()
returns table (
  streak_days integer,
  total_distance_m bigint,
  wins integer,
  total_won_cents bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_today date;
  v_streak integer;
begin
  select (now() at time zone p.timezone)::date into v_today
    from public.profiles p where p.id = v_uid;

  with active_days as (
    select (w.start_at at time zone p.timezone)::date as d
      from public.activity_workouts w
      join public.profiles p on p.id = w.user_id
     where w.user_id = v_uid and w.is_valid and not w.was_user_entered
    union
    select s.date
      from public.activity_daily_steps s
     where s.user_id = v_uid and s.is_valid and s.steps >= private.streak_min_steps()
  ),
  islands as (
    select d, d - (row_number() over (order by d))::integer as grp
      from active_days
  ),
  anchor as (
    select i.grp
      from islands i
     where i.d = v_today or i.d = v_today - 1
     order by i.d desc
     limit 1
  )
  select count(*)::integer into v_streak
    from islands i
   where i.grp = (select a.grp from anchor a);

  return query
  select coalesce(v_streak, 0),
         coalesce((select sum(w.distance_m) from public.activity_workouts w
                    where w.user_id = v_uid and w.is_valid and not w.was_user_entered), 0)::bigint,
         (select count(*) from public.challenge_participants cp
           where cp.user_id = v_uid and cp.result = 'success')::integer,
         coalesce((select sum(cp.payout_cents - cp.stake_cents)
                     from public.challenge_participants cp
                    where cp.user_id = v_uid and cp.result = 'success'
                      and cp.payout_cents is not null), 0)::bigint;
end;
$$;

revoke all on function public.get_my_stats() from public, anon;
grant execute on function public.get_my_stats() to authenticated;

------------------------------------------------------------------------------------------
-- Own week: valid kilometres (in metres) per day, the last 7 days including today
------------------------------------------------------------------------------------------

create function public.get_my_week()
returns table (day date, distance_m integer)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select p.id, (now() at time zone p.timezone)::date as today, p.timezone
      from public.profiles p
     where p.id = private.require_uid()
  )
  select g.day::date,
         coalesce((
           select sum(w.distance_m)
             from public.activity_workouts w
            where w.user_id = me.id and w.is_valid and not w.was_user_entered
              and (w.start_at at time zone me.timezone)::date = g.day::date
         ), 0)::integer
    from me, generate_series(me.today - 6, me.today, interval '1 day') as g(day)
   order by 1;
$$;

revoke all on function public.get_my_week() from public, anon;
grant execute on function public.get_my_week() to authenticated;

------------------------------------------------------------------------------------------
-- Possible win of one challenge
------------------------------------------------------------------------------------------

-- The most a participant can get back: the stake plus the whole distributable lost pot, which
-- is the case when everybody else misses the goal. Same formula as settle_challenge. For
-- someone who has not joined yet, the caller is counted as one more participant. Null if the
-- challenge is not visible to the caller or is already over.
create function public.get_potential_win(p_challenge_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_challenge public.challenges%rowtype;
  v_participants integer;
  v_lost_pot bigint;
  v_fee bigint;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found or v_challenge.status not in ('open', 'active') then
    return null;
  end if;
  if v_challenge.visibility = 'private'
     and v_challenge.creator_id <> v_uid
     and not private.is_participant(v_challenge.id) then
    return null;
  end if;

  v_participants := v_challenge.participant_count
    + case when private.is_participant(v_challenge.id) then 0 else 1 end;
  v_lost_pot := (v_participants - 1)::bigint * v_challenge.stake_cents;
  v_fee := (v_lost_pot * v_challenge.fee_bps) / 10000;

  return v_challenge.stake_cents + (v_lost_pot - v_fee);
end;
$$;

revoke all on function public.get_potential_win(uuid) from public, anon;
grant execute on function public.get_potential_win(uuid) to authenticated;
