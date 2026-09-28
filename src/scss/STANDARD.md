# Estándar de diseño

Cómo está montado este proyecto y por qué. Los tokens viven en `style.scss`
(`:root`), los componentes en `_card.scss` y `_form.scss`. Este documento explica
el porqué; el código es la fuente de la verdad para el cómo.

## 1. Espacio

Escala en `:root`, alineada con el mapa `$spacers` de Bootstrap para que
`--space-3` sea literalmente lo mismo que `mb-3` o `p-3`:

| Token       | px  | Uso                                         |
| ----------- | --- | ------------------------------------------- |
| `--space-1` | 4   | Ajuste fino, separación interna de un icono |
| `--space-2` | 8   | Entre elementos de una misma línea          |
| `--space-3` | 16  | Separación entre campos, inset de bloque    |
| `--space-4` | 24  | Padding de tarjeta, ritmo entre subbloques  |
| `--space-5` | 32  | Entre secciones de página                   |
| `--space-6` | 48  | Entre bloques mayores de página             |

Dentro de una tarjeta o un formulario solo se usan `--space-1..4`. `--space-5` y
`--space-6` quedan reservados a separación de secciones de página.

**No se usan las utilidades `m-*`.** Antes el 70% del espaciado de la app era
margen y casi dos tercios era direccional. El margen exterior no depende del
contenido, así que cuando el contenido crece empuja a lo que tiene alrededor en
lugar de fluir. Para separar elementos se usa `gap`, o padding cuando el
contenedor lo necesita. El margen queda para lo que de verdad necesita aire
respecto a su padre.

Nada de píxeles sueltos en código nuevo. Si un valor no está en la escala, esta es
la ocasión para ampliar la escala, no para escribir `13px`.

## 2. Tarjeta

Una sola tarjeta: `.app-card`, definida en `_card.scss` y cargada globalmente
desde `style.scss`. Todo `CCard` de contenido lleva `app-card`, sin excepciones.

`.dash-card` es exclusiva del dashboard, y el resto de decoración de dashboard
(`journey-*`, `weekly-*`, `progress-ring`, `action-*`) vive en
`components/dashboard/dashboard-styles.css`, que se importa solo desde
`Dashboard.jsx`.

Esto no es solo estética. `app-card` se usó durante mucho tiempo desde
`dashboard-styles.css`, un fichero que solo se carga al entrar en el dashboard. Al
navegar directamente a `/courses` o `/students` las tarjetas salían sin estilo
porque el CSS no existía en el chunk. Cualquier componente compartido necesita sus
estilos en una hoja global.

## 3. Ornamento

Opt-in, nunca opt-out. Los marcos de esquina se aplican solo a `.kpi-card` y a las
piezas de marca que ya tienen arte propio (bienvenida, racha, XP, journey).

Antes estaba al revés: `.card:not(...)` con una lista de seis excepciones
escritas a mano. Eso obliga a mantener la lista al añadir cualquier tarjeta nueva,
y hace que cada superficie decorada se excepcione una por una.

Un modal y una tarjeta de contenido corriente no llevan adorno.

## 4. Formulario

Un ritmo, en `.form-block` (`_form.scss`):

- Separación entre campos: `--space-3`
- Inset del bloque: `--space-3`
- Campos dentro de un bloque: `mb-2`
- Leyenda: `small fw-semibold`
- Descripción de un checkbox: `small text-body-secondary`, line-height 1.4

Los labels de un mismo grupo se ponen todos igual. Si uno lleva `fw-normal` y otro
no, es un descuido, no una intención.

## 5. Lectura

`--measure-legal` (68ch) para texto largo, `--measure-form` (34rem) para
formularios de autenticación. En móvil, padding lateral siempre.

Sin medida máxima, un párrafo a 100% de ancho tiene líneas de más de 120
caracteres y el ojo se pierde al volver al principio. Las cuatro páginas legales
usaban `container-fluid` sin límite.

## 6. Sin cortes

Prohibido `height` fijo en un contenedor cuyo contenido pueda crecer: se usa
`min-height` más `padding`. Un `height` fijo convierte cualquier texto más largo en
un desborde.

`overflow: hidden` nunca como arreglo: esconde el problema y corta el contenido. Se
arregla la causa, que casi siempre es una altura rígida o un ancho mínimo que no
cede.

Las tablas van dentro de `.table-responsive` y las celdas de contenido usan
`white-space: normal` para que el texto envuelva en lugar de empujar.

Las animaciones de marca (`pulse-ring`, el halo de `.journey-node`) se desactivan
bajo `prefers-reduced-motion: reduce`.

## 7. Tipografía

Se reutilizan las utilidades `fs-*` y `small` de CoreUI. Los radios de borde y los
colores salen de las variables `--cui-*` que CoreUI ya expone en `:root`
(`--cui-border-radius-sm` a `--cui-border-radius-xxl`): no se duplican tokens que
la librería ya publica.

Evitar valores de `font-size` sueltos; si hace falta un tamaño que no existe, se
añade el token antes que el literal.
