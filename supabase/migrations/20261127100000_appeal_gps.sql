-- Ausbau 2, part 13 – the app knows GPS runs by their run id, not by the id of the mirrored
-- workout. This wrapper files the appeal for the workout behind an own GPS run.

create function public.submit_gps_run_appeal(p_run_id uuid, p_message text)
returns public.appeals
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_workout_id uuid;
begin
  select g.workout_id into v_workout_id
    from public.gps_runs g
   where g.id = p_run_id and g.user_id = private.require_uid();
  if v_workout_id is null then
    raise exception using errcode = 'P0001', message = 'workout_not_found';
  end if;
  return public.submit_appeal(v_workout_id, p_message);
end;
$$;

-- Which of the own GPS runs have an appeal, and how it stands.
create function public.get_my_gps_run_appeals()
returns table (run_id uuid, status text, resolution_note text)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, a.status, a.resolution_note
    from public.appeals a
    join public.gps_runs g on g.workout_id = a.workout_id
   where a.user_id = private.require_uid();
$$;

revoke all on function public.submit_gps_run_appeal(uuid, text),
  public.get_my_gps_run_appeals() from public, anon;
grant execute on function public.submit_gps_run_appeal(uuid, text) to authenticated;
grant execute on function public.get_my_gps_run_appeals() to authenticated;
