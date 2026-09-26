-- =============================================
-- VERIFICACION 017_security_corrections.sql
-- =============================================
-- ESTE FICHERO TIENE DOS BLOQUES. NO LOS PEGUES JUNTOS.
--
-- BLOQUE A  -> solo lectura. Se ejecuta entero en el SQL Editor.
--              No contiene ni una escritura.
--
-- BLOQUE B  -> pruebas funcionales, con escritura.
--              NO SE PEGAN EN EL SQL EDITOR.
--              Van dentro de BEGIN/ROLLBACK, asi que no cambian nada,
--              pero solo funcionan si se ejecutan en el cliente psql
--              de una sesion real, no en el dashboard.
--
-- POR QUE NO EN EL SQL EDITOR (importante):
-- los triggers de la 017 empiezan asi
--     jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');
--     IF jwt_claims IS NULL THEN RETURN NEW; END IF;
-- En el SQL Editor no hay JWT, asi que devuelven NEW y el UPDATE malicioso
-- SE APLICA DE VERDAD. Ademas `postgres` es dueno de las tablas, asi que
-- las RLS tampoco frenan nada. Un
--     UPDATE public.profiles SET email = 'atacante@ejemplo.com'
-- desde el dashboard cambia el email real de un alumno, y como
-- send_due_payment_reminders notifica a profiles.email, sus avisos de
-- pago se irian a otra direccion: justo lo que la 017 viene a cerrar.
-- =============================================


-- ###########################################################################
-- BLOQUE A - SOLO LECTURA. Pegar y ejecutar en el SQL Editor.
-- ###########################################################################

-- =============================================
-- 0. SMOKE TEST. Ejecuta esto primero: son cinco OK en un segundo.
-- =============================================
-- Una sola consulta, solo lectura. Es la guarda que habria detectado el
-- 42P13 antes de que la 017 llegara a produccion: el fallo fue declarar
-- get_next_badges con un tipo de retorno distinto al que ya tenia, y
-- PostgreSQL aborta el CREATE OR REPLACE sin avisar antes. El resto de
-- secciones miran el detalle; esta mira lo unico que importa, que es si
-- la migracion esta entera y no a medias.
--
--   1. la 017 quedo registrada en el historial (se aplico a mano desde el
--      SQL Editor, asi que hubo que registrarla con migration repair)
--   2. get_next_badges conserva su contrato TABLE
--   3. las 3 politicas de lectura de cursos existen y son FOR SELECT
--   4. hay una unica politica DELETE en messages, no dos UPDATE
--   5. los 3 triggers nuevos de la 017 existen
--
-- Cinco OK y la 017 esta bien. Un FALLO en la 2 significa que hay una
-- version anterior a medias en la base.
-- =============================================
WITH r AS (
  SELECT '1. 017 en el historial' AS c,
         CASE WHEN EXISTS (SELECT 1 FROM supabase_migrations.schema_migrations
                            WHERE version = '17')
              THEN 'OK' ELSE 'FALLO' END AS v
  UNION ALL
  SELECT '2. get_next_badges devuelve TABLE',
         CASE WHEN pg_get_function_result(
                         to_regprocedure('public.get_next_badges(uuid)')) LIKE 'TABLE%'
              THEN 'OK' ELSE 'FALLO' END
  UNION ALL
  SELECT '3. las 3 politicas de lectura de cursos',
         CASE WHEN (SELECT count(*) FROM pg_policies
                     WHERE cmd = 'SELECT' AND policyname IN (
                       'Student read tasks of enrolled courses',
                       'Student read forms of enrolled courses',
                       'Student read materials of enrolled courses')) = 3
              THEN 'OK' ELSE 'FALLO' END
  UNION ALL
  SELECT '4. una sola politica DELETE en messages',
         CASE WHEN (SELECT count(*) FROM pg_policies
                     WHERE tablename = 'messages' AND cmd = 'DELETE') = 1
              THEN 'OK' ELSE 'FALLO' END
  UNION ALL
  SELECT '5. los 3 triggers nuevos de la 017',
         CASE WHEN (SELECT count(*) FROM pg_trigger
                     WHERE NOT tgisinternal AND tgname IN (
                       'trg_restrict_participation_reassignment',
                       'trg_restrict_notification_update',
                       'trg_restrict_student_profile_update')) = 3
              THEN 'OK' ELSE 'FALLO' END
)
SELECT c AS comprobacion, v AS resultado FROM r;

