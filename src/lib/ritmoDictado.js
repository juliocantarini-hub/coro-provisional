// Dictados rítmicos: el cantante escucha un ritmo y lo reproduce de dos maneras.
//   · Ejercicios 1 y 2 de cada nivel ("de oído"): lo escucha sin ver la partitura y lo toca con el botón.
//   · Ejercicios 3, 4 y 5 ("armar"): lo escucha y lo escribe compás por compás eligiendo figuras.
// Los ritmos se generan al azar (cada intento es uno nuevo) con las figuras que corresponden al nivel.
// No depende de React ni de la red: se puede probar en Node.

import { APROBADO_PCT, EJERCICIOS_PARA_AVANZAR, EJERCICIOS_POR_NIVEL, ESTRELLAS_MAX, estrellasPara, estadoNiveles, construirEjercicio, corregir } from './ritmo.js'

export { APROBADO_PCT, EJERCICIOS_PARA_AVANZAR, EJERCICIOS_POR_NIVEL, ESTRELLAS_MAX, estrellasPara, estadoNiveles, corregir }

const EPS = 1e-6

// "unidades": trocitos de compás que se pegan hasta llenarlo. t = figuras (r = silencio), a = cada cuántos tiempos
// puede empezar (alineación), p = peso al sortear.
const u = (t, a = 1, p = 1) => ({ t: t.split(' '), a, p })
const L = {
  redonda: u('4', 4, 1), blanca2: u('2 2', 2, 1.4),
  blanca: u('2', 2, 1), negra: u('1', 1, 1.5),
  rNegra: u('r1', 1, 0.7), rBlanca: u('r2', 2, 0.5),
  corcheas: u('0.5 0.5', 1, 1.6),
  semis: u('0.25 0.25 0.25 0.25', 1, 1), corSem: u('0.5 0.25 0.25', 1, 0.9), semCor: u('0.25 0.25 0.5', 1, 0.9),
  puntilloCor: u('1.5 0.5', 1, 1.2), puntilloSem: u('0.75 0.25', 1, 0.8), blancaPunt: u('3', 4, 0.8),
  tres: u('3', 3, 1), blancaLibre: u('2', 1, 1),
}

export const NIVELES_DICTADO = [
  { id: 1, nombre: 'Redondas y blancas', descr: 'Sonidos largos: uno o dos por compás.', compas: [4, 4], pool: [L.redonda, L.blanca2] },
  { id: 2, nombre: 'Negras', descr: 'Sumamos el pulso: un sonido en cada tiempo.', compas: [4, 4], pool: [L.redonda, L.blanca, L.negra] },
  { id: 3, nombre: 'Silencios', descr: 'Escuchá dónde hay pausa y escribí el silencio.', compas: [4, 4], pool: [L.redonda, L.blanca, L.negra, L.rNegra, L.rBlanca] },
  { id: 4, nombre: 'Corcheas', descr: 'Dos sonidos por pulso.', compas: [4, 4], pool: [L.blanca, L.negra, L.rNegra, L.corcheas] },
  { id: 5, nombre: 'Semicorcheas', descr: 'Cuatro sonidos por pulso. Despacio y con atención.', compas: [4, 4], pool: [L.blanca, L.negra, L.rNegra, L.corcheas, L.semis, L.corSem, L.semCor] },
  { id: 6, nombre: 'Puntillos', descr: 'Figuras con puntillo: la mitad más larga.', compas: [4, 4], pool: [L.blanca, L.negra, L.corcheas, L.puntilloCor, L.puntilloSem, L.blancaPunt] },
  { id: 7, nombre: 'Compás de 3/4', descr: 'Tres pulsos por compás, como un vals.', compas: [3, 4], pool: [L.tres, L.blancaLibre, L.negra, L.rNegra, L.corcheas, L.puntilloCor] },
  { id: 8, nombre: 'Mezcla completa', descr: 'Todas las figuras, en compás de 4/4 y de 3/4.', compas: [4, 4], pool: [L.blanca, L.negra, L.rNegra, L.corcheas, L.semis, L.corSem, L.semCor, L.puntilloCor, L.puntilloSem], pool34: [L.tres, L.blancaLibre, L.negra, L.rNegra, L.corcheas, L.puntilloCor, L.semis] },
]
export const nivelDictado = (id) => NIVELES_DICTADO.find((n) => n.id === id)

/** 'oido' (ejercicios 1 y 2: escuchar y tocar) o 'armar' (3 a 5: escuchar y escribir). */
export const modoDeEjercicio = (numero) => (numero <= 2 ? 'oido' : 'armar')
const COMPASES_POR_EJERCICIO = [2, 2, 2, 3, 4]
const TEMPOS = [60, 60, 60, 66, 72]

// ─── Generación ────────────────────────────────────────────────────────

const tokenAFigura = (tok) => (tok.startsWith('r') ? { dur: Number(tok.slice(1)), silencio: true } : { dur: Number(tok), silencio: false })

function sortear(rnd, lista) {
  const total = lista.reduce((s, x) => s + x.p, 0)
  let r = rnd() * total
  for (const x of lista) { r -= x.p; if (r <= 0) return x }
  return lista[lista.length - 1]
}

function compasAlAzar(rnd, pool, pulsos) {
  for (let intento = 0; intento < 60; intento++) {
    const figuras = []
    let pos = 0
    let atascado = false
    while (pos < pulsos - EPS) {
      const posibles = pool.filter((x) => {
        const dur = x.t.reduce((s, tok) => s + Math.abs(Number(tok.replace('r', ''))), 0)
        return pos + dur <= pulsos + EPS && Math.abs(pos / x.a - Math.round(pos / x.a)) < EPS
      })
      if (!posibles.length) { atascado = true; break }
      const x = sortear(rnd, posibles)
      for (const tok of x.t) figuras.push(tokenAFigura(tok))
      pos += x.t.reduce((s, tok) => s + Math.abs(Number(tok.replace('r', ''))), 0)
    }
    if (!atascado && figuras.some((f) => !f.silencio)) return figuras // un compás solo de silencios no sirve
  }
  throw new Error('No se pudo armar un compás')
}

