import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'
import { useAuth } from './useAuth'

function ordenarAudios(audios) {
  const orden = { general: 0, soprano: 1, contralto: 2, tenor: 3, bajo: 4 }
  return (audios || []).sort((a, b) => {
    const vozA = orden[a.voz] ?? 99
    const vozB = orden[b.voz] ?? 99
    return vozA !== vozB ? vozA - vozB : a.parte - b.parte
  })
}

async function cargarAudiosParaObras(obraIds) {
  if (!obraIds.length) return {}
  const { data } = await supabase
    .from('obras_audios')
    .select('id, obra_id, voz, parte, drive_id, etiqueta')
    .in('obra_id', obraIds)
  const mapa = {}
  for (const a of data || []) {
    if (!mapa[a.obra_id]) mapa[a.obra_id] = []
    mapa[a.obra_id].push(a)
  }
  return mapa
}

// ─── Hook principal de repertorio ─────────────────────────────────────────────
export function useObras(filtros = {}) {
  const { usuario } = useAuth()
  const [obras, setObras]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const coro = await getCoroActual()

      let query = supabase
        .from('obras')
        .select(`*, progreso_estudio!left(estado)`)
        .eq('coro_id', coro.id)
        .eq('publicada', true)
        .order('orden', { ascending: true }).order('titulo')

      if (filtros.estado)   query = query.eq('estado', filtros.estado)
      if (filtros.busqueda) {
        query = query.or(
          `titulo.ilike.%${filtros.busqueda}%,compositor.ilike.%${filtros.busqueda}%`
        )
      }

      const { data, error: err } = await query
      if (err) throw err

      const obraIds = (data || []).map(o => o.id)
      const audiosMap = await cargarAudiosParaObras(obraIds)

      const obras = (data || []).map(o => ({
        ...o,
        progreso: o.progreso_estudio?.[0]?.estado || 'pendiente',
        audios: ordenarAudios(audiosMap[o.id] || []),
      }))
      setObras(obras)
    } catch (err) {
      setError('No pudimos cargar el repertorio. Intentá de nuevo.')
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [filtros.estado, filtros.busqueda])

  useEffect(() => { cargar() }, [cargar])

  return { obras, cargando, error, recargar: cargar }
}

// ─── Hook para una obra individual ───────────────────────────────────────────
export function useObra(id) {
  const [obra, setObra]         = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    if (!id) return
    async function cargar() {
      setCargando(true)
      const { data, error: err } = await supabase
        .from('obras')
        .select(`
          *,
          progreso_estudio!left(estado),
          eventos_obras(evento_id, orden, eventos(id, titulo, fecha_inicio))
        `)
        .eq('id', id)
        .eq('publicada', true)
        .single()

      if (err) { setError('Obra no encontrada.'); setCargando(false); return }

      const audiosMap = await cargarAudiosParaObras([id])

      setObra({
        ...data,
        progreso: data.progreso_estudio?.[0]?.estado || 'pendiente',
        eventos: data.eventos_obras?.map(eo => eo.eventos).filter(Boolean) || [],
        audios: ordenarAudios(audiosMap[id] || []),
      })
      setCargando(false)
    }
    cargar()
  }, [id])

  return { obra, cargando, error }
}

// ─── Marcar progreso de estudio ───────────────────────────────────────────────
export async function marcarProgreso(usuarioId, obraId, estado) {
  const { error } = await supabase
    .from('progreso_estudio')
    .upsert({
      perfil_id: usuarioId,
      obra_id: obraId,
      estado,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'perfil_id,obra_id' })

  return { ok: !error, error: error?.message }
}

// ─── CRUD de obras (admin/director) ──────────────────────────────────────────
export async function crearObra(datos) {
  const { audios, ...datosSinAudios } = datos
  const coro = await getCoroActual()
  const { data, error } = await supabase
    .from('obras')
    .insert([{ ...datosSinAudios, coro_id: coro.id, publicada: false }])
    .select()
    .single()
  return { ok: !error, data, error: error?.message }
}

export async function actualizarObra(id, datos) {
  const { audios, ...datosSinAudios } = datos
  const { data, error } = await supabase
    .from('obras')
    .update({ ...datosSinAudios, actualizado_en: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  return { ok: !error, data, error: error?.message }
}

export async function publicarObra(id, publicada) {
  const { error } = await supabase
    .from('obras')
    .update({ publicada })
    .eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function eliminarObra(id) {
  await supabase.from('eventos_obras').delete().eq('obra_id', id)
  await supabase.from('obras_audios').delete().eq('obra_id', id)
  await supabase.from('progreso_estudio').delete().eq('obra_id', id)
  await supabase.from('avisos').update({ obra_id: null }).eq('obra_id', id)
  const { error } = await supabase.from('obras').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

// ─── CRUD de audios ───────────────────────────────────────────────────────────
export async function guardarAudiosObra(obraId, audios) {
  // Intentar borrar audios existentes — ignorar error si no hay o sin permisos
  const { error: errorDelete } = await supabase
    .from('obras_audios')
    .delete()
    .eq('obra_id', obraId)

  if (errorDelete) {
    console.warn('No se pudieron borrar audios previos:', errorDelete.message)
    // No retornar error — intentar insertar igual
  }

  const filas = audios
    .filter(a => a.drive_id?.trim())
    .map(a => ({
      obra_id:  obraId,
      voz:      a.voz,
      parte:    a.parte,
      drive_id: a.drive_id.trim(),
      etiqueta: a.etiqueta?.trim() || null,
    }))

  if (filas.length === 0) return { ok: true }

  const { error: errorInsert } = await supabase
    .from('obras_audios')
    .insert(filas)

  return { ok: !errorInsert, error: errorInsert?.message }
}

// ─── Obtener todas las obras (admin) ─────────────────────────────────────────
export function useObrasAdmin() {
  const [obras, setObras]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const coro = await getCoroActual()
      const { data, error: err } = await supabase
        .from('obras')
        .select('*')
        .eq('coro_id', coro.id)
        .order('orden', { ascending: true }).order('creado_en', { ascending: false })
      if (err) { setError(err.message); setCargando(false); return }

      const obraIds = (data || []).map(o => o.id)
      const audiosMap = await cargarAudiosParaObras(obraIds)

      setObras((data || []).map(o => ({
        ...o,
        audios: ordenarAudios(audiosMap[o.id] || []),
      })))
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { obras, cargando, error, recargar: cargar }
}