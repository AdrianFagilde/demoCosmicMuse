-- =============================================
-- 013: Student Practice Tracking & Gamification
-- Requiere 007_security_hardening.sql (funcion public.is_admin)
-- Idempotente: seguro de ejecutar varias veces
-- =============================================

-- 1. TABLAS
-- =============================================

-- Practice sessions: registro de sesiones de práctica por estudiante
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.tasks(id) ON DELETE SET NULL,
  course_task_id UUID REFERENCES public.course_tasks(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER GENERATED ALWAYS AS (
    CASE 
      WHEN ended_at IS NOT NULL THEN EXTRACT(EPOCH FROM (ended_at - started_at)) / 60
      ELSE NULL
    END
  ) STORED,
  notes TEXT DEFAULT '',
  metronome_used BOOLEAN DEFAULT false,
  metronome_bpm INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Practice streak: racha de días consecutivos de práctica
CREATE TABLE IF NOT EXISTS public.practice_streaks (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  last_practice_date DATE,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Gamificación: XP, nivel, badges
CREATE TABLE IF NOT EXISTS public.student_gamification (
  student_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  xp INTEGER DEFAULT 0,
  level INTEGER DEFAULT 1,
  total_practice_minutes INTEGER DEFAULT 0,
  tasks_completed INTEGER DEFAULT 0,
  courses_completed INTEGER DEFAULT 0,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Badges obtenidos por estudiante
CREATE TABLE IF NOT EXISTS public.student_badges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  badge_key TEXT NOT NULL, -- ej: 'first_task', 'week_streak', 'course_complete'
  earned_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, badge_key)
);

-- Notificaciones push subscriptions
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (student_id, endpoint)
);

