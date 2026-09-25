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

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Argentina/Buenos_Aires' })
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
    const desde = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
    const hasta = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()

    const { data: eventos, error: errEventos } = await supabase
      .from('eventos')
      .select('id, coro_id, titulo, tipo, lugar, fecha_inicio')
      .eq('publicado', true)
      .eq('recordatorio_enviado', false)
      .gte('fecha_inicio', desde)
      .lte('fecha_inicio', hasta)

    if (errEventos) throw errEventos

    let totalEnviadas = 0, totalFallidas = 0

    for (const evento of eventos || []) {
      const { data: cantantes } = await supabase
        .from('perfiles')
        .select('id')
        .eq('coro_id', evento.coro_id)
        .in('rol', ['cantante', 'admin', 'director'])
        .eq('estado', 'activo')

      const { data: noAsisten } = await supabase
        .from('asistencias')
        .select('perfil_id')
        .eq('evento_id', evento.id)
        .eq('estado', 'no_asiste')

      const excluidos = new Set((noAsisten || []).map(a => a.perfil_id))
      const destinatarios = (cantantes || [])
        .map(c => c.id)
        .filter(id => !excluidos.has(id))

      if (destinatarios.length === 0) {
        await supabase.from('eventos').update({ recordatorio_enviado: true }).eq('id', evento.id)
        continue
      }

      // Filtramos también por coro_id: una misma persona puede tener
      // notificaciones activadas en más de una app del grupo (canta en
      // varios coros, o son cuentas de prueba), y push_suscripciones
      // guarda una fila por cada app/endpoint. Sin este filtro, el
      // .in('perfil_id', ...) trae TODAS las suscripciones de esa
      // persona, de cualquier coro, y el recordatorio se manda cruzado.
      const { data: suscripciones } = await supabase
        .from('push_suscripciones')
        .select('*')
        .in('perfil_id', destinatarios)
        .eq('coro_id', evento.coro_id)

      const titulo = `Recordatorio: ${evento.titulo}`
      const cuerpo = `Mañana a las ${formatHora(evento.fecha_inicio)}${evento.lugar ? ` en ${evento.lugar}` : ''}.`
      const payload = JSON.stringify({ title: titulo, body: cuerpo })

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

      totalEnviadas += resultados.filter(r => r.status === 'fulfilled').length
      totalFallidas += resultados.filter(r => r.status === 'rejected').length

      await supabase.from('eventos').update({ recordatorio_enviado: true }).eq('id', evento.id)
    }

    return new Response(
      JSON.stringify({ ok: true, eventosProcesados: eventos?.length || 0, totalEnviadas, totalFallidas }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500 })
  }
})
