import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Recordatorios automáticos de eventos (lo llama pg_cron cada hora).
//
// 1) Día anterior (23 a 25 hs antes), todos los tipos de evento (ensayos incluidos):
//    "Recordatorio: ..." a quienes confirmaron, y un pedido de confirmación a quienes
//    todavía no respondieron. Quien marcó "No podré ir" no recibe nada.
// 2) Una semana antes (entre 2 y 7 días antes), solo conciertos, reuniones y extras:
//    pedido de confirmación a quienes todavía no respondieron.
//    Si el evento se carga con menos de 2 días de anticipación, este aviso no sale
//    (alcanza con el del día anterior).
//
// Cada aviso sale una sola vez por evento (columnas recordatorio_enviado y
// recordatorio_semana_enviado). Al tocar la notificación se abre el evento.

const MULTI_CORO = true

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT')!

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const TZ = 'America/Argentina/Buenos_Aires'
const HORA = 60 * 60 * 1000
const CAMPOS = MULTI_CORO ? 'id, coro_id, titulo, tipo, lugar, fecha_inicio' : 'id, titulo, tipo, lugar, fecha_inicio'

function formatHora(fecha: string) {
  return new Date(fecha).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', timeZone: TZ })
}

function formatDia(fecha: string) {
  const d = new Date(fecha)
  const dia = d.toLocaleDateString('es-AR', { weekday: 'long', timeZone: TZ })
  const num = d.toLocaleDateString('es-AR', { day: 'numeric', month: 'numeric', timeZone: TZ })
  return `${dia} ${num}`
}

function enLugar(evento: any) {
  return evento.lugar ? ` en ${evento.lugar}` : ''
}

async function miembrosActivos(evento: any): Promise<string[]> {
  let q = supabase
    .from('perfiles')
    .select('id')
    .in('rol', ['cantante', 'admin', 'director'])
    .eq('estado', 'activo')
  if (MULTI_CORO) q = q.eq('coro_id', evento.coro_id)
  const { data } = await q
  return (data || []).map((p: any) => p.id)
}

// Estado de "Confirmar asistencia" de cada persona: confirmado, no_asiste o pendiente
async function respuestas(evento: any): Promise<Map<string, string>> {
  const { data } = await supabase
    .from('asistencias')
    .select('perfil_id, estado')
    .eq('evento_id', evento.id)
  return new Map((data || []).map((a: any) => [a.perfil_id, a.estado]))
}

async function enviar(ids: string[], evento: any, aviso: { title: string, body: string }) {
  if (ids.length === 0) return { ok: 0, fallidas: 0 }
  // En proyectos con varios coros se filtra también por coro_id: una persona puede
  // tener la app de más de un coro y cada una guarda su propia suscripción.
  let q = supabase.from('push_suscripciones').select('*').in('perfil_id', ids)
  if (MULTI_CORO) q = q.eq('coro_id', evento.coro_id)
  const { data: suscripciones } = await q

  const payload = JSON.stringify({ ...aviso, url: `/calendario/${evento.id}` })
  const resultados = await Promise.allSettled(
    (suscripciones || []).map((s: any) =>
      webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload
      ).catch(async (err: any) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('push_suscripciones').delete().eq('id', s.id)
        }
        throw err
      })
    )
  )
  return {
    ok: resultados.filter(r => r.status === 'fulfilled').length,
    fallidas: resultados.filter(r => r.status === 'rejected').length,
  }
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
    const ahora = Date.now()
    let totalEnviadas = 0, totalFallidas = 0
    const sumar = (r: { ok: number, fallidas: number }) => { totalEnviadas += r.ok; totalFallidas += r.fallidas }

    // ── 1) Día anterior ──
    const { data: manana, error: err1 } = await supabase
      .from('eventos')
      .select(CAMPOS)
      .eq('publicado', true)
      .eq('recordatorio_enviado', false)
      .gte('fecha_inicio', new Date(ahora + 23 * HORA).toISOString())
      .lte('fecha_inicio', new Date(ahora + 25 * HORA).toISOString())
    if (err1) throw err1

    for (const evento of manana || []) {
      const miembros = await miembrosActivos(evento)
      const resp = await respuestas(evento)
      const recordatorio = {
        title: `Recordatorio: ${evento.titulo}`,
        body: `Mañana a las ${formatHora(evento.fecha_inicio)}${enLugar(evento)}.`,
      }

      const confirmados = miembros.filter(id => resp.get(id) === 'confirmado')
      const sinResponder = miembros.filter(id => !resp.has(id) || resp.get(id) === 'pendiente')
      sumar(await enviar(confirmados, evento, recordatorio))
      sumar(await enviar(sinResponder, evento, {
        title: evento.tipo === 'ensayo' ? 'Mañana ensayamos' : `Mañana: ${evento.titulo}`,
        body: `A las ${formatHora(evento.fecha_inicio)}${enLugar(evento)}. ¿Venís? Tocá para confirmar tu asistencia.`,
      }))

      await supabase.from('eventos').update({ recordatorio_enviado: true }).eq('id', evento.id)
    }

    // ── 2) Una semana antes (no ensayos) ──
    const { data: semana, error: err2 } = await supabase
      .from('eventos')
      .select(CAMPOS)
      .eq('publicado', true)
      .neq('tipo', 'ensayo')
      .eq('recordatorio_semana_enviado', false)
      .gte('fecha_inicio', new Date(ahora + 48 * HORA).toISOString())
      .lte('fecha_inicio', new Date(ahora + 7 * 24 * HORA).toISOString())
    if (err2) throw err2

    for (const evento of semana || []) {
      const miembros = await miembrosActivos(evento)
      const resp = await respuestas(evento)
      const sinResponder = miembros.filter(id => !resp.has(id) || resp.get(id) === 'pendiente')
      sumar(await enviar(sinResponder, evento, {
        title: `¿Venís a ${evento.titulo}?`,
        body: `Es el ${formatDia(evento.fecha_inicio)} a las ${formatHora(evento.fecha_inicio)}${enLugar(evento)}. Tocá para confirmar tu asistencia.`,
      }))
      await supabase.from('eventos').update({ recordatorio_semana_enviado: true }).eq('id', evento.id)
    }

    return new Response(
      JSON.stringify({
        ok: true,
        eventosDiaAnterior: manana?.length || 0,
        eventosSemana: semana?.length || 0,
        totalEnviadas, totalFallidas,
      }),
      { headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
    )

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as any).message }), { status: 500 })
  }
})
