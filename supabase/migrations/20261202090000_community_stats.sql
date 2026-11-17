-- Honest community numbers for the home screen: only aggregates and anonymous events,
-- computed from real activity. No names, no user ids, no money logic touched.

-- Runs of today (Berlin time), reached goals of the last seven days and the donation total of
-- the month as one row.
create function public.get_community_stats()
returns table (runs_today bigint, goals_week bigint, donated_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.activity_workouts w
      where w.is_valid and w.activity_type = 'running'
        and w.start_at >= date_trunc('day', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin')::bigint,
    (select count(*) from public.challenge_participants cp
       join public.challenges c on c.id = cp.challenge_id
      where cp.result = 'success' and c.settled_at >= now() - interval '7 days')::bigint,
    public.get_community_donations()
   where private.require_uid() is not null;
$$;

revoke all on function public.get_community_stats() from public, anon;
grant execute on function public.get_community_stats() to authenticated;

-- The latest real events without any person: a valid run (whole kilometres, at least 1 km) or a
-- reached goal. At most 8, newest first.
create function public.get_community_events()
returns table (kind text, goal_type text, value integer, happened_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select e.kind, e.goal_type, e.value, e.happened_at
    from (
      select 'run'::text as kind, null::text as goal_type,
             (w.distance_m / 1000)::integer as value, w.end_at as happened_at
        from public.activity_workouts w
       where w.is_valid and w.activity_type = 'running'
         and w.distance_m >= 1000 and w.end_at >= now() - interval '2 days' and w.end_at <= now()
      union all
      select 'goal', c.goal_type, c.target_value, c.settled_at
        from public.challenge_participants cp
        join public.challenges c on c.id = cp.challenge_id
       where cp.result = 'success' and c.settled_at >= now() - interval '2 days'
    ) e
   where private.require_uid() is not null
   order by e.happened_at desc
   limit 8;
$$;

revoke all on function public.get_community_events() from public, anon;
grant execute on function public.get_community_events() to authenticated;
