-- =============================================
-- Cosmo Music Academy - Supabase Migration
-- =============================================

-- 1. TABLAS
-- =============================================

-- Perfiles (extiende auth.users)
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

-- Lecciones
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

-- Tareas
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

-- Pagos
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

-- Recordatorios
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

-- Log de notificaciones
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

-- Instrumentos
CREATE TABLE IF NOT EXISTS instruments (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

-- 2. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Admin full access profiles" ON profiles
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Student own profile select" ON profiles
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'student' AND id = auth.uid()
  );

CREATE POLICY "Student own profile update" ON profiles
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'student' AND id = auth.uid()
  );

CREATE POLICY "Authenticated can read all profiles" ON profiles
  FOR SELECT USING (auth.role() = 'authenticated');

-- Lessons
CREATE POLICY "Admin full access lessons" ON lessons
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Student own lessons" ON lessons
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'student' AND student_id = auth.uid()
  );

-- Tasks
CREATE POLICY "Admin full access tasks" ON tasks
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

CREATE POLICY "Student own tasks select" ON tasks
  FOR SELECT USING (
    auth.jwt() ->> 'role' = 'student' AND student_id = auth.uid()
  );

CREATE POLICY "Student own tasks update" ON tasks
  FOR UPDATE USING (
    auth.jwt() ->> 'role' = 'student' AND student_id = auth.uid()
  );

-- Payments (solo admin)
CREATE POLICY "Admin full access payments" ON payments
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Payment reminders (solo admin)
CREATE POLICY "Admin full access reminders" ON payment_reminders
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Notification log (solo admin)
CREATE POLICY "Admin full access notifications" ON notification_log
  FOR ALL USING (auth.jwt() ->> 'role' = 'admin');

-- Instruments (todos autenticados leen)
CREATE POLICY "Authenticated read instruments" ON instruments
  FOR SELECT USING (auth.role() = 'authenticated');

-- 3. STORAGE
-- =============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Admin upload proof" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (auth.jwt() ->> 'role' = 'admin')
  );

CREATE POLICY "Admin read proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (auth.jwt() ->> 'role' = 'admin')
  );

CREATE POLICY "Student read own proofs" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (auth.jwt() ->> 'role' = 'student')
  );

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

-- 5. DATOS SEED
-- =============================================

-- Instrumentos
INSERT INTO instruments (name) VALUES
  ('Piano'), ('Guitarra'), ('Violín'), ('Saxofón'), ('Batería')
ON CONFLICT (name) DO NOTHING;

-- Usuarios demo (se crean en auth.users + trigger crea profiles)
-- Admin
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@cosmomusic.com',
  crypt('admin123', gen_salt('bf')),
  now(),
  '{"full_name": "Aurora Rivera", "username": "admin", "role": "admin"}'::jsonb,
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Estudiante 1
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'maria.lopez@cosmomusic.com',
  crypt('student123', gen_salt('bf')),
  now(),
  '{"full_name": "María López", "username": "maria", "role": "student", "instrument": "Piano", "level": "Intermedio", "teacher": "Clara Estévez", "phone": "+584121234567"}'::jsonb,
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Estudiante 2
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'javier.torres@cosmomusic.com',
  crypt('student123', gen_salt('bf')),
  now(),
  '{"full_name": "Javier Torres", "username": "javier", "role": "student", "instrument": "Guitarra", "level": "Principiante", "teacher": "Luis Martínez", "phone": "+584123456789"}'::jsonb,
  now(),
  now()
) ON CONFLICT (email) DO NOTHING;

-- Completar perfiles de estudiantes con datos extra
UPDATE profiles SET
  instrument = 'Piano',
  level = 'Intermedio',
  teacher = 'Clara Estévez',
  phone = '+584121234567',
  progress = 82,
  attendance = 92,
  next_lesson = '2026-06-03 17:00',
  status = 'Activo'
WHERE email = 'maria.lopez@cosmomusic.com';

