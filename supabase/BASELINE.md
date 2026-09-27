# Baseline de la base de datos

Estado del esquema de Supabase a 2026-09-26, con `018_realtime_notifications.sql`
escrita pero **pendiente de aplicar**. Sirve para dos cosas distintas, que conviene
no confundir:

- **Detectar drift**: comprobar que las migraciones describen la base entera.
  Para eso no hace falta ningún fichero, se usa `supabase db diff --linked`.
- **Reconstruir la base**: tener un `.sql` independiente al que recurrir si
  algún día hay que levantar el esquema desde cero sin pasar por el CLI. Se
  genera a voluntad con el comando de más abajo y no está versionado; las
  migraciones ya son la fuente de verdad del esquema.

## Estado a 2026-09-26

Las 17 primeras migraciones describen el esquema completo: 26 tablas declaradas en
migraciones, 26 en producción. El inventario de tablas cuadra, pero eso no
demuestra que cuadren columnas, índices, políticas ni triggers; para cerrarlo del
todo, `supabase db diff --linked` debería devolver vacío.

```
schemas presentes : auth, extensions, public, realtime, storage,
                    supabase_migrations, vault   (todos estándar de Supabase)
tablas en public  : 26 declaradas en migraciones, 26 en producción
```

Quedan tres discrepancias conocidas y sin resolver, porque las tres
migraciones están escritas pero pendientes de aplicar:

| Migración | Qué la base real tiene y el repo no | ¿Visible en la app? |
| --------- | ----------------------------------- | ------------------- |
| `018` | La 018 no está en el historial. `notifications` sí está publicada en `supabase_realtime` (habilitada a mano) | No, funciona |
| `019` | Las dos políticas de `messages` siguen tautológicas | **Sí: fuga de mensajes** |
| `020` | Faltan los CHECK de integridad | No, solo limita basura |

La 019 es la urgente: es un fallo de seguridad explotable, no una deriva de
historial. Las otras dos son de mantenimiento. Ver «Cómo se aplican la 018, la
019 y la 020».

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

### Cómo se aplica la 018

**Todavía no se ha aplicado.** Pasos, en este orden:

1. Pegar `supabase/migrations/018_realtime_notifications.sql` en el SQL Editor y
   ejecutarlo, o `supabase db push` si el proyecto está enlazado. Es
   idempotente (ver más abajo), así que aplicarla dos veces no rompe nada; si la
   tabla ya está publicada, la migración no hace nada y solo avisa con un NOTICE.
2. Registrar el historial, porque ni el SQL Editor ni una ejecución manual
   añaden la entrada:

```sql
INSERT INTO supabase_migrations.schema_migrations (version, name, statements)
VALUES ('18', 'realtime_notifications', ARRAY[]::text[])
ON CONFLICT (version) DO NOTHING;
```

Equivale a `supabase migration repair --status applied 18 --linked`. Aquí sí
que `db push` es la vía correcta en el paso 1, a diferencia de la 017, porque al
ser idempotente no hay riesgo de reejecutar algo destructivo.

Comprobación, de solo lectura y sin riesgo en el SQL Editor:

```sql
SELECT pubname, schemaname, tablename
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND tablename = 'notifications';
```

Una fila significa que está publicada. Cero filas significa que las
notificaciones in-app no llegan en vivo, aunque la campana y los toasts
parezcan funcionar: se estarían actualizando solo al recargar.

### Cómo se aplican la 019 y la 020

Ninguna de las dos está aplicada, y la 019 es urgente. Aplicar en este orden:
**019 antes que 020**, aunque sean independientes.

Las dos son idempotentes, así que a diferencia de la 017 el paso 1 puede ser
`supabase db push` sin riesgo. Pasos para cada una:

1. `supabase db push` (o pegar el fichero en el SQL Editor).
2. Registrar el historial:
   `supabase migration repair --status applied 19 --linked` y luego
   `--status applied 20 --linked`.

**Comprobación de la 019.** La tautología es visible sin ejecutar nada de la
aplicación, así que esta consulta debe devolver dos filas y en ambas el
`qual` debe mencionar `messages.conversation_id`:

```sql
SELECT polname, polcmd, polqual
FROM pg_policy
WHERE polrelid = 'public.messages'::regclass
  AND polcmd IN ('r', 'a')
ORDER BY polname;
```

Si `polqual` sale como `(cp.conversation_id = cp.conversation_id)`, la 019 no
está aplicada. Si sale `((deleted_at IS NULL) AND (EXISTS (SELECT 1 FROM
conversation_participants cp WHERE ((cp.conversation_id =
messages.conversation_id) AND (cp.user_id = auth.uid()))))`, sí.

