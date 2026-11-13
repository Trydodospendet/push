-- Phase 8 – own GPS run tracking, next to Health Connect / Apple Health.
--
-- The phone records a track and uploads the raw points when the run is over. The SERVER
-- recomputes distance and time from the points (the client's own numbers are never used),
-- rejects fake and implausible tracks and mirrors the result into activity_workouts with
-- platform = 'gps'. From there on a GPS run counts like any other run: challenge progress,
-- statistics, feed and badges all read activity_workouts.
--
-- Privacy: the route lives in gps_runs, which no client can read directly. Only its owner gets
-- the route back through get_gps_run_route, and even then without the first and last 200 m.
-- Other participants only ever see the distance.

------------------------------------------------------------------------------------------
-- activity_workouts may now come from the app itself
------------------------------------------------------------------------------------------

alter table public.activity_workouts drop constraint activity_workouts_platform_valid;
alter table public.activity_workouts
  add constraint activity_workouts_platform_valid check (platform in ('ios', 'android', 'gps'));

alter table public.activity_workouts drop constraint activity_workouts_invalid_reason_valid;
alter table public.activity_workouts
  add constraint activity_workouts_invalid_reason_valid check (
    (is_valid and invalid_reason is null)
    or (
      not is_valid
      and invalid_reason in (
        'manual_entry', 'too_fast', 'too_slow', 'invalid_data',
        'mock_location', 'gps_jump', 'duplicate'
      )
    )
  );

------------------------------------------------------------------------------------------
-- Distance between two points (metres, haversine, mean earth radius)
------------------------------------------------------------------------------------------

create function private.haversine_m(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
)
returns double precision
language sql
immutable
set search_path = ''
as $$
  select 2 * 6371000 * asin(least(1, sqrt(
    power(sin(radians(p_lat2 - p_lat1) / 2), 2)
    + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
  )));
$$;

revoke all on function private.haversine_m(double precision, double precision, double precision, double precision)
  from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Raw tracks (no direct client access at all)
------------------------------------------------------------------------------------------

create table public.gps_runs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- Chosen by the phone; makes uploads idempotent.
  client_run_id uuid not null,
  workout_id uuid not null references public.activity_workouts (id) on delete cascade,
  started_at timestamptz not null,
  ended_at timestamptz not null,
  -- Recomputed by the server.
  distance_m integer not null,
  duration_s integer not null,
  point_count integer not null,
  jump_count integer not null,
  mocked_count integer not null,
  -- The server's verdict on the track itself (null = fine), before duplicates are considered.
  base_reason text null,
  -- [[lat, lng, epoch_ms, accuracy_m, segment, mocked], …] exactly as uploaded.
  route jsonb not null,
  created_at timestamptz not null default now(),
  constraint gps_runs_client_unique unique (user_id, client_run_id),
  constraint gps_runs_base_reason_valid check (
    base_reason is null
    or base_reason in ('too_fast', 'too_slow', 'invalid_data', 'mock_location', 'gps_jump')
  )
);

create index gps_runs_user_start_idx on public.gps_runs (user_id, started_at desc);

alter table public.gps_runs enable row level security;
revoke all on public.gps_runs from anon, authenticated;

------------------------------------------------------------------------------------------
-- One run must not count twice (GPS run + the same run from Health Connect / Apple Health)
------------------------------------------------------------------------------------------

-- A GPS run is a duplicate if a valid health run of the same user overlaps it by at least half
-- of the shorter one. Health data wins (the platform attests it). Runs the server rejected for
-- other reasons keep that reason. Safe to call at any time.
create function private.dedupe_gps_workouts(p_user_id uuid)
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
     and (w.is_valid, w.invalid_reason) is distinct from (d.reason is null, d.reason);
end;
$$;

revoke all on function private.dedupe_gps_workouts(uuid) from public, anon, authenticated;

