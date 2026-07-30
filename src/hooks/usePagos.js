import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

export function useColectas() {
  const [colectas, setColectas] = useState([])
  const [cargando, setCargando] = useState(true)

  async function cargar() {
    const coro = await getCoroActual()
    if (!coro) return
    const { data } = await supabase
      .from('colectas')
      .select('*')
      .eq('coro_id', coro.id)
      .order('anio', { ascending: false })
      .order('mes', { ascending: false })
      .order('creado_en', { ascending: false })
    setColectas(data || [])
    setCargando(false)
  }

  useEffect(() => { cargar() }, [])
  return { colectas, cargando, recargar: cargar }
}

export function useRegistrosColecta(colectaId) {
  const [registros, setRegistros] = useState([])
  const [cantantes, setCantantes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!colectaId) return
    async function cargar() {
      const coro = await getCoroActual()
      if (!coro) return

      const [{ data: perfiles }, { data: regs }] = await Promise.all([
        supabase
          .from('perfiles')
          .select('id, nombre, voz')
          .eq('coro_id', coro.id)
          .eq('rol', 'cantante')
          .order('nombre'),
        supabase
          .from('colectas_registros')
          .select('*')
          .eq('colecta_id', colectaId),
      ])

      setCantantes(perfiles || [])
      setRegistros(regs || [])
      setCargando(false)
    }
    cargar()
  }, [colectaId])

  return { cantantes, registros, setRegistros, cargando }
}

export async function crearColectas(payload) {
  // payload: [{ coro_id, tipo, nombre, mes, anio, monto }]
  return supabase.from('colectas').insert(payload)
}

export async function eliminarColecta(id) {
  return supabase.from('colectas').delete().eq('id', id)
}

export async function marcarPago(colectaId, perfilId, estado, registros, setRegistros) {
  const existe = registros.find(r => r.perfil_id === perfilId)
  if (existe) {
    await supabase
      .from('colectas_registros')
      .update({ estado, actualizado_en: new Date().toISOString() })
      .eq('colecta_id', colectaId)
      .eq('perfil_id', perfilId)
    setRegistros(prev => prev.map(r => r.perfil_id === perfilId ? { ...r, estado } : r))
  } else {
    const { data } = await supabase
      .from('colectas_registros')
      .insert({ colecta_id: colectaId, perfil_id: perfilId, estado })
      .select()
      .single()
    if (data) setRegistros(prev => [...prev, data])
  }
}

// Para el lado cantante
export function useMisPagos(perfilId) {
  const [cuotaPendiente, setCuotaPendiente] = useState(null)
  const [colectasPendientes, setColectasPendientes] = useState([])
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    if (!perfilId) return
    async function cargar() {
      const coro = await getCoroActual()
      if (!coro) return

      const hoy = new Date()
      const mes = hoy.getMonth() + 1
      const anio = hoy.getFullYear()

      const { data: colectas } = await supabase
        .from('colectas')
        .select('*, colectas_registros(*)')
        .eq('coro_id', coro.id)

      if (!colectas) { setCargando(false); return }

      // Cuota del mes corriente
      const cuotaMes = colectas.find(c => c.tipo === 'cuota' && c.mes === mes && c.anio === anio)
      if (cuotaMes) {
  const reg = cuotaMes.colectas_registros?.find(r => r.perfil_id === perfilId)
  setCuotaPendiente({ ...cuotaMes, estado: reg?.estado || 'pendiente', nota: reg?.nota || null })
}

      // Colectas pendientes (no cuotas)
      const pendientes = colectas
  .filter(c => c.tipo === 'colecta')
  .filter(c => {
    const reg = c.colectas_registros?.find(r => r.perfil_id === perfilId)
    return !reg || reg.estado === 'pendiente'
  })
  .map(c => {
    const reg = c.colectas_registros?.find(r => r.perfil_id === perfilId)
    return { ...c, nota: reg?.nota || null }
  })
setColectasPendientes(pendientes)

      setCargando(false)
    }
    cargar()
  }, [perfilId])

  return { cuotaPendiente, colectasPendientes, cargando }
}

// Para el Dashboard del director: resumen financiero del mes actual (cuota + colectas puntuales activas)
export function useResumenFinancieroMes() {
  const [resumen, setResumen] = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const coro = await getCoroActual()
      if (!coro) { setCargando(false); return }

      const hoy = new Date()
      const mes = hoy.getMonth() + 1
      const anio = hoy.getFullYear()

      const [{ data: colectas }, { count: totalCantantes }] = await Promise.all([
        supabase
          .from('colectas')
          .select('*, colectas_registros(*)')
          .eq('coro_id', coro.id)
          .eq('mes', mes)
          .eq('anio', anio),
        supabase
          .from('perfiles')
          .select('id', { count: 'exact', head: true })
          .eq('coro_id', coro.id)
          .eq('rol', 'cantante'),
      ])

      const activas = colectas || []
      const total = totalCantantes || 0
      let esperado = 0, ingresado = 0, pagas = 0, impagas = 0, exentas = 0

      activas.forEach(c => {
        const regs = c.colectas_registros || []
        const pagasC = regs.filter(r => r.estado === 'pagado').length
        const exentasC = regs.filter(r => r.estado === 'exento').length
        const impagasC = Math.max(total - pagasC - exentasC, 0)

        esperado += c.monto * (total - exentasC)
        ingresado += c.monto * pagasC
        pagas += pagasC
        exentas += exentasC
        impagas += impagasC
      })

      setResumen({
        activas,
        totalCantantes: total,
        esperado,
        ingresado,
        falta: esperado - ingresado,
        pagas,
        impagas,
        exentas,
      })
      setCargando(false)
    }
    cargar()
  }, [])

  return { resumen, cargando }
}