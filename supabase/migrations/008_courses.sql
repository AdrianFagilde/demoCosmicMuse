-- =============================================
-- 008: Courses environment
-- Requiere 007_security_hardening.sql (funcion public.is_admin)
-- Idempotente: seguro de ejecutar varias veces
-- =============================================

-- 1. TABLAS
-- =============================================

CREATE TABLE IF NOT EXISTS public.courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  instrument TEXT,
  level TEXT,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.task_checklist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id UUID NOT NULL REFERENCES public.course_tasks(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.course_enrollments (
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.checklist_progress (
  item_id UUID NOT NULL REFERENCES public.task_checklist_items(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  completed_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (item_id, student_id)
);

-- 2. INDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_course_tasks_course ON public.course_tasks (course_id, position);
CREATE INDEX IF NOT EXISTS idx_task_checklist_items_task ON public.task_checklist_items (task_id, position);
CREATE INDEX IF NOT EXISTS idx_course_enrollments_student ON public.course_enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_checklist_progress_student ON public.checklist_progress (student_id);

-- 3. ROW LEVEL SECURITY (patron is_admin de la migracion 007)
-- =============================================

ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_progress ENABLE ROW LEVEL SECURITY;

-- courses: admin total; estudiante solo cursos en los que esta inscrito
DROP POLICY IF EXISTS "Admin all courses" ON public.courses;
CREATE POLICY "Admin all courses" ON public.courses
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read enrolled courses" ON public.courses;
CREATE POLICY "Student read enrolled courses" ON public.courses
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = id AND e.student_id = auth.uid()
    )
  );

-- course_tasks: admin total; estudiante lee tareas de sus cursos inscritos
DROP POLICY IF EXISTS "Admin all course_tasks" ON public.course_tasks;
CREATE POLICY "Admin all course_tasks" ON public.course_tasks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read tasks of enrolled courses" ON public.course_tasks;
CREATE POLICY "Student read tasks of enrolled courses" ON public.course_tasks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_id AND e.student_id = auth.uid()
    )
  );

-- task_checklist_items: admin total; estudiante lee items de tareas de sus cursos
DROP POLICY IF EXISTS "Admin all checklist items" ON public.task_checklist_items;
CREATE POLICY "Admin all checklist items" ON public.task_checklist_items
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read items of enrolled courses" ON public.task_checklist_items;
CREATE POLICY "Student read items of enrolled courses" ON public.task_checklist_items
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.course_tasks t
      JOIN public.course_enrollments e ON e.course_id = t.course_id
      WHERE t.id = task_id AND e.student_id = auth.uid()
    )
  );

-- course_enrollments: admin total; estudiante ve sus propias inscripciones
DROP POLICY IF EXISTS "Admin all enrollments" ON public.course_enrollments;
CREATE POLICY "Admin all enrollments" ON public.course_enrollments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read own enrollments" ON public.course_enrollments;
CREATE POLICY "Student read own enrollments" ON public.course_enrollments
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- checklist_progress: admin lee todo (matriz de progreso); estudiante gestiona solo el suyo
DROP POLICY IF EXISTS "Admin read all progress" ON public.checklist_progress;
CREATE POLICY "Admin read all progress" ON public.checklist_progress
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student manage own progress" ON public.checklist_progress
  ;
CREATE POLICY "Student manage own progress" ON public.checklist_progress
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());
