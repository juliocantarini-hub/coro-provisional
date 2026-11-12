// ─────────────────────────────────────────────────────────────────────────────
// Versión imprimible del resumen de temporada del coro (pestaña "Resumen del coro").
// Mismo mecanismo que "Imprimir listado" de Cantantes: arma una página limpia
// (sin menú ni botones) en una ventana nueva y abre el diálogo de impresión,
// donde se puede elegir "Guardar como PDF".
// ─────────────────────────────────────────────────────────────────────────────
import { nombreMes, fechaCorta, capitalizar } from './temporada'
import { ETIQUETAS_SECCION } from './actividad'

export const SECCIONES_IMPRESION = [
  { clave: 'cuerdas',       label: 'Cantantes por cuerda' },
  { clave: 'asistencia',    label: 'Asistencia' },
  { clave: 'eventos',       label: 'Conciertos y eventos' },
  { clave: 'repertorio',    label: 'Repertorio' },
  { clave: 'entrenamiento', label: 'Entrenamiento' },
  { clave: 'uso',           label: 'Uso de la app' },
  { clave: 'participacion', label: 'Participación' },
  { clave: 'reportes',      label: 'Reportes de los cantantes' },
]

const esc = v => String(v ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

const SIN_REGISTRO = '<p class="sin">Sin registro esta temporada</p>'

function barras(filas, max = 100) {
  return `<div class="barras">${filas.map(({ label, valor, texto }) => {
    const ancho = max > 0 && valor > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0
    return `<div class="barra"><span class="b-label">${esc(label)}</span><span class="b-pista"><span class="b-relleno" style="width:${ancho}%"></span></span><span class="b-valor">${esc(texto)}</span></div>`
  }).join('')}</div>`
}
const subtitulo = t => `<h3>${esc(t)}</h3>`
const dato = (l, v) => `<div class="dato"><span>${esc(l)}</span><span>${esc(v)}</span></div>`
const nota = t => (t ? `<p class="nota">${esc(t)}</p>` : '')
const seccion = (t, cuerpo) => `<section><h2>${esc(t)}</h2>${cuerpo}</section>`

export function imprimirResumen(datos, { nombreCoro = '', temporada, cuenta, secciones } = {}) {
  const ver = new Set(secciones || SECCIONES_IMPRESION.map(s => s.clave))
  const { cantantes, asistencia, eventos, repertorio, entrenamiento, uso_app, participacion, datos_desde } = datos
  const partes = []

  if (ver.has('cuerdas')) {
    const c = cantantes?.por_cuerda || []
    partes.push(seccion('Cantantes por cuerda', c.length
      ? barras(c.map(x => ({ label: capitalizar(x.voz), valor: x.n, texto: x.n })), Math.max(...c.map(x => x.n)))
      : SIN_REGISTRO))
  }

  if (ver.has('asistencia')) {
    partes.push(seccion('Asistencia', asistencia?.sin_registro ? SIN_REGISTRO : `
      <p class="intro">${asistencia.listas} listas tomadas · ${asistencia.pct ?? 0}% de asistencia general (solo cantantes)</p>
      ${subtitulo('Por cuerda')}
      ${barras((asistencia.por_cuerda || []).map(x => ({ label: capitalizar(x.voz), valor: x.pct ?? 0, texto: `${x.pct ?? 0}%` })))}
      ${subtitulo('Por mes')}
      ${barras((asistencia.por_mes || []).map(m => ({ label: capitalizar(nombreMes(m.mes)), valor: m.pct ?? 0, texto: `${m.pct ?? 0}% · ${m.listas} ${m.listas === 1 ? 'lista' : 'listas'}` })))}
    `))
  }

  if (ver.has('eventos')) {
    const total = (eventos?.conciertos || 0) + (eventos?.ensayos || 0) + (eventos?.otros || 0)
    partes.push(seccion('Conciertos y eventos', !total ? SIN_REGISTRO : `
      <p class="intro">${eventos.conciertos} conciertos · ${eventos.ensayos} ensayos · ${eventos.otros} otros</p>
      ${(eventos.lista_conciertos || []).length ? `<table class="lista"><tbody>${eventos.lista_conciertos.map(c => `
        <tr><td class="fecha">${esc(fechaCorta(c.fecha))}</td><td>${esc(c.titulo)}${c.lugar ? `<span class="tenue"> · ${esc(c.lugar)}</span>` : ''}</td></tr>`).join('')}
      </tbody></table>` : ''}
    `))
  }

  if (ver.has('repertorio')) {
    const obras = repertorio?.obras || []
    partes.push(seccion('Repertorio', !obras.length ? SIN_REGISTRO : `
      ${subtitulo('Dedicación por cuerda')}
      ${barras((repertorio.dedicacion_por_cuerda || []).map(x => ({ label: capitalizar(x.voz), valor: x.pct ?? 0, texto: `${x.pct ?? 0}%` })))}
      ${subtitulo('Obras (de más a menos estudiada)')}
      <table class="tabla">
        <thead><tr><th>Obra</th><th class="num">Aperturas</th><th class="num">Cantantes</th><th class="num">Estudiada</th></tr></thead>
        <tbody>${obras.map(o => `<tr><td>${esc(o.titulo)}${o.publicada ? '' : '<span class="tenue"> (despublicada)</span>'}</td><td class="num">${o.aperturas}</td><td class="num">${o.cantantes}</td><td class="num">${o.estudiada_por}</td></tr>`).join('')}</tbody>
      </table>
      ${nota(datos_desde?.estudio ? `Registro de estudio desde el ${fechaCorta(datos_desde.estudio)}` : '')}
    `))
  }

  if (ver.has('entrenamiento')) {
    const e = entrenamiento || {}
    partes.push(seccion('Entrenamiento', (e.ejercicios || 0) + (e.lecciones_teoria || 0) === 0 ? SIN_REGISTRO : `
      ${dato('Ejercicios completados', `${e.ejercicios} (${e.cantantes_que_practicaron} personas)`)}
      ${dato('Lecciones de teoría', `${e.lecciones_teoria} (${e.cantantes_teoria} personas)`)}
      ${nota(datos_desde?.entrenamiento ? `Registro desde el ${fechaCorta(datos_desde.entrenamiento)}` : '')}
    `))
  }

  if (ver.has('uso')) {
    const u = uso_app || {}
    partes.push(seccion('Uso de la app', !u.sesiones ? SIN_REGISTRO : `
      ${dato('Ingresos', u.sesiones)}
      ${dato('Cantantes que entraron', `${u.cantantes_con_ingreso} de ${cantantes?.activos ?? 0}`)}
      ${subtitulo('Ingresos por mes')}
      ${barras(u.por_mes.map(m => ({ label: capitalizar(nombreMes(m.mes)), valor: m.sesiones, texto: `${m.sesiones} · ${m.personas} pers.` })), Math.max(1, ...u.por_mes.map(x => x.sesiones)))}
      ${u.pantallas?.length ? subtitulo('Pantallas más visitadas') + barras(u.pantallas.map(p => ({ label: ETIQUETAS_SECCION[p.pantalla] || capitalizar(p.pantalla), valor: p.visitas, texto: p.visitas })), u.pantallas[0].visitas) : ''}
      ${nota(datos_desde?.uso_app ? `Registro de accesos desde el ${fechaCorta(datos_desde.uso_app)}` : '')}
    `))
  }

  if (ver.has('participacion')) {
    const p = participacion || {}
    partes.push(seccion('Participación', !p.encuestas && !p.avisos ? SIN_REGISTRO : `
      ${dato('Encuestas', p.encuestas ? `${p.encuestas} · participación promedio ${p.participacion_encuestas ?? 0}%` : 'Sin registro')}
      ${dato('Avisos publicados', p.avisos ? `${p.avisos} · leídos en promedio por el ${p.lectura_avisos ?? 0}%` : 'Sin registro')}
    `))
  }

  if (ver.has('reportes') && cuenta) {
    partes.push(seccion('Reportes de los cantantes', `
      ${dato('En borrador', cuenta.borrador)}
      ${dato('Publicados', cuenta.publicado)}
      ${dato('Ya los vieron', cuenta.vistos)}
      ${cuenta.excluido ? dato('Excluidos', cuenta.excluido) : ''}
    `))
  }

  const numeros = [
    [cantantes?.activos ?? 0, 'Cantantes activos'],
    [asistencia?.sin_registro ? '—' : `${asistencia?.pct ?? 0}%`, asistencia?.sin_registro ? 'Asistencia: sin registro' : 'Asistencia general'],
    [eventos?.conciertos ?? 0, 'Conciertos'],
    [repertorio?.obras_temporada ?? 0, 'Obras en la temporada'],
    [repertorio?.dedicacion_promedio != null ? `${repertorio.dedicacion_promedio}%` : '—', 'Dedicación promedio'],
  ]
  const anio = temporada || String(datos.desde || '').slice(0, 4)
  const hoy = new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })

  const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Reporte de temporada ${esc(anio)} · ${esc(nombreCoro)}</title>
