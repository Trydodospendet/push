-- Ausbau 2, part 11 – social: friends, groups, kudos and comments, the monthly league.
--
--   Friends     Two people become friends when one sends a request with the other's friend code
--               and the other accepts. There is no search by name: you need the code or an
--               invite link. Friends see each other's recent runs (distance, time, date – never
--               a route or health data); everybody can switch this off.
--   Groups      Private groups with an invite code; the group board compares the valid
--               kilometres of the members in a week or a month.
--   Kudos       Friends can give kudos and write short comments on each other's runs.
--   League      A calendar-month season over the rank points of ranked challenges.
-- Anonymity ("Anonym" in rankings) is respected in the group board and the league; friends
-- already know each other by name.

alter table public.profiles
  add column friend_code text null,
  add column share_runs_with_friends boolean not null default true;

create function private.generate_friend_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.profiles p where p.friend_code = v_code);
  end loop;
  return v_code;
end;
$$;

update public.profiles set friend_code = private.generate_friend_code() where friend_code is null;
alter table public.profiles alter column friend_code set not null;
alter table public.profiles add constraint profiles_friend_code_unique unique (friend_code);
alter table public.profiles alter column friend_code set default private.generate_friend_code();

revoke all on function private.generate_friend_code() from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- Friendships
------------------------------------------------------------------------------------------

create table public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references public.profiles (id) on delete cascade,
  addressee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  responded_at timestamptz null,
  constraint friendships_not_self check (requester_id <> addressee_id),
  constraint friendships_status_valid check (status in ('pending', 'accepted'))
);

create unique index friendships_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index friendships_addressee_idx on public.friendships (addressee_id, status);

alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

create function private.are_friends(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.friendships f
     where f.status = 'accepted'
       and ((f.requester_id = p_a and f.addressee_id = p_b)
         or (f.requester_id = p_b and f.addressee_id = p_a))
  );
$$;

revoke all on function private.are_friends(uuid, uuid) from public, anon, authenticated;

create function public.get_my_friend_code()
returns text
language sql
stable
security definer
set search_path = ''
as $$ select p.friend_code from public.profiles p where p.id = private.require_uid(); $$;

