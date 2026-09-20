-- =============================================
-- Cosmic Muse Academy - Migration 012
-- Server-side processing & transactional RPCs:
--   * send_due_payment_reminders(): envio automatico de recordatorios
--     programados via pg_cron (elimina la dependencia de que un admin
--     tenga la pestana abierta con setInterval en el navegador).
--   * save_form_questions(): guarda el conjunto completo de preguntas de
--     un cuestionario en UNA transaccion (delete + update + insert) y
--     devuelve los ids resueltos de las preguntas nuevas.
--   * submit_form(): crea/actualiza el envio y todas las respuestas en
--     UNA transaccion.
-- Requiere 007/009. Idempotente: seguro de ejecutar varias veces.
-- Nota pg_cron: en Supabase alojado, habilita la extension pg_cron en
-- Dashboard > Database > Extensions si el schedule no aparece.
-- =============================================

-- 1. ENVIO AUTOMATICO DE RECORDATORIOS (pg_cron)
-- =============================================

CREATE OR REPLACE FUNCTION public.send_due_payment_reminders()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  reminder RECORD;
  student RECORD;
  last_payment DATE;
  delinquent BOOLEAN;
  channel TEXT;
  step_ms BIGINT;
  offset_steps BIGINT;
  next_schedule TIMESTAMPTZ;
  sent_count INTEGER := 0;
BEGIN
  FOR reminder IN
    SELECT * FROM public.payment_reminders
    WHERE active
      AND schedule_at <= now()
      -- Guard de idempotencia: si ya se envio para esta ocurrencia no se reenvia
      AND (last_sent IS NULL OR last_sent < schedule_at)
    ORDER BY schedule_at ASC
  LOOP
    channel := CASE WHEN reminder.notify_whatsapp THEN 'App + WhatsApp' ELSE 'App' END;

    FOR student IN
      SELECT id, full_name, email
      FROM public.profiles
      WHERE role = 'student'
      ORDER BY full_name
    LOOP
      IF reminder.target_group = 'Individual' THEN
        IF student.id IS DISTINCT FROM reminder.student_id THEN
          CONTINUE;
        END IF;
      ELSIF reminder.target_group IN ('Morosos', 'Pagados') THEN
        SELECT MAX(payment_date) INTO last_payment
        FROM public.payments
        WHERE student_id = student.id;
        delinquent := last_payment IS NULL OR (current_date - last_payment) > 30;
        IF reminder.target_group = 'Morosos' AND NOT delinquent THEN
          CONTINUE;
        END IF;
        IF reminder.target_group = 'Pagados' AND delinquent THEN
          CONTINUE;
        END IF;
      END IF;

      INSERT INTO public.notifications (sender_id, recipient_id, title, message)
      VALUES (
        reminder.created_by,
        student.id,
        'Recordatorio de pago - ' || COALESCE(reminder.target_group, 'Individual'),
        reminder.message
      );

      INSERT INTO public.notification_log (
        student_id, student_name, target_group, message, method, contact, trigger_type
      )
      VALUES (
        student.id,
        student.full_name,
        COALESCE(reminder.target_group, 'Individual'),
        reminder.message,
        channel,
        student.email,
        'Automático'
      );

      sent_count := sent_count + 1;
    END LOOP;

    IF reminder.interval_value > 0 THEN
      step_ms := CASE WHEN reminder.interval_unit = 'Horas'
        THEN reminder.interval_value::bigint * 60 * 60 * 1000
        ELSE reminder.interval_value::bigint * 24 * 60 * 60 * 1000 END;
      offset_steps := GREATEST(
        1,
        CEIL((EXTRACT(EPOCH FROM (now() - reminder.schedule_at)) * 1000) / step_ms)::bigint
      );
      next_schedule := reminder.schedule_at
        + (offset_steps * reminder.interval_value)::bigint
          * CASE WHEN reminder.interval_unit = 'Horas'
              THEN interval '1 hour'
              ELSE interval '1 day' END;
      UPDATE public.payment_reminders
      SET last_sent = now(), schedule_at = next_schedule
      WHERE id = reminder.id;
    ELSE
      UPDATE public.payment_reminders
      SET last_sent = now(), active = false
      WHERE id = reminder.id;
    END IF;
  END LOOP;

  RETURN sent_count;
