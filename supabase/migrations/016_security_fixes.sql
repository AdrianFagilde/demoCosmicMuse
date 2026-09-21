-- =============================================
-- 016: Security Hardening (CRITICAL)
--
-- Corrige vulnerabilidades introducidas en 013/014/015 sin reescribir
-- las migraciones ya aplicadas:
--
--   * RPC de mensajería (014): las funciones SECURITY DEFINER aceptaban
--     p_user_id / p_created_by / p_sender_id sin verificar auth.uid();
--     cualquiera (incluido anon via PostgREST) podía leer conversaciones
--     y mensajes de otros usuarios o enviar mensajes suplantando a
--     cualquier participante. Ahora verifican al llamador y se revoca
--     el EXECUTE público.
--   * get_weekly_practice_summary (013/015) y get_next_badges (013):
--     fugaban los datos de práctica de cualquier estudiante.
--   * Anti-cheating: se elimina el UPDATE de estudiante sobre
--     practice_streaks y se bloquea el retro-dating / duración absurda
--     en practice_sessions; el XP de práctica queda acotado.
--   * Anti-spam de notificaciones in-app (011): un estudiante solo puede
--     notificar a perfiles admin; el admin puede notificar a cualquiera.
--   * submit_form (012): valida que los question_id pertenezcan al
--     formulario y depura respuestas que dejan de llegar.
--
-- Idempotente: seguro de ejecutar varias veces. Requiere 007 (is_admin).
-- =============================================

-- 0. is_admin(): restringe EXECUTE por defecto
-- =============================================
-- Anon recibe grant explícito porque las políticas RLS sin cláusula TO
-- (p. ej. "Admin full access profiles") se evalúan también para anon y
-- llaman a is_admin(); sin EXECUTE Postgres lanzaría error en vez de
-- devolver "no match". El resto de roles ya no pueden invocarla.
REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon;

-- Nota: el patrón de trg_protect_profiles_role (007) que considera
-- "ausencia de request.jwt.claims = contexto privilegiado" se mantiene
-- como tradeoff documentado: permite migraciones y SQL Editor, pero
-- significa que una credencial de BD directa puede cambiar roles.
-- Mitigación: la service role key y las credenciales de BD deben
-- tratarse como secretos de alta sensibilidad.

-- 1. MENSAJERÍA: autorización por auth.uid() + REVOKE
-- =============================================

-- Convertida a plpgsql para poder validar auth.uid() y deduplicar en
-- conversaciones grupales (antes duplicaba filas por participante).
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  participant_name TEXT,
  participant_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  is_muted BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT t.conversation_id,
         t.participant_name,
         t.participant_avatar,
         t.last_message,
         t.last_message_at,
         t.unread_count,
         t.is_muted
  FROM (
    SELECT DISTINCT ON (c.id)
      c.id AS conversation_id,
      COALESCE(p.full_name, 'Usuario') AS participant_name,
      NULL::text AS participant_avatar,
      m.content AS last_message,
      m.created_at AS last_message_at,
      COALESCE(
        (SELECT COUNT(*) FROM public.messages m2
         WHERE m2.conversation_id = c.id
           AND m2.sender_id != p_user_id
           AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
           AND m2.deleted_at IS NULL), 0
      ) AS unread_count,
      cp.muted AS is_muted
    FROM public.conversations c
    JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = p_user_id
    JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != p_user_id
    JOIN public.profiles p ON p.id = cp2.user_id
    LEFT JOIN LATERAL (
      SELECT content, created_at
      FROM public.messages m
      WHERE m.conversation_id = c.id
        AND m.deleted_at IS NULL
      ORDER BY m.created_at DESC
      LIMIT 1
    ) m ON true
    ORDER BY c.id, cp2.user_id
  ) t
  ORDER BY t.last_message_at DESC NULLS LAST;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_conversation_messages(p_conversation_id UUID, p_user_id UUID, p_limit INTEGER DEFAULT 50, p_before TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  sender_name TEXT,
  content TEXT,
  message_type TEXT,
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID,
  reply_to_content TEXT,
  reply_to_sender_name TEXT,
  created_at TIMESTAMPTZ,
  is_own BOOLEAN
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants cp
    WHERE cp.conversation_id = p_conversation_id AND cp.user_id = p_user_id
  ) THEN
    RAISE EXCEPTION 'No eres participante de esta conversación'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    m.id,
    m.sender_id,
    p.full_name AS sender_name,
    m.content,
    m.message_type,
    m.file_url,
    m.file_name,
    m.reply_to_id,
    m2.content AS reply_to_content,
    p2.full_name AS reply_to_sender_name,
    m.created_at,
    (m.sender_id = p_user_id) AS is_own
  FROM public.messages m
  JOIN public.profiles p ON p.id = m.sender_id
  LEFT JOIN public.messages m2 ON m2.id = m.reply_to_id
  LEFT JOIN public.profiles p2 ON p2.id = m2.sender_id
  WHERE m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
    AND (p_before IS NULL OR m.created_at < p_before)
  ORDER BY m.created_at DESC
  LIMIT p_limit;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_conversation(p_created_by UUID, p_participant_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id UUID;
  existing_conv UUID;
  participant_id UUID;
BEGIN
  IF p_created_by IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  -- Verificar si ya existe conversación 1-a-1
  IF array_length(p_participant_ids, 1) = 1 THEN
    SELECT c.id INTO existing_conv
    FROM public.conversations c
    JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = p_created_by
    JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = p_participant_ids[1]
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp3
      WHERE cp3.conversation_id = c.id AND cp3.user_id NOT IN (p_created_by, p_participant_ids[1])
    )
    LIMIT 1;

    IF existing_conv IS NOT NULL THEN
      RETURN existing_conv;
    END IF;
  END IF;

  -- Crear nueva conversación
  INSERT INTO public.conversations (created_by) VALUES (p_created_by) RETURNING id INTO conv_id;

  -- Agregar creador
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, p_created_by);

  -- Agregar participantes
  FOREACH participant_id IN ARRAY p_participant_ids LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, participant_id)
    ON CONFLICT DO NOTHING;
  END LOOP;

  RETURN conv_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_file_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_reply_to_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_id UUID;
