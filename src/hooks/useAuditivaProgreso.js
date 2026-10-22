import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { estadoNiveles, EJERCICIOS_POR_NIVEL, ESTRELLAS_MAX, NIVELES, estrellasPara } from '../lib/auditiva'

// Progreso de la práctica auditiva de cada cantante.
// Se guarda en Supabase (tablas auditiva_progreso y auditiva_ajustes, ver supabase/auditiva_progreso.sql) y,
// además, una copia en el dispositivo: así funciona aunque no haya conexión o todavía no se haya
// creado la tabla. Si el director reinicia el progreso, la copia local anterior se descarta.

const claveLocal = (id) => `auditiva_progreso_${id}`

function leerLocal(id) {
  try {
    const r = JSON.parse(localStorage.getItem(claveLocal(id)) || 'null')
    return Array.isArray(r) ? r : []
  } catch { return [] }
}
function guardarLocal(id, filas) {
  try { localStorage.setItem(claveLocal(id), JSON.stringify(filas)) } catch { /* sin almacenamiento */ }
}

// Une dos listas de filas; por (nivel, ejercicio) se queda con lo mejor de cada una
function unir(a, b) {
  const m = new Map()
  for (const f of [...a, ...b]) {
    const k = `${f.nivel}-${f.ejercicio}`
    const p = m.get(k)
    if (!p) { m.set(k, { ...f }); continue }
    const masNueva = (Date.parse(f.actualizado_en) || 0) >= (Date.parse(p.actualizado_en) || 0) ? f : p
    m.set(k, {
      ...masNueva,
      mejor_pct: Math.max(p.mejor_pct || 0, f.mejor_pct || 0),
      intentos: Math.max(p.intentos || 0, f.intentos || 0),
    })
  }
  return [...m.values()]
}

export function useAuditivaProgreso() {
  const { usuario, perfil } = useAuth()
  const uid = usuario?.id
  const [filas, setFilas] = useState([])
  const [nivelHasta, setNivelHasta] = useState(0)
  const [cargando, setCargando] = useState(true)
  const [soloLocal, setSoloLocal] = useState(false)
  const filasRef = useRef([])
  const hastaRef = useRef(0)

  const guardarRemoto = useCallback(async (fila) => {
    try {
      const { error } = await supabase.from('auditiva_progreso').upsert({
        ...(perfil?.coro_id ? { coro_id: perfil.coro_id } : {}),
        perfil_id: uid,
        nivel: fila.nivel,
        ejercicio: fila.ejercicio,
        mejor_pct: fila.mejor_pct,
        ultimo_pct: fila.ultimo_pct,
        intentos: fila.intentos,
        actualizado_en: fila.actualizado_en,
      }, { onConflict: 'perfil_id,nivel,ejercicio' })
      if (error) { console.warn('Auditiva: no se pudo guardar el progreso en línea:', error.message); return false }
      return true
    } catch (e) {
      console.warn('Auditiva: no se pudo guardar el progreso en línea:', e?.message || e)
      return false
    }
  }, [uid, perfil?.coro_id])

  const cargar = useCallback(async () => {
    if (!uid) { setCargando(false); return }
    let remotas = []
    let hasta = 0
    let reinicio = null
    let fallo = false
    try {
      const [p, a] = await Promise.all([
        supabase.from('auditiva_progreso').select('nivel,ejercicio,mejor_pct,ultimo_pct,intentos,actualizado_en').eq('perfil_id', uid),
        supabase.from('auditiva_ajustes').select('nivel_hasta,reiniciado_en').eq('perfil_id', uid).maybeSingle(),
      ])
      if (p.error) fallo = true; else remotas = p.data || []
      if (a.error) fallo = true; else { hasta = a.data?.nivel_hasta || 0; reinicio = a.data?.reiniciado_en || null }
    } catch { fallo = true }

    let locales = leerLocal(uid)
    if (reinicio) {
      const limite = Date.parse(reinicio) || 0
      locales = locales.filter((f) => (Date.parse(f.actualizado_en) || 0) > limite)
    }
    const todas = unir(remotas, locales)
    guardarLocal(uid, todas)
    filasRef.current = todas
    hastaRef.current = hasta
    setFilas(todas)
    setNivelHasta(hasta)
    setSoloLocal(fallo)
    setCargando(false)

    // Lo que quedó solo en el dispositivo (por un corte de conexión) se sube ahora
    if (!fallo) {
      const remotasPorClave = new Map(remotas.map((f) => [`${f.nivel}-${f.ejercicio}`, f]))
      for (const f of todas) {
        const r = remotasPorClave.get(`${f.nivel}-${f.ejercicio}`)
        if (!r || (f.mejor_pct || 0) > (r.mejor_pct || 0) || (f.intentos || 0) > (r.intentos || 0)) guardarRemoto(f)
      }
    }
  }, [uid, guardarRemoto])

  useEffect(() => { cargar() }, [cargar])

  /** Anota un intento terminado. Devuelve el estado de los niveles ya actualizado. */
  const registrar = useCallback((nivel, ejercicio, pct) => {
    const previo = filasRef.current.find((f) => f.nivel === nivel && f.ejercicio === ejercicio)
    const fila = {
      nivel, ejercicio,
      ultimo_pct: pct,
      mejor_pct: Math.max(previo?.mejor_pct || 0, pct),
      intentos: (previo?.intentos || 0) + 1,
      actualizado_en: new Date().toISOString(),
    }
    const nuevas = [...filasRef.current.filter((f) => !(f.nivel === nivel && f.ejercicio === ejercicio)), fila]
    filasRef.current = nuevas
    setFilas(nuevas)
    if (uid) { guardarLocal(uid, nuevas); guardarRemoto(fila) }
    return estadoNiveles(nuevas, hastaRef.current)
  }, [uid, guardarRemoto])

  const estado = useMemo(() => estadoNiveles(filas, nivelHasta), [filas, nivelHasta])
  const estrellas = useMemo(() => filas.reduce((s, f) => s + estrellasPara(f.mejor_pct), 0), [filas])
  const estrellasMax = NIVELES.length * EJERCICIOS_POR_NIVEL * ESTRELLAS_MAX

  return { filas, nivelHasta, estado, estrellas, estrellasMax, cargando, soloLocal, registrar, recargar: cargar }
}
