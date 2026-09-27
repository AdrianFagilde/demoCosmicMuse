-- =============================================
-- 019 MENSAJERÍA: CORRIGE LAS POLÍTICAS TAUTOLÓGICAS
--
-- Qué corrige: las dos políticas de `messages` que la 014 escribió con una
-- columna sin qualificar dentro de un subquery, lo que en Postgres resuelve al
-- scope interno y convierte la comparación en una tautología.
--
-- La 014 escribió:
--
--   WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
--
-- `conversation_id` sin qualificar se resuelve a `cp.conversation_id` (el scope
-- más cercano gana), así que la condición real era
-- `cp.conversation_id = cp.conversation_id`, que siempre es verdadera. El
-- esquema en vivo lo confirma.
--
-- Por qué importa aunque la mensajería no tenga interfaz: PostgREST expone
-- todo el esquema `public`, y la anon key va dentro del bundle, o sea que es
-- pública. No hace falta ninguna vista para exploitation, solo
-- `supabase.from('messages').select()`.
--
-- Con la tautología, el filtro se reduce a "participo en ALGUNA conversación":
--
--   SELECT  *  cualquier usuario autenticado puede leer los mensajes de TODAS
--              las conversaciones del centro, incluidas admin-alumno.
--   INSERT  `sender_id = auth.uid()` sí seguía exigiendo identidad propia, pero
--              el EXISTS ya no acotaba conversation_id, así que se puede
--              escribir en cualquier conversación. Es decir: leer una
--              conversación ajena y thereinjectarse como uno mismo.
--
-- La 016 ya había arreglado los cinco RPC (validan `p_user_id IS DISTINCT FROM
-- auth.uid()`), pero eso no protege el camino directo por PostgREST: la 016 no
-- redefinió estas dos políticas, solo la de DELETE.
--
-- Idempotente a propósito, como la 018: solo hace DROP + CREATE sobre políticas,
-- que es reversible y no toca datos.
--
-- PENDIENTE DE APLICAR. Para hacerlo, pegar en el SQL Editor o
-- `supabase db push`, y después registrar el historial con
-- `supabase migration repair --status applied 19 --linked`. Ver
-- supabase/BASELINE.md.
--
-- Depende de: 014 (tablas), 016 (RPCs ya seguros).
-- =============================================

-- 1. Lectura: solo mensajes de conversaciones en las que el usuario participa.
--    El filtro por deleted_at se incluye porque get_conversation_messages ya lo
--    hacia y la política no: las dos formas de leer no coincidían, y una lectura
--    directa devolvía los mensajes "borrados".
DROP POLICY IF EXISTS "User read messages in own conversations" ON public.messages;
CREATE POLICY "User read messages in own conversations" ON public.messages
  FOR SELECT TO authenticated USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );

-- 2. Escritura: no se puede inyectar en una conversación ajena.
DROP POLICY IF EXISTS "User send messages to own conversations" ON public.messages;
CREATE POLICY "User send messages to own conversations" ON public.messages
  FOR INSERT TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.conversation_participants cp
      WHERE cp.conversation_id = messages.conversation_id
        AND cp.user_id = auth.uid()
    )
  );
