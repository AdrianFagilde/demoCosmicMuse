import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    // Supabase inyecta SUPABASE_SERVICE_ROLE_KEY automáticamente;
    // se mantiene el fallback al nombre legado por compatibilidad.
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!serviceRoleKey) {
      console.error('create-student: falta SUPABASE_SERVICE_ROLE_KEY en el entorno')
      return json({ error: 'Error de configuración del servidor' }, 500)
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)

    const { data: caller, error: callerError } = await admin.auth.getUser(
      authorization.replace('Bearer ', ''),
    )
    if (callerError || !caller.user) {
      return json({ error: 'No autorizado' }, 401)
    }

    const { data: callerProfile } = await admin
      .from('profiles')
      .select('role')
      .eq('id', caller.user.id)
      .single()
    if (callerProfile?.role !== 'admin') {
      return json({ error: 'Solo los administradores pueden crear estudiantes' }, 403)
    }

    const body = await req.json()
    const fullName = String(body.fullName ?? '').trim()
    const email = String(body.email ?? '')
      .trim()
      .toLowerCase()
    const password = String(body.password ?? '')
    const instrument = body.instrument ? String(body.instrument) : null
    const level = body.level ? String(body.level) : null

    if (!fullName || !email || password.length < 6) {
      return json(
        { error: 'Nombre, email y contraseña (mínimo 6 caracteres) son obligatorios' },
        400,
      )
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ error: 'El email no tiene un formato válido' }, 400)
    }

    const baseUsername = fullName
      .toLowerCase()
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/\s+/g, '.')
      .replace(/[^a-z0-9.]/g, '')

    // Garantiza unicidad del username (dos alumnos pueden llamarse igual)
    let username = baseUsername
    const { data: existing } = await admin
      .from('profiles')
      .select('username')
      .ilike('username', `${baseUsername}%`)
    if (existing?.length) {
      const taken = new Set(existing.map((row: { username: string }) => row.username))
      let suffix = 2
      while (taken.has(username)) {
        username = `${baseUsername}${suffix}`
        suffix += 1
      }
    }

    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, username, role: 'student' },
    })
    if (createError) {
      // No exponer mensajes internos de GoTrue (filtran detalles del esquema)
      const msg = /already been registered|already exists|duplicate/i.test(createError.message)
        ? 'Ya existe una cuenta registrada con ese email'
        : 'No se pudo crear la cuenta del estudiante'
      console.error('create-student createUser error:', createError.message)
      return json({ error: msg }, 400)
    }

    // El trigger handle_new_user ya inserta la fila base; este upsert
    // completa instrumento/nivel de forma idempotente.
    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: created.user.id,
        full_name: fullName,
        username,
        email,
        role: 'student',
        instrument,
        level,
      },
      { onConflict: 'id' },
    )
    if (profileError) {
      console.error('create-student profile upsert error:', profileError.message)
      return json({ error: 'La cuenta se creó pero no se pudo completar el perfil' }, 500)
    }

    return json({ userId: created.user.id })
  } catch (_error) {
    return json({ error: 'Error interno del servidor' }, 500)
  }
})
