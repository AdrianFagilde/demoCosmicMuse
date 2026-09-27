-- =============================================
-- 021 UNIFICA TASKS Y COURSE_TASKS EN ASSIGNMENTS
--
-- Unifica la tabla legacy `tasks` (asignación individual) y
-- `course_tasks` (curricular) en una sola tabla `assignments`.
--
-- Modelo (Opción C):
--   - `course_id` + `student_id` mutuamente excluyentes (CHECK)
--   - Si `course_id` IS NOT NULL → tarea curricular (curso)
--   - Si `student_id` IS NOT NULL → asignación individual
--   - `due_date` nullable (cubre ambos casos)
--   - `position` para orden en ambos contextos
--   - `updated_at` en ambos
--   - `status` + `progress` legacy mantenidos para compatibilidad
--   - Checklist solo si `course_id` IS NOT NULL
--
-- Idempotente: usa CREATE TABLE IF NOT EXISTS y DROP CONSTRAINT IF EXISTS.
-- PENDIENTE DE APLICAR. Ver supabase/BASELINE.md.
-- =============================================

-- =============================================
-- 1. TABLA UNIFICADA
-- =============================================
CREATE TABLE IF NOT EXISTS public.assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Identidad
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  -- Contexto de asignación (mutuamente excluyentes)
  course_id UUID REFERENCES public.courses(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  -- Fechas y orden
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  -- Campos legacy (compatibilidad)
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','En progreso','Completado')),
  progress INTEGER DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  -- Checklist (solo para asignaciones curriculares)
  -- Los items se crean en task_checklist_items referenciando assignments.id
  -- Metadatos
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Constraint mutua exclusión: exactamente uno de course_id / student_id
ALTER TABLE public.assignments
  DROP CONSTRAINT IF EXISTS assignments_context_xor;
ALTER TABLE public.assignments
  ADD CONSTRAINT assignments_context_xor
  CHECK (
    (course_id IS NOT NULL AND student_id IS NULL)
    OR (course_id IS NULL AND student_id IS NOT NULL)
  );

-- =============================================
-- 2. ÍNDICES
-- =============================================
CREATE INDEX IF NOT EXISTS idx_assignments_course ON public.assignments (course_id, position);
CREATE INDEX IF NOT EXISTS idx_assignments_student ON public.assignments (student_id);
CREATE INDEX IF NOT EXISTS idx_assignments_assigned_by ON public.assignments (assigned_by);

-- =============================================
-- 3. RLS
-- =============================================
ALTER TABLE public.assignments ENABLE ROW LEVEL SECURITY;

-- Admin: acceso total
DROP POLICY IF EXISTS "Admin all assignments" ON public.assignments;
CREATE POLICY "Admin all assignments" ON public.assignments
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Asignaciones curriculares (course_id IS NOT NULL):
--   Admin: total
--   Estudiante: lee tareas de cursos en los que está inscrito
DROP POLICY IF EXISTS "Student read course assignments" ON public.assignments;
CREATE POLICY "Student read course assignments" ON public.assignments
  FOR SELECT TO authenticated USING (
    course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = assignments.course_id
        AND e.student_id = auth.uid()
    )
  );

-- Asignaciones individuales (student_id IS NOT NULL):
--   Admin: total
--   Estudiante: lee sus propias asignaciones
--   Admin/Profesor asignado: puede crear/actualizar
DROP POLICY IF EXISTS "Student read own assignments" ON public.assignments;
CREATE POLICY "Student read own assignments" ON public.assignments
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Student update own assignments" ON public.assignments;
CREATE POLICY "Student update own assignments" ON public.assignments
  FOR UPDATE TO authenticated USING (
    student_id = auth.uid()
  ) WITH CHECK (
    student_id = auth.uid()
  );

-- Admin/Profesor puede crear asignaciones individuales
DROP POLICY IF EXISTS "Admin create individual assignments" ON public.assignments;
CREATE POLICY "Admin create individual assignments" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (
    student_id IS NOT NULL
    AND course_id IS NULL
    AND public.is_admin()
  );

-- Admin/Profesor puede crear asignaciones curriculares
DROP POLICY IF EXISTS "Admin create course assignments" ON public.assignments;
CREATE POLICY "Admin create course assignments" ON public.assignments
  FOR INSERT TO authenticated WITH CHECK (
    course_id IS NOT NULL
    AND student_id IS NULL
    AND public.is_admin()
  );

