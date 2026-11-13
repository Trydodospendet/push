-- Ausbau, part 3 – profile and control: avatar, visibility in rankings, data export.
--
--   * profiles.avatar_path: path of the own picture in the private bucket "avatars"
--     (folder = user id). Only the owner can read or write the files.
--   * profiles.anonymous_in_rankings: others see "Anonym" instead of the name in rankings,
--     the feed and participant lists. Enforced in the database (RLS on profiles and the
--     functions that return names), not only in the app.
--   * export_my_data(): everything stored about the caller, as JSON.

alter table public.profiles
  add column avatar_path text null,
  add column anonymous_in_rankings boolean not null default false,
  add constraint profiles_avatar_path_length check (avatar_path is null or char_length(avatar_path) <= 200);

------------------------------------------------------------------------------------------
-- Names: anonymous people are not readable by others
------------------------------------------------------------------------------------------

drop policy "profiles: signed-in users read display names" on public.profiles;
create policy "profiles: names of everybody who is not anonymous, and the own one"
  on public.profiles for select
  to authenticated
  using (id = (select auth.uid()) or not anonymous_in_rankings);

create function public.set_ranking_visibility(p_anonymous boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_anonymous is null then
    raise exception using errcode = 'P0001', message = 'invalid_setting';
  end if;
  update public.profiles set anonymous_in_rankings = p_anonymous where id = private.require_uid();
end;
$$;

create or replace function public.get_leaderboard(p_challenge_id uuid)
returns table (rank integer, user_id uuid, display_name text, is_me boolean, goal_reached boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select (rank() over (order by cp.progress_value desc))::integer,
         cp.user_id,
         case when p.anonymous_in_rankings and cp.user_id <> (select auth.uid())
              then 'Anonym' else p.display_name end,
         cp.user_id = (select auth.uid()),
         case
           when c.goal_type = 'steps_daily' then cp.progress_value >= private.challenge_days(c)
           else cp.progress_value >= c.target_value
         end
    from public.challenges c
    join public.challenge_participants cp on cp.challenge_id = c.id
    join public.profiles p on p.id = cp.user_id
   where c.id = p_challenge_id
     and c.status in ('active', 'settling', 'settled')
     and private.is_participant(c.id)
   order by 1, 3;
$$;

create or replace function public.get_challenge_feed(p_challenge_id uuid, p_limit integer default 50)
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
         case when p.anonymous_in_rankings and f.user_id <> (select auth.uid())
              then 'Anonym' else p.display_name end,
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

------------------------------------------------------------------------------------------
-- Avatar: private bucket, own folder only
------------------------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', false, 524288, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "avatars: read the own folder"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: upload into the own folder"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: replace in the own folder"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "avatars: delete from the own folder"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Remembers which file is the avatar (null removes it). The path must be in the own folder.
create function public.set_avatar_path(p_path text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if p_path is not null and p_path !~ ('^' || v_user_id::text || '/[A-Za-z0-9._-]{1,80}$') then
    raise exception using errcode = 'P0001', message = 'invalid_avatar_path';
  end if;
  update public.profiles set avatar_path = p_path where id = v_user_id;
end;
$$;

------------------------------------------------------------------------------------------
-- Export of the own data
------------------------------------------------------------------------------------------

-- Everything stored about the caller. Raw GPS tracks only with p_include_routes (they can be
-- large). Other people's data is never part of it.
create function public.export_my_data(p_include_routes boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) - 'id' from public.profiles p where p.id = v_user_id),
    'email', (select u.email from auth.users u where u.id = v_user_id),
    'wallet_balance_cents', (select w.balance_cents from public.wallets w where w.user_id = v_user_id),
    'ledger', coalesce((
      select jsonb_agg(to_jsonb(l) - 'user_id' order by l.created_at)
        from public.ledger_entries l where l.user_id = v_user_id), '[]'::jsonb),
    'participations', coalesce((
      select jsonb_agg(jsonb_build_object(
               'challenge', c.title, 'mode', c.mode, 'goal_type', c.goal_type,
               'target_value', c.target_value, 'starts_at', c.starts_at, 'ends_at', c.ends_at,
               'stake_cents', cp.stake_cents, 'result', cp.result, 'progress_value', cp.progress_value,
               'payout_cents', cp.payout_cents, 'donated_cents', cp.donated_cents,
               'rank', cp.rank, 'rank_points', cp.rank_points, 'joined_at', cp.joined_at)
             order by cp.joined_at)
        from public.challenge_participants cp
        join public.challenges c on c.id = cp.challenge_id
       where cp.user_id = v_user_id), '[]'::jsonb),
    'workouts', coalesce((
      select jsonb_agg(to_jsonb(w) - 'user_id' - 'id' order by w.start_at)
        from public.activity_workouts w where w.user_id = v_user_id), '[]'::jsonb),
    'daily_steps', coalesce((
      select jsonb_agg(to_jsonb(s) - 'user_id' order by s.date)
        from public.activity_daily_steps s where s.user_id = v_user_id), '[]'::jsonb),
    'gps_runs', coalesce((
      select jsonb_agg(
               jsonb_build_object(
                 'started_at', g.started_at, 'ended_at', g.ended_at, 'distance_m', g.distance_m,
                 'duration_s', g.duration_s, 'points', g.point_count)
               || case when p_include_routes then jsonb_build_object('route', g.route) else '{}'::jsonb end
               order by g.started_at)
        from public.gps_runs g where g.user_id = v_user_id), '[]'::jsonb),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('badge', b.badge, 'awarded_at', b.awarded_at) order by b.awarded_at)
        from public.user_badges b where b.user_id = v_user_id), '[]'::jsonb),
    'feed_entries', coalesce((
      select jsonb_agg(jsonb_build_object('kind', f.kind, 'distance_m', f.distance_m, 'created_at', f.created_at)
             order by f.created_at)
        from public.challenge_feed f where f.user_id = v_user_id), '[]'::jsonb)
  );
end;
$$;

revoke all on function public.set_ranking_visibility(boolean), public.set_avatar_path(text),
  public.export_my_data(boolean) from public, anon;
grant execute on function public.set_ranking_visibility(boolean) to authenticated;
grant execute on function public.set_avatar_path(text) to authenticated;
grant execute on function public.export_my_data(boolean) to authenticated;
