import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// Ensayo fijo semanal del coro (tabla ensayo_fijo). La base crea sola el próximo
// ensayo una semana antes (función generar_ensayos_fijos, todos los días a las 9).

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']

export function useEnsayoFijo() {
  const [config, setConfig] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [falta, setFalta] = useState(false) // la tabla todavía no existe en esta base

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    if (!coro) { setCargando(false); return }
    const { data, error } = await supabase
      .from('ensayo_fijo')
      .select('*')
      .eq('coro_id', coro.id)
      .maybeSingle()
    setFalta(!!error)
    setConfig(error ? null : data)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { config, cargando, falta, recargar: cargar }
}

export async function guardarEnsayoFijo(datos) {
  const coro = await getCoroActual()
  const fila = {
    coro_id: coro.id,
    activo: datos.activo,
    dia_semana: Number(datos.dia_semana),
    hora_inicio: datos.hora_inicio,
    hora_fin: datos.hora_fin || null,
    lugar: datos.lugar?.trim() || null,
    titulo: datos.titulo?.trim() || 'Ensayo',
    actualizado: new Date().toISOString(),
  }
  const { error } = await supabase.from('ensayo_fijo').upsert(fila, { onConflict: 'coro_id' })
  if (error) return { ok: false, error: error.message }
  // Crea ya el próximo ensayo si cae dentro de la semana (no duplica si ya existe)
  if (fila.activo) await supabase.rpc('generar_ensayos_fijos')
  return { ok: true }
}

export function textoEnsayoFijo(c) {
  if (!c) return ''
  const hora = (h) => (h || '').slice(0, 5)
  const plural = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']
  return `Todos los ${plural[c.dia_semana]},${hora(c.hora_inicio)}${c.hora_fin ? ` a ${hora(c.hora_fin)}` : ''}${c.lugar ? ` · ${c.lugar}` : ''}`
}
