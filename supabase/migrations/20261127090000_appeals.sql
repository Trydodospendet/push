-- Ausbau 2, part 13 – appeals against rejected activities.
--
-- A user can object to a run that does not count (too fast, jump in the GPS track, …) and say
-- why. The objection is reviewed by a person (the operator); there is no automatic approval.
-- Accepting an appeal makes the run count again and survives later syncs. Manual entries cannot
-- be appealed (they never count, by rule).
--
-- Operator, in the Supabase SQL editor:
--   select * from public.appeals where status = 'open' order by created_at;
--   select private.resolve_appeal('<appeal id>', true,  'Kurze Begründung');   -- accept
--   select private.resolve_appeal('<appeal id>', false, 'Kurze Begründung');   -- reject

alter table public.activity_workouts add column appeal_accepted boolean not null default false;

create table public.appeals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  workout_id uuid not null references public.activity_workouts (id) on delete cascade,
  message text not null,
  status text not null default 'open',
  resolution_note text null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz null,
  constraint appeals_status_valid check (status in ('open', 'accepted', 'rejected')),
  constraint appeals_message_length check (char_length(btrim(message)) between 10 and 500),
  constraint appeals_one_per_workout unique (workout_id),
  constraint appeals_resolved_consistent check (
    (status = 'open' and resolved_at is null) or (status <> 'open' and resolved_at is not null)
  )
);

create index appeals_user_idx on public.appeals (user_id, created_at desc);

alter table public.appeals enable row level security;
revoke all on public.appeals from anon, authenticated;
grant select on public.appeals to authenticated;
create policy "appeals: users read their own appeals"
  on public.appeals for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Files an appeal for an own run that does not count. One appeal per run, at most 5 per day.
create function public.submit_appeal(p_workout_id uuid, p_message text)
returns public.appeals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_workout public.activity_workouts;
  v_appeal public.appeals;
begin
  select * into v_workout from public.activity_workouts w
   where w.id = p_workout_id and w.user_id = v_user_id;
  if v_workout.id is null then
    raise exception using errcode = 'P0001', message = 'workout_not_found';
  end if;
  if v_workout.is_valid then
    raise exception using errcode = 'P0001', message = 'workout_counts';
  end if;
  if v_workout.invalid_reason = 'manual_entry' then
    raise exception using errcode = 'P0001', message = 'manual_entry_not_appealable';
  end if;
  if char_length(btrim(coalesce(p_message, ''))) not between 10 and 500 then
    raise exception using errcode = 'P0001', message = 'invalid_appeal_message';
  end if;
  if (select count(*) from public.appeals a
       where a.user_id = v_user_id and a.created_at > now() - interval '24 hours') >= 5 then
    raise exception using errcode = 'P0001', message = 'appeal_rate_limited';
  end if;
  if exists (select 1 from public.appeals a where a.workout_id = p_workout_id) then
    raise exception using errcode = 'P0001', message = 'appeal_exists';
  end if;

  insert into public.appeals (user_id, workout_id, message)
  values (v_user_id, p_workout_id, btrim(p_message))
  returning * into v_appeal;
  return v_appeal;
end;
$$;

-- For the operator only (no client access): decides an appeal. Accepting makes the run valid
-- and recomputes the progress of the user's challenges.
create function private.resolve_appeal(p_appeal_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_appeal public.appeals;
begin
  select * into v_appeal from public.appeals where id = p_appeal_id for update;
  if v_appeal.id is null or v_appeal.status <> 'open' then
    raise exception using errcode = 'P0001', message = 'appeal_not_open';
  end if;

  update public.appeals
     set status = case when p_accept then 'accepted' else 'rejected' end,
         resolution_note = p_note,
         resolved_at = now()
   where id = p_appeal_id;

  if p_accept then
    update public.activity_workouts
       set is_valid = true, invalid_reason = null, appeal_accepted = true
     where id = v_appeal.workout_id;
    perform private.refresh_health_challenges(v_appeal.user_id);
  end if;
end;
$$;

revoke all on function public.submit_appeal(uuid, text) from public, anon;
grant execute on function public.submit_appeal(uuid, text) to authenticated;
revoke all on function private.resolve_appeal(uuid, boolean, text) from public, anon, authenticated;

-- An accepted appeal must survive later syncs of the same run.
create or replace function public.sync_workouts(p_workouts jsonb)
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
      or coalesce(r->>'distance_m', '') !~ '^-?[0-9]{1,9}$'
      or coalesce(r->>'duration_s', '') !~ '^-?[0-9]{1,9}$' then
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
      invalid_reason = excluded.invalid_reason, synced_at = now()
    where not public.activity_workouts.appeal_accepted;
    n := n + 1;
  end loop;
  perform private.refresh_health_challenges(u);
  return n;
end;
$$;

-- … and the duplicate check of GPS runs.
create or replace function private.dedupe_gps_workouts(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.activity_workouts w
     set is_valid = d.reason is null,
         invalid_reason = d.reason
    from (
      select g.workout_id,
             case
               when g.base_reason is not null then g.base_reason
               when exists (
                 select 1
                   from public.activity_workouts h, public.activity_workouts x
                  where x.id = g.workout_id
                    and h.user_id = g.user_id
                    and h.platform <> 'gps'
                    and h.is_valid and not h.was_user_entered
                    and extract(epoch from least(x.end_at, h.end_at) - greatest(x.start_at, h.start_at)) > 0
                    and extract(epoch from least(x.end_at, h.end_at) - greatest(x.start_at, h.start_at))
                        >= 0.5 * least(extract(epoch from x.end_at - x.start_at),
                                       extract(epoch from h.end_at - h.start_at))
               ) then 'duplicate'
             end as reason
        from public.gps_runs g
       where g.user_id = p_user_id
    ) d
   where w.id = d.workout_id
     and not w.appeal_accepted
     and (w.is_valid, w.invalid_reason) is distinct from (d.reason is null, d.reason);
end;
$$;
