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

// Fecha de hoy en huso horario Argentina (el servidor de Supabase corre en UTC)
function hoyEnArgentina() {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires',
    month: '2-digit',
    day: '2-digit'
  })
  const partes = fmt.formatToParts(new Date())
  const mes = partes.find(p => p.type === 'month').value
  const dia = partes.find(p => p.type === 'day').value
  return { mes, dia }
}

async function enviarATodos(suscripciones, titulo, cuerpo) {
  const payload = JSON.stringify({ title: titulo, body: cuerpo })
  return Promise.allSettled(
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
}

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
    const { mes, dia } = hoyEnArgentina()

    const { data: perfiles, error } = await supabase
      .from('perfiles')
      .select('id, nombre, coro_id, fecha_nacimiento')
      .eq('estado', 'activo')
      .not('fecha_nacimiento', 'is', null)

    if (error) throw error

    // fecha_nacimiento viene como 'YYYY-MM-DD'
    const cumpleaneros = (perfiles || []).filter(p => {
      const partes = p.fecha_nacimiento.split('-')
      return partes[1] === mes && partes[2] === dia
    })

    let enviadas = 0
    let fallidas = 0

    for (const persona of cumpleaneros) {

      // Al resto del coro (si el proyecto es multi-tenant filtra por coro_id; si no, va a todo el proyecto)
      let queryResto = supabase.from('push_suscripciones').select('*').neq('perfil_id', persona.id)
      if (persona.coro_id) queryResto = queryResto.eq('coro_id', persona.coro_id)
      const { data: susResto } = await queryResto
      const r1 = await enviarATodos(
        susResto || [],
        `🎂 ¡Hoy es el cumpleaños de ${persona.nombre}!`,
        'Mandale un saludo 🎉'
      )

      // Mensaje personal al cumpleañero
      const { data: susPersona } = await supabase
        .from('push_suscripciones')
        .select('*')
        .eq('perfil_id', persona.id)
      const r2 = await enviarATodos(
        susPersona || [],
        `🎂 ¡Feliz cumpleaños, ${persona.nombre}!`,
        'Todo el coro te desea un gran día 🎉'
      )

      enviadas += [...r1, ...r2].filter(r => r.status === 'fulfilled').length
      fallidas += [...r1, ...r2].filter(r => r.status === 'rejected').length
    }

    return new Response(
      JSON.stringify({ ok: true, cumpleaneros: cumpleaneros.length, enviadas, fallidas }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
