-- =============================================
-- 017 SECURITY CORRECTIONS
-- Cierra la exposicion de datos y las escalada de privilegios identificadas
-- en la auditoria del esquema tras aplicar 001-016.
--
-- NO es idempotente, y este fichero es el ejemplo de por que importa.
-- PostgreSQL aborta el CREATE OR REPLACE con 42P13 si una funcion ya
-- existe con otro tipo de retorno, sin avisar antes y sin deshacer lo que
-- ya se habia aplicado. Para mas detalle ver supabase/BASELINE.md.
--
-- Se aplico en produccion el 2026-09-25 dentro de un BEGIN/COMMIT
-- explicito, y se registro despues con migration repair porque aplicarla
-- a mano desde el SQL Editor no la anade al historial.
--
-- Depende de: 007 (is_admin), 008/009 (cursos), 013/014/016 (funciones).
-- =============================================

-- =============================================
-- 1. RLS: ESCAPE DE AISLAMIENTO ENTRE CURSOS
-- =============================================
-- BUG: en las politicas de student sobre course_tasks, course_forms y
-- course_materials se escribio `e.course_id = course_id` sin cualificar la
-- columna de la tabla externa. PostgreSQL resuelve una columna sin esquema
-- contra la tabla mas interna del rango, y `course_enrollments` YA tiene una
-- columna `course_id`, asi que el predicado degenere en:
--
--     e.course_id = e.course_id   -- tautologia (course_id es NOT NULL)
--
-- El unico filtro real que sobrevivia era `e.student_id = auth.uid()`, es
-- decir "esta inscrito en AL MENOS UN curso". Consecuencia: cualquier
-- estudiante con una sola inscripcion podia leer TODOS los course_tasks,
-- course_forms y course_materials de la academia.
--
-- Las politias hermanas (`e.course_id = id`, `t.id = task_id`, `f.id = form_id`)
-- son correctas porque la tabla interna no tiene esa columna y la resolucion
-- cae a la externa. El bug venia de copiar sin comprobar.
--
-- Fix: cualificar siempre la columna de la tabla externa.

DROP POLICY IF EXISTS "Student read tasks of enrolled courses" ON public.course_tasks;
CREATE POLICY "Student read tasks of enrolled courses" ON public.course_tasks
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_tasks.course_id
        AND e.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Student read forms of enrolled courses" ON public.course_forms;
CREATE POLICY "Student read forms of enrolled courses" ON public.course_forms
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_forms.course_id
        AND e.student_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Student read materials of enrolled courses" ON public.course_materials;
CREATE POLICY "Student read materials of enrolled courses" ON public.course_materials
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_materials.course_id
        AND e.student_id = auth.uid()
    )
  );

-- =============================================
-- 2. MENSAJERIA: IMPEDIR REASIGNAR UNA PARTICIPACION
-- =============================================
-- BUG: "User update own participation" (014) fija USING/WITH CHECK solo en
-- `user_id`. Toda decision de acceso del esquema de mensajeria cuelga de
-- `conversation_id`, asi que un usuario podia hacer:
--
--   PATCH /rest/v1/conversation_participants?conversation_id=eq.<propia>
--   {"conversation_id": "<conversacion ajena>"}
--
-- USING encuentra su propia fila, WITH CHECK vuelve a validar `user_id = yo`
-- y el UPDATE prospera. Resultado: el atacante queda como participante de una
-- conversacion ajena y puede leerla, escribir en ella y enumerar a los demas
-- participantes. La PK (conversation_id, user_id) nunca colisiona.
--
-- Una politica no puede comparar OLD con NEW, asi que se aplica un trigger
-- BEFORE UPDATE replicando el patron de restrict_student_task_update (011).

CREATE OR REPLACE FUNCTION public.restrict_participation_reassignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Sin JWT (SQL Editor/migraciones) o service_role: sin restriccion
  IF jwt_claims IS NULL THEN
    RETURN NEW;
  END IF;
  IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.conversation_id IS DISTINCT FROM OLD.conversation_id
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'No puedes mover tu participacion a otra conversacion'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_participation_reassignment ON public.conversation_participants;
CREATE TRIGGER trg_restrict_participation_reassignment
  BEFORE UPDATE ON public.conversation_participants
  FOR EACH ROW EXECUTE FUNCTION public.restrict_participation_reassignment();

