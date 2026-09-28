-- =============================================
-- 029 NOTIFICACIONES CON REFERENCIA + REPARAR CHECKLIST
--
-- Dos cosas, porque la segunda bloquea a la primera.
--
-- 1. REFERENCIA EN NOTIFICATIONS
--    Una notificacion no tenia forma de decir a que apunta. Al pulsar "Nueva
--    tarea asignada" solo se marcaba como leida, sin llevar a la tarea. Se
--    anaden dos columnas opcionales:
--
--      reference_type  TEXT   'task' por ahora
--      reference_id    UUID   id de la entidad referenciada
--
--    Las dos son NULL en las filas existentes y en las notificaciones
--    manuales de /send-notifications, que son broadcasts sin entidad que
--    abrir. El frontend trata NULL como "no navegar", asi que no hay que
--    reescribir historico.
--
--    reference_id NO lleva FK a proposito: la columna es un puntero generico
--    para varios tipos de entidad y una FK por tipo daria el mismo id en dos
--    columnas. Se forego integridad referencial a cambio de poder anadir
--    'course' o 'lesson' sin otra migracion. El borrado en cascada de la
--    entidad lo cubre el DELETE de la propia tarea.
--
-- 2. REPARAR check_course_completion_badges Y get_next_badges
--    BUG CRITICO, ya presente en produccion.
--
--    La 017 creo estas dos funciones con plpgsql sobre public.course_tasks.
--    La 021 renombro esa tabla a course_tasks_legacy (L183) y la 025 la borro
--    (L121). Ninguna migracion posterior a la 021 vuelve a definirlas.
--
--    plpgsql resuelve las referencias a tablas en la PRIMERA ejecucion, no al
--    crear la funcion, asi que la 017 se aplico sin error. El fallo aparece
--    cuando un alumno marca un item:
--
--      INSERT checklist_progress
--        -> AFTER INSERT trg_course_completion_badges (013:365)
--        -> check_course_completion_badges()
--        -> ERROR 42P01 relation "public.course_tasks" does not exist
--        -> la transaccion se revierte
--
--    La UI lo oculta: CourseDetailStudent.jsx:212-217 actualiza de forma
--    optimista y, al recibir false, revierte al valor anterior. El alumno ve
--    que la casilla sale y vuelve a entrar sola, sin mensaje de error.
--
--    Consecuencia: marcar el checklist NO FUNCIONABA, y get_next_badges
--    fallaba igual en la vista de progreso del alumno (17:508). El badge
--    'first_course' no se otorganca nunca porque la funcion que lo concede es
--    la que revierte el INSERT.
--
--    Fix: las dos funciones pasan a public.tasks y filtran course_id IS NOT
--    NULL. El filtro no es cosmetico: desde la 021 tasks mezcla tareas
--    individuales (course_id NULL) y curriculares, y sin el filtro el GROUP BY
--    de la linea 384 agruparia tambien las individuales en un grupo con
--    course_id NULL, contando como "curso completado" algo que no es un curso.
--
-- Idempotente: IF NOT EXISTS en las columnas, CREATE OR REPLACE en las
-- funciones, CREATE INDEX IF NOT EXISTS.
-- =============================================

-- 1. REFERENCIA
-- =============================================

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS reference_type TEXT,
  ADD COLUMN IF NOT EXISTS reference_id UUID;

COMMENT ON COLUMN public.notifications.reference_type IS
  'Tipo de entidad referenciada: task. NULL = la notificacion no navega.';
COMMENT ON COLUMN public.notifications.reference_id IS
  'Id de la entidad referenciada. Sin FK a proposito: columna generica.';

-- Para localizar "las notificaciones que apuntan a esta tarea".
CREATE INDEX IF NOT EXISTS idx_notifications_reference
  ON public.notifications (reference_type, reference_id)
  WHERE reference_id IS NOT NULL;


-- 2. REPARAR LAS FUNCIONES ROTOS
-- =============================================

-- 2.1 check_course_completion_badges
--
-- Reproceso de la 017:333-404 con public.tasks en lugar de
-- public.course_tasks, mas el filtro course_id IS NOT NULL en el conteo de
-- cursos completados.
--
-- Nota sobre el calculo de done_items: cuenta los items de ESTE curso
-- marcados por el alumno, y total_items los items de todos los items del
-- curso. Se mantiene la semántica original, que ya era correcta.
CREATE OR REPLACE FUNCTION public.check_course_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  total_items INTEGER;
  done_items  INTEGER;
  course_count INTEGER;
