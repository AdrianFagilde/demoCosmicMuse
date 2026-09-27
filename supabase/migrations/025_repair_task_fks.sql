-- =============================================
-- 025 REPARA LAS FK DE TASKS Y LOS EMBEDS DE POSTGREST
--
-- Corrige el estado que dejó la migración 021 al renombrar `course_tasks`
-- a `course_tasks_legacy` y crear la tabla `tasks`:
--
--   1. Las FK `task_id` de `task_checklist_items`, `course_forms` y
--      `course_materials` seguían apuntando a `course_tasks_legacy`.
--      PostgREST resuelve los embeds usando el grafo de FK, por lo que
--      `courses.select('*, tasks!course_id(id, task_checklist_items(id))')`
--      devolvía HTTP 400 PGRST200 y `fetchCourses` fallaba entero.
--
--   2. La tabla se renombró pero las constraints NO: se llamaban
--      `assignments_*_fkey`. El código usa los nombres `tasks_*_fkey`,
--      así que `tasks.select('*, profiles!tasks_student_id_fkey(...)')`
--      también devolvía PGRST200 y `fetchTasks` devolvía siempre [].
--
--   3. `DROP TABLE course_tasks_legacy` una vez repuntadas las FK.
--
--   4. La política de `form_submissions` creada en 024 pasaba `form_id`
--      a `is_enrolled_in()`, que espera un course_id. Como el UUID de un
--      formulario nunca coincide con el de un curso, la condición era
--      siempre false y el estudiante no podía leer ni insertar entregas.
--
-- No se pierde información: los ids de `course_tasks_legacy` y de `tasks`
-- coinciden uno a uno, y la verificación de huérfanos de abajo aborta la
-- migración si en algún momento dejaran de coincidir.
--
-- Idempotent: DROP CONSTRAINT IF EXISTS / DROP POLICY IF EXISTS /
-- DROP TABLE IF EXISTS y bloques DO con guardas sobre pg_constraint.
-- =============================================

-- =============================================
-- 1. PRECONDICIONES: abortar si quedaran referencias colgando
-- =============================================
DO $$
DECLARE
  v_orphans INTEGER;
BEGIN
  SELECT
    (SELECT count(*) FROM public.task_checklist_items x
      WHERE NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = x.task_id))
  + (SELECT count(*) FROM public.course_forms x
      WHERE x.task_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = x.task_id))
  + (SELECT count(*) FROM public.course_materials x
      WHERE x.task_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM public.tasks t WHERE t.id = x.task_id))
  INTO v_orphans;

  IF v_orphans > 0 THEN
    RAISE EXCEPTION
      'Migracion 025 cancelada: % filas huerfanas impedian repuntar las FK a tasks.',
      v_orphans;
  END IF;
END $$;

-- =============================================
-- 2. REAPUNTAR LAS FK task_id A public.tasks
--    Se recrean con ON DELETE CASCADE / ON UPDATE NO ACTION, igual que
--    las que reemplazan.
-- =============================================
ALTER TABLE public.task_checklist_items
  DROP CONSTRAINT IF EXISTS task_checklist_items_task_id_fkey;
ALTER TABLE public.task_checklist_items
  ADD CONSTRAINT task_checklist_items_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.course_forms
  DROP CONSTRAINT IF EXISTS course_forms_task_id_fkey;
ALTER TABLE public.course_forms
  ADD CONSTRAINT course_forms_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

ALTER TABLE public.course_materials
  DROP CONSTRAINT IF EXISTS course_materials_task_id_fkey;
ALTER TABLE public.course_materials
  ADD CONSTRAINT course_materials_task_id_fkey
  FOREIGN KEY (task_id) REFERENCES public.tasks(id)
  ON DELETE CASCADE ON UPDATE NO ACTION;

-- =============================================
-- 3. RENOMBRAR LAS CONSTRAINTS DE tasks
--    ALTER TABLE ... RENAME no renombra constraints, por eso quedaron
--    como assignments_*_fkey. Se renombran para que coincidan con el
--    nombre de la tabla y con los hints de FK que usa la app.
-- =============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('assignments_course_id_fkey',   'tasks_course_id_fkey'),
      ('assignments_student_id_fkey',  'tasks_student_id_fkey'),
      ('assignments_assigned_by_fkey', 'tasks_assigned_by_fkey'),
      ('assignments_created_by_fkey',  'tasks_created_by_fkey')
    ) AS v(old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = r.old_name
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = r.new_name
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.tasks RENAME CONSTRAINT %I TO %I',
        r.old_name, r.new_name
      );
      RAISE NOTICE '025: constraint renombrada % -> %', r.old_name, r.new_name;
    END IF;
  END LOOP;
END $$;

-- =============================================
-- 4. ELIMINAR LA TABLA LEGACY
--    Ya no tiene referencias: las tres FK de arriba son las unicas
--    dependencias y ya apuntan a tasks.
-- =============================================
DROP TABLE IF EXISTS public.course_tasks_legacy;

-- =============================================
-- 5. CORREGIR LA POLITICA DE form_submissions
--    is_enrolled_in() espera un course_id; hay que resolver el curso a
--    traves de course_forms.
-- =============================================
DROP POLICY IF EXISTS "Student manage own submissions" ON public.form_submissions;
CREATE POLICY "Student manage own submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_forms f
      WHERE f.id = form_submissions.form_id
        AND public.is_enrolled_in(f.course_id)
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_forms f
      WHERE f.id = form_submissions.form_id
        AND public.is_enrolled_in(f.course_id)
    )
  );