-- Health syncs and GPS uploads share this: settle duplicates first, then recompute progress
-- and badges (same as before plus the duplicate check).
create or replace function private.refresh_health_challenges(p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare v_id uuid;
begin
  perform private.dedupe_gps_workouts(p_user_id);
  -- Consistent lock order for concurrent syncs and future settlement.
  for v_id in select c.id from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
    where cp.user_id = p_user_id and c.status in ('active', 'settling')
      and now() < c.ends_at + make_interval(hours => c.sync_grace_hours)
    order by c.id
  loop
    perform private.recompute_health_progress(v_id);
  end loop;
  perform private.award_badges(p_user_id);
end;
$$;

------------------------------------------------------------------------------------------
-- Upload
------------------------------------------------------------------------------------------

-- p_run = {"client_run_id": "<uuid>", "points": [[lat, lng, epoch_ms, accuracy_m, segment, mocked], …]}
-- A new segment number starts after every pause; nothing is measured between segments.
-- Rules (numbers match docs/SECURITY_NOTES.md):
--   * points with an accuracy worse than 50 m are ignored
--   * a step faster than 12 m/s (about 2:19 min/km, i.e. not on foot) is a jump: it is not
--     counted; three or more jumps invalidate the run; after five jumps in a row the track is
--     taken to continue at the new place (nothing is counted for the move)
--   * any point flagged as mocked by the phone invalidates the run
--   * same pace limits as health runs: faster than 2:30 or slower than 15:00 min/km, plus more
--     than 10 % of the distance at faster than 2:05 min/km (8 m/s)
create function public.sync_gps_run(p_run jsonb)
returns table (
  run_id uuid,
  distance_m integer,
  duration_s integer,
  is_valid boolean,
  invalid_reason text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  u uuid := private.require_uid();
  c_max_points constant integer := 20000;
  c_max_accuracy constant double precision := 50;
  c_jump_speed constant double precision := 12;
  c_fast_speed constant double precision := 8;
  v_client uuid;
  v_points jsonb;
  v_count integer;
  r record;
  p jsonb;
  v_lat double precision;
  v_lng double precision;
  v_t bigint;
  v_acc double precision;
  v_seg integer;
  v_mock integer;
  v_last_t bigint := 0;
  v_have_prev boolean := false;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_t bigint;
  v_prev_seg integer;
  v_first_t bigint;
  v_last_used_t bigint;
  v_used integer := 0;
  v_jumps integer := 0;
  v_jump_streak integer := 0;
  v_mocked integer := 0;
  v_dist double precision := 0;
  v_fast_dist double precision := 0;
  v_dur double precision := 0;
  v_step double precision;
  v_dt double precision;
  v_speed double precision;
  v_distance integer;
  v_duration integer;
  v_started timestamptz;
  v_ended timestamptz;
  v_reason text;
  v_workout_id uuid;
  v_run_id uuid;
begin
  if jsonb_typeof(p_run) is distinct from 'object'
     or coalesce(p_run->>'client_run_id', '') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or jsonb_typeof(p_run->'points') is distinct from 'array' then
    raise exception using errcode = '22023', message = 'invalid_gps_payload';
  end if;
  v_client := (p_run->>'client_run_id')::uuid;
  v_points := p_run->'points';
  v_count := jsonb_array_length(v_points);
  if v_count > c_max_points then
    raise exception using errcode = '22023', message = 'gps_batch_too_large';
  end if;
  if v_count < 2 then
    raise exception using errcode = '22023', message = 'invalid_gps_payload';
  end if;

  perform 1 from public.profiles where id = u for update;

  -- Uploading the same run again changes nothing.
  select g.id into v_run_id from public.gps_runs g
   where g.user_id = u and g.client_run_id = v_client;
  if v_run_id is null then
    if (select count(*) from public.gps_runs g
         where g.user_id = u and g.created_at > now() - interval '24 hours') >= 30 then
      raise exception using errcode = 'P0001', message = 'gps_rate_limited';
    end if;

    for r in select value as pt from jsonb_array_elements(v_points) loop
      p := r.pt;
      if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) <> 6
         or jsonb_typeof(p->0) is distinct from 'number'
         or jsonb_typeof(p->1) is distinct from 'number'
         or jsonb_typeof(p->2) is distinct from 'number'
         or jsonb_typeof(p->3) is distinct from 'number'
         or jsonb_typeof(p->4) is distinct from 'number'
         or jsonb_typeof(p->5) is distinct from 'number' then
        raise exception using errcode = '22023', message = 'invalid_gps_payload';
      end if;
      v_lat := (p->>0)::double precision;
      v_lng := (p->>1)::double precision;
      v_t := (p->>2)::numeric::bigint;
      v_acc := (p->>3)::double precision;
      v_seg := (p->>4)::numeric::integer;
      v_mock := (p->>5)::numeric::integer;
      if v_lat not between -90 and 90 or v_lng not between -180 and 180
         or v_t < 0 or v_acc < 0 or v_seg < 0 or v_mock not in (0, 1)
         or v_t < v_last_t then
        raise exception using errcode = '22023', message = 'invalid_gps_payload';
      end if;
      v_last_t := v_t;

      if v_acc > c_max_accuracy then
        continue;
      end if;
      if v_mock = 1 then
        v_mocked := v_mocked + 1;
      end if;

      if not v_have_prev or v_seg <> v_prev_seg then
        v_have_prev := true;
        v_prev_lat := v_lat; v_prev_lng := v_lng; v_prev_t := v_t; v_prev_seg := v_seg;
        v_used := v_used + 1;
        v_first_t := coalesce(v_first_t, v_t);
        v_last_used_t := v_t;
        continue;
      end if;

      v_dt := (v_t - v_prev_t) / 1000.0;
      if v_dt <= 0 then
        continue;
      end if;
      v_step := private.haversine_m(v_prev_lat, v_prev_lng, v_lat, v_lng);
      v_speed := v_step / v_dt;
      if v_speed > c_jump_speed then
        v_jumps := v_jumps + 1;
        v_jump_streak := v_jump_streak + 1;
        if v_jump_streak >= 5 then
          v_prev_lat := v_lat; v_prev_lng := v_lng; v_prev_t := v_t;
          v_jump_streak := 0;
        end if;
        continue;
      end if;
      v_jump_streak := 0;
      v_dist := v_dist + v_step;
      v_dur := v_dur + v_dt;
      if v_speed > c_fast_speed and v_dt >= 2 then
        v_fast_dist := v_fast_dist + v_step;
      end if;
      v_prev_lat := v_lat; v_prev_lng := v_lng; v_prev_t := v_t;
      v_used := v_used + 1;
      v_last_used_t := v_t;
    end loop;

    v_distance := round(v_dist);
    v_duration := round(v_dur);
    v_started := to_timestamp(coalesce(v_first_t, 0) / 1000.0);
    v_ended := to_timestamp(coalesce(v_last_used_t, 0) / 1000.0);

    v_reason := case
      when v_mocked > 0 then 'mock_location'
      when v_jumps >= 3 then 'gps_jump'
      when v_used < 10 or v_distance <= 0 or v_duration < 60 or v_first_t is null
        or v_ended > now() + interval '1 minute' or v_started < now() - interval '45 days'
        then 'invalid_data'
      when v_duration::bigint * 1000 < v_distance::bigint * 150 or v_fast_dist > 0.1 * v_dist
        then 'too_fast'
      when v_duration::bigint * 1000 > v_distance::bigint * 900 then 'too_slow'
      else null end;

    insert into public.activity_workouts (
      user_id, platform, source_record_id, source_name, activity_type, start_at, end_at,
      distance_m, duration_s, was_user_entered, is_valid, invalid_reason)
    values (u, 'gps', v_client::text, 'PUSH GPS', 'running', v_started, v_ended,
      v_distance, v_duration, false, v_reason is null, v_reason)
    returning id into v_workout_id;

    insert into public.gps_runs (
      user_id, client_run_id, workout_id, started_at, ended_at, distance_m, duration_s,
      point_count, jump_count, mocked_count, base_reason, route)
    values (u, v_client, v_workout_id, v_started, v_ended, v_distance, v_duration,
      v_used, v_jumps, v_mocked, v_reason, v_points)
    returning id into v_run_id;

    perform private.refresh_health_challenges(u);
  end if;

  return query
  select g.id, w.distance_m, w.duration_s, w.is_valid, w.invalid_reason
    from public.gps_runs g
    join public.activity_workouts w on w.id = g.workout_id
   where g.id = v_run_id;
end;
$$;

------------------------------------------------------------------------------------------
-- Reading (own runs only)
------------------------------------------------------------------------------------------

create function public.get_my_gps_runs(p_limit integer default 30)
returns table (
  id uuid,
  started_at timestamptz,
  ended_at timestamptz,
  distance_m integer,
  duration_s integer,
  is_valid boolean,
  invalid_reason text,
  has_route boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.started_at, g.ended_at, w.distance_m, w.duration_s, w.is_valid, w.invalid_reason,
         g.distance_m >= 400 and g.point_count >= 10
    from public.gps_runs g
    join public.activity_workouts w on w.id = g.workout_id
   where g.user_id = private.require_uid()
   order by g.started_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

-- The route of an own run without its first and last 200 m (nobody learns where you live or
-- start). Runs shorter than 400 m have nothing left to show. Other people's runs return nothing.
create function public.get_gps_run_route(p_run_id uuid)
returns table (seq integer, lat double precision, lng double precision, segment integer)
language sql
stable
security definer
set search_path = ''
as $$
  with pts as (
    select (e.ord)::integer as ord,
           (e.p->>0)::double precision as lat,
           (e.p->>1)::double precision as lng,
           (e.p->>4)::integer as seg
      from public.gps_runs g,
           lateral jsonb_array_elements(g.route) with ordinality as e (p, ord)
     where g.id = p_run_id
       and g.user_id = private.require_uid()
       and (e.p->>3)::double precision <= 50
  ),
  steps as (
    select ord, lat, lng, seg,
           -- The first point has no predecessor (and least() would turn a NULL into a huge step).
           case when lag(lat) over (order by ord) is null then 0
                else private.haversine_m(
                  lag(lat) over (order by ord), lag(lng) over (order by ord), lat, lng)
           end as d
      from pts
  ),
  cum as (
    select ord, lat, lng, seg, sum(d) over (order by ord) as c from steps
  )
  select (row_number() over (order by ord))::integer, lat, lng, seg
    from cum
   where c >= 200 and c <= (select max(c) from cum) - 200
   order by ord;
$$;

revoke all on function public.sync_gps_run(jsonb), public.get_my_gps_runs(integer),
  public.get_gps_run_route(uuid) from public, anon;
grant execute on function public.sync_gps_run(jsonb) to authenticated;
grant execute on function public.get_my_gps_runs(integer) to authenticated;
grant execute on function public.get_gps_run_route(uuid) to authenticated;