<style>
  @page { size: A4; margin: 16mm 15mm 18mm; }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 11.5px; color: #1A1A18; padding: 28px; max-width: 820px; margin: 0 auto; }
  @media print { body { padding: 0; max-width: none; } }
  header { border-bottom: 1px solid #E8E6DF; padding-bottom: 12px; margin-bottom: 16px; }
  .eyebrow { font-size: 9.5px; font-weight: 700; color: #0F6E56; letter-spacing: 0.8px; text-transform: uppercase; }
  h1 { font-family: Georgia, serif; font-weight: normal; font-size: 24px; margin: 4px 0 3px; }
  .periodo { color: #888780; font-size: 11.5px; }
  .numeros { display: grid; grid-template-columns: repeat(5, 1fr); gap: 8px; margin-bottom: 20px; }
  .numero { background: #E1F5EE; border-radius: 8px; padding: 10px 12px; }
  .numero b { display: block; font-family: Georgia, serif; font-weight: normal; font-size: 21px; color: #0F6E56; line-height: 1.1; }
  .numero span { font-size: 9.5px; color: #0F6E56; }
  section { margin-bottom: 18px; break-inside: avoid; page-break-inside: avoid; }
  h2 { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.6px; color: #1A1A18; border-bottom: 1px solid #E8E6DF; padding-bottom: 5px; margin-bottom: 9px; }
  h3 { font-size: 9.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: #5F5E5A; margin: 10px 0 5px; }
  .intro { color: #5F5E5A; margin-bottom: 4px; }
  .sin { color: #888780; font-style: italic; }
  .nota { color: #888780; font-size: 9.5px; margin-top: 6px; }
  .tenue { color: #888780; }
  .barras { display: grid; gap: 5px; }
  .barra { display: grid; grid-template-columns: 110px 1fr 90px; align-items: center; gap: 10px; }
  .b-label { color: #5F5E5A; }
  .b-pista { height: 7px; background: #F1EFE8; border-radius: 4px; overflow: hidden; }
  .b-relleno { display: block; height: 100%; background: #1D9E75; border-radius: 4px; }
  .b-valor { text-align: right; }
  .dato { display: flex; justify-content: space-between; gap: 12px; padding: 4px 0; border-bottom: 1px solid #F1EFE8; }
  .dato span:first-child { color: #5F5E5A; }
  table { width: 100%; border-collapse: collapse; }
  .tabla th { text-align: left; font-size: 9px; font-weight: 700; color: #888780; text-transform: uppercase; letter-spacing: 0.4px; padding: 4px 6px; border-bottom: 1px solid #D3D1C7; }
  .tabla td { padding: 5px 6px; border-bottom: 1px solid #F1EFE8; }
  .tabla tr { break-inside: avoid; }
  .num { text-align: right !important; width: 80px; }
  .lista td { padding: 4px 0; border-bottom: 1px solid #F1EFE8; vertical-align: top; }
  .lista .fecha { color: #0F6E56; width: 110px; }
  footer { margin-top: 22px; padding-top: 8px; border-top: 1px solid #E8E6DF; color: #888780; font-size: 9.5px; }
</style>
</head>
<body>
  <header>
    <div class="eyebrow">Temporada ${esc(anio)}</div>
    <h1>Reporte de fin de temporada</h1>
    <div class="periodo">${esc(nombreCoro)}${nombreCoro ? ' · ' : ''}del ${esc(fechaCorta(datos.desde))} al ${esc(fechaCorta(datos.hasta))} de ${esc(String(datos.hasta || '').slice(0, 4))}</div>
  </header>
  <div class="numeros">${numeros.map(([v, l]) => `<div class="numero"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('')}</div>
  ${partes.join('\n')}
  <footer>CORUM · ${esc(nombreCoro)} · generado el ${esc(hoy)}</footer>
</body>
</html>`

  const ventana = window.open('', '_blank')
  if (!ventana) return false
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 500)
  return true
}