UPDATE profiles SET
  instrument = 'Guitarra',
  level = 'Principiante',
  teacher = 'Luis Martínez',
  phone = '+584123456789',
  progress = 68,
  attendance = 88,
  next_lesson = '2026-06-02 18:30',
  status = 'Activo'
WHERE email = 'javier.torres@cosmomusic.com';

-- Lecciones seed
INSERT INTO lessons (student_id, instrument, lesson_date, lesson_time, duration, teacher)
SELECT
  (SELECT id FROM profiles WHERE email = 'maria.lopez@cosmomusic.com'),
  'Piano', '2026-06-03', '17:00', '45 min', 'Clara Estévez'
WHERE NOT EXISTS (SELECT 1 FROM lessons LIMIT 1);

INSERT INTO lessons (student_id, instrument, lesson_date, lesson_time, duration, teacher)
SELECT
  (SELECT id FROM profiles WHERE email = 'javier.torres@cosmomusic.com'),
  'Guitarra', '2026-06-02', '18:30', '60 min', 'Luis Martínez'
WHERE NOT EXISTS (SELECT 1 FROM lessons WHERE instrument = 'Guitarra');

-- Tareas seed
INSERT INTO tasks (title, description, student_id, assigned_by, due_date, status, progress)
SELECT
  'Practicar escalas mayores y menores',
  'Realiza 20 minutos de práctica de escalas con el metrónomo.',
  (SELECT id FROM profiles WHERE email = 'maria.lopez@cosmomusic.com'),
  (SELECT id FROM profiles WHERE email = 'admin@cosmomusic.com'),
  '2026-06-03',
  'En progreso',
  65
WHERE NOT EXISTS (SELECT 1 FROM tasks LIMIT 1);

INSERT INTO tasks (title, description, student_id, assigned_by, due_date, status, progress)
SELECT
  'Ejercicio de arpegios en Mi mayor',
  'Completa el ejercicio de arpegios en la guitarra con tempo constante.',
  (SELECT id FROM profiles WHERE email = 'javier.torres@cosmomusic.com'),
  (SELECT id FROM profiles WHERE email = 'admin@cosmomusic.com'),
  '2026-06-05',
  'Pendiente',
  25
WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = 'Ejercicio de arpegios en Mi mayor');

-- Pagos seed
INSERT INTO payments (student_id, amount, payment_date, method, frequency, notes, recorded_by)
SELECT
  (SELECT id FROM profiles WHERE email = 'maria.lopez@cosmomusic.com'),
  50,
  '2026-05-05',
  'Pago móvil',
  'Mensual',
  'Pago mensual de mayo',
  (SELECT id FROM profiles WHERE email = 'admin@cosmomusic.com')
WHERE NOT EXISTS (SELECT 1 FROM payments LIMIT 1);

INSERT INTO payments (student_id, amount, payment_date, method, frequency, notes, recorded_by)
SELECT
  (SELECT id FROM profiles WHERE email = 'javier.torres@cosmomusic.com'),
  45,
  '2026-05-10',
  'Efectivo',
  'Mensual',
  'Pago de suscripción de mayo',
  (SELECT id FROM profiles WHERE email = 'admin@cosmomusic.com')
WHERE NOT EXISTS (SELECT 1 FROM payments WHERE amount = 45);

-- Recordatorios seed
INSERT INTO payment_reminders (student_id, message, notify_whatsapp, schedule_at, interval_value, interval_unit, target_group, active, created_by)
SELECT
  (SELECT id FROM profiles WHERE email = 'maria.lopez@cosmomusic.com'),
  'Recordatorio de pago pendiente para este mes.',
  false,
  '2026-06-01T09:00:00Z',
  7,
  'Días',
  'Morosos',
  true,
  (SELECT id FROM profiles WHERE email = 'admin@cosmomusic.com')
WHERE NOT EXISTS (SELECT 1 FROM payment_reminders LIMIT 1);
