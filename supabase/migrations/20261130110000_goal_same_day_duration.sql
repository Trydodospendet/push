-- Personal daily goals created during the day end at local midnight, so their duration is
-- shorter than 24 hours. Other challenge modes keep their existing duration limits.
alter table public.challenges drop constraint challenges_duration;

alter table public.challenges
  add constraint challenges_duration check (
    ends_at > starts_at
    and (
      (mode = 'goal' and ends_at <= starts_at + interval '32 days')
      or (mode <> 'goal'
          and ends_at >= starts_at + interval '1 day'
          and ends_at <= starts_at + interval '42 days')
    )
  );
