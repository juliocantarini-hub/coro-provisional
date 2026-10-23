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

// Silencios seguidos dentro de un compás se juntan (un silencio de blanca vale lo mismo que dos de negra),
// así no se penaliza una forma distinta de escribir lo mismo.
function agrupar(compases) {
  return compases.map((c, ci) => {
    const grupos = []
    let pos = 0
    c.forEach((f, fi) => {
      const ult = grupos[grupos.length - 1]
      if (f.silencio && ult && ult.silencio) { ult.dur += f.dur; ult.figuras.push(fi) } else grupos.push({ silencio: !!f.silencio, dur: f.dur, inicio: pos, figuras: [fi] })
      pos += f.dur
    })
    return grupos.map((g) => ({ ...g, clave: `${ci}:${g.inicio}:${g.silencio ? 'r' : 'n'}:${g.dur}` }))
  })
}

/**
 * Compara lo escrito con el ritmo. Una figura cuenta si está en el mismo lugar, con la misma duración y siendo
 * sonido o silencio como corresponde. Devuelve { pct, aprobado, porCompas: [[bool]], correctas, total, mensajes }.
 */
export function corregirDictado(ej, respuesta) {
  const esperadas = agrupar(ej.compases)
  const dadas = agrupar(respuesta)
  const setEsp = new Set(esperadas.flat().map((g) => g.clave))
  const total = esperadas.flat().length
  const cantDadas = dadas.flat().length
  const porCompas = respuesta.map((c) => c.map(() => false))
  let correctas = 0
  dadas.forEach((grupos, ci) => grupos.forEach((g) => {
    const ok = setEsp.has(g.clave)
    if (ok) correctas++
    for (const fi of g.figuras) porCompas[ci][fi] = ok
  }))
  const base = Math.max(total, cantDadas)
  const pct = base ? Math.round((correctas / base) * 100) : 0
  const compasesMal = dadas.map((grupos, i) => (grupos.every((g) => setEsp.has(g.clave)) && grupos.length === esperadas[i].length ? null : i + 1)).filter((x) => x != null)
  const mensajes = []
  if (compasesMal.length) mensajes.push(compasesMal.length === 1 ? `Revisá el compás ${compasesMal[0]}.` : `Revisá los compases ${compasesMal.join(', ')}.`)
  return { pct, aprobado: pct >= APROBADO_PCT, porCompas, correctas, total, mensajes }
}

// ─── Escribir tocando: de los toques a las figuras ─────────────────────────

const LAMBDA = 0.12
const DURACIONES = [4, 3, 2, 1.5, 1, 0.75, 0.5, 0.25]

// Parte "d" tiempos en figuras de la lista "permitidas" (de la más larga a la más corta). null si no se puede.
function partir(d, permitidas) {
  const out = []
  let resto = d
  for (let guarda = 0; guarda < 32 && resto > EPS; guarda++) {
    const f = permitidas.find((x) => x <= resto + EPS)
    if (f == null) return null
    out.push(f)
    resto -= f
  }
  return resto > EPS ? null : out
}

/**
 * Convierte toques en tiempo libre en compases escritos.
 * marcas: [{ t, silencio }] con t en segundos (cualquier origen: se usan los intervalos entre toques).
 * Cada marca abre una figura (sonido o silencio) que dura hasta la marca siguiente; la última llega hasta el final.
 * Para cada intervalo se elige una figura del nivel (sonidos) o un silencio, de modo que ninguna cruce una barra de
 * compás, y el tempo del cantante se estima a partir de los mismos toques (parte del tempo del ejemplo).
 * Devuelve { compases: [[{ dur, silencio }]], pulsoSeg }.
 */
