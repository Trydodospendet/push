-- Phase 5 – account deletion (required by Apple and Google Play).
--
-- What happens when a user deletes their account (public.delete_my_account):
--
--   * Open challenges (not started yet): the stake is refunded exactly like leaving.
--     Ranked → the participation is removed. Solo → the solo challenge is cancelled.
--   * Running challenges (active / settling): the stake is FORFEITED. The participation stays
--     as an anonymous, failed row, so the stake remains in the pot and is settled normally
--     (winners share it, or it goes to the house). Otherwise winners would lose money that
--     was already promised to the pot, and the bookings of the challenge would not add up to 0.
--   * Finished challenges (settled / cancelled): nothing changes; the rows are anonymised.
--   * Profile, wallet (including the remaining virtual credits), workouts and daily steps are
--     deleted. Ledger entries and participations are kept with user_id = NULL (anonymised),
--     so every challenge still adds up to 0. Challenges the user created keep running for the
--     other participants, with creator_id = NULL.
--   * Finally the auth user (email address, sessions) is deleted.

------------------------------------------------------------------------------------------
-- Keep challenges and participations when a profile is deleted
------------------------------------------------------------------------------------------

alter table public.challenges alter column creator_id drop not null;
alter table public.challenges drop constraint challenges_creator_id_fkey;
alter table public.challenges
  add constraint challenges_creator_id_fkey
  foreign key (creator_id) references public.profiles (id) on delete set null;

-- A participation of a deleted account has no user any more, so (challenge_id, user_id) can
-- no longer be the primary key. A surrogate key takes its place; the pair stays unique for
-- existing users (NULLs are distinct).
alter table public.challenge_participants add column id uuid not null default gen_random_uuid();
alter table public.challenge_participants drop constraint challenge_participants_pkey;
alter table public.challenge_participants add primary key (id);
alter table public.challenge_participants
  add constraint challenge_participants_one_per_user unique (challenge_id, user_id);
alter table public.challenge_participants alter column user_id drop not null;
alter table public.challenge_participants drop constraint challenge_participants_user_id_fkey;
alter table public.challenge_participants
  add constraint challenge_participants_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete set null;

-- The new key column is readable like the others (progress_value stays hidden).
grant select (id) on public.challenge_participants to authenticated;

------------------------------------------------------------------------------------------
-- Account deletion
------------------------------------------------------------------------------------------

-- Shared by the app (public.delete_my_account) and by the operator for deletion requests that
-- arrive by email (docs/legal/delete-account.html). Operator, in the Supabase SQL editor:
--   select private.delete_account((select id from auth.users where email = 'name@example.com'));
create function private.delete_account(p_user_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_user_id uuid := p_user_id;
  c public.challenges;
  p public.challenge_participants;
begin
  if not exists (select 1 from auth.users where id = v_user_id) then
    raise exception using errcode = 'P0001', message = 'account_not_found';
  end if;

  -- Fixed lock order (challenge id), like settlement and sync.
  for c in
    select ch.* from public.challenges ch
      join public.challenge_participants cp on cp.challenge_id = ch.id
     where cp.user_id = v_user_id
     order by ch.id
       for update of ch
  loop
    select * into p from public.challenge_participants
     where challenge_id = c.id and user_id = v_user_id;

    if c.status = 'open' then
      perform private.post_user_entry(v_user_id, 'refund', p.stake_cents, c.id);
      if c.mode = 'solo' then
        update public.challenge_participants
           set result = 'refunded', payout_cents = p.stake_cents
         where id = p.id;
        update public.challenges set status = 'cancelled' where id = c.id;
      else
        delete from public.challenge_participants where id = p.id;
        update public.challenges
           set participant_count = participant_count - 1
         where id = c.id;
      end if;
    elsif c.status in ('active', 'settling') and p.result = 'pending' then
      update public.challenge_participants
         set result = 'failed', payout_cents = 0
       where id = p.id;
    end if;
  end loop;

  -- Cascades: profile → wallet, workouts, daily steps.
  -- Set null: ledger entries, participations, created challenges.
  delete from auth.users where id = v_user_id;
end;
$$;

revoke all on function private.delete_account(uuid) from public, anon, authenticated;

-- Deletes the caller's own account (Profile → "Konto löschen").
create function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.delete_account(private.require_uid());
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
