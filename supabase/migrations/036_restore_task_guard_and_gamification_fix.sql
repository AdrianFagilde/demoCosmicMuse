-- =============================================
-- 036 RESTAURA EL GUARD DE TASKS Y ARREGLA LA GAMIFICACION
--
-- tres correcciones, todas indoloras al esquema salvo la ultima.
--
-- 1. trg_restrict_student_task_update PERDIDO (B2)
--    ------------------------------------------------
--    La 011 creo un trigger BEFORE UPDATE sobre public.tasks que rebotaba
--    con 42501 cualquier cambio de title, description, student_id,
--    assigned_by o due_date hecho por un no-admin ("Solo puedes actualizar
--    el estado y el progreso de la tarea").
--
--    Ese trigger murio por una cadena de dos migraciones, sin que ninguna
--    de las dos pareciera tener nada que ver:
--
--      021:182  ALTER TABLE public.tasks RENAME TO tasks_legacy
--               Un trigger va atado al OID de su tabla, asi que el
--               trg_restrict_student_task_update fue con ella.
--      026:62   DROP TABLE IF EXISTS public.tasks_legacy
--               Y desaparecio con la tabla.
--
--    La tabla nueva (creada como `assignments` y renombrada a `tasks` en
--    021:186) solo recupero trg_tasks_updated_at (021:258). Ninguna
--    migracion de 027 a 035 lo devuelve.
--
--    POR QUE IMPORTA: una politica RLS no puede restringir columnas, solo
--    filas. "Student update own tasks" (021:233) sigue permitiendo UPDATE,
--    de modo que al perderse el trigger un alumno puede PATCHear su propia
--    tarea y cambiar title, description, due_date, assigned_by, position y
--    progress a voluntad. La anon key va dentro del bundle, asi que basta
--    `supabase.from('tasks').update({title:'...'}).eq('id', idPropia)` desde
--    la consola del navegador. No hay ninguna interfaz que lo delate.
--
--    La denylist se amplia al esquema actual (13 columnas, 021:24-45). Se
--    anaden course_id, position, created_by, id y created_at. course_id
--    necesita estar bloqueada explícitamente porque el CHECK
--    assignments_context_xor solo exige que haya exactamente uno de
--    course_id/student_id: un alumno con una tarea individual podria
--    moverla a un curso suyo poniendo course_id y student_id NULL sin
--    violar la exclusividad.
--
--    Mismo bypass que la 011: sin JWT (SQL Editor, CLI, migraciones),
--    service_role, o is_admin() pasan sin restriccion.
--
--    NOTA: hoy ninguna vista usa esta escritura. En Tasks.jsx los botones
--    de estado y el input de progreso estan tras `isAdmin &&` (Tasks.jsx:644),
--    y el avance de una tarea de curso se registra en checklist_progress,
--    no en tasks. La politica existe desde la 007 sin consumidor. Se
--    mantiene por si hacen falta, pero sin el trigger era escritura libre.
--
-- 2. update_student_gamification ABORTABA CON 42846 (B1)
--    ---------------------------------------------------
--    La funcion hacia:
--
--      gamif := ROW(NEW.student_id, 0, 1, 0, 0, 0, now())
--                    ::public.student_gamification;
--
--    Siete valores contra una tabla que tenia siete columnas. La 035 anadio
--    daily_goal_minutes y son ocho, y PostgreSQL exige que el numero de
--    campos de un ROW coincida con el del tipo compuesto: el cast falla con
--    42846 "cannot cast type record to public.student_gamification".
--
--    Se ejecutaba solo cuando el alumno aun no tenia fila en
--    student_gamification, o sea en su PRIMERA sesion de practica. El
--    trigger trg_update_gamification_ended es AFTER UPDATE, asi que el
--    error aborta el UPDATE entero: la sesion no cerraba y se perdian los
--    minutos, el XP y la racha. En el frontend solo se veia un
--    "[Practice] End error" en consola.
--
--    Fix: releer la fila tras el INSERT en vez de castear un ROW. Asi el
--    codigo deja de depender de la aridad y un ADD COLUMN futuro no lo
--    rompe. La aritmetica de 017 (LEAST a 120 minutos, nivel con ::numeric)
--    se queda como esta.
--
-- 3. form_answers NO DECLARA PROPIEDAD (R2)
--    ---------------------------------------
--    "Student manage own answers" es FOR ALL y su USING solo comprueba que
--    el alumno este matriculado en el curso del formulario. En ningun sitio
--    dice que la entrega sea suya.
--
--    Hoy no es un fallo: el EXISTS interior consulta form_submissions, y
--    esa tabla tiene "Student manage own submissions" (025:129) con
--    `student_id = auth.uid()`, asi que el RLS filtra el subquery a las
--    entregas del propio alumno. La propiedad se aplica de rebote.
--
--    Es fragil, no seguro: si alguna vez se afloja el RLS de
--    form_submissions (una vista de profesor, un informe), esta politica
--    abre lectura y escritura cruzada entre alumnos del mismo curso sin
--    que nada avise. Se hace explicito lo que ya se cumplia.
--
-- Idempotente: DROP ... IF EXISTS, CREATE OR REPLACE solo donde el tipo de
-- retorno no cambia, y NOTIFY pgrst al final.
-- =============================================

-- =============================================
-- 1. GUARD DE COLUMNAS SOBRE TASKS
-- =============================================

-- La firma no cambia (sin parametros, RETURNS TRIGGER), asi que el
-- CREATE OR REPLACE es seguro aunque la 011 ya la hubiera dejado viva.
-- DROP TABLE de 026 se llevo el trigger, no la funcion.
CREATE OR REPLACE FUNCTION public.restrict_student_task_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Contextos de confianza: SQL Editor, CLI y migraciones (sin JWT), o
  -- service_role. Sin esto ninguna migracion podria escribir en tasks.
  IF jwt_claims IS NULL THEN
    RETURN NEW;
  END IF;
  IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- De aqui en adelante, un no-admin. Solo puede tocar status, progress y
  -- updated_at; cualquier otra diferencia es un intento de reescribir la
  -- tarea que le asigno el profesor.
  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.course_id IS DISTINCT FROM OLD.course_id
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.due_date IS DISTINCT FROM OLD.due_date
     OR NEW.position IS DISTINCT FROM OLD.position
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo puedes actualizar el estado y el progreso de la tarea'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_student_task_update ON public.tasks;
CREATE TRIGGER trg_restrict_student_task_update
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.restrict_student_task_update();


-- =============================================
-- 2. GAMIFICACION: SIN CAST A TIPO COMPUESTO
-- =============================================
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
  effective_minutes INTEGER;
BEGIN
  SELECT * INTO gamif FROM public.student_gamification WHERE student_id = NEW.student_id;

  IF gamif IS NULL THEN
    INSERT INTO public.student_gamification (student_id, xp, level, total_practice_minutes)
    VALUES (NEW.student_id, 0, 1, 0);

    -- Se relee en vez de fabricar un ROW y castearlo. El cast original
    -- (ROW(...)::public.student_gamification) depende de que el numero de
    -- campos coincida con el de columnas: al anadir daily_goal_minutes en
    -- la 035 paso a abortar con 42846 en la primera sesion de cada alumno.
    SELECT * INTO gamif FROM public.student_gamification WHERE student_id = NEW.student_id;
  END IF;

  IF NEW.ended_at IS NOT NULL AND NEW.duration_minutes IS NOT NULL THEN
    effective_minutes := LEAST(NEW.duration_minutes, 120); -- cap anti-farm
    xp_gained := effective_minutes * 2;

    IF NEW.metronome_used THEN
      xp_gained := xp_gained + 10;
    END IF;

    UPDATE public.student_gamification
    SET xp = xp + xp_gained,
        total_practice_minutes = total_practice_minutes + effective_minutes,
        updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;

  -- ::numeric evita la division entera que dejaba el nivel siempre en 1
  -- (lo arreglo la 017). Y gamif.xp + xp_gained es intencionado: gamif se
  -- leyo ANTES del UPDATE de arriba, asi que la suma es el xp posterior, no
  -- el anterior. No "simplificarlo" a solo xp.
  new_level := FLOOR(SQRT((gamif.xp + xp_gained)::numeric / 100))::INTEGER + 1;

  IF new_level > gamif.level THEN
    UPDATE public.student_gamification
    SET level = new_level
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;


-- =============================================
-- 3. form_answers: PROPIEDAD EXPLICITA
-- =============================================
DROP POLICY IF EXISTS "Student manage own answers" ON public.form_answers;
CREATE POLICY "Student manage own answers" ON public.form_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      JOIN public.course_forms f ON f.id = s.form_id
      WHERE s.id = form_answers.submission_id
        AND s.student_id = auth.uid()
        AND public.is_enrolled_in(f.course_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      JOIN public.course_forms f ON f.id = s.form_id
      WHERE s.id = form_answers.submission_id
        AND s.student_id = auth.uid()
        AND public.is_enrolled_in(f.course_id)
    )
  );


-- =============================================
-- 4. COMPROBACION
-- =============================================
-- Ver supabase/VERIFICACION_036.sql.
--
-- Tras aplicar, el Bloque A debe dar cinco OK. Y el Bloque B, con sesion de
-- alumno, esto:
--
--   UPDATE public.tasks SET title = 'reescrito' WHERE id = <tarea propia>;
--   ERROR: Solo puedes actualizar el estado y el progreso de la tarea
--
--   UPDATE public.tasks SET status = 'Completado' WHERE id = <tarea propia>;
--   UPDATE 1
--
NOTIFY pgrst, 'reload schema';