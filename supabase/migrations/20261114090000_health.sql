-- Phase 3: health ingestion is authenticated, bounded and server-validated.
alter table public.activity_daily_steps
  add column excluded_sources integer not null default 0 check (excluded_sources >= 0);

create function private.recompute_health_progress(p_challenge_id uuid)
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
    else 0 end
  where cp.challenge_id = c.id;
end;
$$;
revoke all on function private.recompute_health_progress(uuid) from public, anon, authenticated;

create function public.recompute_progress(p_challenge_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); c public.challenges;
begin
  select * into c from public.challenges where id = p_challenge_id for update;
  if not exists (select 1 from public.challenge_participants
      where challenge_id = p_challenge_id and user_id = u) then
    raise exception using errcode = '42501', message = 'not_joined';
  end if;
  if now() >= c.ends_at + make_interval(hours => c.sync_grace_hours) then return; end if;
  perform private.recompute_health_progress(p_challenge_id);
end;
$$;

create function private.refresh_health_challenges(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  -- Consistent lock order for concurrent syncs and future settlement.
  for v_id in select c.id from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
    where cp.user_id = p_user_id and c.status in ('active', 'settling')
      and now() < c.ends_at + make_interval(hours => c.sync_grace_hours)
    order by c.id
  loop
    perform private.recompute_health_progress(v_id);
  end loop;
end;
$$;
revoke all on function private.refresh_health_challenges(uuid) from public, anon, authenticated;

create function public.sync_workouts(p_workouts jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  u uuid := private.require_uid(); r jsonb; v_start timestamptz; v_end timestamptz;
  v_distance integer; v_duration integer; v_manual boolean; v_reason text; n integer := 0;
begin
  if jsonb_typeof(p_workouts) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_health_payload';
  end if;
  if jsonb_array_length(p_workouts) > 500 then
    raise exception using errcode = '22023', message = 'health_batch_too_large';
  end if;
  perform 1 from public.profiles where id = u for update;
  for r in select value from jsonb_array_elements(p_workouts) loop
    if jsonb_typeof(r) is distinct from 'object'
      or coalesce(r->>'platform', '') not in ('ios', 'android')
      or coalesce(r->>'activity_type', '') <> 'running'
      or coalesce(length(r->>'source_record_id'), 0) not between 1 and 256
      or coalesce(length(r->>'source_name'), 0) > 256
      or jsonb_typeof(r->'was_user_entered') is distinct from 'boolean'
      or jsonb_typeof(r->'distance_m') is distinct from 'number'
      or jsonb_typeof(r->'duration_s') is distinct from 'number'
      or coalesce(r->>'distance_m', '') !~ '^-?[0-9]+$'
      or coalesce(r->>'duration_s', '') !~ '^-?[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_health_payload';
    end if;
    v_start := (r->>'start_at')::timestamptz;
    v_end := (r->>'end_at')::timestamptz;
    if v_start is null or v_end is null or not isfinite(v_start) or not isfinite(v_end) then
      raise exception using errcode = '22023', message = 'invalid_health_payload';
    end if;
    if v_start < now() - interval '45 days' then
      raise exception using errcode = '22023', message = 'health_outside_window';
    end if;
    v_distance := (r->>'distance_m')::integer;
    v_duration := (r->>'duration_s')::integer;
    v_manual := (r->>'was_user_entered')::boolean;
    v_reason := case
      when v_manual then 'manual_entry'
      when v_distance <= 0 or v_duration < 60 or v_start > now() or v_end > now()
        or v_end <= v_start or v_duration > extract(epoch from v_end - v_start) + 1
        then 'invalid_data'
      when v_duration::bigint * 1000 < v_distance::bigint * 150 then 'too_fast'
      when v_duration::bigint * 1000 > v_distance::bigint * 900 then 'too_slow'
      else null end;
    insert into public.activity_workouts (
      user_id, platform, source_record_id, source_name, activity_type, start_at, end_at,
      distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
    values (u, r->>'platform', r->>'source_record_id', r->>'source_name', 'running',
      v_start, v_end, v_distance, v_duration, v_manual, v_reason is null, v_reason)
    on conflict (user_id, platform, source_record_id) do update set
      source_name = excluded.source_name, start_at = excluded.start_at, end_at = excluded.end_at,
      distance_m = excluded.distance_m, duration_s = excluded.duration_s,
      was_user_entered = excluded.was_user_entered, is_valid = excluded.is_valid,
      invalid_reason = excluded.invalid_reason, synced_at = now();
    n := n + 1;
  end loop;
  perform private.refresh_health_challenges(u);
  return n;
end;
$$;

create function public.sync_daily_steps(p_days jsonb)
returns integer language plpgsql security definer set search_path = '' as $$
declare u uuid := private.require_uid(); r jsonb; d date; s integer; x integer;
  tz text; today date; n integer := 0;
begin
  if jsonb_typeof(p_days) is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_health_payload';
  end if;
  if jsonb_array_length(p_days) > 45 then
    raise exception using errcode = '22023', message = 'health_batch_too_large';
  end if;
  select timezone into tz from public.profiles where id = u for update;
  today := (now() at time zone tz)::date;
  for r in select value from jsonb_array_elements(p_days) loop
    if jsonb_typeof(r) is distinct from 'object'
      or coalesce(r->>'platform', '') not in ('ios', 'android')
      or coalesce(r->>'date', '') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
      or jsonb_typeof(r->'steps') is distinct from 'number'
      or coalesce(r->>'steps', '') !~ '^[0-9]+$'
      or coalesce(r->>'excluded_sources', '0') !~ '^[0-9]+$' then
      raise exception using errcode = '22023', message = 'invalid_health_payload';
    end if;
    d := (r->>'date')::date; s := (r->>'steps')::integer;
    x := coalesce((r->>'excluded_sources')::integer, 0);
    if d < today - 44 or d > today then
      raise exception using errcode = '22023', message = 'health_outside_window';
    end if;
    insert into public.activity_daily_steps(user_id, date, steps, platform, is_valid, excluded_sources)
    values (u, d, s, r->>'platform', s <= 80000, x)
    on conflict (user_id, date) do update set steps = excluded.steps,
      platform = excluded.platform, is_valid = excluded.is_valid,
      excluded_sources = excluded.excluded_sources, synced_at = now();
    n := n + 1;
  end loop;
  perform private.refresh_health_challenges(u);
  return n;
end;
$$;

revoke all on function public.sync_workouts(jsonb) from public, anon;
revoke all on function public.sync_daily_steps(jsonb) from public, anon;
revoke all on function public.recompute_progress(uuid) from public, anon;
grant execute on function public.sync_workouts(jsonb) to authenticated;
grant execute on function public.sync_daily_steps(jsonb) to authenticated;
grant execute on function public.recompute_progress(uuid) to authenticated;
