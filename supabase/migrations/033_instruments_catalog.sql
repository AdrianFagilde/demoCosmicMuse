-- =============================================
-- 033 CATALOGO DE INSTRUMENTOS
--
-- Reemplaza la lista sembrada en la 001 por la lista vigente:
--   Piano, Violin, Cuatro, Guitarra, Canto, Bajo, Arpa, Flauta
--
-- Los nombres se guardan sin emoji (el emoji es solo presentacion y se
-- resuelve en el frontend con formatInstrument()). No hay FKs hacia
-- instruments: profiles.instrument y lessons.instrument son TEXT, asi que
-- borrar las filas antiguas es seguro.
--
-- Idempotente: INSERT ... WHERE NOT EXISTS + DELETE de lo que no este en la lista.
-- =============================================

-- 1. Alta de los instrumentos vigentes.
INSERT INTO public.instruments (name)
SELECT v.name
FROM (VALUES
  ('Piano'),
  ('Violín'),
  ('Cuatro'),
  ('Guitarra'),
  ('Canto'),
  ('Bajo'),
  ('Arpa'),
  ('Flauta')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM public.instruments i WHERE i.name = v.name
);

-- 2. Baja de los instrumentos que ya no estan en el catalogo.
DELETE FROM public.instruments
WHERE name NOT IN (
  'Piano',
  'Violín',
  'Cuatro',
  'Guitarra',
  'Canto',
  'Bajo',
  'Arpa',
  'Flauta'
);