**Comprobación de la 020.** Los tres CHECK deben aparecer como
`convalidated = false`, que es lo esperado al estar `NOT VALID`:

```sql
SELECT conname, convalidated
FROM pg_constraint
WHERE conname IN (
  'form_answers_one_value_per_answer',
  'practice_sessions_single_task_ref',
  'practice_sessions_metronome_bpm_range'
);
```

Que salga `false` no es un error: significa que solo protegen las filas nuevas.
Para que protejan también las existentes hay que sanear primero los outliers y
luego `ALTER TABLE ... VALIDATE CONSTRAINT ...`, que es un paso aparte y no
urgente.

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
registra. Las idempotentes son la excepción deliberada: 018, 019 y 020 solo
hacen `DROP`/`CREATE` sobre políticas y constraints, o consultan el catálogo
antes de actuar, así que repetirlas es inofensivo. Las demás no son idempotentes
y no deberían serlo: que una migración "se pueda repetir" no es una garantía,
es una casualidad de cómo estuvo escrita.

La 017 es el ejemplo de por qué. Su `CREATE OR REPLACE FUNCTION` sobre
`get_next_badges` declaraba un tipo de retorno distinto al que ya tenía, y
PostgreSQL aborta con `42P13` sin aviso previo. Las nueve sentencias
anteriores del fichero ya se habían aplicado. Reejecutar no habría
"arreglado" nada.

La 018 es el contraejemplo deliberado: envuelve su única sentencia en un
`DO $$ ... $$` que consulta `pg_publication_tables` antes de tocar nada, de
modo que repetirla es inofensivo. La razón de que sea segura es que no
contiene ninguna operación irreversible ni dependiente del orden; si alguna
migración futura necesita el mismo tratamiento, el patrón es ese, no el
`CREATE OR REPLACE` a pelo.

Si una migración se aplicó a mano y falló a medias, la única salida limpia es
`BEGIN`/`COMMIT` alrededor del fichero completo, o deshacerla a mano.

| Migración                            | Contenido                                                                                                |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `001_initial_schema.sql`             | Tablas base: `profiles`, `lessons`, `tasks`, `payments`, `payment_reminders`, `notification_log`, `instruments`; RLS inicial; `handle_new_user` |
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
| `016_security_fixes.sql`             | Endurecimiento de los RPC de mensajería y de práctica, anti-spam en notificaciones, límites de XP |
| `017_security_corrections.sql`       | Correcciones de la auditoría actual (ver abajo)                                                          |
| `018_realtime_notifications.sql`     | Publica `notifications` en `supabase_realtime` (idempotente)                                              |
| `019_fix_messaging_rls_policies.sql`  | Corrije dos políticas de `messages` tautológicas (idempotente)                                          |
| `020_integrity_constraints.sql`       | CHECK constraints que faltaban en `form_answers` y `practice_sessions` (idempotente)                    |

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
5. **Insignias y nivel**, cuatro cosas distintas:
   - `student_badges.student_id` es `NOT NULL` mientras `tasks.student_id` no
     lo es, de modo que completar una tarea sin asignar abortaba el `UPDATE`
     del administrador con `23502`.
   - `check_course_completion_badges` otorgaba `first_course` al marcar **un
     solo** item del checklist: el trigger era `AFTER INSERT` pero la guardia
     leía `OLD`, así que la condición se cumplía siempre. Ahora el curso solo
     cuenta como completado con el 100 % de los items de todos sus
     `course_task`.
   - `get_next_badges` tenía un error en el subquery de progreso de
     `first_course`: era un subquery escalar con `GROUP BY` y sin agregado, así
     que devolvía una fila por curso y abortaba con *"more than one row
     returned"* para alumnos con dos o más cursos. Su `HAVING` comparaba
     `COUNT(tci.id)` con `COUNT(cp.item_id)` sobre un `INNER JOIN` donde
     `cp.item_id` nunca es `NULL`, o sea que siempre era cierto.
   - El nivel se calculaba con `SQRT(integer/integer)`, que trunca a 0, así que
     se quedaba en 1 hasta 10000 XP. Ahora es `FLOOR(SQRT(xp::numeric/100)) + 1`:
     nivel 2 a los 100 XP, 3 a los 400, 4 a los 900.

