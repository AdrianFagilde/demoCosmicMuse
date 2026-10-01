-- =============================================
-- 031 DROP PUSH SUBSCRIPTIONS (fin del Web Push)
--
-- La app ya no envía notificaciones push del navegador: la edge function
-- send-push-notification se ha retirado y el service worker (public/sw.js)
-- dejó de escuchar los eventos push/notificationclick. Los avisos llegan
-- ahora por la tabla notifications + toasts in-app (NotificationToasts),
-- que funcionan con la app abierta y no requieren permiso del navegador.
--
-- Lo que queda es una tabla que PostgREST sigue exponiendo sin consumidor:
--
--   push_subscriptions   endpoints de Web Push (VAPID) por usuario
--
-- Los endpoints de suscripción son credenciales: con endpoint + p256dh +
-- auth cualquiera puede enviar mensajes push a ese navegador. Sin lógica
-- que los use, guardarlos es solo superficie de ataque.
--
-- Comprobado antes de aplicar:
-- - ninguna FK de otra tabla apunta a push_subscriptions
-- - ninguna función de public() referencia la tabla
-- - el frontend no la consulta en ningún hook
--
-- Las suscripciones vivas en los navegadores mueren solas: el servidor ya
-- no envía y el service worker nuevo ignora el evento push.
--
-- Si algún día se recupera el push, hay que registrar de nuevo: los
-- endpoints antiguos no se pueden reconstruir desde la app.
--
-- Idempotente: IF EXISTS en los DROP.
-- =============================================

DROP POLICY IF EXISTS "Admin all push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "User manage own push_subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Student manage own push_subscriptions" ON public.push_subscriptions;

DROP TABLE IF EXISTS public.push_subscriptions CASCADE;
