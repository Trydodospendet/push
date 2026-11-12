-- Preview of a (usually private) challenge by its invite code, so the app can show the
-- details and the confirmation sheet before anybody pays the stake. Read-only.
create function public.get_challenge_by_code(p_code text)
returns public.challenges
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_challenge public.challenges;
begin
  perform private.require_uid();

  select c.* into v_challenge
    from public.challenges c
   where c.invite_code = upper(btrim(coalesce(p_code, '')));

  if not found then
    raise exception using errcode = 'P0001', message = 'invalid_invite_code';
  end if;

  return v_challenge;
end;
$$;

revoke all on function public.get_challenge_by_code(text) from public, anon;
grant execute on function public.get_challenge_by_code(text) to authenticated;