-- 2.1 DELETE real de mensajes. La politica de 014 llamada "User delete own
-- messages" estaba declarada FOR UPDATE, duplicado exacto de la de update:
-- el nombre prometia DELETE y el cuerpo entregaba un segundo UPDATE.
DROP POLICY IF EXISTS "User delete own messages" ON public.messages;
CREATE POLICY "User delete own messages" ON public.messages
  FOR DELETE TO authenticated
  USING (sender_id = auth.uid());

-- =============================================
-- 3. NOTIFICACIONES: EL DESTINATARIO SOLO MARCA LEIDO
-- =============================================
-- BUG: WITH CHECK (recipient_id = auth.uid()) dejaba(sender_id, title,
-- message) escribibles, asi que un estudiante podia PATCHear cualquier
-- notificacion dirigida a el para reasignar el remitente y reescribir el
-- texto: suplantacion del profesor.
--
-- La comparacion con la fila anterior NO se puede expresar en WITH CHECK: una
-- politica RLS se evalua como una expresion SQL sobre la tabla, sin acceso a
-- la fila vieja (OLD solo existe dentro de una funcion de trigger). Por eso
-- la politica queda simple y la inmutabilidad la garantiza un trigger, que si
-- disposo de OLD.
DROP POLICY IF EXISTS "Student update own notifications" ON public.notifications;
CREATE POLICY "Student update own notifications" ON public.notifications
  FOR UPDATE TO authenticated
  USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

CREATE OR REPLACE FUNCTION public.restrict_notification_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Sin JWT (SQL Editor/migraciones) o service_role: sin restriccion
  IF jwt_claims IS NULL THEN
    RETURN NEW;
  END IF;
  IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  -- Lo unico que el destinatario puede tocar es la marca de leido.
  IF NEW.sender_id  IS DISTINCT FROM OLD.sender_id
     OR NEW.title     IS DISTINCT FROM OLD.title
     OR NEW.message   IS DISTINCT FROM OLD.message
     OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'Solo puedes marcar una notificacion como leida'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_notification_update ON public.notifications;
CREATE TRIGGER trg_restrict_notification_update
  BEFORE UPDATE ON public.notifications
  FOR EACH ROW EXECUTE FUNCTION public.restrict_notification_update();

-- =============================================
-- 4. PERFIL: EL ESTUDIANTE NO CAMBIA IDENTIDAD NI ESTADO
-- =============================================
-- BUG: WITH CHECK (id = auth.uid()) dejaba editables email, username,
-- full_name, role, status, progress, attendance... El role ya lo blindaba
-- trg_protect_profiles_role, pero email no: send_due_payment_reminders
-- (012) notifica a profiles.email, de modo que un estudiante podia poner
-- una direccion arbitraria y recibir en su correo las alertas de pago de
-- los demas. Nombre y username eran usables para suplantar a otro alumno en
-- listas, notificaciones y mensajes.
--
-- DENTRO DE LAS COLUMNAS DE IDENTIDAD Y ESTADO (denylist, NO allowlist).
-- Este trigger rechaza 9 columnas concretas, no acepta una lista de las
-- permitidas. Consecuencia: full_name, birth_date, guardian_name,
-- guardian_phone y avatar_url SI siguen siendo editables por el alumno, y
-- eso es intencionado, porque son datos suyos o de su tutor y no mueven
-- nada de estado. Lo que si mueve dinero o permisos es lo de esta lista.
-- El comentario anterior de este fichero lo llamaba "allowlist de lo que
-- puede editar", lo cual era falso: una allowlist de 4 columnas habria
-- dejado pasar tambien birth_date, guardian_name y guardian_phone, que
-- MyProfile.jsx no ofrece pero la API si aceptaria.
--
-- El trigger reemplaza a WITH CHECK por la misma razon que en la seccion
-- 3: OLD no es accesible desde una politica.

DROP POLICY IF EXISTS "Student own profile update" ON profiles;
CREATE POLICY "Student own profile update" ON profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND role = 'student')
  WITH CHECK (id = auth.uid() AND role = 'student');