-- =============================================
-- 1. Contrato de get_next_badges, en detalle
-- El smoke test (0) solo mira que devuelva TABLE. Esto imprime la
-- firma completa, para confirmar columna por columna. Debe coincidir con
-- la que creo la 016, o un CREATE OR REPLACE futuro fallara con 42P13.
-- =============================================
SELECT pg_get_function_result(
         'public.get_next_badges(uuid)'::regprocedure) AS retorna;
-- Esperado EXACTO:
--   TABLE(badge_key text, badge_name text, badge_description text,
--         progress integer, target integer)
-- Si sale jsonb, hay una version anterior a medias en la base.

-- =============================================
-- 2. Las 3 politicas del escape entre cursos
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
-- 3. DELETE real de mensajes
-- Expectativa: exactamente UNA politica "User delete own messages" y es
-- FOR DELETE. Antes habia una FOR UPDATE duplicada.
-- =============================================
SELECT policyname, cmd, qual AS using_expr
FROM pg_policies
WHERE tablename = 'messages'
ORDER BY cmd, policyname;

-- =============================================
-- 4. Trigger anti-reasignacion de participacion
-- Expectativa: 1 fila (trg_restrict_participation_reassignment), BEFORE.
-- =============================================
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid = 'public.conversation_participants'::regclass
  AND NOT tgisinternal;

-- =============================================
-- 5. Aislamiento real: lo que un estudiante puede leer
-- El SQL Editor corre como postgres y saltandose las RLS, asi que aqui NO
-- se puede medir el aislamiento. Hazlo desde la app con un alumno
-- autenticado, o con la sesion de BLOQUE B, y compara:
--   SELECT count(*) FROM public.course_tasks;     -- global, como postgres
--   SELECT count(*) FROM public.course_tasks;     -- como alumno: menor
--   SELECT count(*) FROM public.course_forms;     -- idem
--   SELECT count(*) FROM public.course_materials; -- idem
-- Referencia: seccion 8 te da las cifras globales.
-- =============================================

-- =============================================
-- 6. Badges: el alumno NO debe tener first_course por tick suelta
-- Antes de la 017, marcar un solo item de checklist otorgaba `first_course`.
-- Anota el estado antes de marcar nada:
-- =============================================
SELECT sb.student_id, count(*) AS insignias
FROM public.student_badges sb
GROUP BY sb.student_id
ORDER BY insignias DESC;

-- Marca UN item del checklist como ese alumno y vuelve a consultar: si el
-- alumno no tiene el 100% del curso, `first_course` no debe aparecer.
SELECT badge_key, earned_at
FROM public.student_badges
WHERE student_id = '<UUID_ALUMNO>'
ORDER BY earned_at DESC;

-- =============================================
-- 7. Nivel de gamificacion ya no se queda en 1
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
-- 8. Cifras de partida, para dimensionar el corte
-- Conteo de filas de curso_task / course_form / course_material que SON
-- accesibles hoy para un alumno con una unica inscripcion.
-- =============================================
SELECT
  (SELECT count(*) FROM public.course_tasks)      AS total_course_tasks,
  (SELECT count(*) FROM public.course_forms)      AS total_course_forms,
  (SELECT count(*) FROM public.course_materials)  AS total_course_materials,
  (SELECT count(DISTINCT student_id) FROM public.course_enrollments)
    AS alumnos_con_al_menos_un_curso,
  (SELECT count(*) FROM public.profiles WHERE role = 'student') AS total_alumnos;

-- =============================================
-- 9. Triggers de inmutabilidad y de gamificacion
-- Expectativa: 4 filas, no 2.
--   profiles       -> trg_protect_profiles_role        (007, previa)
--                     trg_profiles_updated_at           (011, previa)
--                     trg_restrict_student_profile_update (017, nueva)
--   notifications  -> trg_restrict_notification_update   (017, nueva)
-- La inmutabilidad NO esta en WITH CHECK porque una politica RLS no puede
-- comparar con la fila anterior; por eso son triggers.
-- =============================================
SELECT tgrelid::regclass AS tabla, tgname, tgenabled,
       pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgrelid IN ('public.notifications'::regclass,
                  'public.profiles'::regclass,
                  'public.tasks'::regclass)
  AND NOT tgisinternal
ORDER BY tgrelid::regclass::text, tgname;

