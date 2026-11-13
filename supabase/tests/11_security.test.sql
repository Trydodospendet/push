-- Ausbau – security audit as tests. Every check looks at ALL tables and functions, so objects
-- added by later migrations are covered automatically.
begin;
create extension if not exists pgtap with schema extensions;

select plan(19);

create function pg_temp.login(p_user_id uuid)
returns void
language sql
as $$
  select set_config('role', 'authenticated', true),
         set_config('request.jwt.claims',
           json_build_object('sub', p_user_id, 'role', 'authenticated')::text, true);
$$;

create function pg_temp.logout()
returns void
language sql
as $$
  select set_config('role', 'postgres', true),
         set_config('request.jwt.claims', '', true);
$$;

-- Tables and views -------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  0,
  'every table in public has row level security'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm', 'f')),
  0,
  'there are no views in public (a view would bypass row level security)'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'select,insert,update,delete,truncate,references,trigger')
           or has_any_column_privilege('anon', c.oid, 'select,insert,update,references'))),
  0,
  'anonymous users have no right on any table'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('authenticated', c.oid, 'insert,update,delete,truncate,references,trigger')
           or has_any_column_privilege('authenticated', c.oid, 'insert,update,references'))),
  0,
  'signed-in users can only read tables; every write goes through a function'
);

select is(
  (select count(*)::integer from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
      and (has_table_privilege('authenticated', c.oid, 'select')
           or has_any_column_privilege('authenticated', c.oid, 'select'))),
  0,
  'every readable table has a policy'
);

select ok(
  not has_any_column_privilege('authenticated', 'public.gps_runs', 'select'),
  'raw GPS tracks cannot be read by clients at all'
);
select ok(
  not has_column_privilege('authenticated', 'public.challenge_participants', 'progress_value', 'select'),
  'the progress of other participants stays hidden'
);

-- Functions ----------------------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prokind = 'f'
      and has_function_privilege('anon', p.oid, 'execute')),
  0,
  'anonymous users cannot execute any function'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')),
  0,
  'every SECURITY DEFINER function has a fixed search_path'
);

select is(
  (select array_agg(p.proname::text order by p.proname) from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.prokind = 'f'
      and has_function_privilege('authenticated', p.oid, 'execute')),
  array['is_participant'],
  'of the internal functions only the RLS helper is executable by signed-in users'
);

select is(
  (select count(*)::integer from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname in
      ('settle_challenge', 'advance_challenges', 'create_weekly_challenge', 'handle_new_user')
      and has_function_privilege('authenticated', p.oid, 'execute')),
  0,
  'scheduler and trigger functions are closed to clients'
);

-- Storage ---------------------------------------------------------------------------------------

select is(
  (select count(*)::integer from storage.buckets where public),
  0,
  'no storage bucket is public'
);
select ok(
  (select relrowsecurity from pg_class where oid = 'storage.objects'::regclass),
  'row level security is on for stored files'
);
select is(
  (select count(*)::integer from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (roles @> array['anon']::name[] or roles @> array['public']::name[])),
  0,
  'no storage policy applies to anonymous users'
);

-- Defaults for the future -----------------------------------------------------------------------

select is(
  (select count(*)::integer from pg_default_acl d
    where d.defaclnamespace = 'public'::regnamespace
      and d.defaclrole = 'postgres'::regrole
      and exists (select 1 from aclexplode(d.defaclacl) a
                   where a.grantee in ('anon'::regrole, 'authenticated'::regrole, 0))),
  0,
  'new tables and functions in public get no client rights by default'
);

-- Behaviour ---------------------------------------------------------------------------------------

insert into auth.users (id, email, aud, role)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'anna@pgtap.test', 'authenticated', 'authenticated');

select pg_temp.login('aaaaaaaa-0000-0000-0000-000000000001');
select throws_ok(
  $$ update public.wallets set balance_cents = 999999999 $$,
  '42501', null, 'nobody can give themselves credits'
);
select throws_ok(
  $$ insert into public.ledger_entries (account, user_id, type, amount_cents)
     values ('user', 'aaaaaaaa-0000-0000-0000-000000000001', 'payout', 100000) $$,
  '42501', null, 'nobody can write ledger entries'
);
select throws_ok(
  $$ update public.profiles set display_name = 'Hacker' $$,
  '42501', null, 'profiles are changed through set_display_name only'
);
select throws_ok(
  $$ select * from cron.job $$,
  '42501', null, 'the scheduler table is closed'
);
select pg_temp.logout();

select * from finish();
rollback;
