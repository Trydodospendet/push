-- Ausbau 2, part 9 – run experience: altitude, splits per km, elevation/pace profile, records and
-- weekly / monthly statistics. Everything is computed by the server from the stored raw track;
-- the app only draws it. Splits and the profile contain NO coordinates (privacy: only the owner
-- ever gets a route, and then without the first and last 200 m).

-- p_run = {"client_run_id": "<uuid>", "points": [[lat, lng, epoch_ms, accuracy_m, segment, mocked, altitude_m?], …]}
-- A new segment number starts after every pause; nothing is measured between segments.
-- Rules (numbers match docs/SECURITY_NOTES.md):
--   * points with an accuracy worse than 50 m are ignored
--   * a step faster than 12 m/s (about 2:19 min/km, i.e. not on foot) is a jump: it is not
--     counted; three or more jumps invalidate the run; after five jumps in a row the track is
--     taken to continue at the new place (nothing is counted for the move)
--   * any point flagged as mocked by the phone invalidates the run
--   * same pace limits as health runs: faster than 2:30 or slower than 15:00 min/km, plus more
--     than 10 % of the distance at faster than 2:05 min/km (8 m/s)
create or replace function public.sync_gps_run(p_run jsonb)
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
      if jsonb_typeof(p) is distinct from 'array' or jsonb_array_length(p) not in (6, 7)
         or jsonb_typeof(p->0) is distinct from 'number'
         or jsonb_typeof(p->1) is distinct from 'number'
         or jsonb_typeof(p->2) is distinct from 'number'
         or jsonb_typeof(p->3) is distinct from 'number'
         or jsonb_typeof(p->4) is distinct from 'number'
         or jsonb_typeof(p->5) is distinct from 'number'
         or (jsonb_array_length(p) = 7 and jsonb_typeof(p->6) not in ('number', 'null')) then
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
-- Walk through the track: the same rules as sync_gps_run (accuracy, segments, jumps)
------------------------------------------------------------------------------------------

-- Accepted steps of a run: cumulative distance and time at the end of every counted step, with
-- the altitude of that point. Used by the splits and the profile.
create function private.gps_steps(p_run_id uuid, p_user_id uuid)
returns table (
  ord integer,
  cum_dist double precision,
  cum_time double precision,
  step_dist double precision,
  step_time double precision,
  altitude double precision
)
language plpgsql
stable
set search_path = ''
as $$
declare
  r record;
  v_have boolean := false;
  v_prev_lat double precision;
  v_prev_lng double precision;
  v_prev_t bigint;
  v_prev_seg integer;
  v_streak integer := 0;
  v_dist double precision := 0;
  v_time double precision := 0;
  v_step double precision;
  v_dt double precision;
  v_alt double precision;
begin
  for r in
    select (e.ord)::integer as o, e.p as p
      from public.gps_runs g,
           lateral jsonb_array_elements(g.route) with ordinality as e (p, ord)
     where g.id = p_run_id and g.user_id = p_user_id
     order by e.ord
  loop
    if (r.p->>3)::double precision > 50 then
      continue;
    end if;
    v_alt := case when jsonb_array_length(r.p) = 7 and jsonb_typeof(r.p->6) = 'number'
                  then (r.p->>6)::double precision end;
    if not v_have or (r.p->>4)::integer <> v_prev_seg then
      v_have := true;
      v_prev_lat := (r.p->>0)::double precision;
      v_prev_lng := (r.p->>1)::double precision;
      v_prev_t := (r.p->>2)::numeric::bigint;
      v_prev_seg := (r.p->>4)::integer;
      continue;
    end if;
    v_dt := ((r.p->>2)::numeric::bigint - v_prev_t) / 1000.0;
    if v_dt <= 0 then
      continue;
    end if;
    v_step := private.haversine_m(v_prev_lat, v_prev_lng,
                                  (r.p->>0)::double precision, (r.p->>1)::double precision);
    if v_step / v_dt > 12 then
      v_streak := v_streak + 1;
      if v_streak >= 5 then
        v_prev_lat := (r.p->>0)::double precision;
        v_prev_lng := (r.p->>1)::double precision;
        v_prev_t := (r.p->>2)::numeric::bigint;
        v_streak := 0;
      end if;
      continue;
    end if;
    v_streak := 0;
    v_dist := v_dist + v_step;
    v_time := v_time + v_dt;
    ord := r.o; cum_dist := v_dist; cum_time := v_time; step_dist := v_step; step_time := v_dt;
    altitude := v_alt;
    return next;
    v_prev_lat := (r.p->>0)::double precision;
    v_prev_lng := (r.p->>1)::double precision;
    v_prev_t := (r.p->>2)::numeric::bigint;
  end loop;
