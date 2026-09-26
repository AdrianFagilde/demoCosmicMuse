-- =============================================
-- VERIFICACION 017_security_corrections.sql
-- Ejecutar en el SQL Editor de Supabase.
--
--   ANTES  -> guarda la salida en "antes.txt"
--   aplicar 017  (supabase db push)
--   DESPUES -> compara las secciones marcadas con [REPETIR]
-- =============================================

-- =============================================
-- [REPETIR] 1. Las 3 politicas del escape entre cursos
-- Expectativa: las 3 existen, son FOR SELECT, y el texto contiene la
-- columna externa cualificada (course_tasks.course_id, etc.).
-- Si aparece `e.course_id = course_id` sin cualificar, el bug sigue vivo.
-- =============================================
SELECT tablename, policyname, cmd, qual AS using_expr
FROM pg_policies
WHERE policyname IN (
  'Student read tasks of enrolled courses',
  'Student read forms of enrolled courses',
  'Student read materials of enrolled courses'
)
ORDER BY tablename;

-- =============================================
-- [REPETIR] 2. DELETE real de mensajes
-- Expectativa: exactamente UNA politica "User delete own messages" y es
-- FOR DELETE. Antes habia una FOR UPDATE duplicada.
-- =============================================
SELECT policyname, cmd, qual AS using_expr
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd, policyname;

-- =============================================
-- [REPETIR] 3. Trigger anti-reasignacion de participacion
-- Expectativa: 1 fila (trg_restrict_participation_reassignment).
-- =============================================
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.conversation_participants'::regclass
  AND NOT tgisinternal;

-- =============================================
-- 4. Prueba funcional del trigger (la importante)
-- Ejecutar MANUALMENTE con dos usuarios reales. Sustituye los UUID.
--
--   a) Crear un usuario A y un usuario B (Dashboard > Authentication).
--   b) Crear una conversacion con ambos como participantes (admin).
--   c) Con la sesion de A, UPDATE su fila de participacion cambiando
--      conversation_id por la de B. Debe fallar con 42501.
-- =============================================
-- Desde la sesion de A:
-- UPDATE public.conversation_participants
--    SET conversation_id = '<conversation_id_de_B>'
--  WHERE conversation_id = '<conversation_id_de_A>'
--    AND user_id = auth.uid();
-- Esperado: ERROR: No puedes mover tu participacion a otra conversacion

-- Con el mismo usuario A pero cambiando solo `muted`, debe funcionar:
-- UPDATE public.conversation_participants
--    SET muted = true
--  WHERE user_id = auth.uid();
-- Esperado: UPDATE 1

-- =============================================
-- [REPETIR] 5. Aislamiento real: lo que un estudiante puede leer
-- Ejecuta esto DESPUES de cambiar la sesion a un usuario alumno y compara
-- con el total global. Lo que el alumno devuelva debe ser solo lo suyo.
-- =============================================
-- El curso ajeno del alumno no debe aparecer en course_tasks.
-- SELECT count(*) FROM public.course_tasks;                 -- como admin
-- SELECT count(*) FROM public.course_tasks;                 -- como alumno: menor
-- SELECT count(*) FROM public.course_forms;                 -- idem
-- SELECT count(*) FROM public.course_materials;             -- idem

-- =============================================
-- [REPETIR] 6. Badges: el alumno NO debe tener first_course por tick suelta
-- Antes de la 017, marcar un solo item de checklist otorgaba `first_course`.
-- =============================================
-- Registro de prueba: elige un alumno y un curso con items de checklist.
-- Antes de tocar el checklist, anota su numero de insignias:
SELECT sb.student_id, count(*) AS badges
FROM public.student_badges sb
GROUP BY sb.student_id
ORDER BY badges DESC;

-- Marca UN item del checklist como ese alumno y vuelve a consultar:
-- si el alumno NO tiene el 100% del curso, `first_course` no debe aparecer.
SELECT badge_key, earned_at
FROM public.student_badges
WHERE student_id = '<alumno>'
ORDER BY earned_at DESC;

-- =============================================
-- [REPETIR] 7. Tarea sin asignar ya no rompe el UPDATE
-- Antes: marcar como Completado una tarea con student_id NULL abortaba
-- con 23502 not_null_violation por el INSERT del badge.
-- =============================================
-- UPDATE public.tasks
--    SET status = 'Completado'
--  WHERE student_id IS NULL
--  RETURNING id, title, status;
-- Esperado: UPDATE <n>, sin error.

