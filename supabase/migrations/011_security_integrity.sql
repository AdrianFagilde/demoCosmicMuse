-- =============================================
-- Cosmic Muse Academy - Migration 011
-- Integrity & security follow-up:
--   * notifications: INSERT para el remitente autenticado (los
--     estudiantes pueden notificar al profesor, p. ej. al enviar un
--     cuestionario). Antes solo el admin podía insertar.
--   * Storage avatars: políticas UPDATE/DELETE propias y acceso admin
--     (el upsert del frontend fallaba en la segunda subida).
--   * Storage payment-proofs: DELETE para admin.
--   * Índices en FKs heredadas de la 001 (las políticas RLS hacían
--     seq scans) + índice para el scheduler de recordatorios.
--   * handle_new_user con SET search_path (misma norma que is_admin).
--   * checklist_progress: exige inscripción al curso del item.
--   * tasks: los no-admins solo pueden cambiar status/progress.
--   * Triggers updated_at en tablas que tienen la columna.
--   * CHECK de rango 0-100 en tasks.progress (NOT VALID: no rompe
--     filas existentes; aplica a escrituras futuras).
-- Requiere 007/008/009. Idempotente: seguro de ejecutar varias veces.
-- =============================================

-- 1. NOTIFICATIONS: INSERT para el remitente autenticado
-- =============================================
-- El remitente solo puede firmar como sí mismo; el destinatario lo elige
-- la app (profesor al entregar cuestionario, admin en avisos, etc.).

DROP POLICY IF EXISTS "User insert own sent notifications" ON notifications;
CREATE POLICY "User insert own sent notifications" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (sender_id = auth.uid());

-- 2. STORAGE AVATARS: UPDATE/DELETE propios + admin
-- =============================================

DROP POLICY IF EXISTS "Users update own avatar" ON storage.objects;
CREATE POLICY "Users update own avatar" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Users delete own avatar" ON storage.objects;
CREATE POLICY "Users delete own avatar" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "Admin all avatars" ON storage.objects;
CREATE POLICY "Admin all avatars" ON storage.objects
  FOR ALL TO authenticated
  USING (bucket_id = 'avatars' AND public.is_admin())
  WITH CHECK (bucket_id = 'avatars' AND public.is_admin());

-- 3. STORAGE PAYMENT-PROOFS: DELETE para admin
-- =============================================

DROP POLICY IF EXISTS "Admin delete proofs" ON storage.objects;
CREATE POLICY "Admin delete proofs" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );

-- 4. ÍNDICES EN FKS (001) + SCHEDULER DE RECORDATORIOS
-- =============================================

CREATE INDEX IF NOT EXISTS idx_lessons_student ON public.lessons (student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_student ON public.tasks (student_id);
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_by ON public.tasks (assigned_by);
CREATE INDEX IF NOT EXISTS idx_payments_student ON public.payments (student_id);
CREATE INDEX IF NOT EXISTS idx_payments_recorded_by ON public.payments (recorded_by);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_student ON public.payment_reminders (student_id);
CREATE INDEX IF NOT EXISTS idx_notification_log_student ON public.notification_log (student_id);
CREATE INDEX IF NOT EXISTS idx_payment_reminders_due
  ON public.payment_reminders (active, schedule_at)
  WHERE active = true;

-- 5. handle_new_user CON search_path FIJO
-- =============================================
-- Misma lógica que en 007 (fuerza role='student'); solo se añade
-- SET search_path = public según la norma de la propia migración.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (
    id, full_name, username, email, role,
    birth_date, guardian_name, guardian_phone
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    'student',
    CASE
      WHEN NEW.raw_user_meta_data ->> 'birth_date' IS NOT NULL
        THEN (NEW.raw_user_meta_data ->> 'birth_date')::DATE
      ELSE NULL
    END,
    NEW.raw_user_meta_data ->> 'guardian_name',
    NEW.raw_user_meta_data ->> 'guardian_phone'
  );
  RETURN NEW;
END;
$$;

-- 6. CHECKLIST_PROGRESS: exigir inscripción al curso del item
-- =============================================
-- Antes bastaba con student_id = auth.uid(): un estudiante podía
-- escribir progreso en items de cursos ajenos.

DROP POLICY IF EXISTS "Student manage own progress" ON public.checklist_progress;
CREATE POLICY "Student manage own progress" ON public.checklist_progress
  FOR ALL TO authenticated
  USING (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.task_checklist_items i
      JOIN public.course_tasks t ON t.id = i.task_id
      JOIN public.course_enrollments e ON e.course_id = t.course_id
      WHERE i.id = item_id AND e.student_id = auth.uid()
    )
  )
  WITH CHECK (
    student_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM public.task_checklist_items i
      JOIN public.course_tasks t ON t.id = i.task_id
      JOIN public.course_enrollments e ON e.course_id = t.course_id
      WHERE i.id = item_id AND e.student_id = auth.uid()
    )
  );

-- 7. TASKS: no-admins solo cambian status/progress
-- =============================================
-- La política "Student own tasks update" (007) no puede restringir
-- columnas; este trigger bloquea cambios fuera de status/progress
-- para usuarios finales no-admin.

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

  -- Sin JWT (SQL Editor/migraciones) o service_role: sin restricción
  IF jwt_claims IS NULL THEN
    RETURN NEW;
  END IF;
  IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
    RETURN NEW;
  END IF;
  IF public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.title IS DISTINCT FROM OLD.title
     OR NEW.description IS DISTINCT FROM OLD.description
     OR NEW.student_id IS DISTINCT FROM OLD.student_id
     OR NEW.assigned_by IS DISTINCT FROM OLD.assigned_by
     OR NEW.due_date IS DISTINCT FROM OLD.due_date THEN
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

-- Rango válido de progreso (NOT VALID: no audita filas previas)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tasks_progress_range'
  ) THEN
    ALTER TABLE public.tasks
      ADD CONSTRAINT tasks_progress_range CHECK (progress >= 0 AND progress <= 100) NOT VALID;
  END IF;
END $$;

-- 8. TRIGGERS updated_at
-- =============================================

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_tasks_updated_at ON public.tasks;
CREATE TRIGGER trg_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_courses_updated_at ON public.courses;
CREATE TRIGGER trg_courses_updated_at
  BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_form_submissions_updated_at ON public.form_submissions;
CREATE TRIGGER trg_form_submissions_updated_at
  BEFORE UPDATE ON public.form_submissions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
