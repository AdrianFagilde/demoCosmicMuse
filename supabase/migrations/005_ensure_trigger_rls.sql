-- =============================================
-- Cosmic Muse Academy - Migration 005
-- Fix: ensure trigger + function + RLS exist
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. Ensure columns exist (in case earlier migrations weren't run)
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. Ensure trigger function exists with latest definition
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, role, birth_date, guardian_name, guardian_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student'),
    CASE
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL
        THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE
      ELSE NULL
    END,
    NEW.raw_user_meta_data ->> 'guardian_name',
    NEW.raw_user_meta_data ->> 'guardian_phone'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Ensure trigger exists on auth.users
-- =============================================

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Ensure RLS policies exist on profiles
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Admin full access
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Student own profile select
DROP POLICY IF EXISTS "Student own profile select" ON profiles;
CREATE POLICY "Student own profile select" ON profiles
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND id = auth.uid()
  );

-- Student own profile update
DROP POLICY IF EXISTS "Student own profile update" ON profiles;
CREATE POLICY "Student own profile update" ON profiles
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND id = auth.uid()
  );

-- All authenticated can read all profiles
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON profiles;
CREATE POLICY "Authenticated can read all profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Authenticated can insert their own profile (student self-registration)
DROP POLICY IF EXISTS "Authenticated insert own profile" ON profiles;
CREATE POLICY "Authenticated insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student');
