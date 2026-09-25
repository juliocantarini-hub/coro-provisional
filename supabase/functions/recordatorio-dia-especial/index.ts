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
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  })
  const partes = fmt.formatToParts(new Date())
  const mes = Number(partes.find(p => p.type === 'month').value)
  const dia = Number(partes.find(p => p.type === 'day').value)
  const esDomingo = partes.find(p => p.type === 'weekday').value === 'Sun'
  return { mes, dia, esDomingo }
}

// ¿Es el domingo número n (1, 2, 3...) del mes?
function esNEsimoDomingo(dia, esDomingo, n) {
  return esDomingo && Math.ceil(dia / 7) === n
}

// Mismas fechas/orden que src/lib/sorpresas.js (diaEspecialHoy), para que el
// push y el banner de la app coincidan.
function diaEspecialHoy({ mes, dia, esDomingo }) {
  if (mes === 3 && dia === 8) {
    return { titulo: '🌸 Recordamos y celebramos a las mujeres del coro. ¡Feliz día!', cuerpo: '' }
  }
  if (mes === 10 && dia === 6) {
    return { titulo: '🎼 ¡Hoy es el día del Director de Coro!', cuerpo: '' }
  }
  if (mes === 11 && dia === 22) {
    return { titulo: '🎶 ¡Feliz Día de la Música!', cuerpo: 'Hoy celebramos lo que más nos une.' }
  }
  if (mes === 12 && dia === 25) {
    return { titulo: '🎄 ¡Feliz Navidad!', cuerpo: 'Que la pasen hermoso junto a los suyos.' }
  }
  if (mes === 1 && dia === 1) {
    return { titulo: '🎆 ¡Feliz Año Nuevo!', cuerpo: 'Que este año esté lleno de música.' }
  }
  if (esNEsimoDomingo(dia, esDomingo, 3) && mes === 6) {
    return { titulo: '👔 ¡Feliz Día del Padre!', cuerpo: 'Un saludo a todos los papás del coro.' }
  }
  if (esNEsimoDomingo(dia, esDomingo, 3) && mes === 10) {
    return { titulo: '💐 ¡Feliz Día de la Madre!', cuerpo: 'Un saludo a todas las mamás del coro.' }
  }
  if (esNEsimoDomingo(dia, esDomingo, 2) && mes === 12) {
    return { titulo: '🎤 ¡Feliz Día del Canto Coral!', cuerpo: 'Hoy celebramos lo que somos: un coro.' }
  }
  return null
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
    const especial = diaEspecialHoy(hoyEnArgentina())

    if (!especial) {
      return new Response(JSON.stringify({ ok: true, especial: false }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      })
    }

    // Sin filtro de coro_id: llega a todos los coros que comparten este proyecto.
    const { data: suscripciones, error } = await supabase.from('push_suscripciones').select('*')
    if (error) throw error

    const payload = JSON.stringify({ title: especial.titulo, body: especial.cuerpo, url: '/' })

    const resultados = await Promise.allSettled(
      (suscripciones || []).map(s =>
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
      JSON.stringify({ ok: true, especial: true, titulo: especial.titulo, enviadas, fallidas }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