-- 2. ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON public.practice_sessions (student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_task ON public.practice_sessions (task_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_course_task ON public.practice_sessions (course_task_id);
CREATE INDEX IF NOT EXISTS idx_student_badges_student ON public.student_badges (student_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_student ON public.push_subscriptions (student_id);

-- 3. ROW LEVEL SECURITY (patron is_admin de la migracion 007)
-- =============================================

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_gamification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- practice_sessions: admin total; estudiante gestiona solo las suyas
DROP POLICY IF EXISTS "Admin all practice_sessions" ON public.practice_sessions;
CREATE POLICY "Admin all practice_sessions" ON public.practice_sessions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student manage own practice_sessions" ON public.practice_sessions;
CREATE POLICY "Student manage own practice_sessions" ON public.practice_sessions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- practice_streaks: admin lee todo; estudiante lee/actualiza el suyo
DROP POLICY IF EXISTS "Admin read all streaks" ON public.practice_streaks;
CREATE POLICY "Admin read all streaks" ON public.practice_streaks
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student read own streak" ON public.practice_streaks;
CREATE POLICY "Student read own streak" ON public.practice_streaks
  FOR SELECT TO authenticated USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Student update own streak" ON public.practice_streaks;
CREATE POLICY "Student update own streak" ON public.practice_streaks
  FOR UPDATE TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- student_gamification: admin lee todo; estudiante lee el suyo
DROP POLICY IF EXISTS "Admin read all gamification" ON public.student_gamification;
CREATE POLICY "Admin read all gamification" ON public.student_gamification
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student read own gamification" ON public.student_gamification;
CREATE POLICY "Student read own gamification" ON public.student_gamification
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- student_badges: admin lee todo; estudiante lee los suyos
DROP POLICY IF EXISTS "Admin read all badges" ON public.student_badges;
CREATE POLICY "Admin read all badges" ON public.student_badges
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student read own badges" ON public.student_badges;
CREATE POLICY "Student read own badges" ON public.student_badges
  FOR SELECT TO authenticated USING (student_id = auth.uid());

-- push_subscriptions: admin gestiona todo; estudiante gestiona las suyas
DROP POLICY IF EXISTS "Admin all push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admin all push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student manage own push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Student manage own push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- 4. TRIGGERS Y FUNCIONES
-- =============================================

-- Función para actualizar streak automáticamente al insertar práctica
CREATE OR REPLACE FUNCTION public.update_practice_streak()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  practice_date DATE := NEW.started_at::DATE;
  prev_streak RECORD;
BEGIN
  -- Obtener streak actual
  SELECT * INTO prev_streak FROM public.practice_streaks WHERE student_id = NEW.student_id;
  
  IF prev_streak IS NULL THEN
    -- Primera práctica
    INSERT INTO public.practice_streaks (student_id, current_streak, longest_streak, last_practice_date)
    VALUES (NEW.student_id, 1, 1, practice_date);
  ELSE
    IF prev_streak.last_practice_date = practice_date THEN
      -- Mismo día, no cambia streak
      RETURN NEW;
    ELSIF prev_streak.last_practice_date = practice_date - INTERVAL '1 day' THEN
      -- Día consecutivo
      UPDATE public.practice_streaks
      SET current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1),
          last_practice_date = practice_date,
          updated_at = now()
      WHERE student_id = NEW.student_id;
    ELSE
      -- Se rompió la racha
      UPDATE public.practice_streaks
      SET current_streak = 1,
          last_practice_date = practice_date,
          updated_at = now()
      WHERE student_id = NEW.student_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_practice_streak ON public.practice_sessions;
CREATE TRIGGER trg_update_practice_streak
  AFTER INSERT ON public.practice_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_practice_streak();

-- Función para actualizar gamificación (XP, nivel)
CREATE OR REPLACE FUNCTION public.update_student_gamification()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gamif RECORD;
  new_level INTEGER;
  xp_gained INTEGER := 0;
BEGIN
  -- Obtener gamificación actual
  SELECT * INTO gamif FROM public.student_gamification WHERE student_id = NEW.student_id;
  
  IF gamif IS NULL THEN
    INSERT INTO public.student_gamification (student_id, xp, level, total_practice_minutes)
    VALUES (NEW.student_id, 0, 1, 0);
    gamif := ROW(NEW.student_id, 0, 1, 0, 0, 0, now())::public.student_gamification;
  END IF;
  
  -- Calcular XP ganado
  IF NEW.ended_at IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
    xp_gained := NEW.duration_minutes * 2; -- 2 XP por minuto
    
    -- Bonus por usar metrónomo
    IF NEW.metronome_used THEN
      xp_gained := xp_gained + 10;
    END IF;
    
    UPDATE public.student_gamification
    SET xp = xp + xp_gained,
        total_practice_minutes = total_practice_minutes + NEW.duration_minutes,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;
  
  -- Recalcular nivel (fórmula: level = floor(sqrt(xp / 100)) + 1)
  new_level := FLOOR(SQRT((gamif.xp + xp_gained) / 100)) + 1;
  
  IF new_level > gamif.level THEN
    UPDATE public.student_gamification
    SET level = new_level
    WHERE student_id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_gamification ON public.practice_sessions;
DROP TRIGGER IF EXISTS trg_update_gamification_ended ON public.practice_sessions;
CREATE TRIGGER trg_update_gamification
  AFTER INSERT ON public.practice_sessions
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL)
  EXECUTE FUNCTION public.update_student_gamification();
CREATE TRIGGER trg_update_gamification_ended
  AFTER UPDATE ON public.practice_sessions
  FOR EACH ROW
  WHEN (NEW.ended_at IS NOT NULL AND OLD.ended_at IS NULL)
  EXECUTE FUNCTION public.update_student_gamification();

-- Trigger para badges al completar tareas
CREATE OR REPLACE FUNCTION public.check_task_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_count INTEGER;
  course_count INTEGER;
  streak_rec RECORD;
BEGIN
  -- Solo actuar cuando la tarea se marca como completada
  IF NEW.status = 'Completado' AND OLD.status != 'Completado' THEN
    -- Badge: Primera tarea completada
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'first_task')
    ON CONFLICT DO NOTHING;
    
    -- Contar tareas completadas
    SELECT COUNT(*) INTO task_count
    FROM public.tasks
    WHERE student_id = NEW.student_id AND status = 'Completado';
    
    -- Badges por hitos de tareas
    IF task_count >= 10 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_10')
      ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 50 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_50')
      ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 100 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_100')
      ON CONFLICT DO NOTHING;
    END IF;
    
    -- Actualizar contador en gamificación
    UPDATE public.student_gamification
    SET tasks_completed = task_count,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_task_completion_badges ON public.tasks;
