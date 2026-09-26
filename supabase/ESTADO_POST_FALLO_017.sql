-- ============================================================================
-- COMPROBACION DEL ESTADO TRAS EL INTENTO FALLIDO
-- Ejecuta esto en el SQL Editor ANTES de volver a aplicar la 017.
-- Es de solo lectura: no modifica nada.
-- ============================================================================

-- 0. ¿Quedo la migracion registrada como aplicada?
-- Si aparece version 17, el script llego a completarse y no debes
-- volver a lanzarlo. Si NO aparece, hubo fallo.
SELECT version, name, statements
FROM supabase_migrations.schema_migrations
ORDER BY version DESC
LIMIT 5;

-- 1. ¿Cuanto de la 017 llego a aplicarse?
-- 017 crea 3 triggers. Los tres deben existir a la vez.
SELECT tgname, tgenabled
FROM pg_trigger
WHERE tgname IN (
  'trg_restrict_participation_reassignment',
  'trg_restrict_notification_update',
  'trg_restrict_student_profile_update'
)
  AND NOT tgisinternal
ORDER BY tgname;
-- 0 filas  -> nada se aplico, se puede lanzar la 017 entera sin mas
-- 1 fila   -> aplicacion PARCIAL, corrige antes de relanzar
-- 3 filas  -> aplicada entera; solo falta registrarla a mano (ver seccion 3)

-- 2. Estado de las funciones de la 017
SELECT p.proname, pg_get_function_result(p.oid) AS retorna
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'restrict_participation_reassignment',
    'restrict_notification_update',
    'restrict_student_profile_update',
    'check_task_completion_badges',
    'check_course_completion_badges',
    'update_student_gamification',
    'get_next_badges'
  )
ORDER BY p.proname;
-- get_next_badges debe devolver TABLE, no jsonb. Si sale jsonb, hay una
-- version intermedia que quedo a medias.

-- 3. Registra la 017 en el historial si ya se aplico entera
-- SOLO si la consulta 1 devolvio las 3 filas y la 2 esta completa.
-- Descomenta la linea siguiente SOLO en ese caso:
--
-- INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
-- VALUES (17, 'security_corrections', ARRAY[]::text[])
-- ON CONFLICT (version) DO NOTHING;
--
-- (asi es como el CLI de Supabase marca una migracion aplicada a mano;
-- si la version no aparece despues, `supabase db push` intentara de nuevo).
