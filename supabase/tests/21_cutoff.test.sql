begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users(id,email,aud,role) values('00000000-0000-4000-8000-000000000031','cutoff@pgtap.test','authenticated','authenticated');
select set_config('request.jwt.claims','{"sub":"00000000-0000-4000-8000-000000000031","role":"authenticated"}',true);
create temp table goal as select * from public.create_goal_with_preferences('Sofortiges Ziel','run_total',5000,1000,(now() at time zone 'Europe/Berlin')::date,(now() at time zone 'Europe/Berlin')::date,false,false,null);
select is((select sync_grace_hours from goal),0,'new goal has no grace period');
select is((select status from goal),'active','immediate goal is active before the first health sync');
update public.profiles set donate_default=true,default_ngo_id='00000000-0000-4000-a000-000000000001' where id=auth.uid();
select is((select effective_donate from public.get_my_challenge_donation((select id from goal))),false,'later default changes do not alter the recorded choice');
select throws_ok($$select public.set_challenge_donation((select id from goal),true,'00000000-0000-4000-a000-000000000001')$$,'P0001','donation_locked','choice is locked as soon as the goal starts');
update public.challenges set starts_at=now()-interval '2 days',ends_at=now()+interval '1 day' where id=(select id from goal);
insert into public.activity_workouts(user_id,platform,source_record_id,activity_type,start_at,end_at,distance_m,duration_s,was_user_entered,is_valid)
values(auth.uid(),'android','on-time','running',now()-interval '1 day',now()-interval '1 day'+interval '20 minutes',3000,1200,false,true);
select private.recompute_health_progress((select id from goal));
select is((select progress_value from public.challenge_participants where challenge_id=(select id from goal)),3000,'on-time progress is stored');
update public.challenges set ends_at=now()-interval '1 hour',status='settling' where id=(select id from goal);
insert into public.activity_workouts(user_id,platform,source_record_id,activity_type,start_at,end_at,distance_m,duration_s,was_user_entered,is_valid)
values(auth.uid(),'android','late','running',now()-interval '4 hours',now()-interval '3 hours',7000,3600,false,true);
select private.recompute_health_progress((select id from goal));
select is((select progress_value from public.challenge_participants where challenge_id=(select id from goal)),3000,'late activity cannot change the frozen progress');
select is(public.settle_challenge((select id from goal)),true,'settles without a grace period');
select is((select result from public.challenge_participants where challenge_id=(select id from goal)),'failed','late kilometres cannot turn a loss into a win');
select * from finish();rollback;
