import webpush from 'npm:web-push'
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
    const body = await req.json()

    // Los Database Webhooks de Supabase mandan {type, table, schema, record, old_record}
    // en vez de {coro_id, titulo, cuerpo, url}. Se detecta y se normaliza acá.
    const esWebhookEjercicio = body.table === 'ejercicios_entrenamiento' && !!body.record

    if (esWebhookEjercicio && body.record.activo === false) {
      return new Response(JSON.stringify({ ok: true, omitido: true }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    const coro_id = esWebhookEjercicio ? null : body.coro_id
    const titulo  = esWebhookEjercicio ? `Nuevo ejercicio: ${body.record.nombre}` : body.titulo
    const cuerpo  = esWebhookEjercicio ? 'Ya está disponible en Entrenamiento' : (body.cuerpo || '')
    const url     = esWebhookEjercicio ? '/entrenamiento' : (body.url || '/')

    if (!titulo) {
      return new Response(JSON.stringify({ error: 'Faltan parámetros' }), { status: 400 })
    }

    let query = supabase.from('push_suscripciones').select('*')
    if (coro_id) query = query.eq('coro_id', coro_id)

    const { data: suscripciones, error } = await query

    if (error) throw error

    const payload = JSON.stringify({ title: titulo, body: cuerpo || '', url: url || '/' })

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