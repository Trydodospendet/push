-- Phase 7, part 3 – feed and cheering.
-- Every ranked challenge has a feed that only its participants can read. Entries are written
-- by triggers (never by clients) and contain only a name, the kind of event and – for runs –
-- the distance. No other health data is stored in the feed.

create table public.challenge_feed (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references public.challenges (id) on delete cascade,
  -- Entries of a deleted account are removed with the profile.
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  -- Metres, only for kind = 'ran'.
  distance_m integer null,
  -- The workout behind a 'ran' entry; makes the entry idempotent.
  ref_id uuid null,
  created_at timestamptz not null default now(),
  constraint challenge_feed_kind_valid check (kind in ('joined', 'ran', 'goal_reached')),
  constraint challenge_feed_distance_by_kind check (
    (kind = 'ran' and distance_m is not null and distance_m > 0)
    or (kind <> 'ran' and distance_m is null)
  )
);

create unique index challenge_feed_once_idx on public.challenge_feed (
  challenge_id, user_id, kind, coalesce(ref_id, '00000000-0000-0000-0000-000000000000')
);
create index challenge_feed_challenge_idx on public.challenge_feed (challenge_id, created_at desc);

create table public.feed_cheers (
  feed_id uuid not null references public.challenge_feed (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  -- One cheer per person and entry.
  primary key (feed_id, user_id)
);

alter table public.challenge_feed enable row level security;
alter table public.feed_cheers enable row level security;

revoke all on public.challenge_feed, public.feed_cheers from anon, authenticated;

grant select on public.challenge_feed to authenticated;
create policy "challenge_feed: readable by participants of the challenge"
  on public.challenge_feed for select
  to authenticated
  using (private.is_participant(challenge_id));

-- Cheers are only readable as counts through get_challenge_feed.
grant select on public.feed_cheers to authenticated;
create policy "feed_cheers: nobody reads rows directly"
  on public.feed_cheers for select
  to authenticated
  using (false);

------------------------------------------------------------------------------------------
-- Writers (triggers)
------------------------------------------------------------------------------------------

create function private.feed_on_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and exists (
    select 1 from public.challenges c where c.id = new.challenge_id and c.mode = 'ranked'
  ) then
    insert into public.challenge_feed (challenge_id, user_id, kind)
    values (new.challenge_id, new.user_id, 'joined')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger feed_on_join
  after insert on public.challenge_participants
  for each row execute function private.feed_on_join();

create function private.feed_on_goal()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  v_needed integer;
begin
  if new.user_id is null or new.progress_value is not distinct from old.progress_value then
    return new;
  end if;
  select * into c from public.challenges where id = new.challenge_id;
  if c.mode <> 'ranked' then
    return new;
  end if;
  v_needed := case when c.goal_type = 'steps_daily' then private.challenge_days(c)
                   else c.target_value end;
  if new.progress_value >= v_needed and old.progress_value < v_needed then
    insert into public.challenge_feed (challenge_id, user_id, kind)
    values (new.challenge_id, new.user_id, 'goal_reached')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger feed_on_goal
  after update of progress_value on public.challenge_participants
  for each row execute function private.feed_on_goal();

create function private.feed_on_workout()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not new.is_valid or new.was_user_entered
     or (tg_op = 'UPDATE' and old.is_valid) then
    return new;
  end if;
  insert into public.challenge_feed (challenge_id, user_id, kind, distance_m, ref_id)
  select c.id, new.user_id, 'ran', new.distance_m, new.id
    from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id and cp.user_id = new.user_id
   where c.mode = 'ranked'
     and c.goal_type in ('run_single', 'run_total')
     and c.status in ('active', 'settling')
     and new.start_at >= c.starts_at and new.start_at < c.ends_at
  on conflict do nothing;
  return new;
end;
$$;

create trigger feed_on_workout
  after insert or update of is_valid on public.activity_workouts
  for each row execute function private.feed_on_workout();

revoke all on function private.feed_on_join(), private.feed_on_goal(), private.feed_on_workout()
  from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Reading and cheering
------------------------------------------------------------------------------------------

create function public.get_challenge_feed(p_challenge_id uuid, p_limit integer default 50)
returns table (
  id uuid,
  kind text,
  display_name text,
  is_mine boolean,
  distance_m integer,
  created_at timestamptz,
  cheer_count integer,
  cheered_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id,
         f.kind,
         p.display_name,
         f.user_id = (select auth.uid()),
         f.distance_m,
         f.created_at,
         (select count(*)::integer from public.feed_cheers fc where fc.feed_id = f.id),
         exists (select 1 from public.feed_cheers fc
                  where fc.feed_id = f.id and fc.user_id = (select auth.uid()))
    from public.challenge_feed f
    join public.profiles p on p.id = f.user_id
   where f.challenge_id = p_challenge_id
     and private.is_participant(p_challenge_id)
   order by f.created_at desc, f.id
   limit greatest(1, least(coalesce(p_limit, 50), 100));
$$;

-- Returns the new number of cheers of the entry.
create function public.cheer_feed_entry(p_feed_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_entry public.challenge_feed;
begin
  select * into v_entry from public.challenge_feed where id = p_feed_id;
  if v_entry.id is null or not private.is_participant(v_entry.challenge_id) then
    raise exception using errcode = 'P0001', message = 'feed_entry_not_found';
  end if;
  if v_entry.user_id = v_user_id then
    raise exception using errcode = 'P0001', message = 'cannot_cheer_self';
  end if;

  insert into public.feed_cheers (feed_id, user_id) values (p_feed_id, v_user_id)
  on conflict do nothing;
  if not found then
    raise exception using errcode = 'P0001', message = 'already_cheered';
  end if;

  return (select count(*)::integer from public.feed_cheers where feed_id = p_feed_id);
end;
$$;

revoke all on function public.get_challenge_feed(uuid, integer) from public, anon;
revoke all on function public.cheer_feed_entry(uuid) from public, anon;
grant execute on function public.get_challenge_feed(uuid, integer) to authenticated;
grant execute on function public.cheer_feed_entry(uuid) to authenticated;
