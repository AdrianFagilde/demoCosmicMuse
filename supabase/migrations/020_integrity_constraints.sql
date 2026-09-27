-- =============================================
-- 020 RESTRICCIONES DE INTEGRIDAD QUE FALTABAN
--
-- No toca el modelo ni mueve datos: solo añade CHECK constraints donde el
-- esquema dejaba estados que no tienen sentido. Los triggers de 013/016 ya
-- gestionan la lógica de negocio (XP, rachas, badges); esto es la red de
-- seguridad en la base, para que un bug de cliente o un import directo no
-- puedan escribir basura.
--
-- Todas van como NOT VALID a propósito: PostgreSQL no las contrasta contra las
-- filas existentes, así que la migración no falla aunque haya datos legacy que
-- no las cumplan. Siguen aplicándose a toda INSERT/UPDATE nueva. Una vez
-- saneados los datos outliers, se validan con:
--
--   ALTER TABLE ... VALIDATE CONSTRAINT ...
--
-- Idempotente a propósito, como la 018 y la 019.
--
-- PENDIENTE DE APLICAR. Ver supabase/BASELINE.md.
-- =============================================

-- 1. form_answers es EAV: cinco columnas de valor, todas nullable, y nada que
--    las ate al `type` de la pregunta. Un CHECK no puede consultar
--    form_questions.type (los CHECK no admiten subqueries), pero sí puede
--    impedir el caso claramente roto: dos o más valores a la vez.
--
--    Lo que la app ya cumple por construcción (useSupabaseForms.js:209-214):
--      short_text, long_text      -> value_text
--      single_choice,             -> value_options
--      multiple_choice
--      scale                      -> value_number
--      file_upload                -> file_path
--    Se permite que las cuatro sean NULL: es una pregunta sin responder.
ALTER TABLE public.form_answers
  DROP CONSTRAINT IF EXISTS form_answers_one_value_per_answer;
ALTER TABLE public.form_answers
  ADD CONSTRAINT form_answers_one_value_per_answer
  CHECK (num_nonnulls(value_text, value_options, value_number, file_path) <= 1)
  NOT VALID;

-- 2. practice_sessions apunta a dos "tareas" distintas: `task_id` referencia
--    tasks (tarea individual, legacy) y `course_task_id` a course_tasks (tarea
--    curricular). Ambos nullable y sin CHECK, así que una sesión puede no
--    apuntar a ninguna, o a las dos, y en los dos casos es ambigua: ¿de qué
--    tarea era la práctica?
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_single_task_ref;
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_single_task_ref
  CHECK (num_nonnulls(task_id, course_task_id) <= 1)
  NOT VALID;

-- 3. El metrónomo marca `metronome_used` pero el BPM era texto libre. 016 acota
--    el XP a 120 minutos para frenar el farm, pero no acotaba el propio valor:
--    se podía guardar 99999 como bpm. El rango de un metrónomo real es
--    20-300.
ALTER TABLE public.practice_sessions
  DROP CONSTRAINT IF EXISTS practice_sessions_metronome_bpm_range;
ALTER TABLE public.practice_sessions
  ADD CONSTRAINT practice_sessions_metronome_bpm_range
  CHECK (
    metronome_bpm IS NULL
    OR (metronome_bpm BETWEEN 20 AND 300)
  )
  NOT VALID;