import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'
import { useAuth } from './useAuth'

// ─── Hook: catálogo de ejercicios, agrupado por categoría ────────────────────
export function useEjerciciosEntrenamiento() {
  const [ejercicios, setEjercicios] = useState([])
  const [cargando, setCargando]     = useState(true)
  const [error, setError]           = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('ejercicios_entrenamiento')
        .select('*')
        .eq('activo', true)
        .order('categoria', { ascending: true })
        .order('orden', { ascending: true })

      if (err) throw err
      setEjercicios(data || [])
    } catch (err) {
      setError('No pudimos cargar los ejercicios. Intentá de nuevo.')
      console.error(err)
    } finally {
      setCargando(false)
    }
  }, [])

  useEffect(() => { cargar() }, [cargar])

  // Agrupa por categoría para renderizar fácil en la lista
  const porCategoria = ejercicios.reduce((acc, ej) => {
    if (!acc[ej.categoria]) acc[ej.categoria] = []
    acc[ej.categoria].push(ej)
    return acc
  }, {})

  return { ejercicios, porCategoria, cargando, error, recargar: cargar }
}

// ─── Registrar que el cantante completó un ejercicio (para la racha) ────────
export async function registrarActividadEntrenamiento(ejercicioId, duracionRealSeg = null, metadata = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'No autenticado' }

  const coro = await getCoroActual()
  if (!coro) return { ok: false, error: 'Coro no encontrado' }

  const { error } = await supabase
    .from('actividad_entrenamiento')
    .insert([{
      cantante_id: user.id,
      ejercicio_id: ejercicioId,
      coro_id: coro.id,
      duracion_real_seg: duracionRealSeg,
      metadata,
    }])

  return { ok: !error, error: error?.message }
}

// ─── Racha de práctica: días consecutivos con al menos un ejercicio ─────────
export function useRachaEntrenamiento() {
  const { usuario } = useAuth()
  const [racha, setRacha]       = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      if (!usuario) { setCargando(false); return }

      const { data, error } = await supabase
        .from('actividad_entrenamiento')
        .select('completado_en')
        .eq('cantante_id', usuario.id)
        .order('completado_en', { ascending: false })

      if (error || !data) { setCargando(false); return }

      // Días únicos con actividad, más recientes primero
      const dias = [...new Set(data.map(r => r.completado_en.slice(0, 10)))]
      let contador = 0
      let fechaEsperada = new Date()
      fechaEsperada.setHours(0, 0, 0, 0)

      for (const diaStr of dias) {
        const dia = new Date(diaStr + 'T00:00:00')
        const diffDias = Math.round((fechaEsperada - dia) / 86400000)
        if (diffDias === 0) {
          contador++
          fechaEsperada.setDate(fechaEsperada.getDate() - 1)
        } else if (diffDias === 1 && contador === 0) {
          // Todavía no practicó hoy pero sí ayer — la racha sigue viva
          contador++
          fechaEsperada = dia
          fechaEsperada.setDate(fechaEsperada.getDate() - 1)
        } else {
          break
        }
      }

      setRacha(contador)
      setCargando(false)
    }
    cargar()
  }, [usuario])

  return { racha, cargando }
}
// ─── Ejercicios completados hoy ──────────────────────────────────────────────
export function useEjerciciosHoy() {
  const { usuario } = useAuth()
  const [cantidad, setCantidad] = useState(0)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      if (!usuario) { setCargando(false); return }

      const hoy = new Date()
      hoy.setHours(0, 0, 0, 0)

      const { count, error } = await supabase
        .from('actividad_entrenamiento')
        .select('id', { count: 'exact', head: true })
        .eq('cantante_id', usuario.id)
        .gte('completado_en', hoy.toISOString())

      if (!error) setCantidad(count || 0)
      setCargando(false)
    }
    cargar()
  }, [usuario])

  return { cantidad, cargando }
}