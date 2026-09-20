-- =============================================
-- 015: Student Practice Tracking (dashboard: meta diaria, racha, semana)
-- Basado en 013 pero SIN gamificación (XP, nivel, badges, cofre) que no
-- está contemplada en el plan de negocio.
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

-- 2. ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_practice_sessions_student ON public.practice_sessions (student_id, started_at DESC);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_task ON public.practice_sessions (task_id);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_course_task ON public.practice_sessions (course_task_id);

-- 3. ROW LEVEL SECURITY (patron is_admin de la migracion 007)
-- =============================================

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_streaks ENABLE ROW LEVEL SECURITY;

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

-- 4. TRIGGER Y FUNCIONES
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