CREATE TRIGGER trg_task_completion_badges
  AFTER UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.check_task_completion_badges();

-- Trigger para badges al completar cursos
CREATE OR REPLACE FUNCTION public.check_course_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  progress RECORD;
  course_count INTEGER;
BEGIN
  -- Solo actuar cuando el progreso llega a 100%
  IF NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL THEN
    -- Verificar si el estudiante completó todos los items del curso
    -- (esto se verifica en la aplicación, aquí solo otorgamos badge)
    
    -- Badge: Primer curso completado
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'first_course')
    ON CONFLICT DO NOTHING;
    
    -- Contar cursos completados (aprox: cursos donde tiene 100% progreso)
    -- Nota: esto es simplificado, en la app se verifica mejor
    SELECT COUNT(DISTINCT e.course_id) INTO course_count
    FROM public.course_enrollments e
    JOIN public.checklist_progress cp ON cp.student_id = e.student_id
    JOIN public.task_checklist_items tci ON tci.id = cp.item_id
    JOIN public.course_tasks ct ON ct.id = tci.task_id
    WHERE e.student_id = NEW.student_id
    GROUP BY e.course_id
    HAVING COUNT(tci.id) = COUNT(cp.item_id);
    
    IF course_count >= 5 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'courses_5')
      ON CONFLICT DO NOTHING;
    END IF;
    
    UPDATE public.student_gamification
    SET courses_completed = course_count,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_course_completion_badges ON public.checklist_progress;
CREATE TRIGGER trg_course_completion_badges
  AFTER INSERT ON public.checklist_progress
  FOR EACH ROW EXECUTE FUNCTION public.check_course_completion_badges();

-- Trigger para badges de racha
CREATE OR REPLACE FUNCTION public.check_streak_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.current_streak >= 7 AND OLD.current_streak < 7 THEN
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'week_streak')
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF NEW.current_streak >= 30 AND OLD.current_streak < 30 THEN
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'month_streak')
    ON CONFLICT DO NOTHING;
  END IF;
  
  IF NEW.current_streak >= 100 AND OLD.current_streak < 100 THEN
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'century_streak')
    ON CONFLICT DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_streak_badges ON public.practice_streaks;
CREATE TRIGGER trg_streak_badges
  AFTER UPDATE ON public.practice_streaks
  FOR EACH ROW EXECUTE FUNCTION public.check_streak_badges();

-- 5. FUNCIONES AUXILIARES
-- =============================================

-- Obtener resumen de práctica de la semana
CREATE OR REPLACE FUNCTION public.get_weekly_practice_summary(p_student_id UUID)
RETURNS TABLE (
  day DATE,
  minutes INTEGER,
  sessions INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gs.day,
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
$$;

-- Obtener próximo badge por desbloquear
CREATE OR REPLACE FUNCTION public.get_next_badges(p_student_id UUID)
RETURNS TABLE (
  badge_key TEXT,
  badge_name TEXT,
  badge_description TEXT,
  progress INTEGER,
  target INTEGER
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
       (SELECT COUNT(DISTINCT e.course_id) FROM public.course_enrollments e
        JOIN public.checklist_progress cp ON cp.student_id = e.student_id
        JOIN public.task_checklist_items tci ON tci.id = cp.item_id
        JOIN public.course_tasks ct ON ct.id = tci.task_id
        WHERE e.student_id = p_student_id
        GROUP BY e.course_id
        HAVING COUNT(tci.id) = COUNT(cp.item_id)), 1),
      ('week_streak', 'Racha de 7 Días', 'Practica 7 días seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0), 7),
      ('month_streak', 'Racha de 30 Días', 'Practica 30 días seguidos',
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
$$;