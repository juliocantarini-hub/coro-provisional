import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

export function useAvisos(filtros = {}) {
  const [avisos, setAvisos]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)
  const [noLeidos, setNoLeidos] = useState(0)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const coro = await getCoroActual()
      let query = supabase
        .from('avisos')
        .select(`*, avisos_leidos!left(leido_en, perfil_id), obras(id, titulo), eventos(id, titulo)`)
        .eq('coro_id', coro.id)
        .eq('publicado', true)
        .order('creado_en', { ascending: false })

      if (filtros.tipo) query = query.eq('tipo', filtros.tipo)

      const { data, error: err } = await query
      if (err) throw err

      const lista = (data || []).map(a => ({ ...a, leido: a.avisos_leidos?.length > 0 }))
      setAvisos(lista)
      setNoLeidos(lista.filter(a => !a.leido).length)
    } catch (err) {
      setError('No pudimos cargar los avisos.')
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [filtros.tipo])

  useEffect(() => { cargar() }, [cargar])
  return { avisos, cargando, error, noLeidos, recargar: cargar }
}

export async function marcarLeido(avisoId, perfilId) {
  const { error } = await supabase
    .from('avisos_leidos')
    .upsert({ aviso_id: avisoId, perfil_id: perfilId }, { onConflict: 'aviso_id,perfil_id' })
  return { ok: !error }
}

export async function marcarTodosLeidos(avisoIds, perfilId) {
  if (!avisoIds.length) return { ok: true }
  const rows = avisoIds.map(aviso_id => ({ aviso_id, perfil_id: perfilId }))
  const { error } = await supabase
    .from('avisos_leidos')
    .upsert(rows, { onConflict: 'aviso_id,perfil_id' })
  return { ok: !error }
}

export function useAvisosAdmin() {
  const [avisos, setAvisos]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    const { data, error: err } = await supabase
      .from('avisos')
      .select('*, obras(titulo), eventos(titulo), avisos_leidos(perfil_id)')
      .eq('coro_id', coro.id)
      .order('creado_en', { ascending: false })
    if (err) { setError(err.message); setCargando(false); return }
    setAvisos(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { avisos, cargando, error, recargar: cargar }
}

export async function crearAviso(datos) {
  const coro = await getCoroActual()
  const { data, error } = await supabase
    .from('avisos')
    .insert([{ ...datos, coro_id: coro.id }])
    .select()
    .single()
  return { ok: !error, data, error: error?.message }
}

export async function actualizarAviso(id, datos) {
  const { data, error } = await supabase
    .from('avisos')
    .update(datos)
    .eq('id', id)
    .select()
    .single()
  return { ok: !error, data, error: error?.message }
}

export async function publicarAviso(id, publicado) {
  const { error } = await supabase.from('avisos').update({ publicado }).eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function eliminarAviso(id) {
  const { error } = await supabase.from('avisos').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

export function tiempoRelativo(iso) {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min  = Math.floor(diff / 60000)
  const hs   = Math.floor(diff / 3600000)
  const dias = Math.floor(diff / 86400000)
  if (min < 1)   return 'Ahora mismo'
  if (min < 60)  return `Hace ${min} min`
  if (hs < 24)   return `Hace ${hs} hora${hs !== 1 ? 's' : ''}`
  if (dias < 7)  return `Hace ${dias} día${dias !== 1 ? 's' : ''}`
  return new Date(iso).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
}

export const TIPO_AVISO = {
  material: { label: 'Nuevo material', bg: '#E1F5EE', color: '#04342C', dot: '#1D9E75' },
  horario:  { label: 'Cambio de horario', bg: '#FAECE7', color: '#712B13', dot: '#D85A30' },
  evento:   { label: 'Evento', bg: '#E6F1FB', color: '#042C53', dot: '#378ADD' },
  urgente:  { label: 'Urgente', bg: '#FCEBEB', color: '#501313', dot: '#E24B4A' },
  encuesta: { label: 'Encuesta', bg: '#F3EFF8', color: '#3B0764', dot: '#7C3AED' },
  general:  { label: 'General', bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780' },  
}