BEGIN
  IF p_sender_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  -- Verificar que el usuario es participante
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'No eres participante de esta conversación'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.messages (
    conversation_id, sender_id, content, message_type,
    file_url, file_name, file_size, reply_to_id
  ) VALUES (
    p_conversation_id, p_sender_id, p_content, p_message_type,
    p_file_url, p_file_name, p_file_size, p_reply_to_id
  ) RETURNING id INTO msg_id;

  -- Actualizar timestamp de conversación
  UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;

  RETURN msg_id;
END;
$$;

-- 1.1 REVOKE/GRANT: solo autenticados pueden invocar los RPC
REVOKE ALL ON FUNCTION public.get_user_conversations(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_conversations(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_conversation_messages(UUID, UUID, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_conversation_messages(UUID, UUID, INTEGER, TIMESTAMPTZ) TO authenticated;

REVOKE ALL ON FUNCTION public.mark_conversation_read(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_conversation_read(UUID, UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.create_conversation(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_conversation(UUID, UUID[]) TO authenticated;

REVOKE ALL ON FUNCTION public.send_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_message(UUID, UUID, TEXT, TEXT, TEXT, TEXT, INTEGER, UUID) TO authenticated;

-- 2. PRÁCTICA: fugas de get_weekly_practice_summary / get_next_badges
-- =============================================

-- Definición final (sustituye a la de 013 y 015) con guarda de autorización.
CREATE OR REPLACE FUNCTION public.get_weekly_practice_summary(p_student_id UUID)
RETURNS TABLE (
  day DATE,
  minutes INTEGER,
  sessions INTEGER
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
END;
$$;

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
       (SELECT COUNT(DISTINCT e.course_id) FROM public.course_enrollments e
        JOIN public.checklist_progress cp ON cp.student_id = e.student_id
        JOIN public.task_checklist_items tci ON tci.id = cp.item_id
        JOIN public.course_tasks ct ON ct.id = tci.task_id
        WHERE e.student_id = p_student_id
        GROUP BY e.course_id
        HAVING COUNT(tci.id) = COUNT(cp.item_id)), 1),
      ('week_streak', 'Racha de 7 Días', 'Practica 7 días seguidos',
       COALESCE((SELECT current_streak FROM public.practice_streaks WHERE student_id = p_student_id), 0), 7),
      ('month_streak', 'Racha de 30 Días', 'Practica 30 días seguidos',
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

REVOKE ALL ON FUNCTION public.get_weekly_practice_summary(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_weekly_practice_summary(UUID) TO authenticated;

REVOKE ALL ON FUNCTION public.get_next_badges(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_next_badges(UUID) TO authenticated;

-- 3. ANTI-CHEATING DE PRÁCTICA
-- =============================================

-- 3.1 El estudiante ya no edita su streak: las rachas las computa el
-- trigger update_practice_streak a partir de practice_sessions reales.
DROP POLICY IF EXISTS "Student update own streak" ON public.practice_streaks;

-- 3.2 Bloquea en practice_sessions:
--   - INSERT con started_at muy retroactivo o futuro (retro-dating de rachas)
--   - UPDATE del started_at por el propio estudiante (re-escribir historia)
--   - ended_at anterior a started_at o con duración absurda
-- Los contextos de confianza (admin HTTP, service_role, SQL/migraciones)
-- pasan sin restricción para permitir migraciones de datos.
CREATE OR REPLACE FUNCTION public.trg_block_practice_tampering()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  IF jwt_claims IS NULL
     OR jwt_claims::jsonb ->> 'role' = 'service_role'
     OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.started_at < now() - INTERVAL '1 day'
       OR NEW.started_at > now() + INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'La sesión de práctica tiene una fecha no válida'
        USING ERRCODE = '42501';
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF NEW.started_at IS DISTINCT FROM OLD.started_at THEN
      RAISE EXCEPTION 'No puedes cambiar la fecha de una sesión registrada'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.ended_at IS NOT NULL THEN
    IF NEW.ended_at < NEW.started_at
       OR NEW.ended_at > NEW.started_at + INTERVAL '24 hours' THEN
      RAISE EXCEPTION 'Duración de práctica no válida' USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_practice_tampering ON public.practice_sessions;
CREATE TRIGGER trg_block_practice_tampering
  BEFORE INSERT OR UPDATE ON public.practice_sessions
  FOR EACH ROW EXECUTE FUNCTION public.trg_block_practice_tampering();

-- 3.3 Acota el XP farmeable por sesión (máx. 120 minutos computados),
-- incluso si el cliente deja el temporizador abierto mucho tiempo.
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

  new_level := FLOOR(SQRT((gamif.xp + xp_gained) / 100)) + 1;

  IF new_level > gamif.level THEN
    UPDATE public.student_gamification
    SET level = new_level
    WHERE student_id = NEW.student_id;
  END IF;

  RETURN NEW;
END;
$$;

-- 4. ANTI-SPAM DE NOTIFICACIONES IN-APP
-- =============================================
-- El remitente solo firma como sí mismo. Un usuario normal solo puede
-- notificar a perfiles admin (profesores); el admin, a cualquiera.
DROP POLICY IF EXISTS "User insert own sent notifications" ON public.notifications;
CREATE POLICY "User insert own sent notifications" ON public.notifications
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.is_admin()
      OR EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = recipient_id AND p.role = 'admin'
      )
    )
  );

-- 5. submit_form: integridad de respuestas
-- =============================================
-- Rechaza respuestas con question_id que no pertenecen al formulario y
-- elimina las respuestas previas que ya no vienen en el payload.
CREATE OR REPLACE FUNCTION public.submit_form(
  p_form_id UUID,
  p_student_id UUID,
  p_answers JSONB
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  submission_id UUID;
  ans JSONB;
BEGIN
  IF p_student_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.course_forms f
    JOIN public.course_enrollments e ON e.course_id = f.course_id
    WHERE f.id = p_form_id AND e.student_id = p_student_id
  ) THEN
    RAISE EXCEPTION 'El estudiante no está inscrito en este curso'
      USING ERRCODE = '42501';
  END IF;

  -- Validar que todas las preguntas pertenezcan al formulario
  IF EXISTS (
    SELECT 1
    FROM jsonb_array_elements(p_answers) a
    LEFT JOIN public.form_questions fq
      ON fq.id = ((a ->> 'question_id')::uuid) AND fq.form_id = p_form_id
    WHERE ((a ->> 'question_id')::uuid) IS NOT NULL AND fq.id IS NULL
  ) THEN
    RAISE EXCEPTION 'Respuesta a pregunta desconocida para este formulario'
      USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.form_submissions (form_id, student_id, updated_at)
  VALUES (p_form_id, p_student_id, now())
  ON CONFLICT (form_id, student_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO submission_id;

  -- Depurar respuestas que dejan de venir en el payload
  DELETE FROM public.form_answers fa
  WHERE fa.submission_id = submission_id
    AND NOT (
      fa.question_id = ANY (
        SELECT ((a ->> 'question_id')::uuid)
        FROM jsonb_array_elements(p_answers) a
        WHERE ((a ->> 'question_id')::uuid) IS NOT NULL
      )
    );

  FOR ans IN SELECT * FROM jsonb_array_elements(p_answers)
  LOOP
    INSERT INTO public.form_answers (
      submission_id, question_id, value_text, value_options, value_number, file_path, file_name
    )
    VALUES (
      submission_id,
      (ans ->> 'question_id')::uuid,
      NULLIF(ans ->> 'value_text', ''),
      NULLIF(ans -> 'value_options', 'null'::jsonb),
      CASE
        WHEN ans ->> 'value_number' IS NULL OR ans ->> 'value_number' = ''
          THEN NULL
        ELSE (ans ->> 'value_number')::numeric
      END,
      NULLIF(ans ->> 'file_path', ''),
      NULLIF(ans ->> 'file_name', '')
    )
    ON CONFLICT (submission_id, question_id) DO UPDATE SET
      value_text = EXCLUDED.value_text,
      value_options = EXCLUDED.value_options,
      value_number = EXCLUDED.value_number,
      file_path = EXCLUDED.file_path,
      file_name = EXCLUDED.file_name;
  END LOOP;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.submit_form(UUID, UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_form(UUID, UUID, JSONB) TO authenticated;