end;
$$;

revoke all on function private.gps_steps(uuid, uuid) from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Splits per kilometre
------------------------------------------------------------------------------------------

-- One row per full kilometre and one for the rest. Times are interpolated inside the step that
-- crosses the mark. ascent_m is the sum of upward altitude changes (null without altitude).
create function public.get_gps_run_splits(p_run_id uuid)
returns table (km integer, distance_m integer, seconds integer, pace_s_per_km integer, ascent_m integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  s record;
  v_prev_dist double precision := 0;
  v_prev_time double precision := 0;
  v_split_start_dist double precision := 0;
  v_split_start_time double precision := 0;
  v_next_mark double precision := 1000;
  v_k integer := 1;
  v_cross double precision;
  v_ascent double precision := 0;
  v_has_alt boolean := false;
  v_prev_alt double precision;
begin
  for s in select * from private.gps_steps(p_run_id, v_user_id) order by ord loop
    if s.altitude is not null then
      v_has_alt := true;
      -- Hysteresis against GPS noise: a climb counts once it is at least 1 m above the lowest
      -- point since the last counted climb.
      if v_prev_alt is null or s.altitude < v_prev_alt then
        v_prev_alt := s.altitude;
      elsif s.altitude >= v_prev_alt + 1 then
        v_ascent := v_ascent + (s.altitude - v_prev_alt);
        v_prev_alt := s.altitude;
      end if;
    end if;
    while s.cum_dist >= v_next_mark loop
      v_cross := v_prev_time + s.step_time * ((v_next_mark - v_prev_dist) / s.step_dist);
      km := v_k;
      distance_m := 1000;
      seconds := round(v_cross - v_split_start_time);
      pace_s_per_km := seconds;
      ascent_m := case when v_has_alt then round(v_ascent) end;
      return next;
      v_split_start_time := v_cross;
      v_split_start_dist := v_next_mark;
      v_next_mark := v_next_mark + 1000;
      v_k := v_k + 1;
      v_ascent := 0;
    end loop;
    v_prev_dist := s.cum_dist;
    v_prev_time := s.cum_time;
  end loop;

  if v_prev_dist - v_split_start_dist >= 50 then
    km := v_k;
    distance_m := round(v_prev_dist - v_split_start_dist);
    seconds := round(v_prev_time - v_split_start_time);
    pace_s_per_km := round((v_prev_time - v_split_start_time) / ((v_prev_dist - v_split_start_dist) / 1000));
    ascent_m := case when v_has_alt then round(v_ascent) end;
    return next;
  end if;
end;
$$;

------------------------------------------------------------------------------------------
-- Profile: pace and altitude over the distance (no coordinates)
------------------------------------------------------------------------------------------

-- About 100 points: every `interval` metres (at least 50) the average pace of that stretch and
-- the altitude there.
create function public.get_gps_run_profile(p_run_id uuid)
returns table (distance_m integer, altitude_m integer, pace_s_per_km integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  s record;
  v_total double precision;
  v_interval double precision;
  v_next double precision;
  v_last_dist double precision := 0;
  v_last_time double precision := 0;
  v_alt double precision;
begin
  select coalesce(max(cum_dist), 0) into v_total from private.gps_steps(p_run_id, v_user_id);
  if v_total <= 0 then
    return;
  end if;
  v_interval := greatest(50, v_total / 100);
  v_next := v_interval;
  for s in select * from private.gps_steps(p_run_id, v_user_id) order by ord loop
    v_alt := coalesce(s.altitude, v_alt);
    if s.cum_dist >= v_next then
      distance_m := round(s.cum_dist);
      altitude_m := case when v_alt is null then null else round(v_alt) end;
      pace_s_per_km := round((s.cum_time - v_last_time) / ((s.cum_dist - v_last_dist) / 1000));
      return next;
      v_last_dist := s.cum_dist;
      v_last_time := s.cum_time;
      v_next := s.cum_dist + v_interval;
    end if;
  end loop;
end;
$$;

------------------------------------------------------------------------------------------
-- Personal records
------------------------------------------------------------------------------------------

-- Longest run, fastest average pace over runs of at least 1 / 5 / 10 km and the best week
-- (all valid runs, from GPS and from the health platforms).
create function public.get_my_records()
returns table (kind text, value bigint, achieved_at timestamptz)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_tz text;
  v_min integer;
begin
  select p.timezone into v_tz from public.profiles p where p.id = v_user_id;

  kind := 'longest_run';
  select w.distance_m, w.start_at into value, achieved_at
    from public.activity_workouts w
   where w.user_id = v_user_id and w.is_valid and not w.was_user_entered
   order by w.distance_m desc, w.start_at desc limit 1;
  if found then
    return next;
  end if;

  foreach v_min in array array[1000, 5000, 10000] loop
    kind := 'fastest_pace_' || (v_min / 1000) || 'k';
    select round(w.duration_s::numeric * 1000 / w.distance_m)::bigint, w.start_at into value, achieved_at
      from public.activity_workouts w
     where w.user_id = v_user_id and w.is_valid and not w.was_user_entered and w.distance_m >= v_min
     order by w.duration_s::numeric / w.distance_m, w.start_at desc limit 1;
    if found then
      return next;
    end if;
  end loop;

  kind := 'best_week';
  select t.dist, t.week into value, achieved_at
    from (
      select sum(w.distance_m)::bigint as dist,
             (date_trunc('week', w.start_at at time zone v_tz) at time zone v_tz) as week
        from public.activity_workouts w
       where w.user_id = v_user_id and w.is_valid and not w.was_user_entered
       group by 2
    ) t
   order by t.dist desc, t.week desc limit 1;
  if found then
    return next;
  end if;
end;
$$;

------------------------------------------------------------------------------------------
-- Weekly and monthly statistics
------------------------------------------------------------------------------------------

-- The last p_count weeks or months (including the current one), oldest first, with zeros for
-- periods without a run. Weeks start on Monday in the user's timezone.
create function public.get_my_period_stats(p_unit text, p_count integer default 8)
returns table (period_start date, distance_m bigint, runs integer, duration_s bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_tz text;
  v_today date;
  v_count integer := greatest(1, least(coalesce(p_count, 8), 24));
begin
  if p_unit is null or p_unit not in ('week', 'month') then
    raise exception using errcode = 'P0001', message = 'invalid_period';
  end if;
  select p.timezone into v_tz from public.profiles p where p.id = v_user_id;
  v_today := (now() at time zone v_tz)::date;

  return query
  with periods as (
    select (date_trunc(p_unit, v_today::timestamp) - (g.i || ' ' || p_unit || 's')::interval)::date as start
      from generate_series(0, v_count - 1) g (i)
  )
  select pe.start,
         coalesce(sum(w.distance_m), 0)::bigint,
         count(w.id)::integer,
         coalesce(sum(w.duration_s), 0)::bigint
    from periods pe
    left join public.activity_workouts w
      on w.user_id = v_user_id and w.is_valid and not w.was_user_entered
     and (w.start_at at time zone v_tz)::date >= pe.start
     and (w.start_at at time zone v_tz)::date < (pe.start + ('1 ' || p_unit)::interval)::date
   group by pe.start
   order by pe.start;
end;
$$;

revoke all on function public.get_gps_run_splits(uuid), public.get_gps_run_profile(uuid),
  public.get_my_records(), public.get_my_period_stats(text, integer) from public, anon;
grant execute on function public.get_gps_run_splits(uuid) to authenticated;
grant execute on function public.get_gps_run_profile(uuid) to authenticated;
grant execute on function public.get_my_records() to authenticated;
grant execute on function public.get_my_period_stats(text, integer) to authenticated;
