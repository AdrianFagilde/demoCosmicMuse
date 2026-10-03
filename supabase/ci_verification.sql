-- =============================================================================
-- CI verification for the migrated schema.
--
-- Runs on a database freshly built with `supabase db reset` (all migrations in
-- order). It only asserts invariants of the FINAL schema, so it stays valid as
-- migrations are added. Read-only: no writes.
--
-- Every check is a boolean. The DO block raises and fails the CI step if any
-- check is false. Run with:
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/ci_verification.sql
-- =============================================================================

DO $$
DECLARE
  failures text;
BEGIN
  WITH checks(check_name, ok) AS (
    -- RLS enabled on the tables that hold user data.
    SELECT 'rls:' || t.tablename,
           c.relrowsecurity
    FROM (VALUES
      ('profiles'),
      ('lessons'),
      ('tasks'),
      ('payments'),
      ('payment_reminders'),
      ('notification_log'),
      ('instruments'),
      ('notifications'),
      ('courses'),
      ('course_enrollments'),
      ('course_forms'),
      ('course_materials')
    ) AS t(tablename)
    JOIN pg_class c ON c.relname = t.tablename
    JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
    UNION ALL
    -- The metrics view must run with the caller's privileges.
    SELECT 'profiles_with_metrics security_invoker',
           COALESCE(
             (SELECT array_to_string(c2.reloptions, ',') LIKE '%security_invoker=true%'
              FROM pg_class c2
              JOIN pg_namespace n2 ON n2.oid = c2.relnamespace
              WHERE n2.nspname = 'public' AND c2.relname = 'profiles_with_metrics'),
             false)
    UNION ALL
    -- get_next_badges keeps its TABLE contract (the 017 regression).
    SELECT 'get_next_badges returns TABLE',
           pg_get_function_result(to_regprocedure('public.get_next_badges(uuid)')) LIKE 'TABLE%'
    UNION ALL
    -- These functions must EXECUTE, not just exist. In 016 they became plpgsql
    -- and RETURN QUERY stopped coercing: gs.day is timestamptz (generate_series
    -- prefers the timestamptz overload), so returning it as `day DATE` raised
    -- 42804; COUNT(*) (bigint) did the same against `progress INTEGER`. With a
    -- NULL student_id the auth guard does not block, the query plans and the
    -- type mismatch would surface here instead of in the browser.
    SELECT 'get_weekly_practice_summary runs (7 days)',
           (SELECT count(*) FROM public.get_weekly_practice_summary(NULL::uuid)) = 7
    UNION ALL
    SELECT 'get_next_badges runs (3 badges)',
           (SELECT count(*) FROM public.get_next_badges(NULL::uuid)) = 3
    UNION ALL
    -- 035: la racha debe dispararse al CERRAR la sesion (AFTER UPDATE), no al
    -- insertarla (boton Practicar). El bug original contaba por entrar.
    SELECT 'streak trigger fires on UPDATE',
           COALESCE(
             (SELECT pg_get_triggerdef(t.oid) LIKE '%AFTER UPDATE%'
              FROM pg_trigger t
              WHERE t.tgname = 'trg_update_practice_streak' AND NOT t.tgisinternal),
             false)
    UNION ALL
    SELECT 'daily_goal_minutes column exists',
           EXISTS (
             SELECT 1 FROM information_schema.columns
             WHERE table_schema = 'public'
               AND table_name = 'student_gamification'
               AND column_name = 'daily_goal_minutes')
    UNION ALL
    SELECT 'xp_events table exists',
           to_regclass('public.xp_events') IS NOT NULL
    UNION ALL
    SELECT 'award_xp(uuid, integer, text, uuid) exists',
           to_regprocedure('public.award_xp(uuid, integer, text, uuid)') IS NOT NULL
    UNION ALL
    SELECT 'award_xp not callable by authenticated',
           NOT has_function_privilege('authenticated', 'public.award_xp(uuid, integer, text, uuid)', 'EXECUTE')
    UNION ALL
    SELECT 'set_daily_goal(uuid, integer) exists',
           to_regprocedure('public.set_daily_goal(uuid, integer)') IS NOT NULL
    UNION ALL
    -- Enrollment helper used by the course read policies.
    SELECT 'is_enrolled_in(uuid) exists',
           to_regprocedure('public.is_enrolled_in(uuid)') IS NOT NULL
    UNION ALL
    -- The three course read policies survive, one per table.
    SELECT 'course read policies (3)',
           (SELECT count(*) FROM pg_policies
             WHERE schemaname = 'public' AND cmd = 'SELECT' AND policyname IN (
               'Student read tasks of enrolled courses',
               'Student read forms of enrolled courses',
               'Student read materials of enrolled courses')) = 3
    UNION ALL
    -- Messaging was removed in 028; the tables must not come back.
    SELECT 'messaging tables dropped',
           to_regclass('public.conversations') IS NULL
           AND to_regclass('public.conversation_participants') IS NULL
           AND to_regclass('public.messages') IS NULL
  )
  SELECT string_agg(check_name, ', ' ORDER BY check_name)
    INTO failures
  FROM checks
  WHERE NOT ok;

  IF failures IS NOT NULL THEN
    RAISE EXCEPTION 'CI schema verification failed: %', failures;
  END IF;

  RAISE NOTICE 'CI schema verification passed';
END $$;
