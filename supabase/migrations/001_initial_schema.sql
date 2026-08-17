-- =============================================
-- Cosmo Music Academy - Supabase Migration
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. TABLAS
-- =============================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('admin','student')),
  instrument TEXT,
  level TEXT,
  teacher TEXT,
  progress INTEGER DEFAULT 0,
  attendance INTEGER DEFAULT 100,
  next_lesson TIMESTAMPTZ,
  status TEXT DEFAULT 'Activo',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  instrument TEXT NOT NULL,
  lesson_date DATE NOT NULL,
  lesson_time TIME NOT NULL,
  duration TEXT NOT NULL,
  teacher TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES profiles(id),
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'Pendiente' CHECK (status IN ('Pendiente','En progreso','Completado')),
  progress INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount NUMERIC(10,2) NOT NULL,
  payment_date DATE NOT NULL,
  method TEXT CHECK (method IN ('Pago móvil','Efectivo','Transferencia')),
  frequency TEXT CHECK (frequency IN ('Mensual','Quincenal','Semanal')),
  proof_url TEXT,
  proof_name TEXT,
  notes TEXT DEFAULT '',
  recorded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  message TEXT NOT NULL,
  notify_whatsapp BOOLEAN DEFAULT false,
  schedule_at TIMESTAMPTZ NOT NULL,
  interval_value INTEGER DEFAULT 0,
  interval_unit TEXT CHECK (interval_unit IN ('Días','Horas')),
  target_group TEXT CHECK (target_group IN ('Individual','Todos','Morosos','Pagados')),
  active BOOLEAN DEFAULT true,
  last_sent TIMESTAMPTZ,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS notification_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  student_name TEXT,
  target_group TEXT,
  message TEXT NOT NULL,
  method TEXT NOT NULL,
  contact TEXT,
  trigger_type TEXT CHECK (trigger_type IN ('Manual','Automático')),
  sent_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instruments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- 2. ROW LEVEL SECURITY
-- =============================================
-- NOTE: Supabase JWT 'role' is always 'authenticated'.
-- Custom role is in auth.jwt() -> 'user_metadata' ->> 'role'

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Profiles
DROP POLICY IF EXISTS "Admin full access profiles" ON profiles;
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Student own profile select" ON profiles;
CREATE POLICY "Student own profile select" ON profiles
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND id = auth.uid()
  );

DROP POLICY IF EXISTS "Student own profile update" ON profiles;
CREATE POLICY "Student own profile update" ON profiles
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND id = auth.uid()
  );

DROP POLICY IF EXISTS "Authenticated can read all profiles" ON profiles;
CREATE POLICY "Authenticated can read all profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Lessons
DROP POLICY IF EXISTS "Admin full access lessons" ON lessons;
CREATE POLICY "Admin full access lessons" ON lessons
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Student own lessons" ON lessons;
CREATE POLICY "Student own lessons" ON lessons
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND student_id = auth.uid()
  );

-- Tasks
DROP POLICY IF EXISTS "Admin full access tasks" ON tasks;
CREATE POLICY "Admin full access tasks" ON tasks
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Student own tasks select" ON tasks;
CREATE POLICY "Student own tasks select" ON tasks
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND student_id = auth.uid()
  );

DROP POLICY IF EXISTS "Student own tasks update" ON tasks;
CREATE POLICY "Student own tasks update" ON tasks
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student' AND student_id = auth.uid()
  );

-- Payments (solo admin)
DROP POLICY IF EXISTS "Admin full access payments" ON payments;
CREATE POLICY "Admin full access payments" ON payments
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Payment reminders (solo admin)
DROP POLICY IF EXISTS "Admin full access reminders" ON payment_reminders;
CREATE POLICY "Admin full access reminders" ON payment_reminders
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Notification log (solo admin)
DROP POLICY IF EXISTS "Admin full access notifications" ON notification_log;
CREATE POLICY "Admin full access notifications" ON notification_log
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Instruments (todos autenticados leen)
DROP POLICY IF EXISTS "Authenticated read instruments" ON instruments;
CREATE POLICY "Authenticated read instruments" ON instruments
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. STORAGE
-- =============================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'payment-proofs', 'payment-proofs', false
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'payment-proofs');

DROP POLICY IF EXISTS "Admin upload proof" ON storage.objects;
CREATE POLICY "Admin upload proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin read proofs" ON storage.objects;
CREATE POLICY "Admin read proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Student read own proofs" ON storage.objects;
CREATE POLICY "Student read own proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'payment-proofs');

-- 4. TRIGGER: Auto-crear perfil al registrar usuario
-- =============================================

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, username, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Usuario'),
    COALESCE(NEW.raw_user_meta_data ->> 'username', SPLIT_PART(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'role', 'student')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 5. INSTRUMENTOS
-- =============================================

INSERT INTO instruments (name)
SELECT 'Piano' WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = 'Piano');
INSERT INTO instruments (name)
SELECT 'Guitarra' WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = 'Guitarra');
INSERT INTO instruments (name)
SELECT 'Violín' WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = 'Violín');
INSERT INTO instruments (name)
SELECT 'Saxofón' WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = 'Saxofón');
INSERT INTO instruments (name)
SELECT 'Batería' WHERE NOT EXISTS (SELECT 1 FROM instruments WHERE name = 'Batería');
