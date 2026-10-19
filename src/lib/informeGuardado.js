import { supabase } from './supabase'

// Arma el paquete de diagnóstico de una toma: entrada, curva de altura (sin audio) y
// resultados. Lo usan el botón oculto "Copiar datos de diagnóstico" y el guardado
// para el director.
export function armarDiagnostico({ titulo, vozNombre, desde, hasta, informe, entrada }) {
  const r2 = (v) => (typeof v === 'number' ? Math.round(v * 1000) / 1000 : v)
  return {
    version: 1,
    conGuiaDePiano: !!entrada.conGuia,
    obra: titulo,
    voz: vozNombre,
    compases: [desde, hasta],
    sampleRate: entrada.sampleRate,
    opciones: entrada.opciones,
    notasEntrada: entrada.notas.map((n) => ({ midi: n.midi, inicio: r2(n.inicio), duracion: r2(n.duracion), compas: n.compas, nombre: n.nombre, pulsoSeg: r2(n.pulsoSeg), tramo: n.tramo })),
    curva: informe.curvaCompacta,
    resumen: informe.resumen,
    notasResultado: informe.notas.map((n) => ({ i: n.indice, nombre: n.nombre, compas: n.compas, estado: n.estado, frames: n.frames, ini: r2(n.inicioSeg), fin: r2(n.finSeg), dev: n.desviacionCents, pctVerde: n.pctVerde, ritmoMs: n.ritmo?.errorMs })),
  }
}

// Guarda un resumen en números del informe para el director. Nunca el audio.
// Si falla (sin conexión, tabla sin crear), se ignora: no debe molestar al cantante.
export async function guardarInformeParaDirector({ perfil, titulo, vozNombre, desde, hasta, informe, entrada }) {
  try {
    if (!perfil?.id || !perfil?.coro_id || !informe?.resumen) return
    const r = informe.resumen
    const diagnostico = entrada ? armarDiagnostico({ titulo, vozNombre, desde, hasta, informe, entrada }) : null
    const { error } = await supabase.from('informes_afinacion').insert({
      coro_id: perfil.coro_id,
      perfil_id: perfil.id,
      obra_titulo: titulo ? String(titulo).slice(0, 200) : null,
      voz: vozNombre ? String(vozNombre).slice(0, 40) : null,
      compas_desde: desde != null ? String(desde) : null,
      compas_hasta: hasta != null ? String(hasta) : null,
      // Para el director se guardan los números estrictos (los de antes); el cantante ve los más permisivos
      pct_afinacion: r.alineacionDudosa ? null : (r.pctVerdeEstricto ?? r.pctVerde),
      pct_ritmo: r.alineacionDudosa ? null : (r.ritmo?.pctOkEstricto ?? r.ritmo?.pctOk ?? null),
      corrimiento_cents: r.offsetGlobalCents ?? null,
      confianza: r.confianza ?? null,
      dudosa: !!r.alineacionDudosa,
      resumen: r,
      compases: informe.compases,
      mensajes: informe.mensajes,
      diagnostico,
    })
    if (error) console.warn('No se pudo guardar el informe para el director:', error.message)
  } catch (e) {
    console.warn('No se pudo guardar el informe para el director:', e?.message || e)
  }
}
