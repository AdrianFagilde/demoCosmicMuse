/**
 * Comprueba que la configuracion de Supabase llego al bundle.
 *
 * Motivo: `vite build` no ejecuta el codigo de los modulos, asi que el `throw`
 * de src/lib/supabase.js (que si salta al cargar la app en el navegador) no
 * aborta el build. Sin esta comprobacion, un bundle con `undefined` en lugar de
 * la URL pasaria CI en verde y reventaria en el primer paint.
 *
 * Falla si alguna variable esta definida en el entorno pero no aparece en el
 * bundle, y tambien si se ha colado el mensaje de error de src/lib/supabase.js:
 * eso significaria que el placeholder no se sustituyo.
 *
 * Una variable que no este en process.env no se puede comprobar (Vite la lee de
 * .env, no del entorno del proceso), asi que se avisa y se salta. En CI estan
 * las dos definidas, de modo que ahi la comprobacion es real.
 */
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const OUT_DIR = 'build'
const REQUIRED = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY']

const readJsFiles = async (dir) => {
  const entries = await readdir(dir, { withFileTypes: true })
  const files = await Promise.all(
    entries.map(async (entry) => {
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) return readJsFiles(full)
      return entry.name.endsWith('.js') ? [await readFile(full, 'utf8')] : []
    }),
  )
  return files.flat().join('\n')
}

let bundle
try {
  bundle = await readJsFiles(OUT_DIR)
} catch {
  console.error(`[bundle-env] No existe ${OUT_DIR}/. Ejecuta el build antes de esta comprobacion.`)
  process.exit(1)
}

const configured = REQUIRED.filter((name) => process.env[name])
const unconfigured = REQUIRED.filter((name) => !process.env[name])

if (unconfigured.length > 0) {
  console.warn(
    `[bundle-env] Sin ${unconfigured.join(' y ')} en el entorno: no se pueden comprobar. ` +
      'Es lo normal en local, donde Vite las lee de .env.',
  )
}

const missing = configured.filter((name) => !bundle.includes(process.env[name]))

if (missing.length > 0) {
  console.error(`[bundle-env] Estas variables no llegaron al bundle: ${missing.join(', ')}`)
  process.exit(1)
}

if (bundle.includes('Faltan variables de entorno')) {
  console.error(
    '[bundle-env] El bundle conserva el mensaje de error de src/lib/supabase.js: ' +
      'significa que alguna variable llego vacia y el throw sigue vivo en produccion.',
  )
  process.exit(1)
}

console.log(
  configured.length > 0
    ? `[bundle-env] OK: ${configured.length}/${REQUIRED.length} variables presentes en el bundle.`
    : '[bundle-env] OK (sin comprobacion posible en este entorno).',
)