const clave = (compases) => compases.map((c) => c.map((f) => `${f.silencio ? 'r' : ''}${f.dur}`).join(' ')).join('|')

/** Arma el dictado nº "numero" (1 a 5) del nivel: un ritmo nuevo cada vez. rnd: () => [0,1). */
export function armarDictado(nivelId, numero, rnd = Math.random) {
  const nivel = nivelDictado(nivelId)
  if (!nivel || numero < 1 || numero > EJERCICIOS_POR_NIVEL) return null
  let compas = nivel.compas
  let pool = nivel.pool
  if (nivel.pool34 && numero % 2 === 0) { compas = [3, 4]; pool = nivel.pool34 }
  const n = COMPASES_POR_EJERCICIO[numero - 1]
  let compases = null
  for (let intento = 0; intento < 40; intento++) {
    compases = Array.from({ length: n }, () => compasAlAzar(rnd, pool, compas[0]))
    const distintos = new Set(compases.map((c) => clave([c]))).size
    if (distintos >= Math.min(2, n)) break // que no sean todos compases iguales
  }
  const modo = modoDeEjercicio(numero)
  const ej = construirEjercicio({
    nivel: nivelId, numero, tempo: TEMPOS[numero - 1], pulsosPorCompas: compas[0], tipoPulso: compas[1], compases,
    titulo: `${nivel.nombre} · dictado ${numero}`,
  })
  return { ...ej, modo, paleta: paletaDe(nivelId, compas[0]) }
}

const dursDe = (pool) => {
  const m = new Map()
  for (const x of pool) for (const tok of x.t) { const f = tokenAFigura(tok); m.set(`${f.silencio ? 'r' : ''}${f.dur}`, f) }
  return [...m.values()]
}

/** Figuras disponibles para armar el ritmo en ese nivel: primero los sonidos (de más largo a más corto), después los silencios. */
export function paletaDe(nivelId, pulsos) {
  const nivel = nivelDictado(nivelId)
  const pool = nivel.pool34 && pulsos === 3 ? nivel.pool34 : nivel.pool
  const figuras = dursDe(pool).filter((f) => f.dur <= pulsos + EPS)
  // Con todas las figuras de 4/4 la blanca con puntillo no entra en 3/4 si no está en el pool: ya está filtrado arriba
  const ordenar = (a, b) => b.dur - a.dur
  return [...figuras.filter((f) => !f.silencio).sort(ordenar), ...figuras.filter((f) => f.silencio).sort(ordenar)]
}

const NOMBRES = { 4: 'redonda', 3: 'blanca con puntillo', 2: 'blanca', 1.5: 'negra con puntillo', 1: 'negra', 0.75: 'corchea con puntillo', 0.5: 'corchea', 0.25: 'semicorchea' }
export const nombreFigura = (f) => (f.silencio ? 'silencio de ' : '') + (NOMBRES[f.dur] || `figura de ${f.dur}`)

// ─── Armar el ejercicio con lo que respondió el cantante ──────────────────

/** Compases de la respuesta: [[{ dur, silencio }]]. ¿Está completo cada compás? */
export const duracionCompas = (figuras) => figuras.reduce((s, f) => s + f.dur, 0)
export const respuestaCompleta = (respuesta, pulsos) => respuesta.every((c) => Math.abs(duracionCompas(c) - pulsos) < EPS)

/** Ejercicio sonoro con la respuesta (si está completa), para escucharla. */
export function ejercicioDeRespuesta(ej, respuesta) {
  if (!respuestaCompleta(respuesta, ej.pulsosPorCompas)) return null
  return construirEjercicio({ ...ej, compases: respuesta, titulo: 'Tu respuesta' })
}

// ─── Corrección del dictado escrito ─────────────────────────────────────

const clavesDe = (compases) => compases.map((c, ci) => {
  let pos = 0
  return c.map((f) => { const k = `${ci}:${pos}:${f.silencio ? 'r' : 'n'}:${f.dur}`; pos += f.dur; return k })
})

/**
 * Compara lo escrito con el ritmo. Una figura cuenta si está en el mismo lugar, con la misma duración y siendo
 * sonido o silencio como corresponde. Devuelve { pct, aprobado, porCompas: [[bool]], correctas, total, mensajes }.
 */
export function corregirDictado(ej, respuesta) {
  const esperadas = clavesDe(ej.compases)
  const dadas = clavesDe(respuesta)
  const setEsp = new Set(esperadas.flat())
  const total = esperadas.flat().length
  const cantDadas = dadas.flat().length
  const porCompas = dadas.map((c) => c.map((k) => setEsp.has(k)))
  const correctas = porCompas.flat().filter(Boolean).length
  const base = Math.max(total, cantDadas)
  const pct = base ? Math.round((correctas / base) * 100) : 0
  const compasesMal = porCompas.map((c, i) => (c.every(Boolean) && c.length === esperadas[i].length ? null : i + 1)).filter((x) => x != null)
  const mensajes = []
  if (compasesMal.length) mensajes.push(compasesMal.length === 1 ? `Revisá el compás ${compasesMal[0]}.` : `Revisá los compases ${compasesMal.join(', ')}.`)
  return { pct, aprobado: pct >= APROBADO_PCT, porCompas, correctas, total, mensajes }
}
