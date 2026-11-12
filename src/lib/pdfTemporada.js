// ─────────────────────────────────────────────────────────────────────────────
// PDF del resumen de temporada del coro (pestaña "Resumen del coro").
// Se arma con jsPDF, que se carga recién al tocar el botón (no suma peso a la app).
// Solo usa fuentes estándar (Helvetica / Times), que cubren acentos y ñ.
// ─────────────────────────────────────────────────────────────────────────────
import { nombreMes, fechaCorta, capitalizar } from './temporada'

const URL_JSPDF = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.2/jspdf.umd.min.js'

let cargaJsPDF = null
function cargarJsPDF() {
  if (window.jspdf?.jsPDF) return Promise.resolve(window.jspdf.jsPDF)
  if (cargaJsPDF) return cargaJsPDF
  cargaJsPDF = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = URL_JSPDF
    s.async = true
    s.onload = () => (window.jspdf?.jsPDF ? resolve(window.jspdf.jsPDF) : reject(new Error('jsPDF no disponible')))
    s.onerror = () => { cargaJsPDF = null; reject(new Error('No se pudo cargar el generador de PDF')) }
    document.head.appendChild(s)
  })
  return cargaJsPDF
}

// Colores de la app
const VERDE = [15, 110, 86]
const VERDE_MEDIO = [29, 158, 117]
const VERDE_CLARO = [225, 245, 238]
const TEXTO = [26, 26, 24]
const GRIS = [95, 94, 90]
const GRIS_CLARO = [136, 135, 128]
const LINEA = [232, 230, 223]
const FONDO_BARRA = [241, 239, 232]

