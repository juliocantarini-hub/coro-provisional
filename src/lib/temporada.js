// ─────────────────────────────────────────────────────────────────────────────
// Reporte de fin de temporada: textos y reglas para armar las "historias".
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

function plural(n, uno, varios) {
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

const SIN_REGISTRO = 'Sin registro esta temporada'

// Arma la lista de pantallas (historias) que ve el cantante.
// Cada una: { clave, emoji, titulo, grande?, texto, lineas?, sinRegistro? }
export function armarHistorias(reporte, { nombreCoro = '' } = {}) {
  const d = reporte?.datos || {}
  const ocultas = new Set(reporte?.ocultas || [])
  const est = estadoSecciones(d)
  const temporada = reporte?.temporada || d.temporada
  const nombre = primerNombre(d.nombre)
  const h = []

  // 1. Bienvenida
  h.push({
    clave: 'bienvenida',
    emoji: '🎶',
    titulo: `Tu temporada ${temporada}`,
    grande: nombre ? `${nombre}` : null,
    texto: [d.voz ? capitalizar(d.voz) : null, nombreCoro].filter(Boolean).join(' · '),
    lineas: d.ingreso_en_temporada
      ? [`Desde que llegaste en ${nombreMes(d.desde)}, esto es lo que cantaste con nosotros.`]
      : ['Un repaso de todo lo que cantaste este año.'],
  })

  // 2. Conciertos y eventos (del coro)
  if (!ocultas.has('eventos')) {
    const ev = d.eventos || {}
    if (est.eventos === 'sin_registro') {
      h.push({ clave: 'eventos', emoji: '🎤', titulo: 'Conciertos y eventos', texto: SIN_REGISTRO, sinRegistro: true })
    } else if (ev.conciertos > 0) {
      h.push({
        clave: 'eventos', emoji: '🎤', titulo: 'Subimos al escenario',
        grande: String(ev.conciertos),
        texto: ev.conciertos === 1 ? 'concierto esta temporada' : 'conciertos esta temporada',
        lineas: [
          ...(ev.lista_conciertos || []).slice(0, 5).map(c => `${c.titulo} · ${fechaCorta(c.fecha)}${c.lugar ? ` · ${c.lugar}` : ''}`),
          ev.ensayos > 0 ? `Y ${plural(ev.ensayos, 'ensayo', 'ensayos')} en el calendario.` : null,
        ].filter(Boolean),
      })
    } else {
      h.push({
        clave: 'eventos', emoji: '📅', titulo: 'Nuestro calendario',
        grande: String((ev.ensayos || 0) + (ev.otros || 0)),
        texto: 'encuentros del coro esta temporada',
      })
    }
  }

  // 3. Asistencia
  if (!ocultas.has('asistencia')) {
    const as = d.asistencia || {}
    if (est.asistencia !== 'ok') {
      h.push({ clave: 'asistencia', emoji: '✅', titulo: 'Asistencia', texto: SIN_REGISTRO, sinRegistro: true })
    } else {
      const lineas = []
      if (as.racha >= RACHA_MINIMA_ENSAYOS) lineas.push(`Tu racha más larga: ${as.racha} ensayos seguidos.`)
      if (as.mejor_mes && as.mejor_mes.pct >= 75) lineas.push(`Tu mes más constante fue ${nombreMes(as.mejor_mes.mes)}.`)
      const mostrarPct = as.pct != null && as.pct >= PCT_MINIMO_ASISTENCIA
      h.push({
        clave: 'asistencia', emoji: '✅', titulo: 'Presente',
        grande: String(as.presentes),
        texto: mostrarPct
          ? `ensayos de ${as.listas} (${as.pct}%)`
          : (as.presentes === 1 ? 'ensayo compartido con el coro' : 'ensayos compartidos con el coro'),
        lineas,
      })
    }
  }

  // 4. Estudio del repertorio
  if (!ocultas.has('estudio')) {
    const es = d.estudio || {}
    if (est.estudio !== 'ok') {
      h.push({ clave: 'estudio', emoji: '📖', titulo: 'Estudio del repertorio', texto: SIN_REGISTRO, sinRegistro: true })
    } else {
      const lineas = []
      if (es.obra_top) lineas.push(`Tu obra más practicada: ${es.obra_top.titulo} (la abriste ${plural(es.obra_top.veces, 'vez', 'veces')}).`)
      if (es.estudiadas > 0) lineas.push(`Marcaste ${plural(es.estudiadas, 'obra', 'obras')} como estudiada${es.estudiadas === 1 ? '' : 's'}.`)
      if (es.dedicacion != null && es.dedicacion >= PCT_MINIMO_DEDICACION) lineas.push(`Tu dedicación: ${es.dedicacion}%. ¡Excelente!`)
      h.push({
        clave: 'estudio', emoji: '📖', titulo: 'Estudiaste',
        grande: String(es.obras_abiertas),
        texto: es.obras_temporada > es.obras_abiertas
          ? `de las ${es.obras_temporada} obras del repertorio`
          : (es.obras_abiertas === 1 ? 'obra del repertorio' : 'obras del repertorio, ¡todas!'),
        lineas,
      })
    }
  }

  // 5. Entrenamiento
  if (!ocultas.has('entrenamiento')) {
    const en = d.entrenamiento || {}
    if (est.entrenamiento !== 'ok') {
      h.push({ clave: 'entrenamiento', emoji: '🎵', titulo: 'Entrenamiento', texto: SIN_REGISTRO, sinRegistro: true })
    } else {
      const lineas = []
      if (en.ejercicios > 0) lineas.push(`${plural(en.ejercicios, 'ejercicio completado', 'ejercicios completados')}`)
      if (en.lecciones_teoria > 0) lineas.push(`${plural(en.lecciones_teoria, 'lección', 'lecciones')} de "Entendé la partitura"`)
      h.push({
        clave: 'entrenamiento', emoji: '🎵', titulo: 'Entrenaste tu voz',
        grande: String((en.ejercicios || 0) + (en.lecciones_teoria || 0)),
        texto: 'prácticas en Entrenamiento',
        lineas,
      })
    }
  }

  // 6. Constancia
  if (!ocultas.has('constancia')) {
    const co = d.constancia || {}
    if (est.constancia !== 'ok') {
      h.push({ clave: 'constancia', emoji: '🔥', titulo: 'Constancia', texto: SIN_REGISTRO, sinRegistro: true })
    } else {
      const lineas = []
      if (co.racha_dias >= RACHA_MINIMA_DIAS) lineas.push(`Tu racha: ${co.racha_dias} días seguidos estudiando.`)
      if (co.mejor_mes && co.mejor_mes.dias > 1) lineas.push(`Tu mejor mes fue ${nombreMes(co.mejor_mes.mes)}, con ${co.mejor_mes.dias} días de práctica.`)
      h.push({
        clave: 'constancia', emoji: '🔥', titulo: 'Le dedicaste',
        grande: String(co.dias_activos),
        texto: co.dias_activos === 1 ? 'día de práctica en la app' : 'días de práctica en la app',
        lineas,
      })
    }
  }

  // 7. Mensaje del director
  if (reporte?.mensaje && reporte.mensaje.trim()) {
    h.push({ clave: 'mensaje', emoji: '💌', titulo: 'Un mensaje para vos', mensaje: reporte.mensaje.trim() })
  }

  // 8. Cierre
  h.push({
    clave: 'cierre', emoji: '👏', titulo: `¡Gracias por esta temporada${nombre ? `, ${nombre}` : ''}!`,
    texto: 'Nos vemos en la próxima.',
    resumen: resumenCorto(reporte, est, ocultas),
  })

  return h
}

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

function capitalizar(s) {
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s
}
