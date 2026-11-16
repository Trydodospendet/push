-- Pledge model ("Pfand"): no more shares of other people's stakes.
--
--   reached the goal  → the own pledge comes back in full (payout = stake)
--   missed the goal   → the pledge is forfeited: fee_bps (house share, default 10 %) to the
--                       house, the rest (default 90 %) is donated to the chosen organisation
--   nobody to pay     → (deleted account / no active organisation) the whole pledge to the house
--   Every booking set of a challenge sums to 0: stake −S, house +fee, donation account +rest.
--   The house share is private.settings.fee_bps, copied into every new goal; the donation share
--   is the remainder, so both stay configurable in one place.
--   Goals no longer settle per window, every challenge settles on its own (idempotent through
--   the status check under the row lock).

update private.settings set fee_bps = 1000;
update public.challenges
   set fee_bps = (select s.fee_bps from private.settings s)
 where mode in ('pool', 'goal') and status in ('open', 'active', 'settling');

drop function private.settle_goal_window(uuid);

create or replace function private.settle_single(p_challenge_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.challenges;
  p public.challenge_participants;
  v_days integer;
  v_house bigint;
  v_donation bigint;
  v_ngo uuid;
  v_fallback_ngo uuid;
  v_house_fee bigint := 0;
  v_house_forfeit bigint := 0;
  r record;
begin
  select * into c from public.challenges where id = p_challenge_id for update;

  if c.id is null
     or c.status <> 'settling'
     or now() < c.ends_at + make_interval(hours => c.sync_grace_hours) then
    return false;
  end if;

  perform private.recompute_health_progress(c.id);
  v_days := private.challenge_days(c);

  update public.challenge_participants cp
     set result = case
           when (c.goal_type = 'steps_daily' and cp.progress_value >= v_days)
             or (c.goal_type <> 'steps_daily' and cp.progress_value >= c.target_value)
             then 'success'
           else 'failed'
         end
   where cp.challenge_id = c.id and cp.result = 'pending';

  -- Ranked: rank and points, nothing is booked.
  if c.mode = 'ranked' then
    for r in
      select cp.id,
             rank() over (order by cp.progress_value desc) as rk,
             cp.progress_value
        from public.challenge_participants cp
       where cp.challenge_id = c.id
    loop
      update public.challenge_participants
         set rank = r.rk,
             rank_points = case
               when r.progress_value = 0 then 0
               when r.rk = 1 then 30
               when r.rk = 2 then 20
               when r.rk = 3 then 10
               else 5
             end
       where id = r.id;
    end loop;

    update public.challenges set status = 'settled', settled_at = now() where id = c.id;

    for r in
      select cp.user_id from public.challenge_participants cp
       where cp.challenge_id = c.id and cp.user_id is not null
       order by cp.user_id
    loop
      perform private.award_badges(r.user_id);
    end loop;
    return true;
  end if;

  select n.id into v_fallback_ngo from public.ngos n where n.active order by n.sort_order limit 1;

  -- Pledge: fixed order (by user id) keeps wallet locks deadlock-free.
  for p in
    select * from public.challenge_participants
     where challenge_id = c.id and stake_cents > 0
     order by user_id
  loop
    if p.result = 'success' and p.user_id is not null then
      perform private.post_user_entry(p.user_id, 'payout', p.stake_cents, c.id);
      update public.challenge_participants
         set payout_cents = p.stake_cents, donated_cents = 0
       where id = p.id;
    else
      v_ngo := null;
      if p.user_id is not null then
        select coalesce(p.ngo_id, pr.default_ngo_id) into v_ngo
          from public.profiles pr where pr.id = p.user_id;
      else
        v_ngo := p.ngo_id;
      end if;
      if v_ngo is null or not exists (select 1 from public.ngos n where n.id = v_ngo and n.active) then
        v_ngo := v_fallback_ngo;
      end if;

      if p.result = 'success' or v_ngo is null then
        -- Nobody to pay back or nobody to donate to: the house keeps the pledge.
        v_house_forfeit := v_house_forfeit + p.stake_cents;
        update public.challenge_participants set payout_cents = 0 where id = p.id;
      else
        v_house := (p.stake_cents * c.fee_bps) / 10000;
        v_donation := p.stake_cents - v_house;
        v_house_fee := v_house_fee + v_house;
        update public.challenge_participants
           set payout_cents = 0, donated_cents = v_donation, ngo_id = v_ngo
         where id = p.id;
      end if;
    end if;
  end loop;

  perform private.post_house_entry('fee', v_house_fee, c.id);
  perform private.post_house_entry('forfeit', v_house_forfeit, c.id);

  -- One summed credit per organisation.
  for r in
    select cp.ngo_id, sum(cp.donated_cents) as total
      from public.challenge_participants cp
     where cp.challenge_id = c.id and cp.donated_cents > 0
     group by cp.ngo_id
     order by cp.ngo_id
  loop
    perform private.post_donation_entry(r.ngo_id, r.total::bigint, c.id);
  end loop;

  update public.challenge_participants
     set payout_cents = 0
   where challenge_id = c.id and result = 'failed' and payout_cents is null;

  update public.challenges set status = 'settled', settled_at = now() where id = c.id;
  return true;
end;
$$;

revoke all on function private.settle_single(uuid) from public, anon, authenticated;

create or replace function public.settle_challenge(p_challenge_id uuid)
returns boolean
language sql
security definer
set search_path = ''
as $$
  select private.settle_single(p_challenge_id);
$$;

revoke all on function public.settle_challenge(uuid) from public, anon, authenticated;

-- What comes back when the goal is reached: the own pledge, nothing more.
create or replace function public.get_potential_win(p_challenge_id uuid)
returns bigint
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := private.require_uid();
  v_challenge public.challenges%rowtype;
  v_own_stake bigint;
begin
  select * into v_challenge from public.challenges where id = p_challenge_id;
  if not found or v_challenge.status not in ('open', 'active') or v_challenge.mode = 'ranked' then
    return null;
  end if;
  if v_challenge.visibility = 'private'
     and v_challenge.creator_id is distinct from v_uid
     and not private.is_participant(v_challenge.id) then
    return null;
  end if;
  select cp.stake_cents into v_own_stake
    from public.challenge_participants cp
   where cp.challenge_id = p_challenge_id and cp.user_id = v_uid;
  return coalesce(v_own_stake, v_challenge.stake_cents);
end;
$$;

-- Donations of the caller. They are no longer user ledger rows (the pledge was booked as the
-- stake), so they are read from the settled participation.
create or replace function public.get_my_donations()
returns table (
  challenge_id uuid,
  title text,
  ngo_id uuid,
  ngo_name text,
  amount_cents bigint,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.challenge_id, c.title, cp.ngo_id, n.name, cp.donated_cents, c.settled_at
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
    join public.ngos n on n.id = cp.ngo_id
   where cp.user_id = private.require_uid() and cp.donated_cents > 0
   order by c.settled_at desc;
$$;

create or replace function public.get_my_donation_totals()
returns table (ngo_id uuid, ngo_name text, total_cents bigint, donations integer)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.ngo_id, n.name, sum(cp.donated_cents)::bigint, count(*)::integer
    from public.challenge_participants cp
    join public.ngos n on n.id = cp.ngo_id
   where cp.user_id = private.require_uid() and cp.donated_cents > 0
   group by cp.ngo_id, n.name
   order by n.name;
$$;

-- Community counter: everything donated in the current calendar month (Berlin time).
-- One aggregate number, no names.
create function public.get_community_donations()
returns bigint
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(le.amount_cents), 0)::bigint
    from public.ledger_entries le
   where private.require_uid() is not null
     and le.account = 'donation'
     and le.created_at >= date_trunc('month', now() at time zone 'Europe/Berlin') at time zone 'Europe/Berlin';
$$;

revoke all on function public.get_community_donations() from public, anon;
grant execute on function public.get_community_donations() to authenticated;

-- A missed goal always donates, so the organisation is optional here: without a choice the
-- default of the profile (or else the first active organisation) is recorded for this goal. p_donate stays
-- for older app builds and no longer changes anything.
drop function public.create_goal_with_preferences(text, text, integer, bigint, date, date, boolean, boolean, uuid);
create function public.create_goal_with_preferences(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_start_date date,
  p_end_date date,
  p_with_friends boolean default false,
  p_donate boolean default true,
  p_ngo_id uuid default null
)
returns public.challenges
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_challenge public.challenges;
begin
  if p_ngo_id is not null
     and not exists (select 1 from public.ngos where id = p_ngo_id and active) then
    raise exception 'ngo_not_found';
  end if;

  v_challenge := public.create_scheduled_goal(
    p_title, p_goal_type, p_target_value, p_stake_cents, p_start_date, p_end_date, p_with_friends
  );
  if p_with_friends then
    perform private."join"(v_challenge.id, v_user_id, p_stake_cents);
  end if;

  update public.challenge_participants
     set donate = true,
         ngo_id = coalesce(p_ngo_id, ngo_id, (select n.id from public.ngos n where n.active order by n.sort_order limit 1))
   where challenge_id = v_challenge.id and user_id = v_user_id;

  if v_challenge.starts_at <= now() then
    perform private.start_challenge(v_challenge.id);
    perform private.recompute_health_progress(v_challenge.id);
  end if;

  select * into v_challenge from public.challenges where id = v_challenge.id;
  return v_challenge;
end;
$$;

revoke all on function public.create_goal_with_preferences(text, text, integer, bigint, date, date, boolean, boolean, uuid) from public, anon;
grant execute on function public.create_goal_with_preferences(text, text, integer, bigint, date, date, boolean, boolean, uuid) to authenticated;
