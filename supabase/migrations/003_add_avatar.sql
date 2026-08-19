-- =============================================
-- Cosmo Music Academy - Migration 003
-- Add avatar_url column and avatars storage bucket
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. NUEVA COLUMNA
-- =============================================

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- 2. STORAGE BUCKET: avatars (publico para lectura)
-- =============================================

INSERT INTO storage.buckets (id, name, public)
SELECT 'avatars', 'avatars', true
WHERE NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars');

-- 3. STORAGE POLICIES
-- =============================================

-- Usuarios autenticados suben su propio avatar
DROP POLICY IF EXISTS "Users upload own avatar" ON storage.objects;
CREATE POLICY "Users upload own avatar" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'avatars'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Usuarios autenticados leen avatars de otros
DROP POLICY IF EXISTS "Authenticated read avatars" ON storage.objects;
CREATE POLICY "Authenticated read avatars" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');
