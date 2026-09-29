-- Corregir ambigüedad de `submission_id` en submit_form
-- La variable PL/pgSQL se renombra a `v_submission_id` para no colisionar
-- con la columna `form_answers.submission_id` en ON CONFLICT y DELETE.

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
  v_submission_id UUID;
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
  RETURNING id INTO v_submission_id;

  -- Depurar respuestas que dejan de venir en el payload
  DELETE FROM public.form_answers fa
  WHERE fa.submission_id = v_submission_id
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
      v_submission_id,
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