# baseline/

Este directorio está vacío a propósito.

Aquí se puede dejar el volcado del esquema como `.sql` independiente:

```bash
supabase db dump --linked --schema public -f supabase/baseline/schema-public.sql
```

No está versionado, y no hace falta que lo esté. `supabase/migrations/` ya
describe el esquema completo y es lo que se aplica; un volcado de 26 tablas
duplicaría esa información y empezaría a quedarse viejo en cuanto cambiara
algo. El valor de generarlo es puntual: tener una referencia el día que haya
que reconstruir la base sin depender del CLI.

Para lo mismo pero de verdad, mira `supabase/BASELINE.md`, que explica la
diferencia entre detectar drift (`supabase db diff --linked`, no necesita
ningún fichero) y guardar un snapshot de recuperación.