-- =============================================
-- [REPETIR] 8. Nivel de gamificacion ya no se queda en 1
-- Antes: SQRT(integer/integer) trunca a 0 hasta 10000 XP.
-- Con 250 XP el nivel correcto es FLOOR(SQRT(250/100)) + 1 = 2.
-- =============================================
SELECT student_id, xp, level,
       (FLOOR(SQRT(xp::numeric / 100))::int + 1) AS nivel_calculado,
       (FLOOR(SQRT(xp::numeric / 100))::int + 1) - level AS desfase
FROM public.student_gamification
WHERE xp > 100
ORDER BY xp DESC
LIMIT 10;
-- Esperado: desfase = 0 para todos (el trigger ya recalcula al proximo evento)

-- =============================================
-- 9. Triggers de inmutabilidad (notificaciones y perfil)
-- Expectativa: 2 filas, trg_restrict_notification_update y
-- trg_restrict_student_profile_update, ambas BEFORE UPDATE.
-- La inmutabilidad NO esta en WITH CHECK porque una politica RLS no puede
-- comparar con la fila anterior; por eso son triggers.
-- =============================================
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid IN ('public.notifications'::regclass, 'public.profiles'::regclass)
  AND NOT tgisinternal
ORDER BY tgname;

-- =============================================
-- 10. Prueba funcional de los triggers (importante)
-- Ejecutar MANUALMENTE con dos sesiones reales. Sustituye los UUID.
--
--   a) Crear un alumno A y abrir sesion con su token.
--   b) Con la sesion de A, intentar reescribir el texto de una notificacion
--      recibida. Debe fallar con 42501.
--   c) Con la sesion de A, marcar esa misma notificacion como leida.
--      Debe funcionar (UPDATE <n>).
--   d) Con la sesion de A, cambiarse el email a uno arbitrario. 42501.
--   e) Con la sesion de A, editar phone / instrument / level / avatar.
--      Debe funcionar: son los unicos campos que ofrece MyProfile.jsx.
-- =============================================
-- Desde la sesion de A:
-- UPDATE public.notifications SET message = 'texto falso'
--  WHERE recipient_id = '<id_de_A>';
-- UPDATE public.notifications SET read = true
--  WHERE recipient_id = '<id_de_A>';
-- UPDATE public.profiles SET email = 'atacante@ejemplo.com'
--  WHERE id = '<id_de_A>';
-- UPDATE public.profiles SET phone = '600000000', instrument = 'Piano'
--  WHERE id = '<id_de_A>';

-- =============================================
-- 11. Que datos se perderian al aplicar 017 (cifras previous, no bloqueantes)
-- Conteo de filas de curso_task / course_form / course_material que SON
-- accesibles hoy para un alumno con una unica inscripcion.
-- Sirve para dimensionar el alcance del corte.
-- =============================================
SELECT
  (SELECT count(*) FROM public.course_tasks)    AS total_course_tasks,
  (SELECT count(*) FROM public.course_forms)    AS total_course_forms,
  (SELECT count(*) FROM public.course_materials) AS total_course_materials,
  (SELECT count(DISTINCT student_id) FROM public.course_enrollments)
    AS alumnos_con_al_menos_un_curso,
  (SELECT count(*) FROM public.profiles WHERE role = 'student') AS total_alumnos;

-- =============================================
-- 12. Rollback
-- Si 017 causa problemas, revertir es:
--
--   DROP TRIGGER IF EXISTS trg_restrict_participation_reassignment
--     ON public.conversation_participants;
--   DROP FUNCTION IF EXISTS public.restrict_participation_reassignment();
--
--   DROP TRIGGER IF EXISTS trg_restrict_notification_update
--     ON public.notifications;
--   DROP FUNCTION IF EXISTS public.restrict_notification_update();
--
--   DROP TRIGGER IF EXISTS trg_restrict_student_profile_update
--     ON public.profiles;
--   DROP FUNCTION IF EXISTS public.restrict_student_profile_update();
--
-- Las 3 politicas de lectura de la seccion 1 se restauran copiando el texto
-- original de 008/009. Las demas correcciones (badges, nivel) son silenciosas
-- y no afectan funcionalidad visible.
-- =============================================
