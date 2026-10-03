-- =============================================
-- 034 FIX get_weekly_practice_summary / get_next_badges (TYPE MISMATCH)
--
-- La migracion 016 paso estas funciones de LANGUAGE sql a LANGUAGE plpgsql para
-- anadirles la guarda de autorizacion. En plpgsql, RETURN QUERY exige que el
-- SELECT devuelva exactamente los mismos tipos que el RETURNS TABLE; en una
-- funcion LANGUAGE sql el resultado se coaccionaba al tipo declarado.
--
-- get_weekly_practice_summary:
--   generate_series(date, date, interval) no tiene overload propio: resuelve a
--   la variante timestamp with time zone (preferida en la resolucion de tipos).
--   Es decir, gs.day es timestamptz, no date. Al devolverlo en la columna
--   `day DATE` plpgsql lanzaba:
--     "structure of query does not match function result type" (SQLSTATE 42804)
--   y el RPC devolvia 400. Fix: gs.day::DATE.
--
-- get_next_badges:
--   La 029 ya la habia movido de public.course_tasks (borrada en 025) a
--   public.tasks con course_id IS NOT NULL. Esta migracion conserva esa
--   definicion (no reintroduce course_tasks) y anade el cast que falta:
--   COUNT(*) devuelve bigint y `progress` esta declarada INTEGER, asi que
--   RETURN QUERY tambien fallaba con 42804 al ejecutarla. Fix: ::INTEGER.
--
-- Ambas se recrean de forma idempotente (CREATE OR REPLACE) y se mantienen los
-- GRANT/REVOKE de 016 para no reabrir la fuga que cerro esa migracion.
-- =============================================

CREATE OR REPLACE FUNCTION public.get_weekly_practice_summary(p_student_id UUID)
RETURNS TABLE (
  day DATE,
  minutes INTEGER,
  sessions INTEGER
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
  SELECT
    gs.day::DATE,
    COALESCE(SUM(ps.duration_minutes), 0)::INTEGER AS minutes,
    COUNT(ps.id)::INTEGER AS sessions
  FROM generate_series(
    (CURRENT_DATE - INTERVAL '6 days')::DATE,
    CURRENT_DATE,
    INTERVAL '1 day'
  ) gs(day)
  LEFT JOIN public.practice_sessions ps
    ON ps.student_id = p_student_id
    AND ps.started_at::DATE = gs.day
    AND ps.ended_at IS NOT NULL
  GROUP BY gs.day
  ORDER BY gs.day;
END;
$$;

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
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado')::INTEGER, 1),
      ('tasks_10', '10 Tareas', 'Completa 10 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado')::INTEGER, 10),
      ('tasks_50', '50 Tareas', 'Completa 50 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado')::INTEGER, 50),
      ('tasks_100', '100 Tareas', 'Completa 100 tareas',
       (SELECT COUNT(*) FROM public.tasks WHERE student_id = p_student_id AND status = 'Completado')::INTEGER, 100),
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
        ) AS completed_courses)::INTEGER, 1),
      ('week_streak', 'Racha de 7 Días', 'Practica 7 días seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0)::INTEGER, 7),
      ('month_streak', 'Racha de 30 Días', 'Practica 30 días seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0)::INTEGER, 30)
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

REVOKE ALL ON FUNCTION public.get_weekly_practice_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_practice_summary(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_next_badges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_badges(UUID) TO authenticated;

-- PostgREST reconstruye su cache al arrancar, pero forzamos la recarga para que
-- el RPC quede disponible sin esperar al siguiente reinicio.
NOTIFY pgrst, 'reload schema';
