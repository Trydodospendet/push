-- Immediate final results: progress freezes at the goal deadline.
alter table public.challenges alter column sync_grace_hours set default 0;
update public.challenges set sync_grace_hours = 0 where status in ('open','active','settling');
-- Preserve the existing implementation for pre-deadline recomputation.
alter function private.recompute_health_progress(uuid) rename to recompute_health_progress_before_cutoff;
create function private.recompute_health_progress(p_challenge_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare c public.challenges;
begin
 select * into c from public.challenges where id=p_challenge_id for update;
 if c.sync_grace_hours=0 and now()>=c.ends_at then return; end if;
 perform private.recompute_health_progress_before_cutoff(p_challenge_id);
end; $$;
revoke all on function private.recompute_health_progress(uuid) from public,anon,authenticated;

-- Snapshot the default at entry so later profile edits cannot change a running goal.
create function private.freeze_entry_donation() returns trigger language plpgsql security definer set search_path='' as $$
begin
 select coalesce(new.donate,p.donate_default),coalesce(new.ngo_id,p.default_ngo_id)
 into new.donate,new.ngo_id from public.profiles p where p.id=new.user_id;
 return new;
end; $$;
revoke all on function private.freeze_entry_donation() from public,anon,authenticated;
create trigger freeze_entry_donation before insert on public.challenge_participants for each row execute function private.freeze_entry_donation();
update public.challenge_participants cp set donate=coalesce(cp.donate,p.donate_default),ngo_id=coalesce(cp.ngo_id,p.default_ngo_id) from public.profiles p where p.id=cp.user_id and cp.result='pending';
create or replace function public.set_challenge_donation(
  p_challenge_id uuid, p_donate boolean default null, p_ngo_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
  v_status text;
  v_starts timestamptz;
begin
  select c.status, c.starts_at into v_status, v_starts from public.challenges c where c.id = p_challenge_id for update;
  if not exists (
    select 1 from public.challenge_participants cp
     where cp.challenge_id = p_challenge_id and cp.user_id = v_user_id
  ) then
    raise exception using errcode = 'P0001', message = 'not_joined';
  end if;
  if v_status <> 'open' or now() >= v_starts then
    raise exception using errcode = 'P0001', message = 'donation_locked';
  end if;
  if p_ngo_id is not null
     and not exists (select 1 from public.ngos n where n.id = p_ngo_id and n.active) then
    raise exception using errcode = 'P0001', message = 'ngo_not_found';
  end if;

  update public.challenge_participants
     set donate = coalesce(p_donate,(select donate_default from public.profiles where id=v_user_id)), ngo_id = coalesce(p_ngo_id,(select default_ngo_id from public.profiles where id=v_user_id))
   where challenge_id = p_challenge_id and user_id = v_user_id;
end;
$$;


create function public.create_goal_with_preferences(p_title text,p_goal_type text,p_target_value integer,p_stake_cents bigint,p_start_date date,p_end_date date,p_with_friends boolean,p_donate boolean,p_ngo_id uuid)
returns public.challenges language plpgsql security definer set search_path='' as $$
declare u uuid:=private.require_uid(); c public.challenges;
begin
 if p_donate is null then raise exception 'invalid_donation_setting'; end if;
 if p_donate and (p_ngo_id is null or not exists(select 1 from public.ngos where id=p_ngo_id and active)) then raise exception 'ngo_not_found'; end if;
 c:=public.create_scheduled_goal(p_title,p_goal_type,p_target_value,p_stake_cents,p_start_date,p_end_date,p_with_friends);
 update public.challenge_participants set donate=p_donate,ngo_id=case when p_donate then p_ngo_id else null end where challenge_id=c.id and user_id=u;
 if c.starts_at<=now() then
  perform private.start_challenge(c.id);
  perform private.recompute_health_progress(c.id);
 end if;
 select * into c from public.challenges where id=c.id;
 return c;
end; $$;
revoke all on function public.create_goal_with_preferences(text,text,integer,bigint,date,date,boolean,boolean,uuid) from public,anon;
grant execute on function public.create_goal_with_preferences(text,text,integer,bigint,date,date,boolean,boolean,uuid) to authenticated;
-- A short scheduler interval also closes goals while every phone is offline.
select cron.schedule('advance-challenges','10 seconds','select public.advance_challenges()');
