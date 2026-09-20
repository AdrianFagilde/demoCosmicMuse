-- =============================================
-- 014: Messaging System & Push Notifications
-- Requiere 007_security_hardening.sql (funcion public.is_admin)
-- Idempotente: seguro de ejecutar varias veces
-- =============================================

-- 1. TABLAS
-- =============================================

-- Conversaciones (hilos de mensajes entre usuarios)
CREATE TABLE IF NOT EXISTS public.conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Participantes de conversación
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT now(),
  last_read_at TIMESTAMPTZ,
  muted BOOLEAN DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

-- Mensajes
CREATE TABLE IF NOT EXISTS public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  message_type TEXT DEFAULT 'text' CHECK (message_type IN ('text', 'image', 'file', 'audio', 'system')),
  file_url TEXT,
  file_name TEXT,
  file_size INTEGER,
  reply_to_id UUID REFERENCES public.messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  deleted_at TIMESTAMPTZ
);

-- Notificaciones push (suscripciones Web Push)
-- La migración 013 puede haber creado push_subscriptions con student_id.
-- Aqui se adopta el esquema canónico con user_id (creación/migración idempotente).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'push_subscriptions') THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = 'user_id'
    ) THEN
      ALTER TABLE public.push_subscriptions
        ADD COLUMN user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = 'student_id'
      ) THEN
        UPDATE public.push_subscriptions SET user_id = student_id;
      END IF;
      ALTER TABLE public.push_subscriptions ALTER COLUMN user_id SET NOT NULL;
    END IF;

    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'push_subscriptions' AND column_name = 'student_id'
    ) THEN
      DROP POLICY IF EXISTS "Admin all push_subscriptions" ON public.push_subscriptions;
      DROP POLICY IF EXISTS "Student manage own push_subscriptions" ON public.push_subscriptions;
      ALTER TABLE public.push_subscriptions DROP COLUMN student_id;
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = 'push_subscriptions_user_endpoint_key'
        AND conrelid = 'public.push_subscriptions'::regclass
    ) THEN
      ALTER TABLE public.push_subscriptions
        ADD CONSTRAINT push_subscriptions_user_endpoint_key UNIQUE (user_id, endpoint);
    END IF;
  ELSE
    CREATE TABLE public.push_subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (user_id, endpoint)
    );
  END IF;
END $$;

