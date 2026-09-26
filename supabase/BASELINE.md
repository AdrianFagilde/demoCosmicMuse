# Baseline de la base de datos

Estado del esquema de Supabase, verificado tras aplicar la migración
`017_security_corrections.sql`. Sirve para dos cosas distintas, que conviene
no confundir:

- **Detectar drift**: comprobar que las migraciones describen la base entera.
  Para eso no hace falta ningún fichero, se usa `supabase db diff --linked`.
- **Reconstruir la base**: tener un `.sql` independiente al que recurrir si
  algún día hay que levantar el esquema desde cero sin pasar por el CLI. Se
  genera a voluntad con el comando de más abajo y no está versionado; las
  migraciones ya son la fuente de verdad del esquema.

## Estado a 2026-09-25

No hay drift: las 17 migraciones describen el esquema completo. Se comparó el
inventario de tablas y coinciden exactamente, 26 en `public`.

```
schemas presentes : auth, extensions, public, realtime, storage,
                    supabase_migrations, vault   (todos estándar de Supabase)
tablas en public  : 26 declaradas en migraciones, 26 en producción
```

Que cuadren las tablas no demuestra que cuadren columnas, índices, políticas ni
triggers. Para cerrarlo del todo, `supabase db diff --linked` debería devolver
vacío.

### Cómo se aplicó la 017

