-- =============================================
-- 010: Cuestionarios anidados por tarea
-- Requiere 008_courses.sql y 009_course_forms_content.sql
-- Idempotente: seguro de ejecutar varias veces
-- =============================================

-- 1. COLUMNA task_id EN course_forms
-- =============================================
-- Nullable: los cuestionarios generales del curso quedan con task_id NULL.
-- Al eliminar una tarea se elimina en cascada su cuestionario (y con el,
-- sus envios y respuestas por las FKs ON DELETE CASCADE de la 009).

ALTER TABLE public.course_forms
  ADD COLUMN IF NOT EXISTS task_id UUID REFERENCES public.course_tasks(id) ON DELETE CASCADE;

-- 2. INDICE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_course_forms_task ON public.course_forms(task_id);