-- =============================================
-- 10. Los 3 triggers nuevos de la 017, y solo los 3
-- =============================================
SELECT tgname, tgenabled, pg_get_triggerdef(oid) AS definition
FROM pg_trigger
WHERE tgname IN (
  'trg_restrict_participation_reassignment',
  'trg_restrict_notification_update',
  'trg_restrict_student_profile_update'
)
ORDER BY tgname;
-- Esperado: 3 filas, los tres BEFORE UPDATE (el de participacion, BEFORE).

-- =============================================
-- 11. Rollback de la 017, por si hace falta
-- =============================================
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
-- Las 3 politicas de lectura de la seccion 2 se restauran copiando el texto
-- original de 008/009. Las demas correcciones (badges, nivel) son silenciosas
-- y no afectan funcionalidad visible.


-- ###########################################################################
-- BLOQUE B - PRUEBAS FUNCIONALES CON ESCRITURA.
-- NO PEGAR EN EL SQL EDITOR. Ver la nota de la cabecera.
-- Sustituye los UUID y ejecuta cada bloque por separado.
--
-- Cada bloque simula la sesion del alumno con el GUC del JWT y hace
-- SET ROLE authenticated, de modo que se ejercitan las RLS y el trigger a
-- la vez. No hay COMMIT: termine lo que termine, nada se guarda.
--
-- AVISO sobre el resultado: si un UPDATE devuelve "UPDATE 0" en vez de
-- 42501, la prueba NO vale. Significa que las RLS ya filtraron la fila
-- antes de que el trigger llegara a ejecutarse (por ejemplo porque el
-- usuario no tiene role = 'student'). El trigger no se probo.
-- =============================================

-- ---- B1. No se puede reescribir una notificacion (espera 42501) --------
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_ALUMNO>","role":"authenticated","email":"<EMAIL>"}';
-- set local role authenticated;
-- UPDATE public.notifications
--    SET message = 'texto falso'
--  WHERE recipient_id = '<UUID_ALUMNO>';
-- ROLLBACK;

-- ---- B2. Si se puede marcar como leida (espera UPDATE n) ---------------
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_ALUMNO>","role":"authenticated","email":"<EMAIL>"}';
-- set local role authenticated;
-- UPDATE public.notifications
--    SET read = true
--  WHERE recipient_id = '<UUID_ALUMNO>';
-- ROLLBACK;

-- ---- B3. No se puede cambiar el email del perfil (espera 42501) --------
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_ALUMNO>","role":"authenticated","email":"<EMAIL>"}';
-- set local role authenticated;
-- UPDATE public.profiles
--    SET email = 'atacante@ejemplo.com'
--  WHERE id = '<UUID_ALUMNO>';
-- ROLLBACK;

-- ---- B4. Editar phone / instrument si se permite (espera UPDATE n) ------
-- Son justo los 4 campos que ofrece MyProfile.jsx: phone, instrument,
-- level, avatar.
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_ALUMNO>","role":"authenticated","email":"<EMAIL>"}';
-- set local role authenticated;
-- UPDATE public.profiles
--    SET phone = '600000000', instrument = 'Piano', level = 'Intermedio'
--  WHERE id = '<UUID_ALUMNO>';
-- ROLLBACK;

-- ---- B5. No se puede mover la participacion a otra conversacion --------
-- Necesitas dos usuarios A y B en una misma conversacion.
-- Espera 42501.
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_A>","role":"authenticated","email":"<EMAIL_A>"}';
-- set local role authenticated;
-- UPDATE public.conversation_participants
--    SET conversation_id = '<UUID_CONVERSACION_DE_B>'
--  WHERE conversation_id = '<UUID_CONVERSACION_DE_A>'
--    AND user_id = '<UUID_A>';
-- ROLLBACK;

-- ---- B6. Silenciar la conversacion si se permite (espera UPDATE n) ------
-- BEGIN;
-- set local request.jwt.claims =
--   '{"sub":"<UUID_A>","role":"authenticated","email":"<EMAIL_A>"}';
-- set local role authenticated;
-- UPDATE public.conversation_participants
--    SET muted = true
--  WHERE user_id = '<UUID_A>';
-- ROLLBACK;

-- ---- B7. Marcar Completado una tarea sin alumno ya no rompe (23502) -----
-- Antes abortaba con not_null_violation por el INSERT del badge.
-- Se hace como postgres, sin SET ROLE, porque el caso a probar es
-- student_id IS NULL.
-- BEGIN;
-- UPDATE public.tasks
--    SET status = 'Completado'
--  WHERE student_id IS NULL
--  RETURNING id, title, status;
-- ROLLBACK;
-- Esperado: las filas devueltas, sin error.
