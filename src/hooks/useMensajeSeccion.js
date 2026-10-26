import { useEffect, useMemo, useState, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'
import { clasificarRuta } from '../lib/actividad'
import {
  MENSAJES_SECCION, MAX_MENSAJES_POR_SESION,
  situacionesSeccion, necesitaDedicacion, calcularDedicacion,
  diasSinVerSeccion, esAntiguo, enEspera,
  armarTextoSeccion, indiceAlAzarSeccion, fechaLocal,
} from '../lib/sorpresas'
import { obtenerEstado, guardarEstado, mostradosEnSesion, registrarMostrado } from './useMensajeSorpresa'

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes sorpresa por pantalla (Repertorio, Entrenamiento, Calendario, Avisos).
//
// Se usa una sola vez, en AppLayout. Cuando la persona entra a una de esas
// pantallas decide si corresponde algún mensaje (ver MENSAJES_SECCION en
// src/lib/sorpresas.js) y lo devuelve listo para pintar:
//
//   - "ausente" / "muyAusente": hace mucho que no miraba esa pantalla
//     (lo calcula Supabase con mi_actividad_resumen, solo con datos propios).
//   - "poco" / "mucho" (solo Repertorio): su dedicación al estudio.
//
// Reglas para no cansar: a lo sumo un mensaje por visita a la app (contando
// también el de Inicio), cada pantalla se evalúa una sola vez por visita, y cada
// situación espera unos días antes de repetirse (ESPERA_DIAS).
// Nunca debe romper la app: si algo falla, simplemente no muestra nada.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE_ESPERA = 'corum_sorpresa_pantallas_'

// Momento en que se abrió la app: la visita actual no cuenta como "última vez".
const INICIO_APP = new Date().toISOString()

let rpcNoDisponible = false // todavía no se creó la función en Supabase

function leer(clave) {
  try { return JSON.parse(window.localStorage.getItem(clave)) } catch { return null }
}
function guardar(clave, valor) {
  try { window.localStorage.setItem(clave, JSON.stringify(valor)) } catch { /* sin storage */ }
}

// ?sorpresa=repertorio.poco → { seccion: 'repertorio', situacion: 'poco' }
function leerPreview() {
  try {
    const p = new URLSearchParams(window.location.search).get('sorpresa') || ''
    const [seccion, situacion] = p.split('.')
    return MENSAJES_SECCION[seccion]?.[situacion] ? { seccion, situacion } : null
  } catch { return null }
}

async function cargarDedicacion(perfilId, coroId) {
  try {
    const { data: obras, error: e1 } = await supabase
      .from('obras').select('id').eq('coro_id', coroId).eq('publicada', true)
    if (e1) throw e1
    const ids = (obras || []).map(o => o.id)
    if (!ids.length) return null

    const { data, error: e2 } = await supabase
      .from('actividad_estudio').select('obra_id')
      .eq('usuario_id', perfilId).eq('tipo', 'apertura').in('obra_id', ids)
    if (e2) throw e2
    return calcularDedicacion(ids.length, (data || []).map(a => a.obra_id))
  } catch (err) {
    console.warn('No se pudo calcular la dedicación:', err?.message || err)
    return null
  }
}

// Devuelve { situacion, dias, pct } o null si no corresponde ningún mensaje
async function elegirSituacion(perfil, est, seccion) {
  if (rpcNoDisponible) return null
  try {
    const coro = await getCoroActual()
    if (!coro) return null

    const { data, error } = await supabase.rpc('mi_actividad_resumen', {
      p_coro_id: coro.id, p_seccion: seccion, p_antes_de: INICIO_APP,
    })
    if (error) {
      if (/PGRST202|42883|mi_actividad_resumen/.test(`${error.code} ${error.message}`)) rpcNoDisponible = true
      throw error
    }
    const fila = Array.isArray(data) ? data[0] : data
    const ahora = new Date()
    const diasSinVer = diasSinVerSeccion(
      { ultimaVista: fila?.ultima_vista, primeraActividad: fila?.primera_actividad }, ahora)

    const espera = leer(CLAVE_ESPERA + perfil.id) || {}
    const libre = s => !enEspera(espera[`${seccion}.${s}`], s, ahora)

    let candidatas = situacionesSeccion(seccion, { diasSinVer }).filter(libre)
    let pct = null

    // La dedicación solo se habla con cantantes que ya llevan un tiempo, y solo si
    // no corresponde ya un mensaje de ausencia (esos van primero).
    const hablarDeDedicacion = perfil.rol === 'cantante'
      && est.ausencia !== 'primera'
      && esAntiguo(perfil, fila?.primera_actividad, ahora)
    if (!candidatas.length && hablarDeDedicacion && necesitaDedicacion(seccion)) {
      pct = await cargarDedicacion(perfil.id, coro.id)
      candidatas = situacionesSeccion(seccion, { dedicacion: pct, antiguo: true }).filter(libre)
    }

    return candidatas.length ? { situacion: candidatas[0], dias: diasSinVer, pct } : null
  } catch (err) {
    console.warn('No se pudo preparar el mensaje de la pantalla:', err?.message || err)
    return null
  }
}

export function useMensajeSeccion(perfil) {
  const { pathname } = useLocation()
  const perfilId = perfil?.id
  const ruta = clasificarRuta(pathname)
  const seccion = ruta?.tipo === 'seccion' && MENSAJES_SECCION[ruta.detalle] ? ruta.detalle : null
  const [decision, setDecision] = useState(null)

  useEffect(() => {
    setDecision(null)
    if (!perfilId || !seccion) return

    // Vista previa forzada con ?sorpresa=pantalla.situacion (no toca base ni storage)
    const previa = leerPreview()
    if (previa && previa.seccion === seccion) {
      setDecision({
        seccion, situacion: previa.situacion,
        idx: indiceAlAzarSeccion(seccion, previa.situacion),
        vars: { dias: 21, pct: 32 },
      })
      return
    }

    const est = obtenerEstado(perfil)
    if (!est) return
    if (!est.secciones) est.secciones = {}
    if (est.secciones[seccion]) return                                // ya se evaluó en esta visita
    if (mostradosEnSesion(est) >= MAX_MENSAJES_POR_SESION) return     // esta visita ya tuvo su mensaje

    est.secciones[seccion] = true
    guardarEstado()

    let vivo = true
    let terminado = false
    ;(async () => {
      const elegido = await elegirSituacion(perfil, est, seccion)
      terminado = true
      if (!vivo || !elegido) return
      // Mientras esperábamos, puede que otra pantalla ya haya usado el mensaje de esta visita
      if (mostradosEnSesion(est) >= MAX_MENSAJES_POR_SESION) return

      registrarMostrado(est)
      const espera = leer(CLAVE_ESPERA + perfilId) || {}
      espera[`${seccion}.${elegido.situacion}`] = fechaLocal()
      guardar(CLAVE_ESPERA + perfilId, espera)

      setDecision({
        seccion, situacion: elegido.situacion,
        idx: indiceAlAzarSeccion(seccion, elegido.situacion),
        vars: { dias: elegido.dias, pct: elegido.pct },
      })
    })()

    return () => {
      vivo = false
      // Si se fue de la pantalla antes de tener la respuesta, la próxima vez se vuelve a evaluar
      if (!terminado) {
        est.secciones[seccion] = false
        guardarEstado()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilId, seccion])

  const cerrar = useCallback(() => setDecision(null), [])

  const nombre = perfil?.nombre?.split(' ')[0]
  const mensaje = useMemo(() => {
    if (!decision || decision.seccion !== seccion) return null
    const cat = MENSAJES_SECCION[decision.seccion]?.[decision.situacion]
    if (!cat) return null
    return {
      tipo: `${decision.seccion}.${decision.situacion}`,
      emoji: cat.emoji,
      texto: armarTextoSeccion(decision.seccion, decision.situacion, decision.idx, { nombre, ...decision.vars }),
    }
  }, [decision, seccion, nombre])

  return { mensaje, cerrar }
}
