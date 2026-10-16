import { notaAMidi } from './afinacion'

// Arma, a partir de la partitura ya parseada (parsearMusicXML), la lista de
// notas de UNA voz en un rango de compases, en el formato que espera
// analizarGrabacion (ver informeAfinacion.js).
//
// Tiempos: la partitura ya trae el tiempo en segundos con los cambios de tempo
// aplicados. Acá se hacen relativos al inicio del rango elegido. A cada nota se
// le agrega el "tramo" (zona de tempo constante) y la duración de un pulso.
//
// Ojo: no se despliegan las repeticiones (el parser tampoco lo hace), así que
// el rango elegido se analiza una sola vez, tal como está escrito.

const EPS = 1e-6

export function listarCompases(partitura) {
  return (partitura?.medidas || []).map((m) => m.numero)
}

function medidaIndice(medidas, numero) {
  return medidas.findIndex((m) => m.numero === numero)
}

export function rangoEnSegundos(partitura, desdeCompas, hastaCompas) {
  const medidas = partitura.medidas || []
  const i = medidaIndice(medidas, desdeCompas)
  const j = medidaIndice(medidas, hastaCompas)
  if (i < 0 || j < 0 || j < i) return null
  const desde = medidas[i].tiempo
  const hasta = medidas[j + 1] ? medidas[j + 1].tiempo : partitura.duracionTotal
  return { desde, hasta, duracion: hasta - desde }
}

export function notasParaInforme(partitura, vozId, desdeCompas, hastaCompas) {
  const voz = partitura.voces.find((v) => v.id === vozId)
  const rango = rangoEnSegundos(partitura, desdeCompas, hastaCompas)
  if (!voz || !rango) return { notas: [], rango: null }

  const medidas = partitura.medidas
  const pulsos = partitura.tiempos || []

  const compasDe = (t) => {
    let c = medidas[0]?.numero ?? 1
    for (const m of medidas) {
      if (m.tiempo <= t + EPS) c = m.numero
      else break
    }
    return c
  }
  const pulsoDe = (t) => {
    let idx = 0
    for (let k = 0; k < pulsos.length; k++) {
      if (pulsos[k].tiempo <= t + EPS) idx = k
      else break
    }
    const ini = pulsos[idx]?.tiempo ?? 0
    const fin = pulsos[idx + 1]?.tiempo ?? partitura.duracionTotal
    return Math.max(0.15, fin - ini)
  }

  const notas = []
  for (const n of voz.notas) {
    if (!n.nota) continue // silencio
    if (n.tiempo < rango.desde - EPS || n.tiempo >= rango.hasta - EPS) continue
    const midi = notaAMidi(n.nota)
    if (midi == null) continue
    const pulsoSeg = pulsoDe(n.tiempo)
    notas.push({
      midi,
      inicio: n.tiempo - rango.desde,
      duracion: n.duracion,
      compas: compasDe(n.tiempo),
      nombre: n.nota,
      letra: n.letra || null,
      pulsoSeg,
      tramo: Math.round(60 / pulsoSeg), // bpm redondeado: cambia donde cambia el tempo
    })
  }
  return { notas, rango, pulsoInicialSeg: notas.length ? notas[0].pulsoSeg : pulsoDe(rango.desde) }
}

/**
 * Pulsos para el metrónomo y el conteo: un clic por cada tiempo del compás de la partitura (los
 * mismos que usa el cursor), con el primer tiempo de cada compás acentuado. "t" en segundos
 * escritos desde el inicio del fragmento.
 * Devuelve { clics, clicsPrimerCompas, pulsoSeg } (pulsoSeg = separación entre los dos primeros clics).
 */
export function pulsosMetronomo(partitura, desdeCompas, hastaCompas) {
  const rango = rangoEnSegundos(partitura, desdeCompas, hastaCompas)
  if (!rango) return { clics: [], clicsPrimerCompas: 0, pulsoSeg: null }
  const medidas = partitura.medidas || []
  const tiempos = partitura.tiempos || []
  const clics = []
  let clicsPrimerCompas = 0
  let primero = true
  for (let i = 0; i < medidas.length; i++) {
    const m = medidas[i]
    if (m.tiempo < rango.desde - EPS || m.tiempo >= rango.hasta - EPS) continue
    const fin = medidas[i + 1] ? medidas[i + 1].tiempo : partitura.duracionTotal
    const delCompas = tiempos.filter((p) => p.tiempo >= m.tiempo - EPS && p.tiempo < fin - EPS)
    delCompas.forEach((p, k) => clics.push({ t: p.tiempo - rango.desde, acento: k === 0 }))
    if (primero) { clicsPrimerCompas = delCompas.length; primero = false }
  }
  return { clics, clicsPrimerCompas, pulsoSeg: clics.length > 1 ? clics[1].t - clics[0].t : null }
}
