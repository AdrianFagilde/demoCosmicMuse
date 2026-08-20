-- =============================================
-- Cosmic Muse Academy - Migration 006
-- Create notifications table for in-app notifications
-- Idempotent: safe to run multiple times
-- =============================================

-- 1. TABLA NOTIFICATIONS
-- =============================================

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups by recipient
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread ON notifications(recipient_id, read) WHERE read = false;

-- 2. ROW LEVEL SECURITY
-- =============================================

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Admin full access (create, read, update, delete all)
DROP POLICY IF EXISTS "Admin full access notifications_v2" ON notifications;
CREATE POLICY "Admin full access notifications_v2" ON notifications
  FOR ALL USING ((auth.jwt() -> 'user_metadata' ->> 'role') = 'admin');

-- Student can read own notifications
DROP POLICY IF EXISTS "Student read own notifications" ON notifications;
CREATE POLICY "Student read own notifications" ON notifications
  FOR SELECT USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND recipient_id = auth.uid()
  );

-- Student can mark own notifications as read (UPDATE)
DROP POLICY IF EXISTS "Student update own notifications" ON notifications;
CREATE POLICY "Student update own notifications" ON notifications
  FOR UPDATE USING (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND recipient_id = auth.uid()
  )
  WITH CHECK (
    (auth.jwt() -> 'user_metadata' ->> 'role') = 'student'
    AND recipient_id = auth.uid()
  );
