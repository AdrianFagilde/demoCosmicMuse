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
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!serviceRoleKey) {
      console.error('delete-user: falta SUPABASE_SERVICE_ROLE_KEY en el entorno')
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
      return json({ error: 'Solo los administradores pueden eliminar usuarios' }, 403)
    }

    const body = await req.json()
    const userId = String(body?.userId ?? '').trim()
    if (!userId) {
      return json({ error: 'Falta el identificador del usuario' }, 400)
    }

    // No permitirse borrarse a sí mismo
    if (caller.user.id === userId) {
      return json({ error: 'No puedes eliminar tu propia cuenta desde aquí' }, 400)
    }

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId)
    if (deleteError) {
      console.error('delete-user error:', deleteError.message)
      return json({ error: 'No se pudo eliminar la cuenta del usuario' }, 500)
    }

    // El perfil (y sus dependencias con CASCADE) se elimina vía la FK
    // profiles.id -> auth.users.id ON DELETE CASCADE.
    return json({ ok: true })
  } catch (_error) {
    return json({ error: 'Error interno del servidor' }, 500)
  }
})