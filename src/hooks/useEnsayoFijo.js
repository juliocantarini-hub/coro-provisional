import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// Ensayo fijo semanal del coro (tabla ensayo_fijo). La base crea sola el próximo
// ensayo una semana antes (función generar_ensayos_fijos, todos los días a las 9),
// respetando los cambios programados (tabla ensayo_fijo_cambios).

export const DIAS_SEMANA = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado']
export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

const hora = (h) => (h || '').slice(0, 5)
const DIAS_PLURAL = ['domingos', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábados']

function hoyISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function useEnsayoFijo() {
  const [config, setConfig] = useState(null)
  const [cambios, setCambios] = useState([])
  const [cargando, setCargando] = useState(true)
  const [falta, setFalta] = useState(false)               // la tabla del ensayo todavía no existe en esta base
  const [faltanCambios, setFaltanCambios] = useState(false) // la tabla de cambios todavía no existe

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    if (!coro) { setCargando(false); return }
    const [{ data, error }, { data: camb, error: errCamb }] = await Promise.all([
      supabase.from('ensayo_fijo').select('*').eq('coro_id', coro.id).maybeSingle(),
      supabase.from('ensayo_fijo_cambios').select('*').eq('coro_id', coro.id)
        .gte('hasta', hoyISO()).order('desde'),
    ])
    setFalta(!!error)
    setConfig(error ? null : data)
    setFaltanCambios(!!errCamb)
    setCambios(errCamb ? [] : (camb || []))
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])
  return { config, cambios, cargando, falta, faltanCambios, recargar: cargar }
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

// datos: { tipo: 'sin_ensayo' | 'horario', desdeMes, desdeAnio, hastaMes, hastaAnio,
//          dia_semana, hora_inicio, hora_fin, lugar } — meses de 0 a 11
export async function crearCambioEnsayo(datos) {
  const coro = await getCoroActual()
  const desde = `${datos.desdeAnio}-${String(Number(datos.desdeMes) + 1).padStart(2, '0')}-01`
  const ultimo = new Date(Number(datos.hastaAnio), Number(datos.hastaMes) + 1, 0).getDate()
  const hasta = `${datos.hastaAnio}-${String(Number(datos.hastaMes) + 1).padStart(2, '0')}-${ultimo}`
  if (hasta < desde) return { ok: false, error: 'El mes "hasta" tiene que ser igual o posterior al mes "desde".' }
  const fila = { coro_id: coro.id, tipo: datos.tipo, desde, hasta }
  if (datos.tipo === 'horario') {
    if (!datos.hora_inicio) return { ok: false, error: 'Falta la hora de inicio.' }
    fila.dia_semana = Number(datos.dia_semana)
    fila.hora_inicio = datos.hora_inicio
    fila.hora_fin = datos.hora_fin || null
    fila.lugar = datos.lugar?.trim() || null
  }
  const { error } = await supabase.from('ensayo_fijo_cambios').insert(fila)
  return { ok: !error, error: error?.message }
}

export async function eliminarCambioEnsayo(id) {
  const { error } = await supabase.from('ensayo_fijo_cambios').delete().eq('id', id)
  return { ok: !error, error: error?.message }
}

// Borra la configuración del ensayo semanal y todos los cambios programados.
// Los ensayos que ya están en el calendario no se tocan.
export async function resetearEnsayoFijo() {
  const coro = await getCoroActual()
  await supabase.from('ensayo_fijo_cambios').delete().eq('coro_id', coro.id)
  const { error } = await supabase.from('ensayo_fijo').delete().eq('coro_id', coro.id)
  return { ok: !error, error: error?.message }
}

export function textoEnsayoFijo(c) {
  if (!c) return ''
  return `Todos los ${DIAS_PLURAL[c.dia_semana]}, ${hora(c.hora_inicio)}${c.hora_fin ? ` a ${hora(c.hora_fin)}` : ''}${c.lugar ? ` · ${c.lugar}` : ''}`
}

function textoMes(iso) {
  const [a, m] = iso.split('-').map(Number)
  return `${MESES[m - 1]} ${a}`
}

export function textoPeriodo(c) {
  const d = textoMes(c.desde)
  const h = textoMes(c.hasta)
  return d === h ? d : `${d} a ${h}`
}

export function textoCambio(c, config) {
  if (c.tipo === 'sin_ensayo') return 'Sin ensayos'
  const dia = c.dia_semana ?? config?.dia_semana
  const lugar = c.lugar || config?.lugar
  return `${DIAS_PLURAL[dia]?.replace(/^./, x => x.toUpperCase())}, ${hora(c.hora_inicio)}${c.hora_fin ? ` a ${hora(c.hora_fin)}` : ''}${lugar ? ` · ${lugar}` : ''}`
}
