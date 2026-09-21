import { supabase } from './supabase'
import { getCoroActual } from './coro'

// ─────────────────────────────────────────────────────────────────────────────
// Registro de actividad de los cantantes.
// Alimenta la pantalla admin "Estadística" (tabla actividad_app en Supabase).
//
// Qué se registra:
//   sesion  → entró a la app (a lo sumo una vez cada 30 minutos)
//   seccion → miró una pantalla (Inicio, Avisos, Repertorio...)
//   obra / evento / aviso / texto → abrió uno en particular
//
// Nunca debe romper la app: si algo falla, se ignora. Y si falla 3 veces
// seguidas (por ejemplo porque todavía no se creó la tabla) deja de intentar
// hasta que se recargue la página.
// ─────────────────────────────────────────────────────────────────────────────

export const ETIQUETAS_SECCION = {
  inicio: 'Inicio',
  repertorio: 'Repertorio',
  entrenamiento: 'Entrenamiento',
  calendario: 'Calendario',
  avisos: 'Avisos',
  encuestas: 'Encuestas',
  textos: 'Textos',
  asistencia: 'Mi asistencia',
  companeros: 'Mis compañeros',
  perfil: 'Mi perfil',
}

// Ruta → sección
const SECCIONES = {
  '/': 'inicio',
  '/repertorio': 'repertorio',
  '/entrenamiento': 'entrenamiento',
  '/calendario': 'calendario',
  '/avisos': 'avisos',
  '/encuestas': 'encuestas',
  '/blog': 'textos',
  '/asistencia': 'asistencia',
  '/companeros': 'companeros',
  '/perfil': 'perfil',
}

// Secciones que tienen una pantalla de detalle (/repertorio/:id, etc.)
const DETALLES = {
  '/repertorio': 'obra',
  '/calendario': 'evento',
  '/blog': 'texto',
}

// Devuelve { tipo, refId?, detalle } o null si esa ruta no se registra
// (las pantallas de administración, login, etc. no cuentan).
export function clasificarRuta(pathname) {
  const partes = String(pathname || '/').split('/').filter(Boolean)
  const base = '/' + (partes[0] || '')
  const seccion = SECCIONES[base]
  if (!seccion) return null
  if (partes.length === 2 && DETALLES[base]) {
    return { tipo: DETALLES[base], refId: partes[1], detalle: seccion }
  }
  return { tipo: 'seccion', detalle: seccion }
}

// ─── Estado interno ──────────────────────────────────────────────────────────

const MIN_ENTRE_SESIONES = 30 * 60 * 1000 // 30 minutos
const MAX_FALLOS = 3

let perfilActivo = null
let deshabilitado = false
let fallos = 0
let ultimo = { clave: '', ms: 0 }

export function establecerPerfilActivo(perfilId) {
  if (perfilActivo === perfilId) return
  perfilActivo = perfilId
  deshabilitado = false
  fallos = 0
}

export async function registrarActividad(tipo, { refId = null, detalle = null } = {}) {
  const perfilId = perfilActivo
  if (!perfilId || deshabilitado) return false

  // Evita duplicados seguidos (por ejemplo, doble render en desarrollo)
  const clave = `${tipo}|${refId ?? ''}|${detalle ?? ''}`
  const ahora = Date.now()
  if (clave === ultimo.clave && ahora - ultimo.ms < 3000) return false
  ultimo = { clave, ms: ahora }

  try {
    const coro = await getCoroActual()
    if (!coro) return false
    const { error } = await supabase.from('actividad_app').insert({
      coro_id: coro.id,
      perfil_id: perfilId,
      tipo,
      ref_id: refId != null ? String(refId) : null,
      detalle,
    })
    if (error) throw error
    fallos = 0
    return true
  } catch (err) {
    fallos += 1
    if (fallos >= MAX_FALLOS) deshabilitado = true
    console.warn('No se pudo registrar la actividad:', err?.message || err)
    return false
  }
}

let sesionEnCurso = false

// Registra un "ingreso" si pasaron más de 30 minutos desde el anterior.
// Solo se anota como hecho cuando se guardó de verdad; si falla, se reintenta.
export async function registrarSesionSiCorresponde() {
  const perfilId = perfilActivo
  if (!perfilId || sesionEnCurso) return
  const clave = `corum_sesion_log_${perfilId}`
  let previo = 0
  try { previo = Number(window.localStorage.getItem(clave)) || 0 } catch { /* sin storage */ }
  if (Date.now() - previo < MIN_ENTRE_SESIONES) return

  sesionEnCurso = true
  const guardado = await registrarActividad('sesion')
  sesionEnCurso = false
  if (guardado) {
    try { window.localStorage.setItem(clave, String(Date.now())) } catch { /* sin storage */ }
  }
}

// Después de reiniciar la estadística: el próximo ingreso de esta persona vuelve a contarse
export function olvidarUltimaSesion() {
  if (!perfilActivo) return
  try { window.localStorage.removeItem(`corum_sesion_log_${perfilActivo}`) } catch { /* sin storage */ }
}
