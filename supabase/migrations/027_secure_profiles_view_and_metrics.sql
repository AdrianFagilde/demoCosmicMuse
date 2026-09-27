-- =============================================
-- 027 SECURITY: PROFILES VIEW + STUDENT METRICS
--
-- Cierra tres fugas introducidas por la 023.
--
-- 1) profiles_with_metrics sin security_invoker
-- ------------------------------------------------
-- En PostgreSQL una vista se ejecuta con los permisos de su PROPIETARIO,
-- no de quien la consulta. La 023 hizo GRANT SELECT a authenticated sobre
-- una vista construida con p.*, de modo que las politicas RLS de profiles
-- NO se aplicaban al leerla: cualquier alumno autenticado se llevaba una
-- fila por usuario, con email, telefono, fecha de nacimiento, nombre y
-- telefono del tutor.
--
-- Verificado antes de applying: la alumna recibia 12 filas de las 12
-- (los 3 que RLS le permite de profiles) y podia leer literalmente
-- admin@cosmomusic.com.
--
-- security_invoker = true hace que las politicas RLS de las tablas
-- underlies se apliquen a la consulta, que es lo que se cree que hace
-- una vista. Requiere PostgreSQL 15+ (el proyecto va por 17.6).
--
-- 2) "Student update own metrics"
-- -----------------------------
-- progress y attendance los escribe el admin (StudentDetail.jsx, que
-- ademas esta gateado por rol). La politica dejaba que el alumno
-- hiciese PATCH de su propia fila y se pusiera progress 100 /
-- attendance 100 sin haber dado una sola clase. No hay ningun flujo en
-- la app que actualice metricas desde el perfil del alumno, asi que la
-- politica se elimina en lugar de recortarse.
--
-- 3) "Student own profile update"
-- ------------------------------
-- Mismo patron: ningun componente actualiza profiles (solo se leen
-- id/full_name y id/full_name/email). Con la politica actual el alumno
-- podia reescribir teacher, level, instrument, status o birth_date. Se
-- elimina; si algun dia hace falta editar el perfil, hay que permitirlo
-- columna a columna de forma explicita.
--
-- Idempotente: DROP ... IF EXISTS / CREATE OR REPLACE.
-- =============================================

-- 1. Vista con security_invoker -----------------------------------------
-- DROP + CREATE en vez de CREATE OR REPLACE porque security_invoker es una
-- opcion de la vista y no se puede anadir sobre una vista ya creada. No
-- hay vistas ni otros objetos que dependan de esta (comprobado con
-- pg_depend), asi que el DROP no rompe nada.
DROP VIEW IF EXISTS public.profiles_with_metrics;

CREATE VIEW public.profiles_with_metrics
WITH (security_invoker = true)
AS
SELECT
  p.*,
  COALESCE(sm.progress, 0) AS progress,
  COALESCE(sm.attendance, 100) AS attendance,
  sm.next_lesson
FROM public.profiles p
LEFT JOIN public.student_metrics sm ON sm.student_id = p.id;

-- El GRANT no sobrevive al DROP de la vista.
GRANT SELECT ON public.profiles_with_metrics TO authenticated;

-- 2. Las metricas solo las escribe el admin ------------------------------
DROP POLICY IF EXISTS "Student update own metrics" ON public.student_metrics;

-- 3. El alumno no escribe en profiles ------------------------------------
DROP POLICY IF EXISTS "Student own profile update" ON public.profiles;

-- La lectura del propio perfil se mantiene, pero solo para usuarios
-- autenticados: estaba creada FOR SELECT TO public.
DROP POLICY IF EXISTS "Student own profile select" ON public.profiles;
CREATE POLICY "Student own profile select" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
