import { createClient } from 'npm:@supabase/supabase-js@2'
import {
  setVapidDetails,
  sendNotification,
  WebPushError,
} from 'npm:web-push@3.6.7'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })

type PushRow = {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authorization = req.headers.get('Authorization') ?? ''
    const serviceRoleKey =
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY') ?? ''
    if (!serviceRoleKey) {
      console.error('send-push-notification: falta SUPABASE_SERVICE_ROLE_KEY en el entorno')
      return json({ error: 'Error de configuración del servidor' }, 500)
    }
    const admin = createClient(Deno.env.get('SUPABASE_URL') ?? '', serviceRoleKey)

    const vapidPublic = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
    const vapidPrivate = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
    const vapidSubject = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@example.com'
    if (!vapidPublic || !vapidPrivate) {
      console.error('send-push-notification: faltan VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY')
      return json({ error: 'Notificaciones push no configuradas' }, 500)
    }
    setVapidDetails(vapidSubject, vapidPublic, vapidPrivate)

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
    const isAdmin = callerProfile?.role === 'admin'

    const body = await req.json()
    const title = String(body?.title ?? '').trim()
    const message = String(body?.body ?? body?.message ?? '').trim()
    const url = body?.data?.url ? String(body.data.url) : null
    const target: string[] = []
    if (Array.isArray(body?.userIds)) {
      target.push(...body.userIds.map((id: unknown) => String(id)))
    } else if (body?.userId) {
      target.push(String(body.userId))
    }

    if (!title || !message) {
      return json({ error: 'Faltan title y body' }, 400)
    }
    if (!target.length) {
      return json({ error: 'Falta el usuario destinatario' }, 400)
    }
    // Un usuario solo puede enviarse push a sí mismo (p. ej. prueba);
    // el admin puede enviar a cualquiera.
    if (!isAdmin && (target.length !== 1 || target[0] !== caller.user.id)) {
      return json({ error: 'No autorizado' }, 403)
    }

    const { data: subscriptions, error: subsError } = await admin
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .in('user_id', target)
    if (subsError) {
      console.error('send-push-notification: query error:', subsError.message)
      return json({ error: 'Error consultando suscripciones' }, 500)
    }

    if (!subscriptions || subscriptions.length === 0) {
      return json({ ok: true, sent: 0, subscribed: false })
    }

    const payload = JSON.stringify({ title, body: message, data: url ? { url } : {} })
    let sent = 0
    const staleIds: string[] = []

    await Promise.all(
      (subscriptions as PushRow[]).map(async (sub) => {
        const subscription = {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        }
        try {
          await sendNotification(subscription, payload)
          sent += 1
        } catch (err) {
          if (err instanceof WebPushError) {
            // 404/410: la suscripción ya no es válida (navegador la revocó)
            if (err.statusCode === 404 || err.statusCode === 410) {
              staleIds.push(sub.id)
              console.error(`send-push-notification: suscripción obsoleta ${sub.endpoint}`)
              return
            }
          }
          console.error('send-push-notification: error enviando:', (err as Error).message)
        }
      }),
    )

    if (staleIds.length) {
      await admin.from('push_subscriptions').delete().in('id', staleIds)
    }

    return json({ ok: true, sent, subscribed: subscriptions.length > 0 })
  } catch (_error) {
    return json({ error: 'Error interno del servidor' }, 500)
  }
})