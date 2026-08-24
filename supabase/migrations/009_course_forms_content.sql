-- =============================================
-- 009: Cuestionarios (formularios) y contenido de cursos
-- Requiere 007_security_hardening.sql (funcion public.is_admin)
-- Idempotente: seguro de ejecutar varias veces
-- =============================================

-- 1. TABLAS
-- =============================================

CREATE TABLE IF NOT EXISTS public.course_forms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.course_forms(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'short_text','long_text','single_choice','multiple_choice','scale','file_upload'
  )),
  options JSONB NOT NULL DEFAULT '[]'::jsonb,
  required BOOLEAN NOT NULL DEFAULT false,
  position INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id UUID NOT NULL REFERENCES public.course_forms(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  submitted_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (form_id, student_id)
);

CREATE TABLE IF NOT EXISTS public.form_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.form_submissions(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES public.form_questions(id) ON DELETE CASCADE,
  value_text TEXT,
  value_options JSONB,
  value_number NUMERIC,
  file_path TEXT,
  file_name TEXT,
  UNIQUE (submission_id, question_id)
);

CREATE TABLE IF NOT EXISTS public.course_materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  task_id UUID REFERENCES public.course_tasks(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('text','link','file')),
  body TEXT DEFAULT '',
  url TEXT,
  file_path TEXT,
  file_name TEXT,
  position INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. INDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_course_forms_course ON public.course_forms (course_id, position);
CREATE INDEX IF NOT EXISTS idx_form_questions_form ON public.form_questions (form_id, position);
CREATE INDEX IF NOT EXISTS idx_form_submissions_student ON public.form_submissions (student_id);
CREATE INDEX IF NOT EXISTS idx_form_answers_question ON public.form_answers (question_id);
CREATE INDEX IF NOT EXISTS idx_course_materials_course ON public.course_materials (course_id, position);
CREATE INDEX IF NOT EXISTS idx_course_materials_task ON public.course_materials (task_id);

-- 3. ROW LEVEL SECURITY (patron is_admin de la migracion 007)
-- =============================================

ALTER TABLE public.course_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.course_materials ENABLE ROW LEVEL SECURITY;

-- course_forms: admin total; estudiante lee formularios de sus cursos inscritos
DROP POLICY IF EXISTS "Admin all course_forms" ON public.course_forms;
CREATE POLICY "Admin all course_forms" ON public.course_forms
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read forms of enrolled courses" ON public.course_forms;
CREATE POLICY "Student read forms of enrolled courses" ON public.course_forms
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_id AND e.student_id = auth.uid()
    )
  );

-- form_questions: admin total; estudiante lee preguntas de formularios de sus cursos
DROP POLICY IF EXISTS "Admin all form_questions" ON public.form_questions;
CREATE POLICY "Admin all form_questions" ON public.form_questions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read questions of enrolled courses" ON public.form_questions;
CREATE POLICY "Student read questions of enrolled courses" ON public.form_questions
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1
      FROM public.course_forms f
      JOIN public.course_enrollments e ON e.course_id = f.course_id
      WHERE f.id = form_id AND e.student_id = auth.uid()
    )
  );

-- form_submissions: admin lee todo (revision); estudiante gestiona solo los suyos
-- y solo en cursos donde esta inscrito
DROP POLICY IF EXISTS "Admin read all submissions" ON public.form_submissions;
CREATE POLICY "Admin read all submissions" ON public.form_submissions
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student manage own submissions" ON public.form_submissions;
CREATE POLICY "Student manage own submissions" ON public.form_submissions
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_forms f
      JOIN public.course_enrollments e ON e.course_id = f.course_id
      WHERE f.id = form_id AND e.student_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.course_forms f
      JOIN public.course_enrollments e ON e.course_id = f.course_id
      WHERE f.id = form_id AND e.student_id = auth.uid()
    )
  );

-- form_answers: admin lee todo; estudiante gestiona las de sus propios envios
DROP POLICY IF EXISTS "Admin read all answers" ON public.form_answers;
CREATE POLICY "Admin read all answers" ON public.form_answers
  FOR SELECT TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "Student manage own answers" ON public.form_answers;
CREATE POLICY "Student manage own answers" ON public.form_answers
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.form_submissions s
      WHERE s.id = submission_id AND s.student_id = auth.uid()
    )
  );

-- course_materials: admin total; estudiante lee materiales de sus cursos inscritos
DROP POLICY IF EXISTS "Admin all course_materials" ON public.course_materials;
CREATE POLICY "Admin all course_materials" ON public.course_materials
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read materials of enrolled courses" ON public.course_materials;
CREATE POLICY "Student read materials of enrolled courses" ON public.course_materials
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.course_enrollments e
      WHERE e.course_id = course_id AND e.student_id = auth.uid()
    )
  );

-- 4. STORAGE BUCKET: course-files (privado)
-- =============================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'course-files', 'course-files', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'course-files');

-- Estructura de carpetas:
--   answers/{student_id}/{question_id}/{archivo}   -> respuestas de estudiantes
--   materials/{course_id}/{archivo}                -> contenidos publicados por el profesor

-- Lectura: admin todo; estudiante sus propias respuestas y materiales de cursos inscritos
DROP POLICY IF EXISTS "Course files read access" ON storage.objects;
CREATE POLICY "Course files read access" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (
      public.is_admin()
      OR (
        (storage.foldername(name))[1] = 'answers'
        AND (storage.foldername(name))[2] = auth.uid()::text
      )
      OR (
        (storage.foldername(name))[1] = 'materials'
        AND EXISTS (
          SELECT 1 FROM public.course_enrollments e
          WHERE e.student_id = auth.uid()
            AND e.course_id::text = (storage.foldername(name))[2]
        )
      )
    )
  );

-- Escritura: admin sube materiales; estudiante sube unicamente a su carpeta de respuestas
DROP POLICY IF EXISTS "Admin upload course files" ON storage.objects;
CREATE POLICY "Admin upload course files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'course-files' AND public.is_admin());

DROP POLICY IF EXISTS "Student upload answer files" ON storage.objects;
CREATE POLICY "Student upload answer files" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'answers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- Reemplazo/eliminacion: admin todo en el bucket; estudiante solo sus archivos de respuesta
DROP POLICY IF EXISTS "Admin update course files" ON storage.objects;
CREATE POLICY "Admin update course files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'course-files' AND public.is_admin())
  WITH CHECK (bucket_id = 'course-files' AND public.is_admin());

DROP POLICY IF EXISTS "Admin delete course files" ON storage.objects;
CREATE POLICY "Admin delete course files" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'course-files' AND public.is_admin());

DROP POLICY IF EXISTS "Student update own answer files" ON storage.objects;
CREATE POLICY "Student update own answer files" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'answers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'answers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Student delete own answer files" ON storage.objects;
CREATE POLICY "Student delete own answer files" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'course-files'
    AND (storage.foldername(name))[1] = 'answers'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );
