import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// ─── Hook: partituras publicadas (para el cantante, en Entrenamiento) ────────
export function usePartituras() {
  const [partituras, setPartituras] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const coro = await getCoroActual()
      let query = supabase
        .from('partituras_entrenamiento')
        .select('id, titulo, compositor, duracion_seg, creado_en')
        .eq('publicada', true)
        .order('titulo', { ascending: true })

      if (coro) query = query.eq('coro_id', coro.id)

      const { data, error: err } = await query
      if (err) throw err
      setPartituras(data || [])
    } catch (err) {
      setError('No pudimos cargar las partituras. Intentá de nuevo.')
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { partituras, cargando, error, recargar: cargar }
}

// ─── Hook: una partitura individual, con su MusicXML (para reproducirla) ────
export function usePartitura(id) {
  const [partitura, setPartitura] = useState(null)
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState(null)

  useEffect(() => {
    if (!id) return
    let cancelado = false
    async function cargar() {
      setCargando(true)
      const { data, error: err } = await supabase
        .from('partituras_entrenamiento')
        .select('*')
        .eq('id', id)
        .single()
      if (cancelado) return
      if (err) { setError('Partitura no encontrada.'); setCargando(false); return }
      setPartitura(data)
      setCargando(false)
    }
    cargar()
    return () => { cancelado = true }
  }, [id])

  return { partitura, cargando, error }
}

// ─── Admin: catálogo completo (publicadas y no) del coro actual ─────────────
export function usePartiturasAdmin() {
  const [partituras, setPartituras] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    try {
      const coro = await getCoroActual()
      let query = supabase
        .from('partituras_entrenamiento')
        .select('id, titulo, compositor, duracion_seg, publicada, creado_en')
        .order('creado_en', { ascending: false })

      if (coro) query = query.eq('coro_id', coro.id)

      const { data, error: err } = await query
      if (err) { setError(err.message); setCargando(false); return }
      setPartituras(data || [])
    } catch (err) {
      setError(err.message)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { partituras, cargando, error, recargar: cargar }
}

// ─── Admin: CRUD ──────────────────────────────────────────────────────────
export async function crearPartitura({ titulo, compositor, musicxml, duracionSeg }) {
  const coro = await getCoroActual()
  const { data, error } = await supabase
    .from('partituras_entrenamiento')
    .insert([{
      coro_id: coro?.id,
      titulo,
      compositor: compositor?.trim() || null,
      musicxml,
      duracion_seg: duracionSeg || null,
      publicada: false,
    }])
    .select()
    .single()
  return { ok: !error, data, error: error?.message }
}

export async function actualizarPartitura(id, { titulo, compositor, musicxml, duracionSeg }) {
  const payload = { titulo, compositor: compositor?.trim() || null }
  if (musicxml !== undefined) payload.musicxml = musicxml
  if (duracionSeg !== undefined) payload.duracion_seg = duracionSeg || null

  const { error } = await supabase
    .from('partituras_entrenamiento')
    .update(payload)
    .eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function publicarPartitura(id, publicada) {
  const { error } = await supabase
    .from('partituras_entrenamiento')
    .update({ publicada })
    .eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function eliminarPartitura(id) {
  const { error } = await supabase
    .from('partituras_entrenamiento')
    .delete()
    .eq('id', id)
  return { ok: !error, error: error?.message }
}
