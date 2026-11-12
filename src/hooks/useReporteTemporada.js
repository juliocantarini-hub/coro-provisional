import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// ─────────────────────────────────────────────────────────────────────────────
// Reporte de fin de temporada — lado cantante.
// La RLS solo deja leer los reportes propios ya publicados, así que no hace
// falta filtrar por estado acá (se filtra igual, por claridad).
// ─────────────────────────────────────────────────────────────────────────────

export function useMisTemporadas(perfilId) {
  const [reportes, setReportes] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    if (!perfilId) { setReportes([]); setCargando(false); return }
    try {
      const coro = await getCoroActual()
      if (!coro) { setReportes([]); return }
      const { data, error } = await supabase
        .from('reportes_temporada')
        .select('*')
        .eq('coro_id', coro.id)
        .eq('perfil_id', perfilId)
        .eq('estado', 'publicado')
        .order('temporada', { ascending: false })
      if (error) throw error
      setReportes(data || [])
    } catch (err) {
      // Si la tabla todavía no existe en este proyecto, simplemente no hay reportes
      console.warn('Reporte de temporada:', err?.message || err)
      setReportes([])
    } finally {
      setCargando(false)
    }
  }, [perfilId])

  useEffect(() => { cargar() }, [cargar])

  return { reportes, cargando, recargar: cargar }
}

export async function cargarReporte(id) {
  const { data, error } = await supabase.from('reportes_temporada').select('*').eq('id', id).maybeSingle()
  if (error) return { ok: false, error: error.message }
  return { ok: !!data, data }
}

export async function marcarReporteVisto(id) {
  try { await supabase.rpc('marcar_reporte_temporada_visto', { p_id: id }) } catch { /* no es grave */ }
}

// ¿Hay que destacar este reporte en Inicio? (tarjeta arriba de todo)
export function seDestacaHoy(reporte) {
  if (!reporte) return false
  if (!reporte.destacar_hasta) return true
  const hoy = new Date()
  const hoyIso = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  return hoyIso <= reporte.destacar_hasta
}

// Pantalla de bienvenida "Tu temporada está lista": una sola vez por reporte.
// Si la cierra sin abrirlo, no se vuelve a forzar (queda la tarjeta en Inicio).
const CLAVE_AVISO = 'corum_temporada_aviso_'
export function avisoYaMostrado(id) {
  try { return localStorage.getItem(CLAVE_AVISO + id) === '1' } catch { return false }
}
export function marcarAvisoMostrado(id) {
  try { localStorage.setItem(CLAVE_AVISO + id, '1') } catch { /* sin storage */ }
}

// ─────────────────────────────────────────────────────────────────────────────
// Lado director
// ─────────────────────────────────────────────────────────────────────────────

export async function listarReportesCoro(temporada) {
  const coro = await getCoroActual()
  if (!coro) return { ok: false, error: 'No se encontró el coro' }
  const { data, error } = await supabase
    .from('reportes_temporada')
    .select('*')
    .eq('coro_id', coro.id)
    .eq('temporada', temporada)
  if (error) return { ok: false, error: error.message }
  return { ok: true, data: data || [] }
}

export async function generarReportes(temporada, desde, hasta, perfilId = null) {
  const coro = await getCoroActual()
  if (!coro) return { ok: false, error: 'No se encontró el coro' }
  const { data, error } = await supabase.rpc('generar_reportes_temporada', {
    p_coro_id: coro.id, p_temporada: temporada, p_desde: desde, p_hasta: hasta, p_perfil_id: perfilId,
  })
  if (error) return { ok: false, error: error.message }
  return { ok: true, cantidad: data }
}

export async function actualizarReporte(id, cambios) {
  const { data, error } = await supabase.from('reportes_temporada').update(cambios).eq('id', id).select().single()
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}

export async function enviarPushTemporada(reporte) {
  try {
    const coro = await getCoroActual()
    if (!coro) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: {
        coro_id: coro.id,
        perfil_id: reporte.perfil_id,
        titulo: `Tu temporada ${reporte.temporada} está lista 🎶`,
        cuerpo: 'Entrá a ver tu resumen del año en el coro',
        url: `/temporada/${reporte.id}`,
      },
    })
  } catch (err) {
    console.error('No se pudo enviar la notificación:', err)
  }
}

export async function resumenCoro(desde, hasta) {
  const coro = await getCoroActual()
  if (!coro) return { ok: false, error: 'No se encontró el coro' }
  const { data, error } = await supabase.rpc('reporte_temporada_coro', { p_coro_id: coro.id, p_desde: desde, p_hasta: hasta })
  if (error) return { ok: false, error: error.message }
  return { ok: true, data }
}
