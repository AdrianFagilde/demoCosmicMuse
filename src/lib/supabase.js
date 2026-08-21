import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  throw new Error(
    '[Supabase] Faltan variables de entorno: define VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en tu archivo .env',
  )
}

const supabase = createClient(supabaseUrl, supabaseKey)

export default supabase
