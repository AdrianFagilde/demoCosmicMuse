# Baseline de la base de datos

Referencia del estado del esquema de Supabase para detectar derivas antes de
aplicar la migración `017_security_corrections.sql`.

## Por qué no se generó automáticamente

El proyecto enlazado (`AdrianFagilde's Project`) es **producción** y contiene
datos reales. No se ha ejecutado ni `supabase db dump` ni `supabase db push`
sobre él, por acuerdo explícito. Tampoco hay Docker en esta máquina, así que
no se pudo levantar un stack local con `supabase start` para volcar un
esquema de referencia.

Lo que sigue es el procedimiento para generarlo cuando haya un entorno de
pruebas, más el inventario obtenido por lectura estática de las migraciones.

## Generar el baseline (requiere un proyecto que NO sea producción)

```bash
# 1. Stack local (necesita Docker Desktop)
supabase start

# 2. Volcar SOLO el esquema, sin filas de datos
supabase db dump --schema-only -f supabase/baseline_001.sql

# 3. Contrastar el dump contra las migraciones
supabase db diff --schema supabase/baseline_001.sql
```

`db diff` debería devolver vacío. Si no lo hace, hay objetos creados a mano
en la base de datos que no están en las migraciones, y eso es exactamente lo
que el baseline sirve para detectar.

Para un entorno de pruebas remoto, sustituye `supabase start` por
`supabase link --project-ref <ref-de-pruebas>`.

## Orden de aplicación y estado

Las migraciones deben aplicarse en orden numérico. Todas son pensadas para
ser idempotentes (`IF NOT EXISTS`, `DROP ... IF EXISTS`, `CREATE OR REPLACE`),
de modo que reejecutar una migración ya aplicada no produce error.

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

Ejecuta `supabase/VERIFICACION_017.sql` completo. Las secciones marcadas
`[REPETIR]` son consultas de solo lectura y se pueden lanzar de una vez. Las
funcionales requieren dos sesiones autenticadas reales y **deben ejecutarse
con un alumno de prueba**, nunca con datos de producción.

```bash
# Estado de migraciones aplicadas
supabase migration list
```

## Rollback

Está al final de `supabase/VERIFICACION_017.sql`: son `DROP TRIGGER` y
`DROP FUNCTION` de los tres triggers nuevos. Las políticas de lectura de la
sección 1 se restauran copiando el texto original de `008`/`009`. Las
correcciones de insignias y nivel no tienen rollback porque son silenciosas y
no afectan funcionalidad visible.
