-- Daily personal goals can begin as soon as they are created. The goal ends at the
-- account's next local midnight; its stake is therefore bound immediately.
create or replace function public.create_goal(
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
  v_start_at timestamptz;
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

  if p_period in ('day', 'today') then
    v_start := v_today;
    v_end := v_today + 1;
    v_start_at := now();
  elsif p_period = 'week' then
    v_start := v_today + (8 - extract(isodow from v_today)::integer);
    v_end := v_start + 7;
    v_start_at := v_start::timestamp at time zone v_timezone;
  elsif p_period = 'month' then
    v_start := (date_trunc('month', v_today) + interval '1 month')::date;
    v_end := (v_start + interval '1 month')::date;
    v_start_at := v_start::timestamp at time zone v_timezone;
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
    v_start_at, v_end::timestamp at time zone v_timezone,
    1, 1, 'private', private.generate_invite_code(), 'open', 'goal'
  )
  returning * into v_challenge;

  -- Creation and the owner's stake are one transaction. No invitation deadline applies
  -- to the owner creating an immediate personal goal.
  perform private.post_user_entry(v_user_id, 'stake', -p_stake_cents, v_challenge.id);
  insert into public.challenge_participants (challenge_id, user_id, stake_cents)
  values (v_challenge.id, v_user_id, p_stake_cents);
  update public.challenges set participant_count = 1 where id = v_challenge.id;

  if p_period in ('day', 'today') then
    update public.challenges set starts_at = now() where id = v_challenge.id;
  end if;

  select * into v_challenge from public.challenges where id = v_challenge.id;
  return v_challenge;
end;
$$;

revoke all on function public.create_goal(text, text, integer, bigint, text) from public, anon;
grant execute on function public.create_goal(text, text, integer, bigint, text) to authenticated;


create or replace function public.create_scheduled_goal(
 p_title text, p_goal_type text, p_target_value integer, p_stake_cents bigint,
 p_start_date date, p_end_date date, p_with_friends boolean default false
) returns public.challenges
language plpgsql security definer set search_path = '' as $$
declare
 v_uid uuid := private.require_uid();
 v_tz text;
 v_today date;
 v_goal public.challenges;
begin
 select timezone into v_tz from public.profiles where id = v_uid;
 if not found then raise exception 'profile_not_found'; end if;
 v_today := (now() at time zone v_tz)::date;
 if p_start_date is null or p_end_date is null or p_start_date < v_today
    or p_start_date > v_today + 30 or p_end_date < p_start_date
    or p_end_date > p_start_date + 30 then
   raise exception 'invalid_start_date';
 end if;
 if p_with_friends then
   if p_start_date <= v_today then raise exception 'invalid_start_date'; end if;
   return public.create_challenge(p_title, p_goal_type, p_target_value, p_stake_cents,
     p_start_date, p_end_date - p_start_date + 1, 'private', 20, 'pool');
 end if;
 -- Reuse target, credit and concurrent-goal validation. All work rolls back on failure.
 v_goal := public.create_goal(p_title, p_goal_type, p_target_value, p_stake_cents, 'week');
 update public.challenges set
   starts_at = case when p_start_date = v_today then now() else p_start_date::timestamp at time zone v_tz end,
   ends_at = (p_end_date + 1)::timestamp at time zone v_tz
 where id = v_goal.id returning * into v_goal;
 return v_goal;
end;
$$;
revoke all on function public.create_scheduled_goal(text,text,integer,bigint,date,date,boolean) from public, anon;
grant execute on function public.create_scheduled_goal(text,text,integer,bigint,date,date,boolean) to authenticated;
