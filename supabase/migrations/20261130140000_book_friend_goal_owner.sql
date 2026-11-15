-- Confirming a friend goal also books the creator's entry in the same transaction.
create or replace function public.create_goal_with_preferences(
  p_title text,
  p_goal_type text,
  p_target_value integer,
  p_stake_cents bigint,
  p_start_date date,
  p_end_date date,
  p_with_friends boolean,
  p_donate boolean,
  p_ngo_id uuid
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
  if p_donate is null then
    raise exception 'invalid_donation_setting';
  end if;
  if p_donate and (p_ngo_id is null or not exists (
    select 1 from public.ngos where id = p_ngo_id and active
  )) then
    raise exception 'ngo_not_found';
  end if;

  v_challenge := public.create_scheduled_goal(
    p_title, p_goal_type, p_target_value, p_stake_cents, p_start_date, p_end_date, p_with_friends
  );
  if p_with_friends then
    perform private."join"(v_challenge.id, v_user_id, p_stake_cents);
  end if;

  update public.challenge_participants
     set donate = p_donate,
         ngo_id = case when p_donate then p_ngo_id else null end
   where challenge_id = v_challenge.id and user_id = v_user_id;

  if v_challenge.starts_at <= now() then
    perform private.start_challenge(v_challenge.id);
    perform private.recompute_health_progress(v_challenge.id);
  end if;

  select * into v_challenge from public.challenges where id = v_challenge.id;
  return v_challenge;
end;
$$;
