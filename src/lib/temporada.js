// ─────────────────────────────────────────────────────────────────────────────
// Reporte de fin de temporada: textos y reglas para la tarjeta del cantante.
//
// Los números vienen congelados en reportes_temporada.datos (los calcula la
// función generar_reportes_temporada en Supabase). Acá solo se decide QUÉ se
// muestra y CÓMO se dice, siempre en positivo:
//  - Si el coro no tomó registro de algo, la sección dice "Sin registro esta temporada".
//  - Nunca se muestra un 0 ni un porcentaje bajo: se muestra lo que sí hizo.
//  - El director puede ocultar secciones (reportes_temporada.ocultas).
// ─────────────────────────────────────────────────────────────────────────────

export const SECCIONES = [
  { clave: 'eventos',       titulo: 'Conciertos y eventos' },
  { clave: 'asistencia',    titulo: 'Asistencia' },
  { clave: 'estudio',       titulo: 'Estudio del repertorio' },
  { clave: 'entrenamiento', titulo: 'Entrenamiento' },
  { clave: 'constancia',    titulo: 'Constancia' },
]

// Desde qué porcentaje se muestra el número de dedicación / asistencia al cantante
export const PCT_MINIMO_DEDICACION = 60
export const PCT_MINIMO_ASISTENCIA = 60
// Racha mínima para mencionarla
export const RACHA_MINIMA_ENSAYOS = 3
export const RACHA_MINIMA_DIAS = 3

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']

// "2026-05" → "mayo"
export function nombreMes(ym) {
  if (!ym) return ''
  const m = parseInt(String(ym).slice(5, 7), 10)
  return MESES[m - 1] || ''
}

// "2026-05-20" → "20 de mayo"
export function fechaCorta(iso) {
  if (!iso) return ''
  const [, m, d] = String(iso).slice(0, 10).split('-').map(Number)
  return `${d} de ${MESES[m - 1]}`
}

export function primerNombre(nombre) {
  return (nombre || '').trim().split(/\s+/)[0] || ''
}

export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`
}

// Estado de cada sección para la revisión del director:
//  'ok'           hay datos del cantante
//  'sin_registro' el coro no registró eso en la temporada (es lo esperable)
//  'vacio'        el coro sí registró, pero este cantante no tiene nada (conviene mirarlo)
export function estadoSecciones(datos = {}) {
  const ev = datos.eventos || {}
  const as = datos.asistencia || {}
  const es = datos.estudio || {}
  const en = datos.entrenamiento || {}
  const co = datos.constancia || {}
  return {
    eventos: (ev.conciertos || 0) + (ev.ensayos || 0) + (ev.otros || 0) > 0 ? 'ok' : 'sin_registro',
    asistencia: as.sin_registro || !as.listas ? 'sin_registro' : (as.presentes > 0 ? 'ok' : 'vacio'),
    estudio: !es.obras_temporada ? 'sin_registro' : (es.aperturas > 0 ? 'ok' : 'vacio'),
    entrenamiento: (en.ejercicios || 0) + (en.lecciones_teoria || 0) > 0 ? 'ok' : 'vacio',
    constancia: (co.dias_activos || 0) > 0 ? 'ok' : 'vacio',
  }
}

// Avisos para el director en la revisión (no se muestran al cantante)
export function avisosRevision(reporte) {
  const d = reporte?.datos || {}
  const est = estadoSecciones(d)
  const ocultas = new Set(reporte?.ocultas || [])
  const avisos = []
  for (const s of SECCIONES) {
    if (ocultas.has(s.clave)) continue
    if (est[s.clave] === 'vacio') avisos.push(`${s.titulo}: sin datos de esta persona (se mostrará "Sin registro")`)
  }
  if (d.asistencia && !d.asistencia.sin_registro && d.asistencia.listas > 0 && d.asistencia.pct !== null && d.asistencia.pct < PCT_MINIMO_ASISTENCIA && !ocultas.has('asistencia')) {
    avisos.push(`Asistencia baja (${d.asistencia.pct}%): al cantante no se le muestra el porcentaje, solo cuántos ensayos fue`)
  }
  if (d.estudio?.dedicacion != null && d.estudio.dedicacion < PCT_MINIMO_DEDICACION && d.estudio.aperturas > 0 && !ocultas.has('estudio')) {
    avisos.push(`Dedicación ${d.estudio.dedicacion}%: al cantante no se le muestra el número, solo lo que estudió`)
  }
  if (d.ingreso_en_temporada) avisos.push(`Entró a mitad de temporada: se cuenta desde el ${fechaCorta(d.desde)}`)
  return avisos
}

export const SIN_REGISTRO = 'Sin registro esta temporada'

// Tres o cuatro datos para la tarjeta final y para compartir
export function resumenCorto(reporte, est = estadoSecciones(reporte?.datos), ocultas = new Set(reporte?.ocultas || [])) {
  const d = reporte?.datos || {}
  const items = []
  if (!ocultas.has('eventos') && d.eventos?.conciertos > 0) items.push({ emoji: '🎤', texto: plural(d.eventos.conciertos, 'concierto', 'conciertos') })
  if (!ocultas.has('asistencia') && est.asistencia === 'ok') items.push({ emoji: '✅', texto: plural(d.asistencia.presentes, 'ensayo', 'ensayos') })
  if (!ocultas.has('estudio') && est.estudio === 'ok') items.push({ emoji: '📖', texto: plural(d.estudio.obras_abiertas, 'obra estudiada', 'obras estudiadas') })
  if (!ocultas.has('constancia') && est.constancia === 'ok') items.push({ emoji: '🔥', texto: plural(d.constancia.dias_activos, 'día de práctica', 'días de práctica') })
  return items
}

export function textoCompartir(reporte, nombreCoro = '') {
  const items = resumenCorto(reporte)
  const temporada = reporte?.temporada
  const encabezado = `🎶 Mi temporada ${temporada}${nombreCoro ? ` en ${nombreCoro}` : ''}`
  return [encabezado, ...items.map(i => `${i.emoji} ${i.texto}`)].join('\n')
}

export function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
