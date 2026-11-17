-- Real-money pledge with Stripe (OFF by default, Stripe TEST keys only until the owner decides).
--
-- Model: the pledge is only RESERVED on the card (PaymentIntent with capture_method=manual).
--   goal reached  → the reservation is cancelled, nothing is charged
--   goal missed   → the reservation is captured; the pledge belongs to PUSH, PUSH donates
--                   (100 % - fee_bps) of it to the chosen organisation (default 90 %) and
--                   records that duty in donation_obligations for the monthly report
--   reservation expired or payment failed before the end → the goal counts as "not secured",
--                   nothing is charged
-- The app collects no donations. The credits ledger stays append-only and is not touched by
-- real money; wallets are not debited for real-money goals.
--
-- Everything is guarded by private.settings.real_money_enabled (default false) plus the list of
-- allowed test users (or real_money_open_to_all). Stripe keys live in Supabase secrets only.

------------------------------------------------------------------------------------------
-- Switch and allowed users
------------------------------------------------------------------------------------------

alter table private.settings
  add column real_money_enabled boolean not null default false,
  add column real_money_open_to_all boolean not null default false;

create table private.real_money_testers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table private.real_money_testers enable row level security;
revoke all on private.real_money_testers from public, anon, authenticated;

create function private.real_money_allowed(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select s.real_money_enabled
         and (s.real_money_open_to_all
              or exists (select 1 from private.real_money_testers t where t.user_id = p_user_id))
    from private.settings s;
$$;

revoke all on function private.real_money_allowed(uuid) from public, anon, authenticated;

-- The app asks at start. False means: everything stays with credits as before.
create function public.get_real_money_status()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.real_money_allowed(private.require_uid());
$$;

revoke all on function public.get_real_money_status() from public, anon;
grant execute on function public.get_real_money_status() to authenticated;

------------------------------------------------------------------------------------------
-- Tables
------------------------------------------------------------------------------------------

-- One row per PaymentIntent (= one pledge). Users read their own rows; only the Edge
-- Functions (service role) write.
create table public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  challenge_id uuid references public.challenges (id) on delete set null,
  payment_intent_id text not null unique,
  amount_cents bigint not null check (amount_cents between 100 and 5000),
  status text not null default 'pending'
    check (status in ('pending', 'reserved', 'released', 'captured', 'failed', 'expired')),
  -- What the Edge Function still has to do at Stripe after the goal was settled.
  pending_action text check (pending_action in ('cancel', 'capture')),
  action_attempts integer not null default 0,
  -- The goal as the app asked for it; created when Stripe confirms the reservation.
  goal_params jsonb not null,
  created_at timestamptz not null default now(),
  reserved_at timestamptz,
  closed_at timestamptz
);

alter table public.payments enable row level security;
create policy payments_select_own on public.payments for select to authenticated
  using (user_id = (select auth.uid()));
revoke all on public.payments from public, anon, authenticated;
grant select on public.payments to authenticated;

alter table public.challenge_participants
  add column payment_id uuid references public.payments (id) on delete set null;

create table public.stripe_customers (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  stripe_customer_id text not null unique,
  created_at timestamptz not null default now()
);
alter table public.stripe_customers enable row level security;
revoke all on public.stripe_customers from public, anon, authenticated;