A mano, desde el SQL Editor, dentro de un `BEGIN`/`COMMIT` explícito. Al
aplicarla así no queda registrada en el historial, porque el registro lo hace
el CLI. Se registró después:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('17', 'security_corrections', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
```

Equivale a `supabase migration repair --status applied 17 --linked`. Si
alguna vez se repite, ese es el procedimiento. Ojo: `db push` **no** es
equivalente, intentaría aplicar el fichero entero otra vez.

## Detectar drift

```bash
# Compara supabase/migrations/ contra el proyecto enlazado
supabase db diff --linked
```

Sin salida significa que las migraciones y la base coinciden. Si devuelve SQL,
hay objetos en la base que no están en las migraciones.

## Generar el snapshot de referencia

```bash
# Solo esquema, sin filas de datos
supabase db dump --linked --schema public -f supabase/baseline/schema-public.sql
```

`db dump` es un `pg_dump`: **solo lee**. No es peligroso contra producción,
pero conviene decirlo porque el documento anterior mezclaba ambos casos. Lo
que sí escribe es `db push`, y ese no se ha ejecutado nunca sobre producción.

Dos avisos sobre el comando:

- **No existe `--schema-only`.** `db dump` vuelca el esquema por defecto; el
  flag para el otro sentido es `--data-only`. Pasarlo da error.
- **`db diff --schema` no toma una ruta de fichero**, sino nombres de esquema
  separados por comas. La variante anterior del documento se lo pasaba como si
  fuera un path.

No hace falta Docker. Las vías `supabase start` + dump local que aparecen en
documentación antigua solo son relevantes si quieres un entorno de pruebas
aislado.

## Orden de aplicación y estado

Las migraciones se aplican **una vez**, en orden numérico, y el CLI las
registra. No son idempotentes por diseño y no deberían serlo: que una
migración "se pueda repetir" no es una garantía, es una casualidad de cómo
estuvo escrita.

La 017 es el ejemplo de por qué. Su `CREATE OR REPLACE FUNCTION` sobre
`get_next_badges` declaraba un tipo de retorno distinto al que ya tenía, y
PostgreSQL aborta con `42P13` sin aviso previo. Las nueve sentencias
anteriores del fichero ya se habían aplicado. Reejecutar no habría
"arreglado" nada.

Si una migración se aplicó a mano y falló a medias, la única salida limpia es
`BEGIN`/`COMMIT` alrededor del fichero completo, o deshacerla a mano.

| Migración                            | Contenido                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql`             | Tablas base: `profiles`, `lessons`, `tasks`, `payments`, `notifications`; RLS inicial; `handle_new_user` |
| `002_add_guardian_fields.sql`        | Datos de tutor/guardian en `profiles`                                                                    |
| `003_add_avatar.sql`                 | Columna de avatar en `profiles`                                                                          |
| `004_rls_self_insert.sql`            | Permite el auto-insert del perfil propio                                                                 |
| `005_ensure_trigger_rls.sql`         | Protege los triggers de la tabla de backup contra escritura directa                                      |
| `006_notifications_table.sql`        | Tabla `notifications` con índices de recipient y unread                                                  |
| `007_security_hardening.sql`         | `is_admin()`, endurecimiento de políticas, endurecimiento de conversaciones                              |
| `008_courses.sql`                    | Cursos, inscripciones, tareas de curso y políticas de lectura                                            |
| `009_course_forms_content.sql`       | Formularios, contenidos y materiales de curso                                                            |
| `010_course_form_tasks.sql`          | Tareas de formulario                                                                                     |
| `011_security_integrity.sql`         | Integridad referencial y políticas de escritura                                                          |
| `012_server_processing.sql`          | `send_due_payment_reminders` y procesamiento en servidor                                                 |
| `013_student_practice_tracking.sql`  | Sesiones de práctica, XP, rachas e insignias                                                             |
| `014_messaging_push.sql`             | Mensajería y suscripciones push (tablas **sin interfaz**)                                                |
| `015_student_practice_dashboard.sql` | Vista de datos para el dashboard de práctica                                                             |
| `016_security_fixes.sql`             | Endurecimiento previo: RLS de `profiles`, notificaciones, borrado de mensajes                            |
| `017_security_corrections.sql`       | Correcciones de la auditoría actual (ver abajo)                                                          |

## Qué corrige la 017

1. **Escape entre cursos**: las políticas de lectura de `course_tasks`,
   `course_forms` y `course_materials` comparaban `e.course_id = course_id` sin
   cualificar, lo que permite a un alumno leer contenido de cursos ajenos.
2. **Reasignación de participación**: `conversation_participants.conversation_id`
   y `user_id` eran escribibles; un alumno podía mover su participación a otra
   conversación. Ahora hay un trigger `BEFORE UPDATE`.
3. **DELETE de mensajes**: la política llamada "User delete own messages"
   estaba declarada `FOR UPDATE` y no existía un `DELETE` real.
4. **Inmutabilidad de notificaciones y perfil**: un alumno podía reescribir el
   texto y el remitente de una notificación recibida, y cambiarse el `email`
   (recibiendo así las alertas de pago ajenas). Son triggers
   `BEFORE UPDATE`, no políticas: una política RLS no puede comparar contra la
   fila anterior, porque `OLD` solo existe dentro de una función de trigger.
5. **Insignias y nivel**: `student_badges.student_id` es `NOT NULL` mientras
   `tasks.student_id` no lo es, de modo que completar una tarea sin asignar
   abortaba el `UPDATE` del administrador. También se corrige el truncamiento
   entero del cálculo de nivel.

## Verificación tras aplicar

Empieza por el **smoke test**, que es la sección 0 de
`supabase/VERIFICACION_017.sql`: una consulta, cinco resultados, cinco `OK`.
Si eso pasa, la 017 está entera.

El fichero está partido en dos bloques, y la separación importa:

- **Bloque A**, solo lectura. Se pega entero en el SQL Editor, sin riesgo.
- **Bloque B**, pruebas funcionales con escritura. **No van en el SQL Editor.**
  Los triggers de la 017 abren con `IF jwt_claims IS NULL THEN RETURN NEW`,
  así que sin JWT no hacen nada, y como el dashboard conecta como `postgres`
  las RLS tampoco frenan. Descomentar ahí el `UPDATE` del email cambiaría el
  email real de un alumno y, como `send_due_payment_reminders` notifica a
  `profiles.email`, sus avisos de pago se irían a otra dirección.

El bloque B necesita `psql`, que sí está instalado en esta máquina. Copia cada
prueba a su propio fichero y lánzalo así:

```bash
psql "<connection-string>" -v ON_ERROR_STOP=0 -f b3.sql
```

`ON_ERROR_STOP=0` es importante: con el valor por defecto, `psql` aborta en el
primer `ERROR` y no llega al `ROLLBACK` final. Cada prueba lleva su
`BEGIN`/`ROLLBACK` y el fichero no tiene ningún `COMMIT`, así que nada queda
guardado tanto si pasa como si falla.

## Rollback

Está al final de `supabase/VERIFICACION_017.sql`: son `DROP TRIGGER` y
`DROP FUNCTION` de los tres triggers nuevos. Las políticas de lectura de la
sección 1 se restauran copiando el texto original de `008`/`009`. Las
correcciones de insignias y nivel no tienen rollback porque son silenciosas y
no afectan funcionalidad visible.
