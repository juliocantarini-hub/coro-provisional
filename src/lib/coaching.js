import { supabase } from './supabase'

// Consejos de práctica escritos por IA a partir del informe de afinación y ritmo.
// IMPORTANTE: solo viaja un resumen en números (compases, desvíos en cents, tendencias).
// El audio NO sale del dispositivo: se descarta al terminar el análisis.

const MAX_NOTAS_PROBLEMA = 8

const severidad = (n) => {
  let s = 0
  if (n.estado === 'nota_distinta') s += 100
  else if (n.estado === 'rojo') s += 60
  else if (n.estado === 'amarillo') s += 30
  if (n.ritmo && n.ritmo.estado === 'rojo') s += 50
  else if (n.ritmo && n.ritmo.estado === 'leve') s += 20
  if (n.duracionEstado && n.duracionEstado !== 'ok') s += 15
  return s + Math.min(40, Math.abs(n.desviacionRelativaCents ?? n.desviacionCents ?? 0) / 5)
}

export function armarResumenParaCoaching(informe, { titulo, vozNombre, desde, hasta, pulsoSeg } = {}) {
  const r = informe.resumen
  const rit = r.ritmo || {}
  const notasProblema = informe.notas
    .filter((n) => n.estado !== 'no_detectada' && n.estado !== 'no_separable')
    .map((n) => ({ n, s: severidad(n) }))
    .filter((x) => x.s >= 30 && !x.n.pocaEvidencia)
    .sort((a, b) => b.s - a.s)
    .slice(0, MAX_NOTAS_PROBLEMA)
    .map(({ n }) => {
      const o = { compas: n.compas, nota: n.nombre }
      if (n.estado === 'nota_distinta') o.nota_distinta = true
      else if (n.estado !== 'verde') o.cents = Math.round(n.desviacionRelativaCents ?? n.desviacionCents) // + = alto, − = bajo
      if (n.ritmo && n.ritmo.estado !== 'ok') o.ritmo = `${n.ritmo.direccion || ''} (${n.ritmo.estado})`.trim()
      if (n.duracionEstado && n.duracionEstado !== 'ok') o.duracion = n.duracionEstado === 'corta' ? 'cortada' : 'alargada'
      return o
    })
    .sort((a, b) => a.compas - b.compas)

  const t = informe.tendencias || {}
  return {
    obra: String(titulo || '').slice(0, 80),
    voz: String(vozNombre || '').slice(0, 30),
    compasDesde: desde,
    compasHasta: hasta,
    bpmEscrito: pulsoSeg ? Math.round(60 / pulsoSeg) : null,
    pctAfinacionEntreNotas: r.pctVerde, // ya descuenta la afinación general
    pctRitmoEnTiempo: rit.pctOk ?? null,
    ritmoNoMedible: rit.concluyente === false ? true : undefined, // el ritmo no se pudo medir con confianza: no hablar de ritmo
    tempoCantadoPct: rit.tempoRelativo != null ? Math.round(rit.tempoRelativo * 100) : null,
    afinacionGeneralCents: r.offsetGlobalCents, // todo el fragmento más alto (+) o más bajo (−) que lo escrito; NO está incluido en los cents de cada nota
    notasEsperadas: r.notasEsperadas,
    notasDetectadas: r.notasDetectadas,
    notasDistintas: r.notasDistintas?.length || 0,
    compasesSinCantarAlInicio: r.compasesSinCantarAlInicio || [],
    compasesSinCantarAlFinal: r.compasesSinCantarAlFinal || [],
    // Solo se incluyen los datos que existen: un compás sin dato de ritmo (p. ej. el de la última
    // nota, que no se puede medir) no se manda como null para que no parezca un problema.
    compases: informe.compases.map((c) => {
      const o = { c: c.compas, afinacion: c.estado }
      if (c.estadoRitmo) o.ritmo = c.estadoRitmo
      if (c.ritmoTendencia) o.tendenciaRitmo = c.ritmoTendencia
      return o
    }),
    notasProblema,
    vibratoAmplio: r.vibrato && r.vibrato.amplias ? { notas: r.vibrato.amplias, ampCents: r.vibrato.ampCents, vecesPorSegundo: r.vibrato.hz } : undefined,
    tendencias: {
      saltosHaciaArriba: t.saltosAscendentes,
      saltosHaciaAbajo: t.saltosDescendentes,
      finalesDeFrase: t.finalesDeFrase,
      notasLargas: t.notasLargas,
    },
    avisosAutomaticos: (informe.mensajes || []).slice(0, 8),
  }
}

export async function pedirCoaching(resumen) {
  const { data, error } = await supabase.functions.invoke('coaching-informe', { body: { resumen } })
  if (error) {
    let detalle = null
    try { detalle = await error.context?.json?.() } catch { /* sin cuerpo */ }
    const e = new Error(detalle?.mensaje || 'No pudimos generar los consejos ahora.')
    e.codigo = detalle?.error || 'error'
    throw e
  }
  if (!data?.texto) throw new Error('No pudimos generar los consejos ahora.')
  return data.texto
}
