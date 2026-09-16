import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

export function useEventos(filtros = {}) {
  const [eventos, setEventos]   = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const coro = await getCoroActual()
      let query = supabase
        .from('eventos')
        .select(`*, eventos_obras(obra_id, orden, obras(id, titulo, compositor)), asistencias!left(estado, perfil_id)`)
        .eq('coro_id', coro.id)
        .eq('publicado', true)
        .order('fecha_inicio', { ascending: true })

      if (filtros.tipo) query = query.eq('tipo', filtros.tipo)
      if (filtros.soloFuturos !== false) {
        query = query.gte('fecha_inicio', new Date().toISOString())
      }
      if (filtros.mes) {
        const inicio = new Date(filtros.anio, filtros.mes, 1).toISOString()
        const fin    = new Date(filtros.anio, filtros.mes + 1, 0, 23, 59, 59).toISOString()
        query = query.gte('fecha_inicio', inicio).lte('fecha_inicio', fin)
      }

      const { data, error: err } = await query
      if (err) throw err
      setEventos(data || [])
    } catch (err) {
      setError('No pudimos cargar el calendario. Intentá de nuevo.')
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [filtros.tipo, filtros.mes, filtros.anio, filtros.soloFuturos])

  useEffect(() => { cargar() }, [cargar])
  return { eventos, cargando, error, recargar: cargar }
}

export function useEvento(id) {
  const [evento, setEvento]     = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    if (!id) return
    setCargando(true)
    try {
      const coro = await getCoroActual()

      // Query principal
      const { data, error: err } = await supabase
        .from('eventos')
        .select('*, eventos_obras(obra_id, orden, obras(id, titulo, compositor, estado))')
        .eq('id', id)
        .eq('coro_id', coro.id)
        .single()

      if (err) { setError('Evento no encontrado.'); setCargando(false); return }

      // Query asistencias sin join a perfiles (FK compuesta no lo permite)
      const { data: asistencias } = await supabase
        .from('asistencias')
        .select('estado, perfil_id')
        .eq('evento_id', id)

      // Query perfiles del coro por separado
      const perfilIds = (asistencias || []).map(a => a.perfil_id)
      let perfilesMap = {}
      if (perfilIds.length > 0) {
        const { data: perfiles } = await supabase
          .from('perfiles')
          .select('id, nombre, voz')
          .eq('coro_id', coro.id)
          .in('id', perfilIds)
        ;(perfiles || []).forEach(p => { perfilesMap[p.id] = p })
      }

      // Combinar asistencias con perfiles
      const asistenciasConPerfil = (asistencias || []).map(a => ({
        ...a,
        perfiles: perfilesMap[a.perfil_id] || null,
      }))

      setEvento({ ...data, asistencias: asistenciasConPerfil })
      setCargando(false)
    } catch (err) {
      setError('Evento no encontrado.')
      setCargando(false)
    }
  }, [id])

  useEffect(() => { cargar() }, [cargar])
  return { evento, cargando, error, recargar: cargar }
}

export function useEventosAdmin() {
  const [eventos, setEventos]   = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    const { data, error: err } = await supabase
      .from('eventos')
      .select(`*, asistencias(estado)`)
      .eq('coro_id', coro.id)
      .order('fecha_inicio', { ascending: false })
    if (err) { setError(err.message); setCargando(false); return }
    setEventos(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { eventos, cargando, error, recargar: cargar }
}

export async function confirmarAsistencia(eventoId, perfilId, estado) {
  const { error } = await supabase
    .from('asistencias')
    .upsert(
      { evento_id: eventoId, perfil_id: perfilId, estado, actualizado: new Date().toISOString() },
      { onConflict: 'evento_id,perfil_id' }
    )
  return { ok: !error, error: error?.message }
}

export async function obtenerMiAsistencia(eventoId, perfilId) {
  const { data } = await supabase
    .from('asistencias')
    .select('estado')
    .eq('evento_id', eventoId)
    .eq('perfil_id', perfilId)
    .maybeSingle()
  return data?.estado || 'pendiente'
}

export async function crearEvento(datos, obraIds = []) {
  const coro = await getCoroActual()
  const { data, error } = await supabase
    .from('eventos')
    .insert([{ ...datos, coro_id: coro.id, publicado: false }])
    .select()
    .single()

  if (error) return { ok: false, error: error.message }

  if (obraIds.length > 0) {
    await supabase.from('eventos_obras').insert(
      obraIds.map((obraId, i) => ({ evento_id: data.id, obra_id: obraId, orden: i }))
    )
  }
  return { ok: true, data }
}

export async function actualizarEvento(id, datos, obraIds) {
  const { data, error } = await supabase
    .from('eventos')
    .update(datos)
    .eq('id', id)
    .select()

  if (error) return { ok: false, error: error.message }
  const eventoData = data?.[0]

  if (obraIds !== undefined) {
    await supabase.from('eventos_obras').delete().eq('evento_id', id)
    if (obraIds.length > 0) {
      await supabase.from('eventos_obras').insert(
        obraIds.map((obraId, i) => ({ evento_id: id, obra_id: obraId, orden: i }))
      )
    }
  }
  return { ok: true, data: eventoData }
}

export async function publicarEvento(id, publicado) {
  const { error } = await supabase.from('eventos').update({ publicado }).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function eliminarEvento(id) {
  await supabase.from('avisos_eventos').delete().eq('evento_id', id)
  const { error } = await supabase.from('eventos').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

export function formatFecha(iso, opciones = {}) {
  if (!iso) return ''
  const fecha = new Date(iso)
  return fecha.toLocaleDateString('es-AR', {
    weekday: opciones.conDia ? 'long' : undefined,
    day: 'numeric',
    month: opciones.corto ? 'short' : 'long',
    year: opciones.conAnio ? 'numeric' : undefined,
    ...opciones,
  })
}

export function formatHora(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export function esFuturo(iso) {
  return iso && new Date(iso) > new Date()
}

export function diasRestantes(iso) {
  if (!iso) return null
  const diff = new Date(iso) - new Date()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}