CREATE OR REPLACE FUNCTION public.restrict_student_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Sin JWT (SQL Editor/migraciones) o service_role: sin restriccion
  IF jwt_claims IS NULL THEN
    RETURN NEW;
  END IF;
  IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.email       IS DISTINCT FROM OLD.email
     OR NEW.username  IS DISTINCT FROM OLD.username
     OR NEW.status    IS DISTINCT FROM OLD.status
     OR NEW.progress  IS DISTINCT FROM OLD.progress
     OR NEW.attendance IS DISTINCT FROM OLD.attendance
     OR NEW.teacher   IS DISTINCT FROM OLD.teacher
     OR NEW.next_lesson IS DISTINCT FROM OLD.next_lesson
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.id        IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'No puedes modificar los datos de identidad o estado de tu perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_student_profile_update ON public.profiles;
CREATE TRIGGER trg_restrict_student_profile_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.restrict_student_profile_update();

-- =============================================
-- 5. GAMIFICACION: NIVELES Y INSIGNIAS
-- =============================================

-- 5.1 tasks.student_id es nullable (001) pero student_badges.student_id es
-- NOT NULL (013). Al marcar como Completado una tarea sin asignar, el INSERT
-- de la insignia reventaba con 23502 y abortaba el UPDATE del admin.
CREATE OR REPLACE FUNCTION public.check_task_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  task_count INTEGER;
BEGIN
  -- Solo actuar cuando la tarea se marca como completada y tiene dueño
  IF NEW.status = 'Completado'
     AND OLD.status IS DISTINCT FROM 'Completado'
     AND NEW.student_id IS NOT NULL THEN

    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'first_task')
    ON CONFLICT DO NOTHING;

    SELECT COUNT(*) INTO task_count
    FROM public.tasks
    WHERE student_id = NEW.student_id AND status = 'Completado';

    IF task_count >= 10 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_10') ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 50 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_50') ON CONFLICT DO NOTHING;
    END IF;
    IF task_count >= 100 THEN
      INSERT INTO public.student_badges (student_id, badge_key)
      VALUES (NEW.student_id, 'tasks_100') ON CONFLICT DO NOTHING;
    END IF;

    UPDATE public.student_gamification
    SET tasks_completed = task_count, updated_at = now()
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.2 BUG grave: trg_course_completion_badges era AFTER INSERT pero la
-- guardia era `NEW.completed_at IS NOT NULL AND OLD.completed_at IS NULL`.
-- En un INSERT OLD es NULL y completed_at tiene DEFAULT now(), asi que la
-- condicion era SIEMPRE cierta: el badge `first_course` se otorgaba en el
-- primer item de checklist que tocara un alumno, sin haber completado nada.
--
-- Ademas el conteo de cursos usaba `SELECT COUNT(...) ... GROUP BY
-- e.course_id` dentro de un SELECT INTO escalar: con GROUP BY la consulta
-- devuelve una fila por grupo y INTO se queda solo con la primera, asi que
-- course_count era 1 en cuanto un unico curso cumplia el HAVING.
--
-- Fix: calcular la pertenencia del item, comprobar realmente el 100% de los
-- items del curso y contar los cursos completados en una subconsulta agrupada
-- (el GROUP BY queda encapsulado, no alimentando un escalar).

CREATE OR REPLACE FUNCTION public.check_course_completion_badges()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  total_items INTEGER;
  done_items  INTEGER;
  course_count INTEGER;
