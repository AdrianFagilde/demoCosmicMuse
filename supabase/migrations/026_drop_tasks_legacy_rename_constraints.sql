-- =============================================
-- 026 ELIMINA tasks_legacy Y RENOMBRA LAS CONSTRAINTS DE tasks
--
-- Continuacion de 025. Al recrear `tasks` desde cero durante la
-- aplicacion de 021, la tabla original quedo renombrada a `tasks_legacy`
-- conservando sus constraints con los nombres `tasks_*_fkey`. Eso produjo
-- dos consecuencias:
--
--   1. La tabla `tasks_legacy` seguia expuesta via PostgREST con las
--      mismas 6 politicas RLS que `tasks`: un administrador podia
--      insertar filas ahi y los estudiantes podian leerlas, duplicando
--      la superficie de ataque sin ningun proposito.
--
--   2. Los nombres `tasks_*_fkey` ya estaban ocupados, asi que la guarda
--      de idempotencia de 025 (que buscaba `conname` de forma global en
--      lugar de por tabla) omiteo el renombrado de las constraints de
--      `tasks`, que siguen llamandose `assignments_*_fkey`. Por eso
--      `tasks.select('*, profiles!tasks_student_id_fkey(...)')` continua
--      devolviendo PGRST200.
--
-- Se elimina primero `tasks_legacy` para liberar los nombres y despues se
-- renombran las constraints, ya con la guarda acotada a public.tasks.
--
-- Idempotente: DROP TABLE IF EXISTS y guardas por tabla sobre pg_constraint.
-- =============================================

-- =============================================
-- 1. PRECONDICIONES sobre tasks_legacy
-- =============================================
DO $$
DECLARE
  v_rows INTEGER;
  v_dependents INTEGER;
BEGIN
  IF to_regclass('public.tasks_legacy') IS NOT NULL THEN
    SELECT count(*) INTO v_rows FROM public.tasks_legacy;

    -- Tablas hijas que aun apunten a tasks_legacy
    SELECT count(*) INTO v_dependents
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = 'public.tasks_legacy'::regclass;

    IF v_dependents > 0 THEN
      RAISE EXCEPTION
        'Migracion 026 cancelada: % constraints siguen apuntando a tasks_legacy.',
        v_dependents;
    END IF;

    IF v_rows > 0 THEN
      RAISE EXCEPTION
        'Migracion 026 cancelada: tasks_legacy tiene % filas. Migrarlas antes de eliminarla.',
        v_rows;
    END IF;
  END IF;
END $$;

-- =============================================
-- 2. ELIMINAR tasks_legacy
--    Las politicas RLS se van con la tabla. No tiene filas ni herederos.
-- =============================================
DROP TABLE IF EXISTS public.tasks_legacy;

-- =============================================
-- 3. RENOMBRAR LAS CONSTRAINTS DE public.tasks
--    La guarda mira conrelid para no confundirse con constraints homonimas
--    de otras tablas, que es lo que ocurria en 025.
-- =============================================
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('assignments_course_id_fkey',   'tasks_course_id_fkey'),
      ('assignments_student_id_fkey',  'tasks_student_id_fkey'),
      ('assignments_assigned_by_fkey', 'tasks_assigned_by_fkey'),
      ('assignments_created_by_fkey',  'tasks_created_by_fkey')
    ) AS v(old_name, new_name)
  LOOP
    IF EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.old_name
        AND conrelid = 'public.tasks'::regclass
    ) AND NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = r.new_name
        AND conrelid = 'public.tasks'::regclass
    ) THEN
      EXECUTE format(
        'ALTER TABLE public.tasks RENAME CONSTRAINT %I TO %I',
        r.old_name, r.new_name
      );
      RAISE NOTICE '026: constraint renombrada % -> %', r.old_name, r.new_name;
    END IF;
  END LOOP;
END $$;