-- =============================================
-- 4. TRIGGER updated_at (reutiliza función existente de 008/011)
-- =============================================
DROP TRIGGER IF EXISTS trg_assignments_updated_at ON public.assignments;
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON public.assignments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 5. MIGRACIÓN DE DATOS: tasks (legacy) -> assignments
-- =============================================
-- Nota: tasks legacy no tiene created_by; usamos assigned_by como created_by
INSERT INTO public.assignments (
  id, title, description, student_id, assigned_by,
  due_date, position, status, progress, created_by,
  created_at, updated_at
)
SELECT
  id, title, description, student_id, assigned_by,
  due_date, 0, status, progress, assigned_by,
  created_at, updated_at
FROM public.tasks
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignments a WHERE a.id = tasks.id
);

-- =============================================
-- 6. MIGRACIÓN DE DATOS: course_tasks -> assignments
-- =============================================
INSERT INTO public.assignments (
  id, title, description, course_id, assigned_by,
  due_date, position, created_by, created_at, updated_at
)
SELECT
  id, title, description, course_id, created_by,
  due_date, position, created_by, created_at, created_at
FROM public.course_tasks
WHERE NOT EXISTS (
  SELECT 1 FROM public.assignments a WHERE a.id = course_tasks.id
);

-- =============================================
-- 7. ACTUALIZAR task_checklist_items para referenciar assignments
-- =============================================
-- task_checklist_items ya referencia course_tasks.id, que ahora son IDs válidos en assignments
-- No se necesita migración de IDs, solo actualizar la FK si se desea renombrar la columna.
-- Por compatibilidad, mantenemos task_id referenciando assignments.id.
-- La constraint existente en 008 ya apunta a course_tasks.id; al renombrar course_tasks se mantiene.

-- =============================================
-- 8. REEMPLAZAR TABLAS ANTIGUAS
-- =============================================
-- Primero, eliminar FKs en practice_sessions que referencian las tablas antiguas
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_task_id_fkey,
  DROP CONSTRAINT IF EXISTS practice_sessions_course_task_id_fkey;

-- Renombrar tablas legacy a _legacy
ALTER TABLE IF EXISTS public.tasks RENAME TO tasks_legacy;
ALTER TABLE IF EXISTS public.course_tasks RENAME TO course_tasks_legacy;

-- Renombrar assignments -> tasks (nombre final elegido)
ALTER TABLE IF EXISTS public.assignments RENAME TO tasks;

-- Recrear FKs en practice_sessions apuntando a la nueva tabla unificada tasks
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD CONSTRAINT practice_sessions_course_task_id_fkey
  FOREIGN KEY (course_task_id) REFERENCES public.tasks(id) ON DELETE SET NULL;

-- Actualizar FK en task_checklist_items para apuntar a tasks (ya lo hace por ID)
-- Las constraints existentes en course_tasks_legacy se mantienen pero ya no se usan.

-- =============================================
-- 9. RECREAR ÍNDICES Y RLS EN tasks (tabla final)
-- =============================================
-- Los índices y RLS ya se crearon sobre assignments; al renombrar se conservan.
-- Verificar y recrear si es necesario:

CREATE INDEX IF NOT EXISTS idx_tasks_course ON public.tasks (course_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_student ON public.tasks (student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks (assigned_by);

-- Verificar RLS (se conserva al renombrar)
-- Si alguna policy no se conservó, recrear:

DROP POLICY IF EXISTS "Admin all tasks" ON public.tasks;
CREATE POLICY "Admin all tasks" ON public.tasks
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read course tasks" ON public.tasks;
CREATE POLICY "Student read course tasks" ON public.tasks
  FOR SELECT TO authenticated USING (
    course_id IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = tasks.course_id
        AND e.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Student read own tasks" ON public.tasks;
CREATE POLICY "Student read own tasks" ON public.tasks
  FOR SELECT TO authenticated USING (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Student update own tasks" ON public.tasks;
CREATE POLICY "Student update own tasks" ON public.tasks
  FOR UPDATE TO authenticated USING (
    student_id = auth.uid()
  ) WITH CHECK (
    student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Admin create individual tasks" ON public.tasks;
CREATE POLICY "Admin create individual tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (
    student_id IS NOT NULL
    AND course_id IS NULL
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admin create course tasks" ON public.tasks;
CREATE POLICY "Admin create course tasks" ON public.tasks
  FOR INSERT TO authenticated WITH CHECK (
    course_id IS NOT NULL
    AND student_id IS NULL
    AND public.is_admin()
  );

-- Trigger updated_at
DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- 10. LIMPIEZA OPCIONAL (comentar si se quiere conservar legacy)
-- =============================================
-- DROP TABLE IF EXISTS public.tasks_legacy;
-- DROP TABLE IF EXISTS public.course_tasks_legacy;