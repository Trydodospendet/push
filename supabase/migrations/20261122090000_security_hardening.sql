-- Ausbau, part 1 – security audit.
--
-- Findings of the audit (tables, views, functions, storage) and what this migration does:
--
--   * Every table in public already has row level security and clients have SELECT only.
--   * Two helper functions were executable by everybody (PUBLIC): the ledger trigger function
--     and the step threshold. Neither is reachable by anon (the private schema is closed to
--     it), but nothing outside the database needs them, so the right is removed.
--   * Supabase grants every NEW table and function in public to anon and authenticated by
--     default. All our migrations revoke that by hand; one forgotten revoke would expose a
--     table. The default privileges are now closed, so a new object has NO client access until
--     a migration grants it explicitly. Test 11_security.test.sql checks the result for every
--     table and function, including ones added later.

revoke all on function private.protect_ledger_entries() from public, anon, authenticated;
revoke all on function private.streak_min_steps() from public, anon, authenticated;

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on functions from public, anon, authenticated;

-- Objects created by the Supabase dashboard (role supabase_admin) keep their defaults; ours
-- are all created by migrations (role postgres).