END;
$$;

REVOKE ALL ON FUNCTION public.send_due_payment_reminders() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.send_due_payment_reminders() TO service_role;

-- Agendado horario (idempotente); no falla si pg_cron no está disponible
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    IF NOT EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'send-due-payment-reminders') THEN
      PERFORM cron.schedule(
        'send-due-payment-reminders',
        '0 * * * *',
        $cmd$SELECT public.send_due_payment_reminders()$cmd$
      );
    END IF;
  END IF;
END $$;

-- 2. RPC: GUARDAR PREGUNTAS DE CUESTIONARIO (transaccional)
-- =============================================
-- Elimina las borradas, actualiza las existentes e inserta las nuevas
-- (las que llegan sin id o con id 'temp-*'), todo en una transacción.
-- Devuelve el array de preguntas con los ids reales resueltos.

CREATE OR REPLACE FUNCTION public.save_form_questions(
  p_form_id UUID,
  p_questions JSONB
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  q JSONB;
  result JSONB := '[]'::jsonb;
  new_id UUID;
  keep_ids UUID[];
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Solo los administradores pueden editar cuestionarios'
      USING ERRCODE = '42501';
  END IF;

  SELECT ARRAY_AGG((elem ->> 'id')::uuid) INTO keep_ids
  FROM jsonb_array_elements(p_questions) elem
  WHERE (elem ->> 'id') IS NOT NULL
    AND (elem ->> 'id') <> ''
    AND (elem ->> 'id') NOT LIKE 'temp-%';

  DELETE FROM public.form_questions
  WHERE form_id = p_form_id
    AND NOT (id = ANY(COALESCE(keep_ids, ARRAY[]::uuid[])));

  FOR q IN SELECT * FROM jsonb_array_elements(p_questions)
  LOOP
    new_id := NULLIF((q ->> 'id'), '')::uuid;
    IF new_id IS NULL THEN
      INSERT INTO public.form_questions (
        form_id, question_text, type, options, required, position
      )
      VALUES (
        p_form_id,
        COALESCE(trim((q ->> 'question_text')::text), ''),
        (q ->> 'type')::text,
        COALESCE(NULLIF(q -> 'options', 'null'::jsonb), '[]'::jsonb),
        COALESCE((q ->> 'required')::boolean, false),
        COALESCE((q ->> 'position')::integer, 0)
      )
      RETURNING id INTO new_id;
    ELSE
      UPDATE public.form_questions
      SET question_text = COALESCE(trim((q ->> 'question_text')::text), ''),
          type = (q ->> 'type')::text,
          options = COALESCE(NULLIF(q -> 'options', 'null'::jsonb), '[]'::jsonb),
          required = COALESCE((q ->> 'required')::boolean, false),
          position = COALESCE((q ->> 'position')::integer, 0)
      WHERE id = new_id AND form_id = p_form_id;
    END IF;

    IF new_id IS NOT NULL THEN
      result := result || (q || jsonb_build_object('id', new_id::text));
    END IF;
  END LOOP;

  RETURN result;
END;
$$;

REVOKE ALL ON FUNCTION public.save_form_questions(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_form_questions(UUID, JSONB) TO authenticated;

-- 3. RPC: ENVIAR CUESTIONARIO (transaccional)
-- =============================================
-- Crea/actualiza el envio y TODAS las respuestas en una transacción.
-- Verifica que el llamador sea el propio estudiante y que esté inscrito.

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

  INSERT INTO public.form_submissions (form_id, student_id, updated_at)
  VALUES (p_form_id, p_student_id, now())
  ON CONFLICT (form_id, student_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO submission_id;

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