-- =============================================
-- 035 GAMIFICACION v2
--
-- Tres cambios, todos sobre lo que ya existia (013/015/016/017/029):
--
-- 1. RACHA: el trigger update_practice_streak era AFTER INSERT sobre
--    practice_sessions. La sesion se INSERTA al pulsar "Practicar" (solo
--    started_at, ended_at NULL), asi que la racha avanzaba por ABRIR el
--    temporizador, sin practicar. Ahora el trigger es AFTER UPDATE y solo
--    dispara en la transicion ended_at NULL -> NOT NULL con duracion > 0,
--    es decir al CERRAR una sesion real.
--
-- 2. META DIARIA configurable por alumno:
--    student_gamification.daily_goal_minutes (default 30). El panel de admin
--    la cambia con la RPC set_daily_goal() (comprueba is_admin).
--
-- 3. XP POR TAREAS. Antes solo la practica daba XP. Se anade:
--      - tarea individual completada ............ +50 XP
--      - item de checklist de curso marcado ..... +10 XP
--      - curso completado al 100% ............... +100 XP
--    Para que desmarcar y volver a marcar no farmee XP, todo pasa por
--    public.award_xp() y una tabla ledgers xp_events con
--    UNIQUE (student_id, source_type, source_id): un mismo origen solo
--    otorga XP una vez. award_xp NO tiene EXECUTE para authenticated (solo
--    la llaman triggers SECURITY DEFINER), asi que no se puede invocar por
--    RPC para inflar el XP propio.
--
-- Idempotente: IF NOT EXISTS / CREATE OR REPLACE / DROP TRIGGER IF EXISTS.
-- =============================================

-- 1. META DIARIA
-- =============================================

ALTER TABLE public.student_gamification
  ADD COLUMN IF NOT EXISTS daily_goal_minutes INTEGER NOT NULL DEFAULT 30;

ALTER TABLE public.student_gamification
  DROP CONSTRAINT IF EXISTS student_gamification_daily_goal_check;
ALTER TABLE public.student_gamification
  ADD CONSTRAINT student_gamification_daily_goal_check
  CHECK (daily_goal_minutes BETWEEN 5 AND 240);

-- =============================================
-- 2. RACHA: solo al cerrar la sesion
-- =============================================

DROP TRIGGER IF EXISTS trg_update_practice_streak ON public.practice_sessions;
CREATE TRIGGER trg_update_practice_streak
  AFTER UPDATE ON public.practice_sessions
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL AND NEW.duration_minutes > 0)
  EXECUTE FUNCTION public.update_practice_streak();

-- =============================================
-- 3. LEDGER DE XP
-- =============================================

CREATE TABLE IF NOT EXISTS public.xp_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  source_type TEXT NOT NULL CHECK (source_type IN ('task', 'checklist_item', 'course')),
  source_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, source_type, source_id)
);

CREATE INDEX IF NOT EXISTS idx_xp_events_student
  ON public.xp_events (student_id, created_at DESC);

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read all xp_events" ON public.xp_events;
CREATE POLICY "Admin read all xp_events" ON public.xp_events
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student read own xp_events" ON public.xp_events;
CREATE POLICY "Student read own xp_events" ON public.xp_events
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- Otorga XP una sola vez por origen. No se concede EXECUTE a authenticated:
-- la llaman unicamente los triggers SECURITY DEFINER de abajo.
CREATE OR REPLACE FUNCTION public.award_xp(
  p_student_id UUID,
  p_amount INTEGER,
  p_source_type TEXT,
  p_source_id UUID
) RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inserted INTEGER := 0;
BEGIN
  IF p_student_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN
    RETURN 0;
  END IF;

  INSERT INTO public.xp_events (student_id, amount, source_type, source_id)
  VALUES (p_student_id, p_amount, p_source_type, p_source_id)
  ON CONFLICT (student_id, source_type, source_id) DO NOTHING;

  GET DIAGNOSTICS v_inserted = ROW_COUNT;
  IF v_inserted = 0 THEN
    RETURN 0; -- este origen ya otorgo XP
  END IF;

  INSERT INTO public.student_gamification (student_id, xp, level)
  VALUES (p_student_id, 0, 1)
  ON CONFLICT (student_id) DO NOTHING;

  UPDATE public.student_gamification
  SET xp = xp + p_amount,
      level = FLOOR(SQRT((xp + p_amount) / 100.0))::INTEGER + 1,
      updated_at = now()
  WHERE student_id = p_student_id;

  RETURN p_amount;
END;
$$;

REVOKE ALL ON FUNCTION public.award_xp(UUID, INTEGER, TEXT, UUID)
  FROM PUBLIC, authenticated, anon;

-- =============================================
-- 4. XP AL COMPLETAR TAREAS
-- =============================================

-- 4.1 Tarea individual: transicion a Completado. Reproceso de 017:274 mas
-- el award_xp (idempotente por id de tarea).
CREATE OR REPLACE FUNCTION public.check_task_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_count INTEGER;
BEGIN
  IF NEW.status = 'Completado'
     AND OLD.status IS DISTINCT FROM 'Completado'
     AND NEW.student_id IS NOT NULL THEN

    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'first_task')
    ON CONFLICT DO NOTHING;

    PERFORM public.award_xp(NEW.student_id, 50, 'task', NEW.id);

    SELECT COUNT(*) INTO task_count
    FROM public.tasks
    WHERE student_id = NEW.student_id AND status = 'Completado';

    IF task_count >= 10 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_10') ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 50 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_50') ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 100 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_100') ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.student_gamification
    SET tasks_completed = task_count, updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4.2 Checklist de curso: reproceso de 029:91 (public.tasks, course_id IS NOT
-- NULL) mas el XP por item y por curso completado.
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
  SELECT t.course_id INTO v_course_id
  FROM public.task_checklist_items tci
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE tci.id = NEW.item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- XP por item marcado (idempotente: el item solo otorga una vez).
  PERFORM public.award_xp(NEW.student_id, 10, 'checklist_item', NEW.item_id);

  SELECT COUNT(*) INTO total_items
  FROM public.task_checklist_items tci
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE t.course_id = v_course_id;

  SELECT COUNT(*) INTO done_items
  FROM public.checklist_progress cp
  JOIN public.task_checklist_items tci ON tci.id = cp.item_id
  JOIN public.tasks t ON t.id = tci.task_id
  WHERE cp.student_id = NEW.student_id
    AND t.course_id = v_course_id;

  IF total_items = 0 OR done_items < total_items THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_badges (student_id, badge_key)
  VALUES (NEW.student_id, 'first_course')
  ON CONFLICT DO NOTHING;

  PERFORM public.award_xp(NEW.student_id, 100, 'course', v_course_id);

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

-- =============================================
-- 5. META DIARIA: RPC de admin
-- =============================================

CREATE OR REPLACE FUNCTION public.set_daily_goal(p_student_id UUID, p_minutes INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF p_minutes < 5 OR p_minutes > 240 THEN
    RAISE EXCEPTION 'La meta diaria debe estar entre 5 y 240 minutos'
      USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.student_gamification (student_id, daily_goal_minutes)
  VALUES (p_student_id, p_minutes)
  ON CONFLICT (student_id)
  DO UPDATE SET daily_goal_minutes = EXCLUDED.daily_goal_minutes, updated_at = now();

  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.set_daily_goal(UUID, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_daily_goal(UUID, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
