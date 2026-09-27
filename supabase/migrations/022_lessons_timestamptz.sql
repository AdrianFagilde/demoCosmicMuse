-- =============================================
-- 022 LESSONS: lesson_date + lesson_time -> lesson_start timestamptz
-- duration TEXT -> duration INTEGER (minutos)
--
-- Asume que los datos actuales están en UTC.
-- Si están en hora local (ej. México UTC-6), cambia el AT TIME ZONE en el backfill.
--
-- Idempotente: usa IF NOT EXISTS / IF EXISTS.
-- PENDIENTE DE APLICAR. Ver supabase/BASELINE.md.
-- =============================================

-- 1. Agregar columna lesson_start
ALTER TABLE public.lessons ADD COLUMN IF NOT EXISTS lesson_start TIMESTAMPTZ;

-- 2. Backfill: combinar lesson_date + lesson_time asumiendo UTC
-- Solo si las columnas originales existen (migración no aplicada aún)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'lessons' AND column_name = 'lesson_date'
  ) THEN
    UPDATE public.lessons
    SET lesson_start = (lesson_date + lesson_time) AT TIME ZONE 'UTC'
    WHERE lesson_start IS NULL;
  END IF;
END $$;

-- 3. NOT NULL + índice
ALTER TABLE public.lessons ALTER COLUMN lesson_start SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_lessons_start ON public.lessons (lesson_start);

-- 3b. duration TEXT -> INTEGER (minutos)
-- Los valores pueden venir como "45 min", "60 min", etc. Extraer solo el número.
ALTER TABLE public.lessons ALTER COLUMN duration TYPE INTEGER USING regexp_replace(duration, '\D', '', 'g')::int;

-- 4. Dropear columnas antiguas
ALTER TABLE public.lessons DROP COLUMN IF EXISTS lesson_date;
ALTER TABLE public.lessons DROP COLUMN IF EXISTS lesson_time;

-- 5. Índice adicional para queries por estudiante + rango
CREATE INDEX IF NOT EXISTS idx_lessons_student_start ON public.lessons (student_id, lesson_start);

-- 6. Trigger updated_at (reutiliza set_updated_at de migración 011)
DROP TRIGGER IF EXISTS trg_lessons_updated_at ON public.lessons;
CREATE TRIGGER trg_lessons_updated_at
  BEFORE UPDATE ON public.lessons
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =============================================
-- NOTA SOBRE ZONA HORARIA
-- =============================================
-- Los timestamps se guardan en UTC (TIMESTAMPTZ).
-- Frontend: usa <input type="datetime-local"> -> convierte a UTC al enviar (toISOString).
-- Al mostrar: new Date(isoString).toLocaleString('es-ES', { timeZone: 'local' })
-- Si el backfill anterior usó 'UTC' pero los datos estaban en hora local,
-- ejecuta: UPDATE lessons SET lesson_start = lesson_start AT TIME ZONE 'UTC' AT TIME ZONE 'America/Mexico_City';