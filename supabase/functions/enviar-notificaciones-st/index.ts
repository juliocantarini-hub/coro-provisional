import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
      }
    })
  }

  try {
    const { titulo, cuerpo } = await req.json()

    if (!titulo) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 })
    }

    const { data: suscripciones, error } = await supabase
      .from('push_suscripciones')
      .select('*')

    if (error) throw error

    const payload = JSON.stringify({ title: titulo, body: cuerpo || '' })

    const resultados = await Promise.allSettled(
      suscripciones.map(s =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload
        ).catch(async (err) => {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await supabase.from('push_suscripciones').delete().eq('id', s.id)
          }
          throw err
        })
      )
    )

    const enviadas = resultados.filter(r => r.status === 'fulfilled').length
    const fallidas = resultados.filter(r => r.status === 'rejected').length

    return new Response(
      JSON.stringify({ ok: true, enviadas, fallidas }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})