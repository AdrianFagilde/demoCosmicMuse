-- =============================================
-- Cosmo Music Academy - Migration 004
-- Allow authenticated users to insert their own profile
-- Idempotent: safe to run multiple times
-- =============================================

-- Allow authenticated users to insert their own profile (student self-registration)
DROP POLICY IF EXISTS "Authenticated insert own profile" ON profiles;
CREATE POLICY "Authenticated insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student');