6. **Contrato de `get_next_badges`**: la 017 mantiene el
   `RETURNS TABLE(badge_key, badge_name, badge_description, progress, target)`
   que fijó la 016. Un borrador anterior devolvía `jsonb`, lo que obliga a
   `DROP FUNCTION` porque PostgreSQL no admite cambiar el tipo de retorno con
   `CREATE OR REPLACE`. Ese borrador además devolvía un resumen de
   gamificación en vez de las siguientes insignias, con lo que el nombre
   dejaba de describir lo que hacía.

## Qué hace la 018

No corrige un fallo de seguridad: cierra una deriva entre el esquema
versionado y la base real. `useSupabaseUserNotifications` se suscribe a
`postgres_changes` sobre `public.notifications` filtrando por `recipient_id`,
pero ninguna migración publicaba esa tabla, así que la suscripción no
recibía nada. Se había arreglado habilitándola a mano desde el panel de
Supabase, lo que hacía que `supabase db diff` no puddle detectarla: no es una
tabla ni una columna, es un miembro de una publicación.

La consecuencia de que faltara era silenciosa. La campana del header, los
toasts y la bandeja seguían funcionando; solorecebían las actualizaciones
por otras vías (recargar la página, marcar algo como leído), así que nada
parecía roto. Por eso la comprobación de la sección anterior es de solo
lectura y se puede pegar en el SQL Editor sin riesgo.

## Qué hace la 019

Corrige un fallo de seguridad real, y el más serio que se ha encontrado en la
auditoría: dos políticas de `messages` que en la 014 quedaron tautológicas.

La 014 las escribió con una columna sin qualificar dentro de un subquery:

```sql
WHERE cp.conversation_id = conversation_id AND cp.user_id = auth.uid()
```

En PostgreSQL una referencia sin qualificar se resuelve al scope más cercano,
así que `conversation_id` era `cp.conversation_id` y la comparación quedaba
`cp.conversation_id = cp.conversation_id`: siempre verdadera. La 016 arregló
los cinco RPC de mensajería pero no redefinió estas dos políticas, solo la de
`DELETE`, así que el fallo sobrevivió a la revisión anterior.

Lo que permitía, sin necesitar ninguna interfaz:

- **Leer**: el filtro se reducía a "participo en alguna conversación", así que
  cualquier usuario autenticado podía listar los mensajes de todas las
  conversaciones del centro.
- **Escribir**: `sender_id = auth.uid()` seguía exigiendo identidad propia,
  pero el `EXISTS` ya no acotaba `conversation_id`, así que se podía insertar en
  cualquier conversación. Es decir: leer una conversación ajena y
  thereinjectarse.

Que la mensajería no tenga interfaz no lo mitiga. PostgREST expone todo el
esquema `public` y la anon key va dentro del bundle, o sea que es pública:
bastaba `supabase.from('messages').select()` desde la consola del navegador.

La 019 también añade el filtro `deleted_at IS NULL` que faltaba en la política
SELECT. `get_conversation_messages` ya lo aplicaba, así que las dos formas de
leer no coincidían y una lectura directa devolvía los mensajes "borrados".

## Qué hace la 020

No corrige un fallo de seguridad ni cambia el modelo: añade CHECK constraints
donde el esquema admitía estados sin sentido, para que un bug de cliente no
pueda escribir basura en la base. Los triggers de 013/016 ya gestionan la
lógica de negocio (XP, rachas, insignias); esto va una capa más abajo.

- `form_answers`: es EAV con cinco columnas de valor, todas nullable. Nada
  impedía guardar `value_text` y `value_number` a la vez. Un CHECK no puede
  consultar `form_questions.type` (no admite subqueries), así que se limita a
  exigir que como mucho una de las cuatro esté puesta. Permitir las cuatro a
  NULL es correcto: es una pregunta sin responder.
- `practice_sessions`: apunta a dos tablas de tareas distintas (`tasks` legacy y
  `course_tasks`) y ambos campos son nullable sin restricción, así que una
  sesión podía no apuntar a ninguna o apuntar a las dos, y en ambos casos es
  ambigua.
- `practice_sessions.metronome_bpm`: era texto libre. La 016 acota el XP a 120
  minutos para frenar el farm, pero no el propio valor, así que se podía
  guardar cualquier número.

Van como `NOT VALID` a propósito: PostgreSQL no las contrasta contra las filas
existentes, de modo que la migración no falla aunque haya datos legacy que no
las cumplan, y siguen aplicándose a toda escritura nueva. Una vez saneados los
outliers, `ALTER TABLE ... VALIDATE CONSTRAINT ...` las activa también para las
viejas.

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