-- 2. ÍNDICES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_conversations_updated ON public.conversations (updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user ON public.conversation_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON public.messages (conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON public.push_subscriptions (user_id);

-- 3. ROW LEVEL SECURITY (patron is_admin de la migracion 007)
-- =============================================

ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- conversations: admin total; usuario ve sus conversaciones
DROP POLICY IF EXISTS "Admin all conversations" ON public.conversations;
CREATE POLICY "Admin all conversations" ON public.conversations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "User own conversations" ON public.conversations;
CREATE POLICY "User own conversations" ON public.conversations
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User create conversations" ON public.conversations;
CREATE POLICY "User create conversations" ON public.conversations
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());

-- conversation_participants: admin total; usuario gestiona sus participaciones
DROP POLICY IF EXISTS "Admin all conversation_participants" ON public.conversation_participants;
CREATE POLICY "Admin all conversation_participants" ON public.conversation_participants
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "User read own participations" ON public.conversation_participants;
CREATE POLICY "User read own participations" ON public.conversation_participants
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS "User update own participation" ON public.conversation_participants;
CREATE POLICY "User update own participation" ON public.conversation_participants
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- messages: admin total; usuario ve mensajes de sus conversaciones
DROP POLICY IF EXISTS "Admin all messages" ON public.messages;
CREATE POLICY "Admin all messages" ON public.messages
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "User read messages in own conversations" ON public.messages;
CREATE POLICY "User read messages in own conversations" ON public.messages
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User send messages to own conversations" ON public.messages;
CREATE POLICY "User send messages to own conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "User update own messages" ON public.messages;
CREATE POLICY "User update own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

DROP POLICY IF EXISTS "User delete own messages" ON public.messages;
CREATE POLICY "User delete own messages" ON public.messages
  FOR UPDATE TO authenticated
  USING (sender_id = auth.uid())
  WITH CHECK (sender_id = auth.uid());

-- push_subscriptions: admin total; usuario gestiona las suyas
DROP POLICY IF EXISTS "Admin all push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "Admin all push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "User manage own push_subscriptions" ON public.push_subscriptions;
CREATE POLICY "User manage own push_subscriptions" ON public.push_subscriptions
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 4. TRIGGERS
-- =============================================

-- Actualizar updated_at en conversations
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_conversation_timestamp ON public.conversations;
CREATE TRIGGER trg_update_conversation_timestamp
  BEFORE UPDATE ON public.conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_conversation_timestamp();

-- Actualizar updated_at en messages
CREATE OR REPLACE FUNCTION public.update_message_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_message_timestamp ON public.messages;
CREATE TRIGGER trg_update_message_timestamp
  BEFORE UPDATE ON public.messages
  FOR EACH ROW EXECUTE FUNCTION public.update_message_timestamp();

-- 5. FUNCIONES AUXILIARES
-- =============================================

-- Obtener conversaciones del usuario con último mensaje
CREATE OR REPLACE FUNCTION public.get_user_conversations(p_user_id UUID)
RETURNS TABLE (
  conversation_id UUID,
  participant_name TEXT,
  participant_avatar TEXT,
  last_message TEXT,
  last_message_at TIMESTAMPTZ,
  unread_count INTEGER,
  is_muted BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    c.id AS conversation_id,
    COALESCE(p.full_name, 'Usuario') AS participant_name,
    NULL AS participant_avatar,
    m.content AS last_message,
    m.created_at AS last_message_at,
    COALESCE(
      (SELECT COUNT(*) FROM public.messages m2
       WHERE m2.conversation_id = c.id
       AND m2.sender_id != p_user_id
       AND m2.created_at > COALESCE(cp.last_read_at, '1970-01-01'::timestamptz)
       AND m2.deleted_at IS NULL), 0
    ) AS unread_count,
    cp.muted AS is_muted
  FROM public.conversations c
  JOIN public.conversation_participants cp ON cp.conversation_id = c.id AND cp.user_id = p_user_id
  JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id != p_user_id
  JOIN public.profiles p ON p.id = cp2.user_id
  LEFT JOIN LATERAL (
    SELECT content, created_at
    FROM public.messages m
    WHERE m.conversation_id = c.id
    AND m.deleted_at IS NULL
    ORDER BY m.created_at DESC
    LIMIT 1
  ) m ON true
  ORDER BY m.created_at DESC NULLS LAST;
$$;

-- Obtener mensajes de una conversación
CREATE OR REPLACE FUNCTION public.get_conversation_messages(p_conversation_id UUID, p_user_id UUID, p_limit INTEGER DEFAULT 50, p_before TIMESTAMPTZ DEFAULT NULL)
RETURNS TABLE (
  id UUID,
  sender_id UUID,
  sender_name TEXT,
  content TEXT,
  message_type TEXT,
  file_url TEXT,
  file_name TEXT,
  reply_to_id UUID,
  reply_to_content TEXT,
  reply_to_sender_name TEXT,
  created_at TIMESTAMPTZ,
  is_own BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    m.id,
    m.sender_id,
    p.full_name AS sender_name,
    m.content,
    m.message_type,
    m.file_url,
    m.file_name,
    m.reply_to_id,
    m2.content AS reply_to_content,
    p2.full_name AS reply_to_sender_name,
    m.created_at,
    (m.sender_id = p_user_id) AS is_own
  FROM public.messages m
  JOIN public.profiles p ON p.id = m.sender_id
  LEFT JOIN public.messages m2 ON m2.id = m.reply_to_id
  LEFT JOIN public.profiles p2 ON p2.id = m2.sender_id
  WHERE m.conversation_id = p_conversation_id
    AND m.deleted_at IS NULL
    AND (p_before IS NULL OR m.created_at < p_before)
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = p_conversation_id AND cp.user_id = p_user_id
    )
  ORDER BY m.created_at DESC
  LIMIT p_limit;
$$;

-- Marcar conversación como leída
CREATE OR REPLACE FUNCTION public.mark_conversation_read(p_conversation_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = p_conversation_id AND user_id = p_user_id;
$$;

-- Crear conversación directa (1-a-1) o grupal
CREATE OR REPLACE FUNCTION public.create_conversation(p_created_by UUID, p_participant_ids UUID[])
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  conv_id UUID;
  existing_conv UUID;
BEGIN
  -- Verificar si ya existe conversación 1-a-1
  IF array_length(p_participant_ids, 1) = 1 THEN
    SELECT c.id INTO existing_conv
    FROM public.conversations c
    JOIN public.conversation_participants cp1 ON cp1.conversation_id = c.id AND cp1.user_id = p_created_by
    JOIN public.conversation_participants cp2 ON cp2.conversation_id = c.id AND cp2.user_id = p_participant_ids[1]
    WHERE NOT EXISTS (
      SELECT 1 FROM public.conversation_participants cp3
      WHERE cp3.conversation_id = c.id AND cp3.user_id NOT IN (p_created_by, p_participant_ids[1])
    )
    LIMIT 1;
    
    IF existing_conv IS NOT NULL THEN
      RETURN existing_conv;
    END IF;
  END IF;
  
  -- Crear nueva conversación
  INSERT INTO public.conversations (created_by) VALUES (p_created_by) RETURNING id INTO conv_id;
  
  -- Agregar creador
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, p_created_by);
  
  -- Agregar participantes
  FOREACH participant_id IN ARRAY p_participant_ids LOOP
    INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (conv_id, participant_id)
    ON CONFLICT DO NOTHING;
  END LOOP;
  
  RETURN conv_id;
END;
$$;

-- Enviar mensaje
CREATE OR REPLACE FUNCTION public.send_message(
  p_conversation_id UUID,
  p_sender_id UUID,
  p_content TEXT,
  p_message_type TEXT DEFAULT 'text',
  p_file_url TEXT DEFAULT NULL,
  p_file_name TEXT DEFAULT NULL,
  p_file_size INTEGER DEFAULT NULL,
  p_reply_to_id UUID DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  msg_id UUID;
BEGIN
  -- Verificar que el usuario es participante
  IF NOT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = p_conversation_id AND user_id = p_sender_id
  ) THEN
    RAISE EXCEPTION 'No eres participante de esta conversación';
  END IF;
  
  INSERT INTO public.messages (
    conversation_id, sender_id, content, message_type, 
    file_url, file_name, file_size, reply_to_id
  ) VALUES (
    p_conversation_id, p_sender_id, p_content, p_message_type,
    p_file_url, p_file_name, p_file_size, p_reply_to_id
  ) RETURNING id INTO msg_id;
  
  -- Actualizar timestamp de conversación
  UPDATE public.conversations SET updated_at = now() WHERE id = p_conversation_id;
  
  RETURN msg_id;
END;
$$;