-- Phase 7, part 4 – badges and levels. Everything is decided on the server; the app only
-- shows the result.

------------------------------------------------------------------------------------------
-- Streak as a reusable function (get_my_stats keeps its result, it now calls this)
------------------------------------------------------------------------------------------

create function private.user_streak(p_user_id uuid)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_today date;
  v_streak integer;
begin
  select (now() at time zone p.timezone)::date into v_today
    from public.profiles p where p.id = p_user_id;
  if v_today is null then
    return 0;
  end if;

  with active_days as (
    select (w.start_at at time zone p.timezone)::date as d
      from public.activity_workouts w
      join public.profiles p on p.id = w.user_id
     where w.user_id = p_user_id and w.is_valid and not w.was_user_entered
    union
    select s.date
      from public.activity_daily_steps s
     where s.user_id = p_user_id and s.is_valid and s.steps >= private.streak_min_steps()
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

  return coalesce(v_streak, 0);
end;
$$;

revoke all on function private.user_streak(uuid) from public, anon, authenticated;

create or replace function public.get_my_stats()
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
begin
  return query
  select private.user_streak(v_uid),
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

------------------------------------------------------------------------------------------
-- Badges
------------------------------------------------------------------------------------------

create table public.user_badges (
  user_id uuid not null references public.profiles (id) on delete cascade,
  badge text not null,
  awarded_at timestamptz not null default now(),
  -- Set once the app showed the celebration for this badge.
  seen_at timestamptz null,
  primary key (user_id, badge),
  constraint user_badges_badge_valid check (
    badge in ('first_challenge', 'first_win', 'streak_7', 'streak_30',
              'km_50', 'km_100', 'challenges_10')
  )
);

alter table public.user_badges enable row level security;
revoke all on public.user_badges from anon, authenticated;
grant select on public.user_badges to authenticated;
create policy "user_badges: users read their own badges"
  on public.user_badges for select
  to authenticated
  using (user_id = (select auth.uid()));

-- Points: 1 per kilometre run, 1 per 1,000 steps, 50 per won challenge (all valid data only).
create function private.user_points(p_user_id uuid)
returns bigint
language sql
stable
set search_path = ''
as $$
  select coalesce((select sum(w.distance_m) from public.activity_workouts w
                    where w.user_id = p_user_id and w.is_valid and not w.was_user_entered), 0) / 1000
       + coalesce((select sum(s.steps) from public.activity_daily_steps s
                    where s.user_id = p_user_id and s.is_valid), 0) / 1000
       + 50 * (select count(*) from public.challenge_participants cp
                where cp.user_id = p_user_id and cp.result = 'success');
$$;

revoke all on function private.user_points(uuid) from public, anon, authenticated;

-- Points needed to reach a level: 25 * n * (n - 1), i.e. 0, 50, 150, 300, 500, 750, …
create function private.level_start_points(p_level integer)
returns bigint
language sql
immutable
set search_path = ''
as $$ select 25::bigint * p_level * (p_level - 1); $$;

create function private.level_for_points(p_points bigint)
returns integer
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_level integer := 1;
begin
  while private.level_start_points(v_level + 1) <= p_points loop
    v_level := v_level + 1;
  end loop;
  return v_level;
end;
$$;

revoke all on function private.level_start_points(integer), private.level_for_points(bigint)
  from public, anon, authenticated;

-- Gives the user every badge they qualify for. Safe to call at any time; badges are never
-- taken away and never given twice.
create function private.award_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenges integer;
  v_wins integer;
  v_distance bigint;
  v_streak integer;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer into v_challenges
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
   where cp.user_id = p_user_id and c.status <> 'cancelled';

  select count(*)::integer into v_wins
    from public.challenge_participants cp
   where cp.user_id = p_user_id and cp.result = 'success';

  select coalesce(sum(w.distance_m), 0) into v_distance
    from public.activity_workouts w
   where w.user_id = p_user_id and w.is_valid and not w.was_user_entered;

  v_streak := private.user_streak(p_user_id);

  insert into public.user_badges (user_id, badge)
  select p_user_id, b.badge
    from (values
      ('first_challenge', v_challenges >= 1),
      ('challenges_10', v_challenges >= 10),
      ('first_win', v_wins >= 1),
      ('streak_7', v_streak >= 7),
      ('streak_30', v_streak >= 30),
      ('km_50', v_distance >= 50000),
      ('km_100', v_distance >= 100000)
    ) as b (badge, earned)
   where b.earned
  on conflict do nothing;
end;
$$;

revoke all on function private.award_badges(uuid) from public, anon, authenticated;

-- Triggers: joining a challenge and every result change.
create function private.award_on_participation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.award_badges(new.user_id);
  return new;
end;
$$;

create trigger award_on_join
  after insert on public.challenge_participants
  for each row execute function private.award_on_participation();

create trigger award_on_result
  after update of result on public.challenge_participants
  for each row
  when (old.result is distinct from new.result)
  execute function private.award_on_participation();

revoke all on function private.award_on_participation() from public, anon, authenticated;

-- Every health sync re-checks the distance and streak badges.
create or replace function private.refresh_health_challenges(p_user_id uuid)
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
  perform private.award_badges(p_user_id);
end;
$$;

------------------------------------------------------------------------------------------
-- Level and celebration
------------------------------------------------------------------------------------------

create function public.get_my_level()
returns table (points bigint, level integer, level_start_points bigint, next_level_points bigint)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_points bigint := private.user_points(private.require_uid());
  v_level integer := private.level_for_points(v_points);
begin
  return query
  select v_points, v_level, private.level_start_points(v_level),
         private.level_start_points(v_level + 1);
end;
$$;

-- The app shows a celebration once; this records that it did.
create function public.mark_badge_seen(p_badge text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.user_badges
     set seen_at = now()
   where user_id = private.require_uid() and badge = p_badge and seen_at is null;
$$;

revoke all on function public.get_my_level(), public.mark_badge_seen(text) from public, anon;
grant execute on function public.get_my_level() to authenticated;
grant execute on function public.mark_badge_seen(text) to authenticated;