-- Every webhook event once: duplicates are recognised by the id.
create table public.stripe_events (
  id text primary key,
  type text not null,
  received_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;
revoke all on public.stripe_events from public, anon, authenticated;

-- PUSH's duty to donate: (100 % - fee) of every captured pledge, per organisation and month.
create table public.donation_obligations (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid not null unique references public.payments (id) on delete cascade,
  challenge_id uuid references public.challenges (id) on delete set null,
  ngo_id uuid references public.ngos (id),
  captured_cents bigint not null,
  house_cents bigint not null,
  donation_cents bigint not null,
  month date not null,
  reported boolean not null default false,
  created_at timestamptz not null default now(),
  constraint donation_obligations_sum check (house_cents + donation_cents = captured_cents)
);
alter table public.donation_obligations enable row level security;
revoke all on public.donation_obligations from public, anon, authenticated;

-- For the monthly report (run in the SQL editor): select * from private.donation_report('2026-12-01');
create function private.donation_report(p_month date)
returns table (ngo_name text, donations integer, donation_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(n.name, '–'), count(*)::integer, sum(d.donation_cents)::bigint
    from public.donation_obligations d
    left join public.ngos n on n.id = d.ngo_id
   where d.month = date_trunc('month', p_month)::date
   group by n.name
   order by n.name;
$$;
revoke all on function private.donation_report(date) from public, anon, authenticated;

------------------------------------------------------------------------------------------
-- No wallet booking for real-money goals; refunds become a cancel at Stripe
------------------------------------------------------------------------------------------

alter function private.post_user_entry(uuid, text, bigint, uuid, uuid)
  rename to post_user_entry_credits;

create function private.post_user_entry(
  p_user_id uuid,
  p_type text,
  p_amount_cents bigint,
  p_challenge_id uuid default null,
  p_ngo_id uuid default null
)
returns public.ledger_entries
language plpgsql
set search_path = ''
as $$
begin
  -- The stake of a real-money goal is reserved on the card, not taken from the wallet.
  if p_type = 'stake' and current_setting('push.real_money_goal', true) = 'on' then
    return null;
  end if;
  -- Leaving or cancelling before the start: the reservation is cancelled, no credits appear.
  if p_type = 'refund' and exists (
    select 1 from public.challenge_participants cp
     where cp.challenge_id = p_challenge_id and cp.user_id = p_user_id and cp.payment_id is not null
  ) then
    update public.payments
       set pending_action = 'cancel'
     where challenge_id = p_challenge_id and user_id = p_user_id
       and status = 'reserved' and pending_action is null;
    return null;
  end if;
  return private.post_user_entry_credits(p_user_id, p_type, p_amount_cents, p_challenge_id, p_ngo_id);
end;
$$;

revoke all on function private.post_user_entry(uuid, text, bigint, uuid, uuid) from public;

------------------------------------------------------------------------------------------
-- Settlement: credits as before, real money only marks what Stripe has to do
------------------------------------------------------------------------------------------

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

  -- Real money: Stripe has to cancel (reached) or capture (missed) the reservation. A
  -- reservation that is no longer 'reserved' (expired, failed) charges nothing.
  update public.payments pay
     set pending_action = case when cp.result = 'success' then 'cancel' else 'capture' end
    from public.challenge_participants cp
   where cp.payment_id = pay.id
     and cp.challenge_id = c.id
     and pay.status = 'reserved'
     and pay.pending_action is null;

  select n.id into v_fallback_ngo from public.ngos n where n.active order by n.sort_order limit 1;

  -- Pledge in credits: fixed order (by user id) keeps wallet locks deadlock-free.
  for p in
    select * from public.challenge_participants
     where challenge_id = c.id and stake_cents > 0 and payment_id is null
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

  for r in
    select cp.ngo_id, sum(cp.donated_cents) as total
      from public.challenge_participants cp
     where cp.challenge_id = c.id and cp.donated_cents > 0 and cp.payment_id is null
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

------------------------------------------------------------------------------------------
-- Functions for the Edge Functions (service role only)
------------------------------------------------------------------------------------------

-- Registers a reservation that the Edge Function has just created at Stripe. Checks the
-- switch, the amount and the duration (at most 6 days, so that the reservation, which Stripe
-- releases after 7 days, still holds through the grace time of the settlement).
create function public.rm_register_payment(
  p_user_id uuid,
  p_intent_id text,
  p_amount_cents bigint,
  p_goal jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_days integer;
begin
  if not private.real_money_allowed(p_user_id) then
    raise exception using errcode = 'P0001', message = 'real_money_disabled';
  end if;
  if p_amount_cents is null or p_amount_cents not between 100 and 5000 then
    raise exception using errcode = 'P0001', message = 'invalid_stake';
  end if;
  v_days := (p_goal ->> 'end_date')::date - (p_goal ->> 'start_date')::date + 1;
  if v_days is null or v_days not between 1 and 6 then
    raise exception using errcode = 'P0001', message = 'real_money_too_long';
  end if;
  if coalesce((p_goal ->> 'with_friends')::boolean, false) then
    raise exception using errcode = 'P0001', message = 'real_money_personal_only';
  end if;

  insert into public.payments (user_id, payment_intent_id, amount_cents, goal_params)
  values (p_user_id, p_intent_id, p_amount_cents, p_goal)
  returning id into v_id;
  return v_id;
end;
$$;

-- Creates the goal when Stripe confirmed the reservation (no wallet booking). Any failure
-- cancels the reservation.
create function private.rm_finalize_goal(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  g jsonb;
  v_goal public.challenges;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if pay.id is null or pay.status <> 'pending' or pay.user_id is null then
    return;
  end if;
  g := pay.goal_params;

  begin
    perform set_config('request.jwt.claim.sub', pay.user_id::text, true);
    perform set_config('push.real_money_goal', 'on', true);
    v_goal := public.create_goal_with_preferences(
      g ->> 'title', g ->> 'goal_type', (g ->> 'target_value')::integer, pay.amount_cents,
      (g ->> 'start_date')::date, (g ->> 'end_date')::date, false, true,
      nullif(g ->> 'ngo_id', '')::uuid
    );
    perform set_config('push.real_money_goal', 'off', true);

    -- Stripe releases a card reservation after 7 days: 6 days at most plus 12 hours of grace.
    update public.challenges set sync_grace_hours = least(sync_grace_hours, 12) where id = v_goal.id;
    update public.challenge_participants
       set payment_id = pay.id
     where challenge_id = v_goal.id and user_id = pay.user_id;
    update public.payments
       set status = 'reserved', challenge_id = v_goal.id, reserved_at = now()
     where id = pay.id;
  exception when others then
    perform set_config('push.real_money_goal', 'off', true);
    update public.payments
       set status = 'failed', pending_action = 'cancel'
     where id = pay.id;
  end;
end;
$$;

revoke all on function private.rm_finalize_goal(uuid) from public, anon, authenticated;

-- The donation duty of a captured pledge, once per payment.
create function private.rm_record_capture(p_payment_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  v_fee_bps integer;
  v_ngo uuid;
  v_house bigint;
begin
  select * into pay from public.payments where id = p_payment_id;
  if pay.id is null then
    return;
  end if;
  select coalesce(c.fee_bps, (select s.fee_bps from private.settings s)) into v_fee_bps
    from (select 1) x left join public.challenges c on c.id = pay.challenge_id;
  select coalesce(cp.ngo_id, (select n.id from public.ngos n where n.active order by n.sort_order limit 1))
    into v_ngo
    from (select 1) x
    left join public.challenge_participants cp on cp.payment_id = pay.id;
  v_house := (pay.amount_cents * v_fee_bps) / 10000;
  insert into public.donation_obligations
    (payment_id, challenge_id, ngo_id, captured_cents, house_cents, donation_cents, month)
  values (pay.id, pay.challenge_id, v_ngo, pay.amount_cents, v_house, pay.amount_cents - v_house,
          date_trunc('month', now() at time zone 'Europe/Berlin')::date)
  on conflict (payment_id) do nothing;
end;
$$;

revoke all on function private.rm_record_capture(uuid) from public, anon, authenticated;

-- One Stripe webhook event. Idempotent: the same event id changes nothing the second time.
create function public.rm_apply_intent_event(
  p_event_id text,
  p_type text,
  p_intent_id text,
  p_cancel_reason text default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
  v_new integer;
begin
  insert into public.stripe_events (id, type) values (p_event_id, p_type)
  on conflict (id) do nothing;
  get diagnostics v_new = row_count;
  if v_new = 0 then
    return 'duplicate';
  end if;

  select * into pay from public.payments where payment_intent_id = p_intent_id for update;
  if pay.id is null then
    return 'unknown';
  end if;

  if p_type = 'payment_intent.amount_capturable_updated' then
    perform private.rm_finalize_goal(pay.id);
  elsif p_type = 'payment_intent.succeeded' then
    update public.payments set status = 'captured', closed_at = now(), pending_action = null
     where id = pay.id and status in ('reserved', 'pending');
    perform private.rm_record_capture(pay.id);
  elsif p_type = 'payment_intent.canceled' then
    if pay.pending_action = 'cancel' or pay.status = 'failed' then
      update public.payments set status = case when status = 'failed' then 'failed' else 'released' end,
                                 closed_at = now(), pending_action = null
       where id = pay.id;
    elsif pay.status in ('reserved', 'pending') then
      -- Cancelled by Stripe (expired) or by the bank: not secured, nothing is charged.
      update public.payments set status = 'expired', closed_at = now(), pending_action = null
       where id = pay.id;
    end if;
  elsif p_type = 'payment_intent.payment_failed' then
    update public.payments set status = 'failed', closed_at = now()
     where id = pay.id and status = 'pending';
  end if;
  return 'ok';
end;
$$;

-- What the settlement Edge Function still has to do at Stripe.
create function public.rm_pending_actions()
returns table (payment_id uuid, payment_intent_id text, action text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.payment_intent_id, p.pending_action
    from public.payments p
   where p.pending_action is not null and p.action_attempts < 10
   order by p.created_at
   limit 50;
$$;

-- The result of one attempt. Success closes the payment (idempotent); a failure is retried
-- on the next run up to 10 times.
create function public.rm_action_done(p_payment_id uuid, p_ok boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  pay public.payments;
begin
  select * into pay from public.payments where id = p_payment_id for update;
  if pay.id is null or pay.pending_action is null then
    return;
  end if;
  if not p_ok then
    update public.payments set action_attempts = action_attempts + 1 where id = pay.id;
    return;
  end if;
  if pay.pending_action = 'capture' then
    update public.payments set status = 'captured', closed_at = now(), pending_action = null
     where id = pay.id;
    perform private.rm_record_capture(pay.id);
  else
    update public.payments
       set status = case when status = 'failed' then 'failed' else 'released' end,
           closed_at = now(), pending_action = null
     where id = pay.id;
  end if;
end;
$$;

revoke all on function public.rm_register_payment(uuid, text, bigint, jsonb) from public, anon, authenticated;
revoke all on function public.rm_apply_intent_event(text, text, text, text) from public, anon, authenticated;
revoke all on function public.rm_pending_actions() from public, anon, authenticated;
revoke all on function public.rm_action_done(uuid, boolean) from public, anon, authenticated;
grant execute on function public.rm_register_payment(uuid, text, bigint, jsonb) to service_role;
grant execute on function public.rm_apply_intent_event(text, text, text, text) to service_role;
grant execute on function public.rm_pending_actions() to service_role;
grant execute on function public.rm_action_done(uuid, boolean) to service_role;
