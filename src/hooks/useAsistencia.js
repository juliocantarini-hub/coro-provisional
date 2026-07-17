import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

export function useListasAsistencia() {
  const [listas, setListas]     = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError]       = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    const { data, error: err } = await supabase
      .from('listas_asistencia')
      .select(`*, registros_asistencia(estado, perfil_id)`)
      .eq('coro_id', coro.id)
      .order('fecha', { ascending: false })
    if (err) { setError(err.message); setCargando(false); return }
    setListas(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { listas, cargando, error, recargar: cargar }
}

export function useHistorialAsistencia(perfilId) {
  const [historial, setHistorial] = useState([])
  const [cargando, setCargando]   = useState(true)

  useEffect(() => {
    if (!perfilId) return
    const cargar = async () => {
      const coro = await getCoroActual()
      // Primero obtenemos los IDs de listas de este coro
      const { data: listas } = await supabase
        .from('listas_asistencia')
        .select('id')
        .eq('coro_id', coro.id)
      if (!listas || listas.length === 0) {
        setHistorial([])
        setCargando(false)
        return
      }
      const listaIds = listas.map(l => l.id)
      const { data } = await supabase
        .from('registros_asistencia')
        .select('*, listas_asistencia(fecha, descripcion, coro_id)')
        .eq('perfil_id', perfilId)
        .in('lista_id', listaIds)
        .order('lista_id', { ascending: false })
      setHistorial(data || [])
      setCargando(false)
    }
    cargar()
  }, [perfilId])

  return { historial, cargando }
}

export function useRegistrosLista(listaId) {
  const [registros, setRegistros] = useState([])
  const [cantantes, setCantantes] = useState([])
  const [cargando, setCargando]   = useState(true)

  const cargar = useCallback(async () => {
    if (!listaId) return
    setCargando(true)
    const coro = await getCoroActual()
    const [{ data: regs }, { data: cants }] = await Promise.all([
      supabase.from('registros_asistencia').select('*').eq('lista_id', listaId),
      supabase.from('perfiles').select('id, nombre, voz').eq('coro_id', coro.id).eq('estado', 'activo').order('nombre'),
    ])
    setRegistros(regs || [])
    setCantantes(cants || [])
    setCargando(false)
  }, [listaId])

  useEffect(() => { cargar() }, [cargar])
  return { registros, setRegistros, cantantes, cargando, recargar: cargar } // ← setRegistros expuesto
}

export async function crearLista(fecha, descripcion) {
  const coro = await getCoroActual()
  const { data, error } = await supabase
    .from('listas_asistencia')
    .insert([{ fecha, descripcion, coro_id: coro.id }])
    .select().single()
  return { ok: !error, data, error: error?.message }
}

export async function eliminarLista(id) {
  const { error } = await supabase.from('listas_asistencia').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

export async function marcarAsistencia(listaId, perfilId, estado, nota = null) {
  const { error } = await supabase
    .from('registros_asistencia')
    .upsert({ lista_id: listaId, perfil_id: perfilId, estado, nota },
      { onConflict: 'lista_id,perfil_id' })
  return { ok: !error, error: error?.message }
}

export async function resetearAsistencia() {
  const coro = await getCoroActual()
  const { error } = await supabase
    .from('listas_asistencia')
    .delete()
    .eq('coro_id', coro.id)
  return { ok: !error, error: error?.message }
}

export function calcularEstadisticas(historial) {
  const meses = {}
  historial.forEach(r => {
    if (!r.listas_asistencia) return
    const fecha = new Date(r.listas_asistencia.fecha + 'T12:00:00')
    const key = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}`
    if (!meses[key]) meses[key] = { total: 0, presentes: 0 }
    meses[key].total++
    if (r.estado === 'presente') meses[key].presentes++
  })
  return Object.entries(meses)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, val]) => ({
      mes: key,
      label: new Date(key + '-15').toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }),
      porcentaje: Math.round((val.presentes / val.total) * 100),
      presentes: val.presentes,
      total: val.total,
    }))
}

export function calcularRacha(historial) {
  const ordenado = [...historial]
    .filter(r => r.listas_asistencia?.fecha)
    .sort((a, b) => new Date(b.listas_asistencia.fecha) - new Date(a.listas_asistencia.fecha))

  let racha = 0
  for (const r of ordenado) {
    if (r.estado === 'presente') racha++
    else break
  }
  return racha
}