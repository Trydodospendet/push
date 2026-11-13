-- Ausbau, part 2 (app side) – the own result of a challenge: rank, rank points and what was
-- paid out or donated. These columns are not readable by other participants, so the caller gets
-- only the own row through this function.

create function public.get_my_challenge_result(p_challenge_id uuid)
returns table (rank integer, rank_points integer, payout_cents bigint, donated_cents bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select cp.rank, cp.rank_points, cp.payout_cents, cp.donated_cents
    from public.challenge_participants cp
   where cp.challenge_id = p_challenge_id
     and cp.user_id = private.require_uid();
$$;

revoke all on function public.get_my_challenge_result(uuid) from public, anon;
grant execute on function public.get_my_challenge_result(uuid) to authenticated;
