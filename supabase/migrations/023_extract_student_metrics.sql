-- =============================================
-- 023 PROFILES: EXTRACT STUDENT METRICS TO SEPARATE TABLE
--
-- The profiles table is a "god table" mixing identity (id, email, role)
-- with mutable student metrics (progress, attendance, next_lesson).
-- This migration extracts those three columns into a dedicated table
-- `student_metrics` with a 1:1 relationship to profiles.
--
-- Rationale:
-- - Separation of concerns: identity vs mutable metrics
-- - Easier to audit changes to metrics
-- - Allows multiple metrics rows per student in future (historical tracking)
-- - Cleaner RLS policies (metrics can have different access rules than identity)
--
-- Idempotent: uses IF NOT EXISTS / IF EXISTS.
-- PENDIENTE DE APLICAR. Ver supabase/BASELINE.md.
-- =============================================

-- 1. Create student_metrics table
CREATE TABLE IF NOT EXISTS public.student_metrics (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  progress INTEGER NOT NULL DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  attendance INTEGER NOT NULL DEFAULT 100 CHECK (attendance >= 0 AND attendance <= 100),
  next_lesson TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Migrate existing data from profiles to student_metrics
-- Only run if profiles still has the columns (first run)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' AND column_name = 'progress'
  ) THEN
    INSERT INTO public.student_metrics (student_id, progress, attendance, next_lesson, created_at, updated_at)
    SELECT
      id,
      COALESCE(progress, 0),
      COALESCE(attendance, 100),
      next_lesson,
      COALESCE(created_at, now()),
      COALESCE(updated_at, now())
    FROM public.profiles
    WHERE role = 'student'
    ON CONFLICT (student_id) DO NOTHING;
  END IF;
END $$;

-- 3. Enable RLS on student_metrics
ALTER TABLE public.student_metrics ENABLE ROW LEVEL SECURITY;

-- 4. RLS Policies for student_metrics
-- Admin: full access
DROP POLICY IF EXISTS "Admin all student_metrics" ON public.student_metrics;
CREATE POLICY "Admin all student_metrics" ON public.student_metrics
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Student: read own metrics
DROP POLICY IF EXISTS "Student read own metrics" ON public.student_metrics;
CREATE POLICY "Student read own metrics" ON public.student_metrics
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- Student: update own metrics (progress, attendance, next_lesson)
DROP POLICY IF EXISTS "Student update own metrics" ON public.student_metrics;
CREATE POLICY "Student update own metrics" ON public.student_metrics
  FOR UPDATE TO authenticated USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- Admin can insert metrics for students
DROP POLICY IF EXISTS "Admin insert student_metrics" ON public.student_metrics;
CREATE POLICY "Admin insert student_metrics" ON public.student_metrics
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());

-- 4b. Trigger for updated_at
DROP TRIGGER IF EXISTS trg_student_metrics_updated_at ON public.student_metrics;
CREATE TRIGGER trg_student_metrics_updated_at
  BEFORE UPDATE ON public.student_metrics
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 5. Drop columns from profiles (only if they exist)
-- Note: This is NOT idempotent for the DROP COLUMN part, but guarded by IF EXISTS
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'progress') THEN
    ALTER TABLE public.profiles DROP COLUMN progress;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'attendance') THEN
    ALTER TABLE public.profiles DROP COLUMN attendance;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'profiles' AND column_name = 'next_lesson') THEN
    ALTER TABLE public.profiles DROP COLUMN next_lesson;
  END IF;
END $$;

-- 6. Recreate view if needed (for backward compatibility)
-- We can create a view that joins profiles + student_metrics for backward compatibility
DROP VIEW IF EXISTS public.profiles_with_metrics;
CREATE VIEW public.profiles_with_metrics AS
SELECT
  p.*,
  COALESCE(sm.progress, 0) AS progress,
  COALESCE(sm.attendance, 100) AS attendance,
  sm.next_lesson
FROM public.profiles p
LEFT JOIN public.student_metrics sm ON sm.student_id = p.id;

-- Grant SELECT on view to authenticated
GRANT SELECT ON public.profiles_with_metrics TO authenticated;