BEGIN
  -- Curso al que pertenece el item recien marcado
  SELECT ct.course_id INTO v_course_id
  FROM public.task_checklist_items tci
  JOIN public.course_tasks ct ON ct.id = tci.task_id
  WHERE tci.id = NEW.item_id;

  IF v_course_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Total de items de checklist del curso
  SELECT COUNT(*) INTO total_items
  FROM public.task_checklist_items tci
  JOIN public.course_tasks ct ON ct.id = tci.task_id
  WHERE ct.course_id = v_course_id;

  -- Items ya marcados por este alumno en ese curso
  SELECT COUNT(*) INTO done_items
  FROM public.checklist_progress cp
  JOIN public.task_checklist_items tci ON tci.id = cp.item_id
  JOIN public.course_tasks ct ON ct.id = tci.task_id
  WHERE cp.student_id = NEW.student_id
    AND ct.course_id = v_course_id;

  -- Sin items, o sin el 100%: no hay curso completado
  IF total_items = 0 OR done_items < total_items THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.student_badges (student_id, badge_key)
  VALUES (NEW.student_id, 'first_course')
  ON CONFLICT DO NOTHING;

  -- Cursos con TODOS sus items marcados por este alumno.
  -- El GROUP BY va dentro de la subconsulta para que el COUNT externo vea
  -- una fila por curso y no se quede con el primer grupo.
  SELECT COUNT(*) INTO course_count
  FROM (
    SELECT ct2.course_id
    FROM public.course_tasks ct2
    JOIN public.task_checklist_items tci2 ON tci2.task_id = ct2.id
    LEFT JOIN public.checklist_progress cp2
           ON cp2.item_id = tci2.id
          AND cp2.student_id = NEW.student_id
    GROUP BY ct2.course_id
    HAVING COUNT(*) FILTER (WHERE cp2.item_id IS NOT NULL) = COUNT(*)
  ) AS completed_courses;

  IF course_count >= 5 THEN
    INSERT INTO public.student_badges (student_id, badge_key)
    VALUES (NEW.student_id, 'courses_5') ON CONFLICT DO NOTHING;
  END IF;

  UPDATE public.student_gamification
  SET courses_completed = course_count, updated_at = now()
  WHERE student_id = NEW.student_id;

  RETURN NEW;
END;
$$;

-- 5.3 BUG: `SQRT((gamif.xp + xp_gained) / 100)` es division entera en
-- PostgreSQL (integer / integer), asi que el resultado era 0 hasta superar
-- los 10000 XP y `level` se quedaba clavado en 1. Fix: castear a numeric.
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
    gamif := ROW(NEW.student_id, 0, 1, 0, 0, 0, now())::public.student_gamification;
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
  new_level := FLOOR(SQRT((gamif.xp + xp_gained)::numeric / 100))::INTEGER + 1;

  IF new_level > gamif.level THEN
    UPDATE public.student_gamification
    SET level = new_level
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 5.4 get_next_badges (016): el calculo de `first_course` es un subquery
-- escalar con GROUP BY y sin agregado en la lista de seleccion. Eso hace
-- que devuelva una fila por curso, de modo que (a) con dos o mas cursos
-- agrupados PostgreSQL aborta con "more than one row returned for a
-- subquery used as an expression" y (b) el HAVING era
-- `COUNT(tci.id) = COUNT(cp.item_id)` sobre un INNER JOIN, donde
-- cp.item_id nunca es NULL: la condicion era siempre cierta, asi que
-- cualquier curso con al menos un item de checklist contaba como completado.
--
-- Fix: mismo patron que usa check_course_completion_badges mas arriba. El
-- GROUP BY va dentro de una subconsulta para que el COUNT externo vea una
-- fila por curso.
--
-- NOTA: aqui se mantiene RETURNS TABLE, el contrato que fijo la 016. Una
-- version anterior de este archivo devolvia jsonb, lo que obliga a hacer
-- DROP FUNCTION porque PostgreSQL no permite cambiar el tipo de retorno con
-- CREATE OR REPLACE (error 42P13). Ademas esa version no devolvia las
-- siguientes insignias sino un resumen de gamificacion, con lo que el
-- nombre de la funcion dejaba de describir lo que hacia.
CREATE OR REPLACE FUNCTION public.get_next_badges(p_student_id UUID)
RETURNS TABLE (
  badge_key TEXT,
  badge_name TEXT,
  badge_description TEXT,
  progress INTEGER,
  target INTEGER
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_student_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
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
       (SELECT COUNT(*) FROM (
          SELECT ct3.course_id
          FROM public.course_tasks ct3
          JOIN public.task_checklist_items tci3 ON tci3.task_id = ct3.id
          LEFT JOIN public.checklist_progress cp3
                 ON cp3.item_id = tci3.id
                AND cp3.student_id = p_student_id
          GROUP BY ct3.course_id
          HAVING COUNT(*) FILTER (WHERE cp3.item_id IS NOT NULL) = COUNT(*)
        ) AS completed_courses), 1),
      ('week_streak', 'Racha de 7 Dias', 'Practica 7 dias seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0), 7),
      ('month_streak', 'Racha de 30 Dias', 'Practica 30 dias seguidos',
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
END;
$$;

REVOKE ALL ON FUNCTION public.get_next_badges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_badges(UUID) TO authenticated;