create function public.send_friend_request(p_code text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_other uuid;
  v_existing public.friendships;
  v_name text;
begin
  select p.id into v_other from public.profiles p
   where p.friend_code = upper(btrim(coalesce(p_code, '')));
  if v_other is null then
    raise exception using errcode = 'P0001', message = 'invalid_friend_code';
  end if;
  if v_other = v_user_id then
    raise exception using errcode = 'P0001', message = 'cannot_friend_self';
  end if;
  if (select count(*) from public.friendships f
       where f.requester_id = v_user_id and f.created_at > now() - interval '24 hours') >= 20 then
    raise exception using errcode = 'P0001', message = 'friend_rate_limited';
  end if;

  select * into v_existing from public.friendships f
   where least(f.requester_id, f.addressee_id) = least(v_user_id, v_other)
     and greatest(f.requester_id, f.addressee_id) = greatest(v_user_id, v_other);
  if v_existing.id is not null then
    if v_existing.status = 'accepted' then
      raise exception using errcode = 'P0001', message = 'already_friends';
    end if;
    -- The other person had already asked: sending a request back accepts it.
    if v_existing.addressee_id = v_user_id then
      update public.friendships set status = 'accepted', responded_at = now() where id = v_existing.id;
      return 'accepted';
    end if;
    raise exception using errcode = 'P0001', message = 'request_exists';
  end if;

  insert into public.friendships (requester_id, addressee_id) values (v_user_id, v_other);
  select p.display_name into v_name from public.profiles p where p.id = v_user_id;
  perform private.enqueue_push(v_other, 'friend', coalesce(v_name, 'Jemand') || ' möchte dein Freund sein',
    'Öffne PUSH, um die Anfrage zu beantworten.', '{}'::jsonb);
  return 'pending';
end;
$$;

create function public.respond_friend_request(p_friendship_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if not exists (select 1 from public.friendships f
                  where f.id = p_friendship_id and f.addressee_id = v_user_id and f.status = 'pending') then
    raise exception using errcode = 'P0001', message = 'request_not_found';
  end if;
  if p_accept then
    update public.friendships set status = 'accepted', responded_at = now() where id = p_friendship_id;
  else
    delete from public.friendships where id = p_friendship_id;
  end if;
end;
$$;

create function public.remove_friend(p_user_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.friendships f
   where (f.requester_id = private.require_uid() and f.addressee_id = p_user_id)
      or (f.addressee_id = private.require_uid() and f.requester_id = p_user_id);
$$;

create function public.get_my_friends()
returns table (user_id uuid, display_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.display_name
    from public.friendships f
    join public.profiles p
      on p.id = case when f.requester_id = private.require_uid() then f.addressee_id else f.requester_id end
   where f.status = 'accepted'
     and private.require_uid() in (f.requester_id, f.addressee_id)
   order by p.display_name;
$$;

create function public.get_friend_requests()
returns table (id uuid, display_name text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select f.id, p.display_name, f.created_at
    from public.friendships f
    join public.profiles p on p.id = f.requester_id
   where f.addressee_id = private.require_uid() and f.status = 'pending'
   order by f.created_at desc;
$$;

create function public.set_share_runs(p_share boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_share is null then
    raise exception using errcode = 'P0001', message = 'invalid_setting';
  end if;
  update public.profiles set share_runs_with_friends = p_share where id = private.require_uid();
end;
$$;

------------------------------------------------------------------------------------------
-- Friends' runs, kudos and comments
------------------------------------------------------------------------------------------

create table public.run_kudos (
  workout_id uuid not null references public.activity_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (workout_id, user_id)
);

create table public.run_comments (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.activity_workouts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint run_comments_body_length check (char_length(btrim(body)) between 1 and 200)
);

create index run_comments_workout_idx on public.run_comments (workout_id, created_at);

alter table public.run_kudos enable row level security;
alter table public.run_comments enable row level security;
revoke all on public.run_kudos, public.run_comments from anon, authenticated;

-- Can the caller see and react to this run? The owner, or a friend of an owner who shares runs.
create function private.can_see_run(p_workout_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
      from public.activity_workouts w
      join public.profiles p on p.id = w.user_id
     where w.id = p_workout_id and w.is_valid and not w.was_user_entered
       and (w.user_id = private.require_uid()
            or (p.share_runs_with_friends and private.are_friends(private.require_uid(), w.user_id)))
  );
$$;

revoke all on function private.can_see_run(uuid) from public, anon, authenticated;

create function public.get_friend_runs(p_limit integer default 30)
returns table (
  workout_id uuid, user_id uuid, display_name text, is_mine boolean,
  distance_m integer, duration_s integer, start_at timestamptz,
  kudos_count integer, comment_count integer, kudos_by_me boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.user_id, p.display_name, w.user_id = private.require_uid(),
         w.distance_m, w.duration_s, w.start_at,
         (select count(*)::integer from public.run_kudos k where k.workout_id = w.id),
         (select count(*)::integer from public.run_comments c where c.workout_id = w.id),
         exists (select 1 from public.run_kudos k where k.workout_id = w.id and k.user_id = private.require_uid())
    from public.activity_workouts w
    join public.profiles p on p.id = w.user_id
   where w.is_valid and not w.was_user_entered
     and w.start_at > now() - interval '30 days'
     and (w.user_id = private.require_uid()
          or (p.share_runs_with_friends and private.are_friends(private.require_uid(), w.user_id)))
   order by w.start_at desc
   limit greatest(1, least(coalesce(p_limit, 30), 100));
$$;

create function public.give_kudos(p_workout_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_owner uuid;
begin
  if not private.can_see_run(p_workout_id) then
    raise exception using errcode = 'P0001', message = 'run_not_found';
  end if;
  select w.user_id into v_owner from public.activity_workouts w where w.id = p_workout_id;
  if v_owner = v_user_id then
    raise exception using errcode = 'P0001', message = 'cannot_cheer_self';
  end if;
  insert into public.run_kudos (workout_id, user_id) values (p_workout_id, v_user_id)
  on conflict do nothing;
end;
$$;

create function public.add_run_comment(p_workout_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_id uuid;
begin
  if not private.can_see_run(p_workout_id) then
    raise exception using errcode = 'P0001', message = 'run_not_found';
  end if;
  if char_length(btrim(coalesce(p_body, ''))) not between 1 and 200 then
    raise exception using errcode = 'P0001', message = 'invalid_comment';
  end if;
  if (select count(*) from public.run_comments c
       where c.user_id = v_user_id and c.created_at > now() - interval '24 hours') >= 30 then
    raise exception using errcode = 'P0001', message = 'comment_rate_limited';
  end if;
  insert into public.run_comments (workout_id, user_id, body)
  values (p_workout_id, v_user_id, btrim(p_body)) returning id into v_id;
  return v_id;
end;
$$;

create function public.get_run_comments(p_workout_id uuid)
returns table (id uuid, display_name text, is_mine boolean, body text, created_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, p.display_name, c.user_id = private.require_uid(), c.body, c.created_at
    from public.run_comments c
    join public.profiles p on p.id = c.user_id
   where c.workout_id = p_workout_id and private.can_see_run(p_workout_id)
   order by c.created_at;
$$;

create function public.delete_run_comment(p_comment_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.run_comments c
   where c.id = p_comment_id
     and (c.user_id = private.require_uid()
          or exists (select 1 from public.activity_workouts w
                      where w.id = c.workout_id and w.user_id = private.require_uid()));
$$;

------------------------------------------------------------------------------------------
-- Groups
------------------------------------------------------------------------------------------

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid null references public.profiles (id) on delete set null,
  invite_code text not null unique,
  created_at timestamptz not null default now(),
  constraint groups_name_length check (char_length(btrim(name)) between 3 and 40)
);

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create index group_members_user_idx on public.group_members (user_id);

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
revoke all on public.groups, public.group_members from anon, authenticated;

create function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.group_members m
                  where m.group_id = p_group_id and m.user_id = private.require_uid());
$$;

revoke all on function private.is_group_member(uuid) from public, anon, authenticated;

create function public.create_group(p_name text)
returns public.groups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_group public.groups;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 40 then
    raise exception using errcode = 'P0001', message = 'invalid_group_name';
  end if;
  if (select count(*) from public.group_members m where m.user_id = v_user_id) >= 10 then
    raise exception using errcode = 'P0001', message = 'too_many_groups';
  end if;
  insert into public.groups (name, owner_id, invite_code)
  values (btrim(p_name), v_user_id, private.generate_invite_code())
  returning * into v_group;
  insert into public.group_members (group_id, user_id) values (v_group.id, v_user_id);
  return v_group;
end;
$$;

create function public.join_group(p_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_group_id uuid;
begin
  select g.id into v_group_id from public.groups g
   where g.invite_code = upper(btrim(coalesce(p_code, '')));
  if v_group_id is null then
    raise exception using errcode = 'P0001', message = 'invalid_group_code';
  end if;
  if (select count(*) from public.group_members m where m.group_id = v_group_id) >= 50 then
    raise exception using errcode = 'P0001', message = 'group_full';
  end if;
  insert into public.group_members (group_id, user_id) values (v_group_id, v_user_id)
  on conflict do nothing;
  return v_group_id;
end;
$$;

create function public.leave_group(p_group_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.group_members m where m.group_id = p_group_id and m.user_id = private.require_uid();
$$;

create function public.get_my_groups()
returns table (id uuid, name text, invite_code text, member_count integer)
language sql
stable
security definer
set search_path = ''
as $$
  select g.id, g.name, g.invite_code,
         (select count(*)::integer from public.group_members m2 where m2.group_id = g.id)
    from public.groups g
    join public.group_members m on m.group_id = g.id and m.user_id = private.require_uid()
   order by g.name;
$$;

-- Valid kilometres of every member in the current week or month (Monday / first of the month,
-- Europe/Berlin like the weekly challenge). Members who are anonymous show as "Anonym".
create function public.get_group_board(p_group_id uuid, p_period text default 'week')
returns table (rank integer, display_name text, is_me boolean, distance_m bigint, runs integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start timestamptz;
begin
  if p_period not in ('week', 'month') then
    raise exception using errcode = 'P0001', message = 'invalid_period';
  end if;
  if not private.is_group_member(p_group_id) then
    return;
  end if;
  v_start := date_trunc(p_period, now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
  return query
  select (rank() over (order by coalesce(sum(w.distance_m), 0) desc))::integer,
         case when p.anonymous_in_rankings and p.id <> private.require_uid() then 'Anonym' else p.display_name end,
         p.id = private.require_uid(),
         coalesce(sum(w.distance_m), 0)::bigint,
         count(w.id)::integer
    from public.group_members m
    join public.profiles p on p.id = m.user_id
    left join public.activity_workouts w
      on w.user_id = m.user_id and w.is_valid and not w.was_user_entered and w.start_at >= v_start
   where m.group_id = p_group_id
   group by p.id, p.display_name, p.anonymous_in_rankings
   order by 1, 2;
end;
$$;

------------------------------------------------------------------------------------------
-- League: calendar-month season over the rank points of ranked challenges
------------------------------------------------------------------------------------------

create function public.get_season_board(p_limit integer default 20)
returns table (rank integer, display_name text, is_me boolean, points bigint)
language sql
stable
security definer
set search_path = ''
as $$
  with season as (
    select date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin' as start
  ),
  scores as (
    select cp.user_id, sum(cp.rank_points)::bigint as points
      from public.challenge_participants cp
      join public.challenges c on c.id = cp.challenge_id, season s
     where c.mode = 'ranked' and c.status = 'settled' and c.settled_at >= s.start
       and cp.user_id is not null and cp.rank_points > 0
     group by cp.user_id
  ),
  ranked as (
    select sc.user_id, sc.points, (rank() over (order by sc.points desc))::integer as rk from scores sc
  )
  select r.rk,
         case when p.anonymous_in_rankings and p.id <> private.require_uid() then 'Anonym' else p.display_name end,
         p.id = private.require_uid(),
         r.points
    from ranked r
    join public.profiles p on p.id = r.user_id
   where r.rk <= greatest(1, least(coalesce(p_limit, 20), 100)) or p.id = private.require_uid()
   order by r.rk, 2;
$$;

revoke all on function public.get_my_friend_code(), public.send_friend_request(text),
  public.respond_friend_request(uuid, boolean), public.remove_friend(uuid), public.get_my_friends(),
  public.get_friend_requests(), public.set_share_runs(boolean), public.get_friend_runs(integer),
  public.give_kudos(uuid), public.add_run_comment(uuid, text), public.get_run_comments(uuid),
  public.delete_run_comment(uuid), public.create_group(text), public.join_group(text),
  public.leave_group(uuid), public.get_my_groups(), public.get_group_board(uuid, text),
  public.get_season_board(integer) from public, anon;
grant execute on function public.get_my_friend_code() to authenticated;
grant execute on function public.send_friend_request(text) to authenticated;
grant execute on function public.respond_friend_request(uuid, boolean) to authenticated;
grant execute on function public.remove_friend(uuid) to authenticated;
grant execute on function public.get_my_friends() to authenticated;
grant execute on function public.get_friend_requests() to authenticated;
grant execute on function public.set_share_runs(boolean) to authenticated;
grant execute on function public.get_friend_runs(integer) to authenticated;
grant execute on function public.give_kudos(uuid) to authenticated;
grant execute on function public.add_run_comment(uuid, text) to authenticated;
grant execute on function public.get_run_comments(uuid) to authenticated;
grant execute on function public.delete_run_comment(uuid) to authenticated;
grant execute on function public.create_group(text) to authenticated;
grant execute on function public.join_group(text) to authenticated;
grant execute on function public.leave_group(uuid) to authenticated;
grant execute on function public.get_my_groups() to authenticated;
grant execute on function public.get_group_board(uuid, text) to authenticated;
grant execute on function public.get_season_board(integer) to authenticated;
