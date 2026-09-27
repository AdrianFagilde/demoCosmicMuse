-- =============================================
-- 028 DROP MESSAGING (sin interfaz)
--
-- La 023 dejo el esquema de mensajeria en pie "por si acaso", pero la 016
-- ya habia eliminado los hooks useSupabaseMessaging y
-- useSupabasePushNotifications por no tener consumidor y sus rutas se
-- retiraron. Lo que queda son tres tablas que PostgREST sigue exponiendo
-- y que nadie usa:
--
--   conversations            0 filas
--   conversation_participants 0 filas
--   messages                 0 filas
--
-- 11 politicas RLS y 6 claves foraneas para proteger datos que no existen.
-- Un modulo sin interfaz sigue siendo una superficie de ataque: basta con
-- supabase.from('messages') desde la consola del navegador.
--
-- Comprobado antes de aplicar:
-- - las tres tablas estan vacias
-- - ninguna FK de otra tabla apunta a ellas (las 6 son internas al grupo o
--   hacia profiles, y se van con el DROP)
-- - ninguna funcion de public() referencia las tablas
--
-- Si algun dia se recupera el chat, hay que rehacerlo con el modelo de
-- datos actual, no solo las policies.
--
-- Idempotente: IF EXISTS en los DROP.
-- =============================================

DROP TABLE IF EXISTS public.messages CASCADE;
DROP TABLE IF EXISTS public.conversation_participants CASCADE;
DROP TABLE IF EXISTS public.conversations CASCADE;
