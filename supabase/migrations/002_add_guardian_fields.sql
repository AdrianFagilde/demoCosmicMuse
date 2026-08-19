-- =============================================
-- Cosmo Music Academy - Migration 002
-- Add birth_date and guardian fields to profiles
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. NUEVAS COLUMNAS
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_name TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS guardian_phone TEXT;

-- 2. ACTUALIZAR TRIGGER: Extraer datos del representante al registrar
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, role, birth_date, guardian_name, guardian_phone)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student'),
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