export function transcribirToques(marcas, { pulsosPorCompas, nCompases, pulsoSeg, paleta }) {
  const vacios = Array.from({ length: nCompases }, () => [])
  if (!marcas.length) return { compases: vacios, pulsoSeg }
  const total = nCompases * pulsosPorCompas
  const grilla = Math.min(...paleta.map((f) => f.dur))
  const idxTotal = Math.round(total / grilla)
  const paso = (d) => Math.round(d / grilla)
  const idxCompas = Math.round(pulsosPorCompas / grilla)
  const sonidos = [...new Set(paleta.filter((f) => !f.silencio).map((f) => f.dur))].sort((a, b) => b - a)
  const multiplo = (x) => x >= grilla - EPS && Math.abs(x / grilla - Math.round(x / grilla)) < EPS
  const silencios = [...new Set([...paleta.filter((f) => f.silencio).map((f) => f.dur), ...DURACIONES.filter(multiplo)])].sort((a, b) => b - a)
  const permitidas = (m) => (m.silencio ? silencios : (sonidos.length ? sonidos : DURACIONES)).filter((d) => d <= pulsosPorCompas + EPS)
  const rel = marcas.map((m) => m.t - marcas[0].t)

  // Un compás, a lo sumo: una figura no puede pasar de la barra
  const cabe = (s, ds) => Math.floor((s + ds - 1) / idxCompas) === Math.floor(s / idxCompas)

  // Mejor camino para un tempo "b" y las primeras "n" marcas: costo y figura elegida para cada una
  function camino(b, n, guardar) {
    const INF = 1e9
    let actual = new Array(idxTotal + 1).fill(INF)
    actual[0] = 0
    const atras = guardar ? [] : null
    for (let i = 0; i < n - 1; i++) {
      const sig = new Array(idxTotal + 1).fill(INF)
      const vino = guardar ? new Array(idxTotal + 1).fill(null) : null
      const intervalo = rel[i + 1] - rel[i]
      const opciones = permitidas(marcas[i])
      for (let st = 0; st < idxTotal; st++) {
        if (actual[st] >= INF) continue
        for (const d of opciones) {
          const ds = paso(d)
          if (st + ds > idxTotal || !cabe(st, ds)) continue
          const e = Math.log(Math.max(intervalo, 1e-3) / (b * d)) / 0.25
          const c = actual[st] + Math.min(e * e, 4)
          if (c < sig[st + ds]) { sig[st + ds] = c; if (guardar) vino[st + ds] = { desde: st, d } }
        }
      }
      if (guardar) atras.push(vino)
      actual = sig
    }
    let mejor = INF
    let fin = -1
    for (let st = 0; st < idxTotal; st++) if (actual[st] < mejor) { mejor = actual[st]; fin = st }
    return { costo: mejor, fin, atras }
  }

  // Si hay más toques de los que caben, se descartan los últimos
  for (let n = marcas.length; n >= 1; n--) {
    let mejorB = pulsoSeg
    let mejorCosto = 1e9
    if (n >= 2) {
      for (let k = -20; k <= 20; k++) {
        const b = pulsoSeg * Math.pow(2, (k / 20) * 0.8) // de ~0,57x a ~1,74x
        const { costo } = camino(b, n, false)
        const total = costo + LAMBDA * n * Math.abs(Math.log2(b / pulsoSeg))
        if (total < mejorCosto) { mejorCosto = total; mejorB = b }
      }
      if (mejorCosto >= 1e8) continue
    } else { mejorCosto = 0 }

    // Reconstruir las figuras del mejor camino
    const figuras = new Array(n) // { st, d }
    let fin = 0
    if (n >= 2) {
      const r = camino(mejorB, n, true)
      fin = r.fin
      let st = fin
      for (let i = n - 2; i >= 0; i--) { const v = r.atras[i][st]; figuras[i] = { st: v.desde, d: v.d }; st = v.desde }
    }
    figuras[n - 1] = { st: fin, d: null }
    const compases = vacios.map(() => [])
    const poner = (st, d, silencio) => compases[Math.min(nCompases - 1, Math.floor(st / idxCompas))].push({ dur: d, silencio })
    figuras.forEach((f, i) => {
      if (f.d != null) { poner(f.st, f.d, marcas[i].silencio); return }
      // La última marca llega hasta el final de su compás; los compases que siguen quedan vacíos para completarlos
      const a = f.st
      const b2 = Math.min((Math.floor(a / idxCompas) + 1) * idxCompas, idxTotal)
      const lista = marcas[i].silencio ? silencios : (sonidos.length ? sonidos : DURACIONES)
      const partes = partir((b2 - a) * grilla, lista) || partir((b2 - a) * grilla, DURACIONES) || [(b2 - a) * grilla]
      partes.forEach((d, k) => poner(a, d, marcas[i].silencio || k > 0))
    })
    return { compases, pulsoSeg: mejorB }
  }
  return { compases: vacios, pulsoSeg }
}
