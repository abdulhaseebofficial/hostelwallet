-- Takes the browser-facing roles off the application's tables entirely.
--
-- WHY THIS EXISTS
--
-- On Supabase, `anon` and `authenticated` are the roles behind the public API
-- at <project>.supabase.co/rest/v1/. Anyone who has the anon key - which is
-- designed to be public - is those roles. The project was provisioned with the
-- Supabase default: both roles hold SELECT, INSERT, UPDATE, DELETE, TRUNCATE,
-- REFERENCES and TRIGGER on every table in `public`.
--
-- Twelve of the thirteen tables survive that only because RLS is enabled on
-- them with no policies, which denies every row. That is protection by
-- accident, not by design: it holds exactly as long as nobody adds a permissive
-- policy or turns RLS off on one table, and it leaves the endpoints reachable,
-- so the table and column names are readable even when the rows are not.
--
-- schema_migrations did not survive it. RLS was never enabled there, so it was
-- readable AND writable with the public key. Verified against the live project:
--
--   SELECT on schema_migrations  -> 200, returned a real row
--   INSERT on schema_migrations  -> 23502 (not-null) - permission was passed,
--                                   only the constraint refused it
--   INSERT on expenses/users/... -> 42501 - denied by RLS before the table
--
-- Reading the ledger is minor. Writing it is not: inserting a row named after a
-- migration that has NOT yet run makes the runner believe it already has, and
-- skip it forever. A future migration - including a security fix - would then
-- silently never apply. Deleting rows has the mirror effect of re-running
-- migrations that were already applied.
--
-- WHAT THIS DOES
--
-- Removes both roles from the schema altogether, rather than adding policies to
-- work around grants that should not be there. This application never uses
-- PostgREST: the browser talks only to the Express API, which connects as the
-- table owner. Nothing legitimate is being taken away.
--
-- service_role is deliberately left alone. It bypasses RLS by design, it is the
-- credential the Supabase dashboard and any future server-side tooling use, and
-- revoking it would break the dashboard without improving anything - the key is
-- server-side only and was verified absent from the frontend bundle.
--
-- SAFETY
--
-- No table, column, row or constraint is touched; this changes privileges only.
-- Every statement is guarded on the role existing, so it is a clean no-op on
-- Neon and on a local Postgres, where `anon` and `authenticated` do not exist.
--
-- Rollback (the runner is forward-only; run by hand if ever needed):
--   GRANT USAGE ON SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated;
--   GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated;

/* ------- 1. the migration ledger stops being a special case ---------- */

-- The one table that had no RLS. The application connects as the owner, and an
-- owner bypasses RLS, so the migration runner is unaffected. This is belt and
-- braces behind the revocation below.
ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

/* ------- 2. anon and authenticated lose access to the schema --------- */

DO $$
DECLARE
  target text;
BEGIN
  FOREACH target IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target) THEN

      -- Existing objects.
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA public FROM %I', target);
      EXECUTE format('REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM %I', target);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM %I', target);

      -- Anything this migration runner creates from now on. Without this, the
      -- next CREATE TABLE quietly re-grants everything and the fix rots.
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON TABLES FROM %I', target);
      EXECUTE format(
        'ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE ALL ON SEQUENCES FROM %I', target);

      -- USAGE last: without it the role cannot even name an object in the
      -- schema, which is what makes the REST endpoints stop existing for it
      -- rather than merely returning nothing.
      EXECUTE format('REVOKE USAGE ON SCHEMA public FROM %I', target);

      RAISE NOTICE 'revoked public schema access from %', target;
    ELSE
      RAISE NOTICE 'role % does not exist here, nothing to revoke', target;
    END IF;
  END LOOP;
END $$;
