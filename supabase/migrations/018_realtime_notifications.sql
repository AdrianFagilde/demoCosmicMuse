-- =============================================
-- 018 REALTIME NOTIFICATIONS
-- Publica la tabla `notifications` en la publicación `supabase_realtime`.
--
-- Por qué hace falta: `useSupabaseUserNotifications` se suscribe a
-- `postgres_changes` sobre `public.notifications` filtrando por
-- `recipient_id` (ver src/hooks/useSupabaseUserNotifications.js). La
-- suscripción no recibe nada si la tabla no está en la publicación, así que
-- hasta ahora la campana y los toasts solo se actualizaban al recargar o al
-- marcar algo como leído.
--
-- La tabla se creó en 006, pero ninguna migración la publicaba. Se había
-- habilitado a mano desde el panel de Supabase, de modo que el esquema
-- versionado no describía la base real. Esto cierra esa deriva.
--
-- A diferencia de 001-017, esta migración ES idempotente a propósito: la
-- guarda de abajo no hace nada si la tabla ya está publicada, así que
-- aplicarla dos veces es inofensivo. Es justamente el contrario de lo que
-- ocurrió con la 017, que abortó a medias con 42P13; ver
-- supabase/BASELINE.md.
--
-- NO cambia `REPLICA IDENTITY`, y no debería. La identidad por defecto
-- (primary key) basta: Realtime compara el filtro contra el registro nuevo en
-- INSERT y en UPDATE, y los UPDATE que hace la app son solo `read`, que no
-- tocan `recipient_id`. Ponerla en FULL haría que cada UPDATE se replicara
-- entera por el WAL sin que el filtro lo necesite.
--
-- PENDIENTE DE APLICAR. Esta migración está escrita pero aún no se ha aplicado
-- en ningún entorno. Para hacerlo:
--   1. Pegarla en el SQL Editor y ejecutarla, o
--      `supabase db push` si el proyecto está enlazado.
--   2. Registrar el historial, porque ni el SQL Editor ni una ejecución
--      manual añaden la entrada: `supabase migration repair --status applied 18
--      --linked`.
-- No se revierte REPLICA IDENTITY ni ningún otro ajuste, así que aplicarla
-- sobre la publicación ya activa en producción no tiene efecto.
--
-- Depende de: 006 (tabla notifications).
-- =============================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'notifications'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
    RAISE NOTICE '018: public.notifications añadida a supabase_realtime.';
  ELSE
    RAISE NOTICE '018: public.notifications ya estaba publicada; no se hace nada.';
  END IF;
END;
$$;
