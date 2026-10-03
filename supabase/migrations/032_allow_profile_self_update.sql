-- =============================================
-- 032 PERFILES: EL ALUMNO PUEDE EDITAR SU PROPIO PERFIL (columnas limitadas)
--
-- Contexto / bug:
--   * La 017 creo "Student own profile update" y el trigger
--     restrict_student_profile_update (denylist de 9 columnas).
--   * La 023 elimino progress/attendance/next_lesson de profiles, pero dejo el
--     trigger de 017 referenciando esas columnas: desde entonces CUALQUIER
--     UPDATE de un alumno sobre profiles revienta con
--     `record "new" has no field "progress"` (42703).
--   * La 027 elimino la politica "Student own profile update" asumiendo que
--     ningun componente escribia en profiles. Falso: MyProfile.jsx guarda
--     phone, instrument y avatar_url. Sin politica, el update afectaba 0 filas
--     SIN error, y la UI cantaba exito mientras la foto nunca se persistia.
--
-- Fix (lo que pide la 027: permitirlo columna a columna de forma explicita):
--   1. Re-crea la politica de UPDATE de la fila propia.
--   2. Retira el trigger de la 017 (roto por la 023) y su funcion.
--   3. Amplia protect_profiles_role() para que sea el unico guard: bloquea
--      role y las columnas sensibles. El alumno solo puede tocar phone,
--      instrument y avatar_url (mas updated_at).
--
-- Idempotente: DROP ... IF EXISTS / CREATE OR REPLACE.
-- =============================================

-- 1. RLS: el alumno actualiza unicamente su propia fila de estudiante.
DROP POLICY IF EXISTS "Student own profile update" ON public.profiles;
CREATE POLICY "Student own profile update" ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() AND role = 'student')
  WITH CHECK (id = auth.uid() AND role = 'student');

-- 2. Retirar el trigger de 017 y su funcion, obsoletos tras la 023.
DROP TRIGGER IF EXISTS trg_restrict_student_profile_update ON public.profiles;
DROP FUNCTION IF EXISTS public.restrict_student_profile_update();

-- 3. Guard de columnas: se extiende la funcion del trigger existente
--    (trg_protect_profiles_role apunta a este mismo OID).
CREATE OR REPLACE FUNCTION public.protect_profiles_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_claims TEXT;
BEGIN
  jwt_claims := NULLIF(current_setting('request.jwt.claims', true), '');

  -- Contextos de confianza: SQL editor/CLI/migraciones (sin JWT) o service_role.
  IF jwt_claims IS NULL OR (jwt_claims::jsonb ->> 'role') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF public.is_admin() THEN
    -- El admin puede cambiarlo todo, pero role debe seguir siendo valido.
    IF NEW.role IS DISTINCT FROM OLD.role AND NEW.role NOT IN ('admin', 'student') THEN
      RAISE EXCEPTION 'Rol invalido: %', NEW.role;
    END IF;
    RETURN NEW;
  END IF;

  -- No-admin: no puede cambiar su rol...
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'Solo un administrador puede cambiar el rol de un perfil'
      USING ERRCODE = '42501';
  END IF;

  -- ...ni tocar columnas sensibles. Solo phone, instrument y avatar_url
  -- (mas updated_at) pasan.
  IF NEW.teacher IS DISTINCT FROM OLD.teacher
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.level IS DISTINCT FROM OLD.level
     OR NEW.birth_date IS DISTINCT FROM OLD.birth_date
     OR NEW.full_name IS DISTINCT FROM OLD.full_name
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.username IS DISTINCT FROM OLD.username
     OR NEW.guardian_name IS DISTINCT FROM OLD.guardian_name
     OR NEW.guardian_phone IS DISTINCT FROM OLD.guardian_phone THEN
    RAISE EXCEPTION 'No autorizado a modificar ese campo del perfil'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;
