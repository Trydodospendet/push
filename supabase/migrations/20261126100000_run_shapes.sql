-- Ausbau 2, part 9 – mini maps for the run history.
--
-- Returns only the SHAPE of each route: at most 28 points, already without the first and last
-- 200 m, scaled into a 0–1000 box. No coordinates, so the position cannot be derived from it.

create function public.get_my_run_shapes(p_limit integer default 30)
returns table (run_id uuid, shape jsonb)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  r record;
  v_min_lat double precision;
  v_max_lat double precision;
  v_min_lng double precision;
  v_max_lng double precision;
  v_cos double precision;
  v_scale double precision;
  v_count integer;
  v_step integer;
begin
  for r in
    select g.id from public.gps_runs g
     where g.user_id = v_user_id and g.distance_m >= 400 and g.point_count >= 10
     order by g.started_at desc
     limit greatest(1, least(coalesce(p_limit, 30), 100))
  loop
    select count(*), min(t.lat), max(t.lat), min(t.lng), max(t.lng)
      into v_count, v_min_lat, v_max_lat, v_min_lng, v_max_lng
      from public.get_gps_run_route(r.id) t;
    if v_count < 2 then
      continue;
    end if;
    v_cos := cos(radians((v_min_lat + v_max_lat) / 2));
    v_scale := greatest(v_max_lat - v_min_lat, (v_max_lng - v_min_lng) * v_cos, 0.00001);
    v_step := greatest(1, ceil(v_count / 28.0)::integer);

    run_id := r.id;
    select jsonb_agg(jsonb_build_array(
             round(((t.lng - v_min_lng) * v_cos / v_scale) * 1000)::integer,
             round(((v_max_lat - t.lat) / v_scale) * 1000)::integer) order by t.seq)
      into shape
      from public.get_gps_run_route(r.id) t
     where (t.seq - 1) % v_step = 0 or t.seq = v_count;
    return next;
  end loop;
end;
$$;

revoke all on function public.get_my_run_shapes(integer) from public, anon;
grant execute on function public.get_my_run_shapes(integer) to authenticated;
