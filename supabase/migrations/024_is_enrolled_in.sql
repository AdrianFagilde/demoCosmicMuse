-- =============================================
-- 024 ISENROLLEDIN: OPTIMIZE ENROLLMENT CHECKS
--
-- Creates a STABLE function is_enrolled_in(course_id UUID) to replace
-- the repeated EXISTS (SELECT 1 FROM course_enrollments ...) pattern
-- used in RLS policies across multiple migrations.
--
-- Benefits:
-- - Single source of truth for enrollment check logic
-- - STABLE function can be memoized by Postgres per query
-- - Easier to maintain and audit
-- - Reduces policy size and complexity
-- - Avoids tautology bugs (like the one fixed in 017)
--
-- Idempotent: uses CREATE OR REPLACE FUNCTION / DROP POLICY IF EXISTS.
-- PENDIENTE DE APLICAR. Ver supabase/BASELINE.md.
-- =============================================

-- 1. Create the is_enrolled_in function
-- Checks if the current user is enrolled in a given course
CREATE OR REPLACE FUNCTION public.is_enrolled_in(p_course_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1
        FROM public.course_enrollments e
        WHERE e.course_id = p_course_id
          AND e.student_id = auth.uid()
    );
$$;

-- Grant execute to authenticated users
REVOKE ALL ON FUNCTION public.is_enrolled_in(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_enrolled_in(UUID) TO authenticated;

-- =============================================
-- 2. UPDATE POLICIES TO USE is_enrolled_in()
-- =============================================

-- courses: Student read enrolled courses
DROP POLICY IF EXISTS "Student read enrolled courses" ON public.courses;
CREATE POLICY "Student read enrolled courses" ON public.courses
  FOR SELECT TO authenticated USING (public.is_enrolled_in(id));

-- tasks (course tasks): Student read tasks of enrolled courses
-- Note: course_tasks was merged into tasks table in migration 021
-- Course tasks have course_id IS NOT NULL
DROP POLICY IF EXISTS "Student read tasks of enrolled courses" ON public.tasks;
CREATE POLICY "Student read tasks of enrolled courses" ON public.tasks
  FOR SELECT TO authenticated USING (
    course_id IS NOT NULL AND public.is_enrolled_in(course_id)
  );

-- task_checklist_items: Student read items of enrolled courses
-- task_checklist_items references tasks table (which now has course_id)
DROP POLICY IF EXISTS "Student read items of enrolled courses" ON public.task_checklist_items;
CREATE POLICY "Student read items of enrolled courses" ON public.task_checklist_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.tasks t
      WHERE t.id = task_checklist_items.task_id
        AND t.course_id IS NOT NULL
        AND public.is_enrolled_in(t.course_id)
    )
  );

-- course_forms: Student read forms of enrolled courses
DROP POLICY IF EXISTS "Student read forms of enrolled courses" ON public.course_forms;
CREATE POLICY "Student read forms of enrolled courses" ON public.course_forms
  FOR SELECT TO authenticated USING (public.is_enrolled_in(course_id));

-- form_questions: Student read questions of enrolled courses
DROP POLICY IF EXISTS "Student read questions of enrolled courses" ON public.form_questions;
CREATE POLICY "Student read questions of enrolled courses" ON public.form_questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_forms f
      WHERE f.id = form_questions.form_id
        AND public.is_enrolled_in(f.course_id)
    )
  );

-- form_submissions: Student manage own submissions
DROP POLICY IF EXISTS "Student manage own submissions" ON public.form_submissions;
CREATE POLICY "Student manage own submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (student_id = auth.uid() AND public.is_enrolled_in(form_id))
  WITH CHECK (student_id = auth.uid() AND public.is_enrolled_in(form_id));

-- form_answers: Student manage own answers
DROP POLICY IF EXISTS "Student manage own answers" ON public.form_answers;
CREATE POLICY "Student manage own answers" ON public.form_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      JOIN public.course_forms f ON f.id = s.form_id
      WHERE s.id = form_answers.submission_id
        AND public.is_enrolled_in(f.course_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      JOIN public.course_forms f ON f.id = s.form_id
      WHERE s.id = form_answers.submission_id
        AND public.is_enrolled_in(f.course_id)
    )
  );

-- course_materials: Student read materials of enrolled courses
DROP POLICY IF EXISTS "Student read materials of enrolled courses" ON public.course_materials;
CREATE POLICY "Student read materials of enrolled courses" ON public.course_materials
  FOR SELECT TO authenticated USING (public.is_enrolled_in(course_id));

-- checklist_progress: Student manage own progress
DROP POLICY IF EXISTS "Student manage own progress" ON public.checklist_progress;
CREATE POLICY "Student manage own progress" ON public.checklist_progress
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.task_checklist_items tci
      JOIN public.tasks t ON t.id = tci.task_id
      WHERE tci.id = checklist_progress.item_id
        AND t.course_id IS NOT NULL
        AND public.is_enrolled_in(t.course_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.task_checklist_items tci
      JOIN public.tasks t ON t.id = tci.task_id
      WHERE tci.id = checklist_progress.item_id
        AND t.course_id IS NOT NULL
        AND public.is_enrolled_in(t.course_id)
    )
  );