BEGIN
  -- Curso al que pertenece el item recien marcado
  SELECT t.course_id INTO v_course_id
  FROM public.task_checklist_items tci
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE tci.id = NEW.item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Total de items de checklist del curso
  SELECT COUNT(*) INTO total_items
  FROM public.task_checklist_items tci
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE t.course_id = v_course_id;

  -- Items ya marcados por este alumno en ese curso
  SELECT COUNT(*) INTO done_items
  FROM public.checklist_progress cp
  JOIN public.task_checklist_items tci ON tci.id = cp.item_id
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE cp.student_id = NEW.student_id
    AND t.course_id = v_course_id;

  -- Sin items, o sin el 100%: no hay curso completado
  IF total_items = 0 OR done_items < total_items THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_badges (student_id, badge_key)
  VALUES (NEW.student_id, 'first_course')
  ON CONFLICT DO NOTHING;

  -- Cursos con TODOS sus items marcados por este alumno.
  -- El filtro course_id IS NOT NULL es lo nuevo desde la 021: sin el, las
  -- tareas individuales (course_id NULL) forman su propio grupo y cuentan
  -- como curso completado.
  SELECT COUNT(*) INTO course_count
  FROM (
    SELECT t2.course_id
    FROM public.tasks t2
    JOIN public.task_checklist_items tci2 ON tci2.task_id = t2.id
    LEFT JOIN public.checklist_progress cp2
           ON cp2.item_id = tci2.id
          AND cp2.student_id = NEW.student_id
    WHERE t2.course_id IS NOT NULL
    GROUP BY t2.course_id
    HAVING COUNT(*) FILTER (WHERE cp2.item_id IS NOT NULL) = COUNT(*)
  ) AS completed_courses;

  IF course_count >= 5 THEN
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'courses_5') ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.student_gamification
  SET courses_completed = course_count, updated_at = now()
  WHERE student_id = NEW.student_id;

  RETURN NEW;
END;
$$;

-- 2.2 get_next_badges
--
-- Reproceso de la 017:476-539. Unico cambio: public.course_tasks ->
-- public.tasks, con course_id IS NOT NULL, por el mismo motivo que arriba.
-- Esta funcion es STABLE y se llama desde la UI de progreso del alumno
-- (Dashboard), asi que el 42P01 la rompia en cada render.
CREATE OR REPLACE FUNCTION public.get_next_badges(p_student_id UUID)
RETURNS TABLE (
  badge_key TEXT,
  badge_name TEXT,
  badge_description TEXT,
  progress INTEGER,
  target INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_student_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT * FROM (
    VALUES
      ('first_task', 'Primera Tarea', 'Completa tu primera tarea',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado'), 1),
      ('tasks_10', '10 Tareas', 'Completa 10 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado'), 10),
      ('tasks_50', '50 Tareas', 'Completa 50 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado'), 50),
      ('tasks_100', '100 Tareas', 'Completa 100 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado'), 100),
      ('first_course', 'Primer Curso', 'Completa tu primer curso',
       (SELECT COUNT(*) FROM (
          SELECT t3.course_id
          FROM public.tasks t3
          JOIN public.task_checklist_items tci3 ON tci3.task_id = t3.id
          LEFT JOIN public.checklist_progress cp3
                 ON cp3.item_id = tci3.id
                AND cp3.student_id = p_student_id
          WHERE t3.course_id IS NOT NULL
          GROUP BY t3.course_id
          HAVING COUNT(*) FILTER (WHERE cp3.item_id IS NOT NULL) = COUNT(*)
        ) AS completed_courses), 1),
      ('week_streak', 'Racha de 7 Dias', 'Practica 7 dias seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0), 7),
      ('month_streak', 'Racha de 30 Dias', 'Practica 30 dias seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0), 30)
  ) AS b(badge_key, badge_name, badge_description, progress, target)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.student_badges sb
    WHERE sb.student_id = p_student_id AND sb.badge_key = b.badge_key
  )
  ORDER BY
    CASE b.badge_key
      WHEN 'first_task' THEN 1
      WHEN 'week_streak' THEN 2
      WHEN 'tasks_10' THEN 3
      WHEN 'first_course' THEN 4
      WHEN 'month_streak' THEN 5
      WHEN 'tasks_50' THEN 6
      WHEN 'tasks_100' THEN 7
      WHEN 'century_streak' THEN 8
      ELSE 99
    END
  LIMIT 3;
END;
$$;


-- 3. COMPROBACION
-- =============================================
-- Tras aplicar, esto debe devolver 0 filas:
--
--   SELECT p.proname, format('public.%I', c.relname) AS tabla_inexistente
--   FROM pg_proc p
--   JOIN pg_depend d ON d.objid = p.oid AND d.deptype = 'n'
--   JOIN pg_class c ON c.oid = d.refobjid
--   WHERE p.pronamespace = 'public'::regnamespace
--     AND c.relname = 'course_tasks';
--
-- Y marcar un item de checklist debe devolver ok=true en la consola:
--
--   INSERT INTO public.checklist_progress (item_id, student_id)
--   VALUES ('<item>', auth.uid());
