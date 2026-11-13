-- Ausbau, part 6 – secret badges (easter eggs). Harmless surprises, nothing to do with money.
--
--   marathon     one valid run of at least 42.195 km
--   early_bird   a valid run that starts between 03:00 and 05:30 local time ("before sunrise";
--                a real sunrise calculation is not worth it)
--   new_year     a valid run on January 1st (local date)
--   lucky_run    a valid run of 7.777 km (7,767 to 7,787 m)
--   logo_tap     tapped the logo in the profile seven times (claimed by the app)
--
-- The app shows them as "???" until they are earned.

alter table public.user_badges drop constraint user_badges_badge_valid;
alter table public.user_badges
  add constraint user_badges_badge_valid check (
    badge in ('first_challenge', 'first_win', 'streak_7', 'streak_30',
              'km_50', 'km_100', 'challenges_10', 'podium',
              'marathon', 'early_bird', 'new_year', 'lucky_run', 'logo_tap')
  );

create or replace function private.award_badges(p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_challenges integer;
  v_wins integer;
  v_distance bigint;
  v_streak integer;
  v_podium boolean;
  v_marathon boolean;
  v_early boolean;
  v_new_year boolean;
  v_lucky boolean;
begin
  if p_user_id is null then
    return;
  end if;

  select count(*)::integer into v_challenges
    from public.challenge_participants cp
    join public.challenges c on c.id = cp.challenge_id
   where cp.user_id = p_user_id and c.status <> 'cancelled';

  select count(*)::integer into v_wins
    from public.challenge_participants cp
   where cp.user_id = p_user_id and cp.result = 'success';

  select coalesce(sum(w.distance_m), 0) into v_distance
    from public.activity_workouts w
   where w.user_id = p_user_id and w.is_valid and not w.was_user_entered;

  v_streak := private.user_streak(p_user_id);

  -- A podium place needs at least three participants.
  select exists (
    select 1 from public.challenge_participants cp
      join public.challenges c on c.id = cp.challenge_id
     where cp.user_id = p_user_id and c.mode = 'ranked' and c.status = 'settled'
       and cp.rank <= 3 and cp.progress_value > 0 and c.participant_count >= 3
  ) into v_podium;

  select coalesce(bool_or(w.distance_m >= 42195), false),
         coalesce(bool_or((w.start_at at time zone p.timezone)::time between time '03:00' and time '05:30'), false),
         coalesce(bool_or(extract(month from w.start_at at time zone p.timezone) = 1
                          and extract(day from w.start_at at time zone p.timezone) = 1), false),
         coalesce(bool_or(w.distance_m between 7767 and 7787), false)
    into v_marathon, v_early, v_new_year, v_lucky
    from public.activity_workouts w
    join public.profiles p on p.id = w.user_id
   where w.user_id = p_user_id and w.is_valid and not w.was_user_entered;

  insert into public.user_badges (user_id, badge)
  select p_user_id, b.badge
    from (values
      ('first_challenge', v_challenges >= 1),
      ('challenges_10', v_challenges >= 10),
      ('first_win', v_wins >= 1),
      ('streak_7', v_streak >= 7),
      ('streak_30', v_streak >= 30),
      ('km_50', v_distance >= 50000),
      ('km_100', v_distance >= 100000),
      ('podium', v_podium),
      ('marathon', v_marathon),
      ('early_bird', v_early),
      ('new_year', v_new_year),
      ('lucky_run', v_lucky)
    ) as b (badge, earned)
   where b.earned
  on conflict do nothing;
end;
$$;

-- The one secret the app claims itself (a fun badge, no value): the logo tap. Anything else is
-- rejected; the other secrets are awarded from the data only.
create function public.claim_secret_badge(p_secret text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := private.require_uid();
begin
  if p_secret is distinct from 'logo_tap' then
    raise exception using errcode = 'P0001', message = 'unknown_secret';
  end if;
  insert into public.user_badges (user_id, badge) values (v_user_id, 'logo_tap')
  on conflict do nothing;
end;
$$;

revoke all on function public.claim_secret_badge(text) from public, anon;
grant execute on function public.claim_secret_badge(text) to authenticated;
