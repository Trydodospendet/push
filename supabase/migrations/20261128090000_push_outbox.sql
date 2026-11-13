-- Ausbau 2, part 16 – push messages from the server (prepared, not switched on).
--
-- The database writes the messages that should reach a phone into push_outbox; a small Edge
-- Function (supabase/functions/send-push) takes them from there and sends them through Expo's
-- push service (which talks to Firebase on Android). Nothing in the cloud has to be changed to
-- keep the app working without it: without the function the outbox just fills up and is cleaned.
-- See docs/PUSH.md for what has to be set up.
--
-- Messages: your result is ready, somebody cheered you on, a friend request (added with the
-- friends feature). Every kind can be switched off per user.

alter table public.profiles
  add column push_results boolean not null default true,
  add column push_cheers boolean not null default true,
  add column push_friends boolean not null default true;

create table public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  token text not null,
  platform text not null,
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  constraint push_tokens_token_unique unique (token),
  constraint push_tokens_platform_valid check (platform in ('android', 'ios')),
  constraint push_tokens_token_format check (token ~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$')
);

create index push_tokens_user_idx on public.push_tokens (user_id);

create table public.push_outbox (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  -- Deep link target (e.g. /challenge/<id>); nothing personal.
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at timestamptz null,
  error text null,
  constraint push_outbox_kind_valid check (kind in ('result', 'cheer', 'friend'))
);

create index push_outbox_pending_idx on public.push_outbox (created_at) where sent_at is null;

-- Server-only tables: no client access at all (RLS on, no policy, no grants). The Edge Function
-- uses the service role.
alter table public.push_tokens enable row level security;
alter table public.push_outbox enable row level security;
revoke all on public.push_tokens, public.push_outbox from anon, authenticated;

-- The app registers the token of this phone (after the user allowed notifications).
create function public.register_push_token(p_token text, p_platform text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if p_platform is null or p_platform not in ('android', 'ios')
     or p_token is null or p_token !~ '^(Expo|Exponent)PushToken\[[A-Za-z0-9_-]+\]$' then
    raise exception using errcode = 'P0001', message = 'invalid_push_token';
  end if;
  -- A phone belongs to one account at a time: signing in with another account moves the token.
  insert into public.push_tokens (user_id, token, platform)
  values (v_user_id, p_token, p_platform)
  on conflict (token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen_at = now();
end;
$$;

create function public.unregister_push_token(p_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_tokens where token = p_token and user_id = private.require_uid();
$$;

create function public.set_push_preferences(p_results boolean, p_cheers boolean, p_friends boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_results is null or p_cheers is null or p_friends is null then
    raise exception using errcode = 'P0001', message = 'invalid_setting';
  end if;
  update public.profiles
     set push_results = p_results, push_cheers = p_cheers, push_friends = p_friends
   where id = private.require_uid();
end;
$$;

revoke all on function public.register_push_token(text, text), public.unregister_push_token(text),
  public.set_push_preferences(boolean, boolean, boolean) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;
grant execute on function public.set_push_preferences(boolean, boolean, boolean) to authenticated;

-- Writes a message if the user has a registered phone and wants this kind.
create function private.enqueue_push(
  p_user_id uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_wanted boolean;
begin
  if p_user_id is null then
    return;
  end if;
  select case p_kind
           when 'result' then p.push_results
           when 'cheer' then p.push_cheers
           when 'friend' then p.push_friends
         end
    into v_wanted
    from public.profiles p
   where p.id = p_user_id;
  if coalesce(v_wanted, false)
     and exists (select 1 from public.push_tokens t where t.user_id = p_user_id) then
    insert into public.push_outbox (user_id, kind, title, body, data)
    values (p_user_id, p_kind, p_title, p_body, p_data);
  end if;
end;
$$;

revoke all on function private.enqueue_push(uuid, text, text, text, jsonb) from public, anon, authenticated;

-- Result: when the settlement gives somebody a result.
create function private.push_on_result()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_title text;
begin
  select c.title into v_title from public.challenges c where c.id = new.challenge_id;
  perform private.enqueue_push(
    new.user_id, 'result', 'Dein Ergebnis ist da',
    coalesce(v_title, 'Challenge'),
    jsonb_build_object('url', '/challenge/' || new.challenge_id::text));
  return new;
end;
$$;

create trigger push_on_result
  after update of result on public.challenge_participants
  for each row
  when (old.result = 'pending' and new.result in ('success', 'failed') and new.user_id is not null)
  execute function private.push_on_result();

-- Cheer: somebody cheered an entry (not your own, and only once per person by the key of
-- feed_cheers). The name respects "anonymous in rankings".
create function private.push_on_cheer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entry public.challenge_feed;
  v_name text;
begin
  select * into v_entry from public.challenge_feed where id = new.feed_id;
  if v_entry.id is null then
    return new;
  end if;
  select case when p.anonymous_in_rankings then 'Jemand' else p.display_name end
    into v_name from public.profiles p where p.id = new.user_id;
  perform private.enqueue_push(
    v_entry.user_id, 'cheer', coalesce(v_name, 'Jemand') || ' feuert dich an',
    'Weiter so!',
    jsonb_build_object('url', '/challenge/' || v_entry.challenge_id::text));
  return new;
end;
$$;

create trigger push_on_cheer
  after insert on public.feed_cheers
  for each row execute function private.push_on_cheer();

revoke all on function private.push_on_result(), private.push_on_cheer() from public, anon, authenticated;

-- Housekeeping: sent messages older than 7 days and tokens not seen for 90 days go away.
create function private.clean_push()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_outbox where sent_at is not null and sent_at < now() - interval '7 days';
  delete from public.push_outbox where sent_at is null and created_at < now() - interval '3 days';
  delete from public.push_tokens where last_seen_at < now() - interval '90 days';
$$;

revoke all on function private.clean_push() from public, anon, authenticated;
select cron.schedule('clean-push', '17 3 * * *', 'select private.clean_push()');