export async function descargarPdfResumen(datos, { nombreCoro = '', temporada, cuenta } = {}) {
  const JsPDF = await cargarJsPDF()
  const doc = new JsPDF({ unit: 'mm', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 16
  const ancho = W - M * 2
  let y = M

  const color = (c, tipo = 'text') => (tipo === 'text' ? doc.setTextColor(...c) : tipo === 'fill' ? doc.setFillColor(...c) : doc.setDrawColor(...c))
  const fuente = (familia, estilo, tam) => { doc.setFont(familia, estilo); doc.setFontSize(tam) }
  const lugar = alto => { if (y + alto > H - 18) { doc.addPage(); y = M } }

  // ── Encabezado ──
  fuente('helvetica', 'bold', 8); color(VERDE)
  doc.text(`TEMPORADA ${temporada || String(datos.desde || '').slice(0, 4)}`, M, y + 3)
  fuente('times', 'normal', 22); color(TEXTO)
  doc.text('Reporte de fin de temporada', M, y + 12)
  fuente('helvetica', 'normal', 10); color(GRIS_CLARO)
  doc.text(`${nombreCoro ? nombreCoro + ' · ' : ''}del ${fechaCorta(datos.desde)} al ${fechaCorta(datos.hasta)} de ${String(datos.hasta || '').slice(0, 4)}`, M, y + 18)
  y += 23
  color(LINEA, 'draw'); doc.setLineWidth(0.3); doc.line(M, y, W - M, y)
  y += 7

  // ── Números principales ──
  const { cantantes, asistencia, eventos, repertorio, entrenamiento, uso_app, participacion, datos_desde } = datos
  const numeros = [
    [String(cantantes?.activos ?? 0), 'Cantantes activos'],
    [asistencia?.sin_registro ? '—' : `${asistencia?.pct ?? 0}%`, asistencia?.sin_registro ? 'Asistencia: sin registro' : 'Asistencia general'],
    [String(eventos?.conciertos ?? 0), 'Conciertos'],
    [String(repertorio?.obras_temporada ?? 0), 'Obras en la temporada'],
    [repertorio?.dedicacion_promedio != null ? `${repertorio.dedicacion_promedio}%` : '—', 'Dedicación promedio'],
  ]
  const porFila = 5
  const gap = 3
  const wBox = (ancho - gap * (porFila - 1)) / porFila
  numeros.forEach(([v, l], i) => {
    const x = M + i * (wBox + gap)
    color(VERDE_CLARO, 'fill'); doc.roundedRect(x, y, wBox, 20, 2, 2, 'F')
    fuente('times', 'normal', 17); color(VERDE); doc.text(v, x + 4, y + 9.5)
    fuente('helvetica', 'normal', 7.5); color(VERDE)
    doc.text(doc.splitTextToSize(l, wBox - 7), x + 4, y + 15)
  })
  y += 28

  // ── Helpers de secciones ──
  const titulo = t => {
    lugar(16)
    fuente('helvetica', 'bold', 10); color(TEXTO)
    doc.text(t.toUpperCase(), M, y)
    y += 2.5
    color(LINEA, 'draw'); doc.line(M, y, W - M, y)
    y += 6
  }
  const subtitulo = t => {
    lugar(10)
    fuente('helvetica', 'bold', 8.5); color(GRIS)
    doc.text(t.toUpperCase(), M, y)
    y += 5
  }
  const sinRegistro = () => {
    fuente('helvetica', 'italic', 9.5); color(GRIS_CLARO)
    doc.text('Sin registro esta temporada', M, y)
    y += 8
  }
  const nota = t => {
    if (!t) return
    fuente('helvetica', 'normal', 7.5); color(GRIS_CLARO)
    doc.text(t, M, y)
    y += 6
  }
  const dato = (l, v) => {
    lugar(7)
    fuente('helvetica', 'normal', 9.5); color(GRIS); doc.text(l, M, y)
    color(TEXTO); doc.text(String(v), W - M, y, { align: 'right' })
    y += 6
  }
  const barras = (filas, max = 100) => {
    const xBar = M + 38
    const wBar = ancho - 38 - 26
    filas.forEach(({ label, valor, texto }) => {
      lugar(7)
      fuente('helvetica', 'normal', 9); color(GRIS)
      doc.text(String(label), M, y)
      color(FONDO_BARRA, 'fill'); doc.roundedRect(xBar, y - 2.6, wBar, 3, 1.5, 1.5, 'F')
      const w = max > 0 ? Math.max(1.5, (valor / max) * wBar) : 0
      if (valor > 0) { color(VERDE_MEDIO, 'fill'); doc.roundedRect(xBar, y - 2.6, w, 3, 1.5, 1.5, 'F') }
      color(TEXTO); doc.text(String(texto), W - M, y, { align: 'right' })
      y += 6
    })
    y += 2
  }

  // ── Cantantes por cuerda ──
  titulo('Cantantes por cuerda')
  const cuerdas = cantantes?.por_cuerda || []
  if (!cuerdas.length) sinRegistro()
  else barras(cuerdas.map(c => ({ label: capitalizar(c.voz), valor: c.n, texto: c.n })), Math.max(...cuerdas.map(c => c.n)))

  // ── Asistencia ──
  titulo('Asistencia')
  if (asistencia?.sin_registro) sinRegistro()
  else {
    fuente('helvetica', 'normal', 9.5); color(GRIS)
    doc.text(`${asistencia.listas} listas tomadas · ${asistencia.pct ?? 0}% de asistencia general (solo cantantes)`, M, y)
    y += 7
    subtitulo('Por cuerda')
    barras((asistencia.por_cuerda || []).map(c => ({ label: capitalizar(c.voz), valor: c.pct ?? 0, texto: `${c.pct ?? 0}%` })))
    subtitulo('Por mes')
    barras((asistencia.por_mes || []).map(m => ({ label: capitalizar(nombreMes(m.mes)), valor: m.pct ?? 0, texto: `${m.pct ?? 0}% · ${m.listas}` })))
  }

  // ── Conciertos y eventos ──
  titulo('Conciertos y eventos')
  if ((eventos?.conciertos || 0) + (eventos?.ensayos || 0) + (eventos?.otros || 0) === 0) sinRegistro()
  else {
    fuente('helvetica', 'normal', 9.5); color(GRIS)
    doc.text(`${eventos.conciertos} conciertos · ${eventos.ensayos} ensayos · ${eventos.otros} otros`, M, y)
    y += 7
    ;(eventos.lista_conciertos || []).forEach(c => {
      lugar(7)
      fuente('helvetica', 'normal', 9.5); color(VERDE)
      doc.text(fechaCorta(c.fecha), M, y)
      color(TEXTO)
      const t = doc.splitTextToSize(`${c.titulo}${c.lugar ? ' · ' + c.lugar : ''}`, ancho - 32)
      doc.text(t, M + 32, y)
      y += 5.5 * t.length
    })
    y += 3
  }

  // ── Repertorio ──
  titulo('Repertorio')
  const obras = repertorio?.obras || []
  if (!obras.length) sinRegistro()
  else {
    subtitulo('Dedicación por cuerda')
    barras((repertorio.dedicacion_por_cuerda || []).map(c => ({ label: capitalizar(c.voz), valor: c.pct ?? 0, texto: `${c.pct ?? 0}%` })))
    subtitulo('Obras (de más a menos estudiada)')
    const cols = [M, W - M - 52, W - M - 26, W - M]
    lugar(8)
    fuente('helvetica', 'bold', 8); color(GRIS_CLARO)
    doc.text('OBRA', cols[0], y)
    doc.text('APERTURAS', cols[1], y, { align: 'right' })
    doc.text('CANTANTES', cols[2], y, { align: 'right' })
    doc.text('ESTUDIADA', cols[3], y, { align: 'right' })
    y += 2; color(LINEA, 'draw'); doc.line(M, y, W - M, y); y += 4.5
    obras.forEach(o => {
      const t = doc.splitTextToSize(`${o.titulo}${o.publicada ? '' : ' (despublicada)'}`, cols[1] - M - 22)
      lugar(5.5 * t.length + 1)
      fuente('helvetica', 'normal', 9); color(TEXTO)
      doc.text(t, cols[0], y)
      doc.text(String(o.aperturas), cols[1], y, { align: 'right' })
      doc.text(String(o.cantantes), cols[2], y, { align: 'right' })
      doc.text(String(o.estudiada_por), cols[3], y, { align: 'right' })
      y += 5.5 * t.length
    })
    y += 1
    nota(datos_desde?.estudio ? `Registro de estudio desde el ${fechaCorta(datos_desde.estudio)}` : null)
  }

  // ── Entrenamiento ──
  titulo('Entrenamiento')
  if ((entrenamiento?.ejercicios || 0) + (entrenamiento?.lecciones_teoria || 0) === 0) sinRegistro()
  else {
    dato('Ejercicios completados', `${entrenamiento.ejercicios} (${entrenamiento.cantantes_que_practicaron} personas)`)
    dato('Lecciones de teoría', `${entrenamiento.lecciones_teoria} (${entrenamiento.cantantes_teoria} personas)`)
    nota(datos_desde?.entrenamiento ? `Registro desde el ${fechaCorta(datos_desde.entrenamiento)}` : null)
  }

  // ── Uso de la app ──
  titulo('Uso de la app')
  if (!uso_app?.sesiones) sinRegistro()
  else {
    dato('Ingresos', uso_app.sesiones)
    dato('Cantantes que entraron', `${uso_app.cantantes_con_ingreso} de ${cantantes?.activos ?? 0}`)
    y += 2
    subtitulo('Ingresos por mes')
    const maxS = Math.max(...uso_app.por_mes.map(x => x.sesiones), 1)
    barras(uso_app.por_mes.map(m => ({ label: capitalizar(nombreMes(m.mes)), valor: m.sesiones, texto: `${m.sesiones} · ${m.personas} pers.` })), maxS)
    if (uso_app.pantallas?.length) {
      subtitulo('Pantallas más visitadas')
      barras(uso_app.pantallas.map(p => ({ label: capitalizar(p.pantalla), valor: p.visitas, texto: p.visitas })), uso_app.pantallas[0].visitas)
    }
    nota(datos_desde?.uso_app ? `Registro de accesos desde el ${fechaCorta(datos_desde.uso_app)}` : null)
  }

  // ── Participación ──
  titulo('Participación')
  if (!participacion?.encuestas && !participacion?.avisos) sinRegistro()
  else {
    dato('Encuestas', participacion.encuestas ? `${participacion.encuestas} · participación promedio ${participacion.participacion_encuestas ?? 0}%` : 'Sin registro')
    dato('Avisos publicados', participacion.avisos ? `${participacion.avisos} · leídos en promedio por el ${participacion.lectura_avisos ?? 0}%` : 'Sin registro')
  }

  // ── Reportes de los cantantes ──
  if (cuenta) {
    titulo('Reportes de los cantantes')
    dato('En borrador', cuenta.borrador)
    dato('Publicados', cuenta.publicado)
    dato('Ya los vieron', cuenta.vistos)
    if (cuenta.excluido) dato('Excluidos', cuenta.excluido)
  }

  // ── Pie de página ──
  const total = doc.getNumberOfPages()
  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })
  for (let p = 1; p <= total; p++) {
    doc.setPage(p)
    fuente('helvetica', 'normal', 7.5); color(GRIS_CLARO)
    doc.text(`CORUM · ${nombreCoro} · generado el ${hoy}`, M, H - 9)
    doc.text(`${p} de ${total}`, W - M, H - 9, { align: 'right' })
  }

  const slug = (nombreCoro || 'coro').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
  doc.save(`reporte-temporada-${temporada || ''}-${slug}.pdf`)
}
