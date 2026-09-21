import { useEffect, useMemo, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'
import { formatHora } from './useEventos'
import {
  MENSAJES, TIPOS_DEL_DIA,
  tipoPorAusencia, esCumple, eventoDeHoy,
  armarTexto, indiceAlAzar, fechaLocal,
} from '../lib/sorpresas'

// ─────────────────────────────────────────────────────────────────────────────
// Mensajes sorpresa para cantantes.
//
// Dos piezas:
//  - useRegistrarAcceso(perfil): se usa una vez en AppLayout. Congela el cálculo
//    de "cuánto hace que no entraba" y después sella el acceso actual en
//    perfiles.ultimo_acceso. Corre en cualquier pantalla (por ejemplo cuando se
//    entra directo desde una notificación push), no solo en Inicio.
//  - useMensajeSorpresa(perfil, eventos, cargando): se usa en Inicio. Decide qué
//    mensaje mostrar (a lo sumo uno por visita) y lo devuelve listo para pintar.
// ─────────────────────────────────────────────────────────────────────────────

const CLAVE_SESION = 'corum_sorpresa_v1'
const CLAVE_DIA = 'corum_sorpresa_dia_'
const MIN_ENTRE_SELLOS = 30 * 60 * 1000 // no escribir en la base más de 1 vez cada 30 min

// Storage a prueba de fallos (modo privado, storage bloqueado, etc.)
function leer(tipoStorage, clave) {
  try { return JSON.parse(window[tipoStorage].getItem(clave)) } catch { return null }
}
function guardar(tipoStorage, clave, valor) {
  try { window[tipoStorage].setItem(clave, JSON.stringify(valor)) } catch { /* sin storage: seguimos igual */ }
}

// Estado de esta visita. Vive en memoria y en sessionStorage, así un F5 no hace
// perder un mensaje que todavía no se cerró.
// { perfilId, ausencia, decidido: { tipo, idx } | null, cerrado }
let estado = null

function obtenerEstado(perfil) {
  if (!perfil?.id) return null
  if (estado?.perfilId === perfil.id) return estado
  const guardado = leer('sessionStorage', CLAVE_SESION)
  estado = guardado?.perfilId === perfil.id
    ? guardado
    : { perfilId: perfil.id, ausencia: tipoPorAusencia(perfil), decidido: null, cerrado: false }
  guardar('sessionStorage', CLAVE_SESION, estado)
  return estado
}

// ─── Registro del último acceso ──────────────────────────────────────────────

let sello = { perfilId: null, ms: 0 }

async function sellarAcceso(perfilId) {
  if (Date.now() - sello.ms < MIN_ENTRE_SELLOS) return
  sello = { perfilId, ms: Date.now() }
  try {
    const coro = await getCoroActual()
    if (!coro) return
    const { error } = await supabase
      .from('perfiles')
      .update({ ultimo_acceso: new Date().toISOString() })
      .eq('id', perfilId)
      .eq('coro_id', coro.id)
    if (error) throw error
  } catch (err) {
    sello = { perfilId, ms: 0 } // reintentar la próxima vez
    console.error('No se pudo registrar el último acceso:', err)
  }
}

export function useRegistrarAcceso(perfil) {
  const perfilId = perfil?.id
  const tieneColumna = !!perfil && 'ultimo_acceso' in perfil

  useEffect(() => {
    if (!perfilId || !tieneColumna) return

    // Primero congelamos la ausencia calculada con el valor anterior...
    obtenerEstado(perfil)

    // ...y recién después sellamos el acceso actual.
    const previo = perfil.ultimo_acceso ? new Date(perfil.ultimo_acceso).getTime() : 0
    if (sello.perfilId !== perfilId) sello = { perfilId, ms: previo }
    sellarAcceso(perfilId)

    // Para quien deja la app abierta días en segundo plano
    const alVolver = () => {
      if (document.visibilityState === 'visible') sellarAcceso(perfilId)
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [perfilId, tieneColumna])
}

// ─── Elección del mensaje ────────────────────────────────────────────────────

function yaMostradoHoy(perfilId, tipo) {
  return leer('localStorage', CLAVE_DIA + perfilId) === `${fechaLocal()}|${tipo}`
}

function decidir(perfil, est, eventos) {
  // Orden de prioridad: cumple > concierto > ausencia > ensayo
  const candidatos = []
  if (esCumple(perfil)) candidatos.push('cumple')
  if (eventoDeHoy(eventos, 'concierto')) candidatos.push('concierto')
  if (est.ausencia) candidatos.push(est.ausencia)
  if (eventoDeHoy(eventos, 'ensayo')) candidatos.push('ensayo')

  // Los mensajes "del día" se muestran una sola vez por día
  const tipo = candidatos.find(t => !TIPOS_DEL_DIA.includes(t) || !yaMostradoHoy(perfil.id, t)) || null

  if (tipo && TIPOS_DEL_DIA.includes(tipo)) {
    guardar('localStorage', CLAVE_DIA + perfil.id, `${fechaLocal()}|${tipo}`)
  }

  est.decidido = { tipo, idx: tipo ? indiceAlAzar(tipo) : 0 }
  guardar('sessionStorage', CLAVE_SESION, est)
  return est.decidido
}

function leerPreview() {
  try {
    const p = new URLSearchParams(window.location.search).get('sorpresa')
    return MENSAJES[p] ? p : null
  } catch { return null }
}

export function useMensajeSorpresa(perfil, eventos, cargandoEventos) {
  const [cerradoLocal, setCerradoLocal] = useState(false)
  const preview = useMemo(leerPreview, [])
  const idxPreview = useMemo(() => (preview ? indiceAlAzar(preview) : 0), [preview])

  const cerrar = useCallback(() => {
    setCerradoLocal(true)
    if (estado) {
      estado.cerrado = true
      guardar('sessionStorage', CLAVE_SESION, estado)
    }
  }, [])

  const nombre = perfil?.nombre?.split(' ')[0]
  const est = obtenerEstado(perfil)

  let tipo = null
  let idx = 0

  if (preview) {
    // Vista previa forzada con ?sorpresa=... (no toca base ni storage)
    tipo = preview
    idx = idxPreview
  } else if (est && !est.cerrado) {
    // Esperamos a tener los eventos para no mostrar un mensaje y cambiarlo enseguida
    const decidido = est.decidido || (cargandoEventos ? null : decidir(perfil, est, eventos))
    if (decidido?.tipo) {
      tipo = decidido.tipo
      idx = decidido.idx
    }
  }

  if (!tipo || cerradoLocal) return { mensaje: null, cerrar }

  const evento = eventoDeHoy(eventos, tipo)
  const hora = evento ? formatHora(evento.fecha_inicio) : (preview ? '19:00' : '')

  return {
    mensaje: { tipo, emoji: MENSAJES[tipo].emoji, texto: armarTexto(tipo, idx, { nombre, hora }) },
    cerrar,
  }
}
