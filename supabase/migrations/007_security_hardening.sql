-- =============================================
-- Cosmic Muse Academy - Migration 007
-- Security hardening:
--   * is_admin() basado en la tabla profiles (el rol del JWT en
--     user_metadata es editable por el propio usuario y deja de ser
--     fuente de autorización).
--   * Todas las políticas se reescriben sin confiar en el JWT.
--   * profiles: se elimina la lectura global; filas de staff legibles.
--   * Storage payment-proofs: lectura del estudiante limitada a su carpeta.
--   * Trigger: los no-admins no pueden cambiar profiles.role.
--   * handle_new_user fuerza role='student' (bloquea escalada en signup).
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. HELPER: verificación de admin autoritativa (verdad del servidor)
-- =============================================

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = (SELECT auth.uid())
      AND role = 'admin'
  );
$$;

-- 2. PROFILES
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student own profile select" ON profiles;
CREATE POLICY "Student own profile select" ON profiles
  FOR SELECT USING (id = auth.uid());

DROP POLICY IF EXISTS "Student own profile update" ON profiles;
CREATE POLICY "Student own profile update" ON profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Elimina la exposición global de PII (emails, teléfonos, tutores).
-- Los joins que muestran nombres de remitente/asignador siguen funcionando:
-- esos perfiles son de admins y quedan cubiertos por esta política.
DROP POLICY IF EXISTS "Authenticated can read all profiles" ON profiles;
DROP POLICY IF EXISTS "Authenticated read staff profiles" ON profiles;
CREATE POLICY "Authenticated read staff profiles" ON profiles
  FOR SELECT TO authenticated
  USING (role = 'admin');

DROP POLICY IF EXISTS "Authenticated insert own profile" ON profiles;
CREATE POLICY "Authenticated insert own profile" ON profiles
  FOR INSERT TO authenticated
  WITH CHECK (id = auth.uid() AND role = 'student');

-- Trigger: bloquea cambios de role por usuarios finales no-admin.
-- Contextos de confianza (sin JWT HTTP = SQL Editor/CLI/migraciones,
-- o token service_role) pasan sin restricción.
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

    IF jwt_claims IS NULL THEN
      RETURN NEW;
    END IF;

    IF jwt_claims::jsonb ->> 'role' = 'service_role' THEN
      RETURN NEW;
    END IF;

    IF NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede cambiar el rol de un perfil'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.role NOT IN ('admin', 'student') THEN
      RAISE EXCEPTION 'Rol invalido: %', NEW.role;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profiles_role ON public.profiles;
CREATE TRIGGER trg_protect_profiles_role
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profiles_role();

-- 3. LESSONS
-- =============================================

ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access lessons" ON lessons;
CREATE POLICY "Admin full access lessons" ON lessons
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student own lessons" ON lessons;
CREATE POLICY "Student own lessons" ON lessons
  FOR SELECT USING (student_id = auth.uid());

-- 4. TASKS
-- =============================================

ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access tasks" ON tasks;
CREATE POLICY "Admin full access tasks" ON tasks
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student own tasks select" ON tasks;
CREATE POLICY "Student own tasks select" ON tasks
  FOR SELECT USING (student_id = auth.uid());

DROP POLICY IF EXISTS "Student own tasks update" ON tasks;
CREATE POLICY "Student own tasks update" ON tasks
  FOR UPDATE USING (student_id = auth.uid())
  WITH CHECK (student_id = auth.uid());

-- 5. PAYMENTS / REMINDERS / LOG (solo admin)
-- =============================================

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access payments" ON payments;
CREATE POLICY "Admin full access payments" ON payments
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access reminders" ON payment_reminders;
CREATE POLICY "Admin full access reminders" ON payment_reminders
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin full access notifications" ON notification_log;
CREATE POLICY "Admin full access notifications" ON notification_log
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- 6. NOTIFICATIONS
-- =============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin full access notifications_v2" ON notifications;
CREATE POLICY "Admin full access notifications_v2" ON notifications
  FOR ALL USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Student read own notifications" ON notifications;
CREATE POLICY "Student read own notifications" ON notifications
  FOR SELECT USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS "Student update own notifications" ON notifications;
CREATE POLICY "Student update own notifications" ON notifications
  FOR UPDATE USING (recipient_id = auth.uid())
  WITH CHECK (recipient_id = auth.uid());

-- 7. INSTRUMENTS (lectura para autenticados, sin cambios)
-- =============================================

DROP POLICY IF EXISTS "Authenticated read instruments" ON instruments;
CREATE POLICY "Authenticated read instruments" ON instruments
  FOR SELECT USING (auth.role() = 'authenticated');

-- 8. STORAGE
-- =============================================

DROP POLICY IF EXISTS "Admin upload proof" ON storage.objects;
CREATE POLICY "Admin upload proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );

DROP POLICY IF EXISTS "Admin read proofs" ON storage.objects;
CREATE POLICY "Admin read proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND public.is_admin()
  );

-- Antes permitía leer TODO el bucket a cualquier autenticado.
-- Ahora cada estudiante solo ve su propia carpeta (los uploads usan
-- la ruta '<studentId>/<timestamp>-<archivo>').
DROP POLICY IF EXISTS "Student read own proofs" ON storage.objects;
CREATE POLICY "Student read own proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

-- 9. TRIGGER DE ALTA: forzar role='student' siempre
-- =============================================
-- Un usuario malintencionado podía enviar data:{role:'admin'} en el
-- signup y recibir permisos de admin. El rol ya no se confía al
-- metadata del cliente; promociones a admin: manuales (SQL Editor)
-- o vía service_role.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- El trigger existente (on_auth_user_created) conserva su binding;
-- CREATE OR REPLACE FUNCTION actualiza la definición en el mismo OID.

-- 10. ÍNDICES DE SOPORTE
-- =============================================

CREATE INDEX IF NOT EXISTS idx_notification_log_sent_at
  ON notification_log (sent_at DESC);
