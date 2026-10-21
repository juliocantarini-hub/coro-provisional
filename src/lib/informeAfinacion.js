// Informe de afinación a partir de una grabación.
//
// Flujo: grabación (Float32Array mono) + notas de la voz del cantante en el
// fragmento elegido  →  curva de altura (YIN) → alineación con la partitura
// (Viterbi tipo DTW) → métricas por nota y por compás → resumen.
//
// Todo corre en el dispositivo; no usa red ni guarda audio. No depende de
// React: se puede ejecutar en un Web Worker o en Node (para pruebas).
//
// Entrada de notas (solo las que canta la voz, ordenadas por tiempo):
//   { midi: 62, inicio: 0, duracion: 1, compas: 1, nombre: 'D4' }
// "inicio" y "duracion" en cualquier unidad consistente (pulsos o segundos):
// solo se usan de forma relativa, porque el cantante va a su propio tempo.

import { nombreEnEspanol } from './afinacion'

// Márgenes del informe para el cantante: algo permisivos, para no desalentar (un coro tolera ±20-25 cents).
// Los márgenes estrictos de antes (±15) se siguen calculando aparte para el director (pctVerdeEstricto).
export const BANDA_VERDE_CENTS = 20
export const BANDA_AMARILLA_CENTS = 40
export const BANDA_VERDE_ESTRICTA_CENTS = 15
const UMBRAL_NOTA_DISTINTA_CENTS = 75

const fold = (x) => ((x + 6) % 12 + 12) % 12 - 6 // semitonos → [-6, 6)

function mediana(arr) {
  if (!arr.length) return NaN
  const a = Float64Array.from(arr).sort()
  const n = a.length
  return n % 2 ? a[(n - 1) / 2] : (a[n / 2 - 1] + a[n / 2]) / 2
}

// ─── 1. Curva de altura (YIN) ───────────────────────────────────────────

function decimar(x, sr, objetivo = 16000) {
  const f = Math.max(1, Math.round(sr / objetivo))
  if (f === 1) return { x, sr }
  const n = Math.floor(x.length / f)
  const y = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    let s = 0
    for (let k = 0; k < f; k++) s += x[i * f + k]
    y[i] = s / f
  }
  return { x: y, sr: sr / f }
}

/**
 * Devuelve { t, midi, vozeado, rms } con un cuadro cada `hop` segundos.
 * midi es fraccionario (69 = La4 = 440 Hz); en cuadros sin voz es NaN.
 */
export function extraerCurvaF0(muestras, sampleRate, opts = {}) {
  const { hop = 0.02, fMin = 60, fMax = 1000, umbral = 0.2 } = opts
  const { x, sr } = decimar(muestras, sampleRate, 16000)
  const tauMax = Math.floor(sr / fMin)
  const tauMin = Math.max(2, Math.floor(sr / fMax))
  const W = Math.floor(sr * 0.04)
  const paso = Math.max(1, Math.round(hop * sr))
  const d = new Float32Array(tauMax + 2)
  const cm = new Float32Array(tauMax + 2)

  const t = [], midi = [], rms = [], aper = []
  for (let p = 0; p + W + tauMax + 1 < x.length; p += paso) {
    let e = 0
    for (let j = 0; j < W; j++) e += x[p + j] * x[p + j]
    const r = Math.sqrt(e / W)
    t.push((p + W / 2) / sr)
    rms.push(r)
    if (r < 1e-4) { midi.push(NaN); aper.push(1); continue }

    for (let tau = 1; tau <= tauMax; tau++) {
      let s = 0
      for (let j = 0; j < W; j++) { const dd = x[p + j] - x[p + j + tau]; s += dd * dd }
      d[tau] = s
    }
    let acum = 0
    cm[0] = 1
    for (let tau = 1; tau <= tauMax; tau++) {
      acum += d[tau]
      cm[tau] = acum > 0 ? (d[tau] * tau) / acum : 1
    }
    let tau = -1
    for (let k = tauMin; k < tauMax; k++) {
      if (cm[k] < umbral) {
        while (k + 1 < tauMax && cm[k + 1] < cm[k]) k++
        tau = k
        break
      }
    }
    if (tau < 0) {
      let mn = Infinity, k0 = -1
      for (let k = tauMin; k < tauMax; k++) if (cm[k] < mn) { mn = cm[k]; k0 = k }
      if (mn < 0.35) tau = k0
    }
    if (tau <= 0 || tau >= tauMax) { midi.push(NaN); aper.push(1); continue }
    const c0 = cm[tau - 1], c1 = cm[tau], c2 = cm[tau + 1]
    const den = c0 - 2 * c1 + c2
    const tauFino = den !== 0 ? tau + (0.5 * (c0 - c2)) / den : tau
    const f0 = sr / tauFino
    midi.push(69 + 12 * Math.log2(f0 / 440))
    aper.push(cm[tau])
  }

  // Cuadros con voz: suficiente energía (relativa a la grabación) y periodicidad.
  const orden = Float64Array.from(rms).sort()
  const rmsRef = orden.length ? orden[Math.floor(orden.length * 0.95)] : 0
  const pisoRms = Math.max(0.004, 0.08 * rmsRef)
  const vozeado = midi.map((m, i) => Number.isFinite(m) && rms[i] >= pisoRms && aper[i] < 0.3)

  corregirOctavas(midi, vozeado)
  return { t, midi, vozeado, rms }
}

// Un cuadro aislado una octava (o más) lejos de sus vecinos es un error de
// detección, no una nota distinta: lo devolvemos a la octava de la vecindad.
function corregirOctavas(midi, vozeado, ventana = 4) {
  const copia = midi.slice()
  for (let i = 0; i < midi.length; i++) {
    if (!vozeado[i]) continue
    const vec = []
    for (let k = Math.max(0, i - ventana); k <= Math.min(midi.length - 1, i + ventana); k++) {
      if (vozeado[k]) vec.push(copia[k])
    }
    if (vec.length < 3) continue
    const med = mediana(vec)
    const dif = copia[i] - med
    if (Math.abs(dif) > 6) midi[i] = copia[i] - 12 * Math.round(dif / 12)
  }
}

// Errores de armónico: en tramos de varios cuadros seguidos el detector de altura puede
// quedarse con un armónico en vez de la fundamental. El 3.º suena una 12.ª (19,02
// semitonos) arriba; el 4.º, dos octavas; el 5.º y el 6.º, 27,86 y 31,02. Plegar por
// octavas no alcanza (una 12.ª plegada parece una nota ~500 cents más baja), así que
// después de una primera alineación se baja cada cuadro que quedó muy por encima de su
// nota esperada si, restando ese salto, cae cerca de ella. Solo hacia abajo y solo saltos
// armónicos: una nota realmente mal cantada (otra altura) o una octava distinta no se toca.
const SALTOS_ARMONICOS = [19.02, 24, 27.86, 31.02]
function corregirArmonicos(frames, asig, notas, offset) {
  const K = notas.length
  const dif = Array.from({ length: K }, () => [])
  for (let i = 0; i < frames.t.length; i++) dif[asig[i]].push(frames.m[i] - notas[asig[i]].midi)
  const octavas = []
  for (let j = 0; j < K; j++) {
    if (dif[j].length >= 5) octavas.push(Math.round(mediana(dif[j]) / 12))
  }
  const octG = octavas.length ? mediana(octavas) : 0
  let corregidos = 0
  for (let i = 0; i < frames.t.length; i++) {
    const objetivo = notas[asig[i]].midi + 12 * octG + offset
    const res0 = frames.m[i] - objetivo
    if (res0 <= 4) continue
    let mejor = null, mejorRes = Infinity
    for (const s of SALTOS_ARMONICOS) {
      const r = Math.abs(res0 - s)
      if (r < mejorRes) { mejorRes = r; mejor = s }
    }
    if (mejor != null && mejorRes <= 2) {
      frames.m[i] -= mejor
      corregidos++
    }
  }
  return corregidos
}

// ─── 2. Alineación con la partitura ─────────────────────────────────────

const CAP_COSTO = 3 // semitonos: un cuadro muy lejano no pesa más que esto
const COSTO_AVANCE = 0.05
const COSTO_SALTO = 2 // por cada nota que el cantante se saltea
const COSTO_FIN = 1 // por cada nota sin alcanzar al final

/**
 * Alinea los cuadros con voz a la secuencia de notas (Viterbi tipo DTW).
 * "tExp[j]" es cuándo se espera la nota j (en segundos de la grabación) y
 * "escala" cuánto tiempo (s) equivale a "un error de bulto" (≈ un compás): sirve
 * de a-priori para desempatar notas repetidas; "lambda" es su peso. La primera
 * pasada usa un peso chico (casi todo lo decide la altura); la segunda, con
 * los tiempos ya ajustados al tempo real del cantante, uno mayor.
 */
function alinear(frames, notas, tExp, escala, lambda, offset, kMax) {
  const N = frames.t.length
  const K = notas.length
  const dp = new Float32Array(N * K)
  const bp = new Int16Array(N * K)

  for (let i = 0; i < N; i++) {
    const base = i * K
    const prev = (i - 1) * K
    for (let j = 0; j < K; j++) {
      let dif = Math.abs(fold(frames.m[i] - notas[j].midi - offset))
      if (dif > CAP_COSTO) dif = CAP_COSTO
      const c = dif + lambda * Math.min(Math.abs(frames.t[i] - tExp[j]) / escala, 2)
      if (i === 0) {
        dp[base + j] = c + COSTO_SALTO * j
        bp[base + j] = -1
      } else {
        let mejor = dp[prev + j]
        let arg = j
        for (let k = 1; k <= kMax && j - k >= 0; k++) {
          const v = dp[prev + j - k] + COSTO_AVANCE + (k - 1) * COSTO_SALTO
          if (v < mejor) { mejor = v; arg = j - k }
        }
        dp[base + j] = c + mejor
        bp[base + j] = arg
      }
    }
  }

  let jf = 0, mejorTotal = Infinity
  for (let j = 0; j < K; j++) {
    const v = dp[(N - 1) * K + j] + COSTO_FIN * (K - 1 - j)
    if (v < mejorTotal) { mejorTotal = v; jf = j }
  }
  const asig = new Int16Array(N)
  let j = jf
  for (let i = N - 1; i >= 0; i--) {
    asig[i] = j
    j = bp[i * K + j]
  }
  return { asig, costo: mejorTotal }
}

function cuadrosVozeados(curva, desdeSeg = 0, ignorar = []) {
  const t = [], m = []
  for (let i = 0; i < curva.t.length; i++) {
    if (!curva.vozeado[i] || curva.t[i] < desdeSeg) continue
    const ti = curva.t[i]
    // "ignorar": tramos [desde, hasta] en segundos (los clics de silencio que suenan mientras se graba)
    if (ignorar.some((r) => ti >= r[0] && ti <= r[1])) continue
    t.push(ti); m.push(curva.midi[i])
  }
  return { t, m }
}

function submuestrear(frames, cada) {
  const t = [], m = []
  for (let i = 0; i < frames.t.length; i += cada) { t.push(frames.t[i]); m.push(frames.m[i]) }
  return { t, m }
}

// Ajuste de tiempos a partir de una primera alineación: cuándo entró cada nota
// realmente contra cuándo estaba escrita. Sirve para la segunda pasada.
function ajusteDesdeAsignacion(frames, asig, notas) {
  const primero = new Map()
  const cuenta = new Map()
  for (let i = 0; i < frames.t.length; i++) {
    const j = asig[i]
    cuenta.set(j, (cuenta.get(j) || 0) + 1)
    if (!primero.has(j)) primero.set(j, frames.t[i])
  }
  const xs = [], ys = []
  for (const [j, c] of cuenta) {
    // Solo entradas confiables: con una nota repetida pegada a la anterior, la
    // frontera entre ambas no sale de la altura y ensuciaría el ajuste.
    const repetida = j > 0 && Math.abs(notas[j].midi - notas[j - 1].midi) < 1
    if (c >= 5 && !repetida) { xs.push(notas[j].inicio); ys.push(primero.get(j)) }
  }
  return xs.length >= 4 ? ajusteLineal(xs, ys) : null
}

/** Busca el desplazamiento global (en semitonos, módulo octava) que mejor encaja. */
function estimarOffset(frames, notas, tExp, escala) {
  const g = submuestrear(frames, 5)
  if (g.t.length < 5) return 0
  let mejor = 0, mejorCosto = Infinity
  for (let o = -6; o < 6; o += 0.5) {
    const { costo } = alinear(g, notas, tExp, escala, 0.4, o, 4)
    if (costo < mejorCosto) { mejorCosto = costo; mejor = o }
  }
  const centro = mejor
  for (let o = centro - 0.5; o <= centro + 0.5; o += 0.125) {
    const { costo } = alinear(g, notas, tExp, escala, 0.4, fold(o), 4)
    if (costo < mejorCosto) { mejorCosto = costo; mejor = fold(o) }
  }
  return mejor
}

// ─── 3. Métricas ────────────────────────────────────────────────────────

function suavizar(arr, ventana) {
  if (ventana <= 1) return arr.slice()
  const out = new Array(arr.length)
  const mitad = Math.floor(ventana / 2)
  for (let i = 0; i < arr.length; i++) {
    let sum = 0, n = 0
    for (let k = Math.max(0, i - mitad); k <= Math.min(arr.length - 1, i + mitad); k++) { sum += arr[k]; n++ }
    out[i] = sum / n
  }
  return out
}

// Vibrato de una nota larga: amplitud (cents, ±) y frecuencia (Hz), una vez quitada la
// deriva lenta con una recta. Devuelve null si la nota es corta (< ~40 cuadros útiles).
function medirVibrato(devs, paso) {
  const n = devs.length
  if (n < 40) return null
  let sx = 0, sy = 0, sxx = 0, sxy = 0
  devs.forEach((y, x) => { sx += x; sy += y; sxx += x * x; sxy += x * y })
  const m = (n * sxy - sx * sy) / (n * sxx - sx * sx)
  const c = (sy - m * sx) / n
  const det = devs.map((y, x) => y - (m * x + c))
  const orden = [...det].sort((a, b) => a - b)
  const q = (f) => orden[Math.min(n - 1, Math.max(0, Math.round(f * (n - 1))))]
  const amp = (q(0.9) - q(0.1)) / 2
  const hist = Math.max(6, 0.3 * amp)
  let signo = 0, cruces = 0
  for (const v of det) {
    const s = v > hist ? 1 : v < -hist ? -1 : 0
    if (s !== 0 && signo !== 0 && s !== signo) cruces++
    if (s !== 0) signo = s
  }
  return { ampCents: Math.round(amp), hz: Math.round((cruces / 2 / (n * paso)) * 10) / 10, cruces }
}

const foldCents = (c) => ((c + 600) % 1200 + 1200) % 1200 - 600

function estadoPorCents(c) {
  const a = Math.abs(c)
  return a <= BANDA_VERDE_CENTS ? 'verde' : a <= BANDA_AMARILLA_CENTS ? 'amarillo' : 'rojo'
}

// Puntaje de una nota: % del tiempo en la zona de afinación. En verde cuenta entero y en amarillo
// la mitad ("blando", lo que ve el cantante). "estricto" = solo verde con el margen de ±15 (para el director).
function puntajeZona(vals) {
  const n = vals.length || 1
  let verde = 0, amarillo = 0, estricto = 0
  for (const v of vals) {
    const a = Math.abs(v)
    if (a <= BANDA_VERDE_CENTS) verde++
    else if (a <= BANDA_AMARILLA_CENTS) amarillo++
    if (a <= BANDA_VERDE_ESTRICTA_CENTS) estricto++
  }
  return { blando: Math.round(((verde + 0.5 * amarillo) / n) * 100), estricto: Math.round((estricto / n) * 100) }
}

function pendienteCentsPorSeg(ts, ms) {
  const n = ts.length
  if (n < 5) return 0
  const mt = ts.reduce((a, b) => a + b, 0) / n
  const mm = ms.reduce((a, b) => a + b, 0) / n
  let num = 0, den = 0
  for (let i = 0; i < n; i++) { num += (ts[i] - mt) * (ms[i] - mm); den += (ts[i] - mt) ** 2 }
  return den > 0 ? (num / den) * 100 : 0
}

// ─── 4. Ritmo ───────────────────────────────────────────────────────────

// Ajuste robusto (Theil–Sen) de "momento cantado" contra "momento escrito".
function ajusteLineal(xs, ys) {
  const pend = []
  for (let i = 0; i < xs.length; i++) {
    for (let j = i + 1; j < xs.length; j++) {
      const dx = xs[j] - xs[i]
      if (Math.abs(dx) > 0.2) pend.push((ys[j] - ys[i]) / dx)
    }
  }
  const b = Math.max(0.5, Math.min(2, pend.length ? mediana(pend) : 1))
  const a = mediana(ys.map((y, i) => y - b * xs[i]))
  return { a, b }
}

const RITMO_OK_PULSOS = 0.2 // hasta 20% de un pulso: bien
const RITMO_LEVE_PULSOS = 0.4 // hasta 40%: leve; más: marcado
const RITMO_OK_ESTRICTO_PULSOS = 0.15 // el margen de antes, solo para el director
const RITMO_COBERTURA_MIN = 0.5 // si se pueden medir menos de la mitad de las notas escritas, el ritmo no es concluyente

/**
 * Compara CUÁNDO entró cada nota con cuándo debía entrar, descontando el tempo
 * propio del cantante (si cantó todo un poco más lento, no es un error de
 * cada nota). Una nota sólo se evalúa si su entrada es confiable: viene de un
 * cambio de altura o de un silencio (con notas repetidas pegadas la frontera
 * entre una y otra no se puede saber a partir de la altura).
 * Cada nota puede traer "tramo" (cambios de tempo de la partitura) y
 * "pulsoSeg" (duración de un pulso en esa zona, en segundos escritos).
 */
function analizarRitmo(resultados, notas) {
  const conFrames = resultados.filter((r) => r.frames >= 5)
  const salta = (a, b) => Math.abs(notas[a.indice].midi - notas[b.indice].midi) >= 1
  conFrames.forEach((r, k) => {
    const prev = conFrames[k - 1]
    const next = conFrames[k + 1]
    r.inicioFiable = !prev || salta(r, prev) || r.inicioSeg - prev.finSeg > 0.05
    r.finFiable = !next || salta(r, next) || next.inicioSeg - r.finSeg > 0.05
  })

  const fiables = conFrames.filter((r) => r.inicioFiable)
  if (fiables.length < 4) return { tempoRelativo: null, evaluadas: 0, pctOk: null, concluyente: false, motivo: 'pocas_entradas' }

  const global = ajusteLineal(fiables.map((r) => notas[r.indice].inicio), fiables.map((r) => r.inicioSeg))
  const porTramo = new Map()
  for (const r of fiables) {
    const t = notas[r.indice].tramo ?? 0
    if (!porTramo.has(t)) porTramo.set(t, [])
    porTramo.get(t).push(r)
  }
  const ajustes = new Map()
  for (const [t, rs] of porTramo) {
    ajustes.set(t, rs.length >= 5 ? ajusteLineal(rs.map((r) => notas[r.indice].inicio), rs.map((r) => r.inicioSeg)) : global)
  }

  let evaluadas = 0, ok = 0, okEstricto = 0
  for (const r of conFrames) {
    const nota = notas[r.indice]
    const aj = ajustes.get(nota.tramo ?? 0) || global
    if (r.inicioFiable) {
      const esperadoSeg = aj.a + aj.b * nota.inicio
      const errorSeg = r.inicioSeg - esperadoSeg
      const pulsos = errorSeg / ((nota.pulsoSeg ?? 0.5) * aj.b)
      const mag = Math.abs(pulsos)
      r.ritmo = {
        errorMs: Math.round(errorSeg * 1000),
        errorPulsos: Math.round(pulsos * 100) / 100,
        estado: mag <= RITMO_OK_PULSOS ? 'ok' : mag <= RITMO_LEVE_PULSOS ? 'leve' : 'fuerte',
        direccion: pulsos > 0 ? 'tarde' : 'temprano',
      }
      evaluadas++
      if (r.ritmo.estado === 'ok') ok++
      if (mag <= RITMO_OK_ESTRICTO_PULSOS) okEstricto++
    }
    if (r.inicioFiable && r.finFiable && nota.duracion >= 0.75 * (nota.pulsoSeg ?? 0.5)) {
      const ratio = (r.finSeg - r.inicioSeg) / (nota.duracion * aj.b)
      r.duracionRatio = Math.round(ratio * 100) / 100
      r.duracionEstado = ratio < 0.65 ? 'corta' : ratio > 1.4 ? 'larga' : 'ok'
    }
  }
  // ¿Se puede confiar en este ritmo? Con notas repetidas en la misma altura cantadas ligadas
  // (sin consonantes que las separen) el motor no tiene cómo saber a cuál nota escrita
  // corresponde cada sonido: solo se pueden medir las entradas que vienen después de un
  // silencio o de un cambio de altura. Si son pocas respecto de las notas escritas, el resultado
  // sería un número engañoso (típicamente un 0% injusto), así que se declara "no concluyente".
  const esperadas = notas.length
  const cobertura = esperadas ? evaluadas / esperadas : 0
  if (cobertura < RITMO_COBERTURA_MIN) {
    const repetidas = notas.filter((n, i) => i > 0 && n.midi === notas[i - 1].midi).length
    const muchasRepetidas = esperadas > 1 && repetidas / (esperadas - 1) >= 0.4
    for (const r of conFrames) {
      delete r.ritmo
      delete r.duracionRatio
      delete r.duracionEstado
    }
    return {
      tempoRelativo: null,
      evaluadas,
      pctOk: null,
      concluyente: false,
      motivo: muchasRepetidas ? 'notas_repetidas' : 'pocas_entradas',
    }
  }
  return {
    // b = segundos cantados por segundo escrito → velocidad relativa = 1/b
    tempoRelativo: Math.round(100 / global.b) / 100,
    evaluadas,
    pctOk: evaluadas ? Math.round((ok / evaluadas) * 100) : null,
    pctOkEstricto: evaluadas ? Math.round((okEstricto / evaluadas) * 100) : null,
    concluyente: true,
  }
}

/**
 * Analiza una grabación contra las notas de la voz.
 * @param {Float32Array} muestras audio mono (-1..1)
 * @param {number} sampleRate
 * @param {Array<{midi:number,inicio:number,duracion:number,compas?:number,nombre?:string}>} notas
 */
export function analizarGrabacion(muestras, sampleRate, notas, opciones = {}) {
  const curva = opciones.curva || extraerCurvaF0(muestras, sampleRate)
  // Lo anterior a "descartarAntesDeSeg" (el conteo con clics) se ignora: el clic
  // que se cuela en el micrófono no debe tomarse como una nota cantada.
  const frames = cuadrosVozeados(curva, opciones.descartarAntesDeSeg || 0, opciones.ignorar || [])
  const K = notas.length
  if (K === 0) return { error: 'sin_notas' }
  if (frames.t.length < 20) return { error: 'sin_voz', mensaje: 'No se detectó voz suficiente en la grabación.' }

  const paso = curva.t.length > 1 ? curva.t[1] - curva.t[0] : 0.02
  // Primera pasada: se asume que el cantante entra cuando termina el conteo
  // ("inicioCantoSeg") y sigue el tempo escrito; con peso chico, casi todo lo
  // decide la altura. Eso aguanta tomas incompletas o a otro tempo.
  const yaSeg = opciones.inicioCantoSeg ?? frames.t[0]
  const escala = Math.max(1, 4 * mediana(notas.map((n) => n.pulsoSeg ?? 0.5)))
  const tExp0 = notas.map((n) => yaSeg + n.inicio)
  const kMax = Math.min(16, K)
  const offsetEstimado = estimarOffset(frames, notas, tExp0, escala)
  // Alineación completa (dos pasadas) con un corrimiento dado. Trabaja sobre una copia de las alturas
  // porque corregirArmonicos las modifica.
  function alinearCon(offset) {
    const fr = { t: frames.t, m: frames.m.slice() }
    let asig = alinear(fr, notas, tExp0, escala, 0.4, offset, kMax).asig
    // Cuadros enganchados a un armónico (ver corregirArmonicos): se corrigen antes de seguir.
    const armonicos = corregirArmonicos(fr, asig, notas, offset)
    // Segunda pasada: con los tiempos ajustados al tempo real de esta toma.
    const ajuste = ajusteDesdeAsignacion(fr, asig, notas)
    if (ajuste) {
      const tExp1 = notas.map((n) => ajuste.a + ajuste.b * n.inicio)
      asig = alinear(fr, notas, tExp1, escala, 1.5, offset, kMax).asig
    }
    const cuenta = new Array(K).fill(0)
    for (const j of asig) cuenta[j]++
    return { fr, asig, armonicos, ajuste, offset, encontradas: cuenta.filter((c) => c >= 5).length }
  }
  let intento = alinearCon(offsetEstimado)
  // El corrimiento más "barato" a veces es un promedio que no representa a ninguna nota (unas notas graves
  // bajas y otras justas, por ejemplo) y hace que una nota se pegue a la vecina y se pierda. Si faltan
  // notas, se prueba también sin corrimiento y se queda con la alineación que encuentra más.
  if (Math.abs(offsetEstimado) >= 0.25 && intento.encontradas < K) {
    const alterno = alinearCon(0)
    if (alterno.encontradas > intento.encontradas) intento = alterno
  }
  const offsetGrueso = intento.offset
  const asig = intento.asig
  const armonicosCorregidos = intento.armonicos
  const ajuste1 = intento.ajuste
  frames.m = intento.fr.m

  // Frames por nota
  const porNota = Array.from({ length: K }, () => ({ t: [], m: [] }))
  for (let i = 0; i < frames.t.length; i++) {
    const g = porNota[asig[i]]
    g.t.push(frames.t[i]); g.m.push(frames.m[i])
  }

  // Octava global (los hombres cantan una octava debajo de la escrita, etc.)
  const octavas = []
  for (let j = 0; j < K; j++) {
    if (porNota[j].m.length >= 5) octavas.push(Math.round(mediana(porNota[j].m.map((v) => v - notas[j].midi)) / 12))
  }
  const octavaGlobal = octavas.length ? mediana(octavas) : 0

  const suavesPorNota = []
  const resultados = notas.map((nota, j) => {
    const g = porNota[j]
    const base = { indice: j, nombre: nota.nombre ?? null, midi: nota.midi, compas: nota.compas ?? null }
    if (g.m.length < 5) return { ...base, estado: 'no_detectada', frames: g.m.length }
    const n = g.m.length
    const desde = n >= 10 ? Math.floor(n * 0.15) : 0
    const hasta = n >= 10 ? Math.ceil(n * 0.9) : n
    const tc = g.t.slice(desde, hasta)
    const mc = g.m.slice(desde, hasta)
    const crudo = mediana(mc.map((v) => v - nota.midi))
    const octava = Math.round(crudo / 12)
    const devs = mc.map((v) => fold(v - nota.midi) * 100)
    const dev = mediana(devs)
    // El vibrato (±20-30 cents a ~5 Hz) no es desafinación: la nota se juzga por
    // su centro. Suavizamos con una ventana de ~un ciclo de vibrato (≈200 ms)
    // antes de contar el tiempo en la zona verde, y la estabilidad usa esa
    // curva suavizada para no castigar el vibrato.
    const suave = suavizar(devs, Math.max(1, Math.round(0.2 / paso)))
    const desv = mediana(suave.map((v) => Math.abs(v - dev))) * 1.4826
    const pz = puntajeZona(suave)
    suavesPorNota[j] = suave
    const vib = medirVibrato(devs, paso)
    const duracionSeg = g.t[n - 1] - g.t[0]
    return {
      ...base,
      frames: n,
      inicioSeg: g.t[0],
      finSeg: g.t[n - 1],
      desviacionCents: Math.round(dev),
      estabilidadCents: Math.round(desv),
      pctVerde: pz.blando,
      pctVerdeEstricto: pz.estricto,
      pendienteCentsPorSeg: duracionSeg >= 0.5 ? Math.round(pendienteCentsPorSeg(tc, mc)) : 0,
      octavaDistinta: octava !== octavaGlobal,
      estado: estadoPorCents(dev),
      vibratoCents: vib ? vib.ampCents : null,
      vibratoHz: vib ? vib.hz : null,
      vibratoAmplio: !!vib && vib.ampCents >= 40 && vib.hz >= 2.5 && vib.hz <= 8 && vib.cruces >= 4,
    }
  })

  // Una nota repetida pegada a otra igual (do-do) a veces queda "sin datos" porque
  // la frontera entre ambas no se puede separar por la altura: no es un error del
  // cantante, así que no se informa como nota no encontrada.
  for (const r of resultados) {
    if (r.estado !== 'no_detectada') continue
    const vecinoIgual = [r.indice - 1, r.indice + 1].some((k) => {
      const v = resultados[k]
      return v && v.frames >= 5 && Math.abs(notas[k].midi - notas[r.indice].midi) < 1
    })
    if (vecinoIgual) r.estado = 'no_separable'
  }

  const validas = resultados.filter((r) => r.frames >= 5)
  // Corrimiento general: normalmente la mediana de las notas. Si las notas se reparten en dos grupos (unas
  // bajas y otras justas) esa mediana no representa a ninguno y las notas bien afinadas salen como "altas":
  // se prueba también la mediana pesada por duración y el corrimiento cero, y se elige el que mejor
  // describe la toma (solo si mejora el puntaje de forma clara).
  let offsetGlobal = 0
  if (validas.length) {
    const medianaNotas = Math.round(mediana(validas.map((r) => r.desviacionCents)))
    const totalFr = validas.reduce((s, r) => s + r.frames, 0)
    let acum = 0, medianaPesada = medianaNotas
    for (const r of [...validas].sort((a, b) => a.desviacionCents - b.desviacionCents)) {
      acum += r.frames
      if (acum >= totalFr / 2) { medianaPesada = r.desviacionCents; break }
    }
    const puntajeCon = (off) => validas.reduce((s, r) => {
      const suave = suavesPorNota[r.indice] || []
      return s + r.frames * puntajeZona(suave.map((v) => foldCents(v - off))).blando
    }, 0) / totalFr
    offsetGlobal = medianaNotas
    let mejorPuntaje = puntajeCon(medianaNotas) + 3 // hay que superar a la mediana por un margen claro
    for (const cand of [medianaPesada, 0]) {
      if (cand === offsetGlobal) continue
      const pj = puntajeCon(cand)
      if (pj > mejorPuntaje) { mejorPuntaje = pj; offsetGlobal = cand }
    }
  }
  for (const r of validas) {
    // Relativa al desplazamiento general: si todo el fragmento está corrido,
    // una nota "distinta" es la que se aparta ADEMÁS de ese corrimiento.
    r.desviacionRelativaCents = foldCents(r.desviacionCents - offsetGlobal)
    // La afinación se juzga ENTRE NOTAS (los intervalos), descontando el corrimiento
    // general de todo el fragmento (que suele venir de la nota de partida). El valor
    // absoluto se conserva aparte.
    r.pctVerdeAbsoluto = r.pctVerde
    const suaveRel = suavesPorNota[r.indice] || []
    if (suaveRel.length) {
      const pzRel = puntajeZona(suaveRel.map((v) => foldCents(v - offsetGlobal)))
      r.pctVerde = pzRel.blando
      r.pctVerdeEstricto = pzRel.estricto
    }
    r.estadoAbsoluto = r.estado
    if (Math.abs(r.desviacionRelativaCents) >= UMBRAL_NOTA_DISTINTA_CENTS) {
      r.estado = 'nota_distinta'
      r.estadoRelativo = 'nota_distinta'
    } else {
      r.estadoRelativo = estadoPorCents(r.desviacionRelativaCents)
      r.estado = r.estadoRelativo
    }
    // Una nota con muy pocos cuadros de voz (típico de una nota corta en una subida o bajada)
    // no alcanza para marcarla en rojo: se baja a amarillo y se avisa que hay poca evidencia.
    if (r.frames < 8 && (r.estado === 'rojo' || r.estado === 'nota_distinta')) {
      r.estado = 'amarillo'
      r.estadoRelativo = 'amarillo'
      r.pocaEvidencia = true
    }
  }

  const ritmoResumen = analizarRitmo(resultados, notas)

  // Por compás
  const compases = new Map()
  for (const r of validas) {
    if (r.compas == null) continue
    if (!compases.has(r.compas)) compases.set(r.compas, [])
    compases.get(r.compas).push(r)
  }
  const porCompas = [...compases.entries()]
    .map(([compas, rs]) => { // ya en el orden de la partitura (no se ordena: los compases pueden ser texto)
      const fr = rs.reduce((s, r) => s + r.frames, 0)
      const verde = rs.reduce((s, r) => s + r.pctVerde * r.frames, 0) / fr
      const dev = rs.reduce((s, r) => s + (r.desviacionRelativaCents ?? r.desviacionCents) * r.frames, 0) / fr
      const conRitmo = rs.filter((r) => r.ritmo)
      const ritmoOk = conRitmo.filter((r) => r.ritmo.estado === 'ok').length
      const pctRitmoOk = conRitmo.length ? Math.round((ritmoOk / conRitmo.length) * 100) : null
      const tardes = conRitmo.filter((r) => r.ritmo.estado !== 'ok' && r.ritmo.direccion === 'tarde').length
      const tempranos = conRitmo.filter((r) => r.ritmo.estado !== 'ok' && r.ritmo.direccion === 'temprano').length
      return {
        compas,
        notas: rs.length,
        pctVerde: Math.round(verde),
        desviacionCents: Math.round(dev),
        estado: verde >= 60 ? 'verde' : verde >= 30 ? 'amarillo' : 'rojo',
        pctRitmoOk,
        estadoRitmo: pctRitmoOk == null ? null : pctRitmoOk >= 70 ? 'verde' : pctRitmoOk >= 45 ? 'amarillo' : 'rojo',
        ritmoTendencia: tardes > tempranos ? 'tarde' : tempranos > tardes ? 'temprano' : null,
      }
    })

  const totalFrames = validas.reduce((s, r) => s + r.frames, 0)
  const pctVerdeAbsolutoTotal = totalFrames ? Math.round(validas.reduce((s, r) => s + (r.pctVerdeAbsoluto ?? r.pctVerde) * r.frames, 0) / totalFrames) : 0
  const pctVerdeEstrictoTotal = totalFrames ? Math.round(validas.reduce((s, r) => s + (r.pctVerdeEstricto ?? r.pctVerde) * r.frames, 0) / totalFrames) : 0
  const pctVerdeTotal = totalFrames ? Math.round(validas.reduce((s, r) => s + r.pctVerde * r.frames, 0) / totalFrames) : 0
  let costoAltura = 0
  for (let i = 0; i < frames.t.length; i++) {
    costoAltura += Math.min(Math.abs(fold(frames.m[i] - notas[asig[i]].midi - offsetGrueso)), CAP_COSTO)
  }
  const costoPorCuadro = costoAltura / frames.t.length
  const cobertura = validas.length / K
  const confianza = Math.max(0, Math.min(1, (1 - costoPorCuadro / 1.5) * (0.5 + 0.5 * cobertura)))

  // Notas sin encontrar: las del medio (se las salteó o cantó otra cosa), las del
  // final (dejó de cantar antes) y las del principio (entró más tarde).
  const hayVoz = (r) => r.frames >= 5
  const idxDetectadas = resultados.filter(hayVoz).map((r) => r.indice)
  const primerDetectado = idxDetectadas.length ? Math.min(...idxDetectadas) : -1
  const ultimoDetectado = idxDetectadas.length ? Math.max(...idxDetectadas) : -1
  const sinEncontrar = resultados.filter((r) => r.estado === 'no_detectada')
  const finales = sinEncontrar.filter((r) => r.indice > ultimoDetectado)
  const iniciales = sinEncontrar.filter((r) => r.indice < primerDetectado)
  const medios = sinEncontrar.filter((r) => r.indice > primerDetectado && r.indice < ultimoDetectado)
  const compasesDe = (rs) => [...new Set(rs.filter((r) => r.compas != null).map((r) => r.compas))]

  const conVib = validas.filter((x) => x.vibratoCents != null)
  const vibAmplios = conVib.filter((x) => x.vibratoAmplio)
  const vibrato = {
    largas: conVib.length,
    amplias: vibAmplios.length,
    ampCents: vibAmplios.length ? Math.round(mediana(vibAmplios.map((x) => x.vibratoCents))) : null,
    hz: vibAmplios.length ? Math.round(mediana(vibAmplios.map((x) => x.vibratoHz)) * 10) / 10 : null,
  }

  // Entrada: la primera nota, respecto de donde estaba escrita (solo cuando hubo conteo y se la oyó bien)
  let entradaSeg = null
  if (opciones.inicioCantoSeg != null && resultados[0] && resultados[0].frames >= 5) {
    entradaSeg = Math.round((resultados[0].inicioSeg - (yaSeg + notas[0].inicio)) * 100) / 100
  }
  const resumen = {
    notasEsperadas: K,
    notasDetectadas: validas.length,
    pctVerde: pctVerdeTotal, // entre notas (descontando la afinación general)
    pctVerdeAbsoluto: pctVerdeAbsolutoTotal,
    pctVerdeEstricto: pctVerdeEstrictoTotal, // márgenes de antes (±15, solo verde): para el director
    offsetGlobalCents: offsetGlobal,
    octavaGlobal,
    notasDistintas: resultados.filter((r) => r.estado === 'nota_distinta').map((r) => r.indice),
    notasNoEncontradas: resultados.filter((r) => r.estado === 'no_detectada').map((r) => r.indice),
    // Compás entero sin datos (se salteó o cantó otra cosa) vs. notas sueltas que no se pudieron
    // medir dentro de un compás que sí se cantó (típico: una nota muy corta pegada a otras).
    compasesNoEncontrados: compasesDe(medios).filter((c) => !validas.some((v) => v.compas === c)),
    notasSinMedir: medios.filter((x) => x.compas != null && validas.some((v) => v.compas === x.compas)).map((x) => ({ compas: x.compas, nombre: x.nombre })),
    compasesSinCantarAlFinal: compasesDe(finales).filter((c) => ultimoDetectado < 0 || c !== resultados[ultimoDetectado].compas), // las notas finales sin cantar están en compases iguales o posteriores: no se comparan como texto
    compasesSinCantarAlInicio: compasesDe(iniciales),
    ultimoCompasCantado: ultimoDetectado >= 0 ? (resultados[ultimoDetectado].compas ?? null) : null,
    confianza: Math.round(confianza * 100) / 100,
    alineacionDudosa: confianza < 0.45,
    armonicosCorregidos, // cuadros que el detector de altura confundió con un armónico (diagnóstico)
    pulsoSeg: Math.round(mediana(notas.map((n) => n.pulsoSeg ?? 0.5)) * 1000) / 1000,
    entradaSeg, // cuánto después (o antes, si es negativo) de lo escrito entró la primera nota; null si no se puede saber
    ritmo: ritmoResumen,
    vibrato,
    diagnostico: {
      segundosGrabados: Math.round((curva.t[curva.t.length - 1] || 0) * 10) / 10,
      segundosConVoz: Math.round(frames.t.length * (curva.t.length > 1 ? curva.t[1] - curva.t[0] : 0.02) * 10) / 10,
    },
  }
  const informe = { resumen, notas: resultados, compases: porCompas, tendencias: calcularTendencias(validas, notas) }
  informe.mensajes = redactarMensajes(informe)
  // Curva de altura compacta (SIN audio): solo para el botón oculto de diagnóstico.
  informe.curvaCompacta = {
    t0: Math.round((curva.t[0] || 0) * 1000) / 1000,
    hop: Math.round(paso * 1000) / 1000,
    midi: curva.midi.map((v, i) => (curva.vozeado[i] && Number.isFinite(v) ? Math.round(v * 100) / 100 : null)),
    rms: curva.rms ? Array.from(curva.rms, (v) => Math.round(v * 1000) / 1000) : null,
  }
  return informe
}

function calcularTendencias(validas, notas) {
  const t = {}
  const rel = (r) => r.desviacionRelativaCents
  const prom = (rs) => (rs.length ? Math.round(rs.reduce((s, r) => s + rel(r), 0) / rs.length) : null)

  const ascendentes = [], descendentes = [], finales = [], largas = []
  validas.forEach((r) => {
    const i = r.indice
    if (i > 0) {
      const salto = notas[i].midi - notas[i - 1].midi
      if (salto >= 3) ascendentes.push(r)
      if (salto <= -3) descendentes.push(r)
    }
    const sig = validas.find((v) => v.indice > i)
    if (!sig || sig.inicioSeg - r.finSeg > 0.35) finales.push(r)
    if (r.finSeg - r.inicioSeg >= 0.8) largas.push(r)
  })
  t.saltosAscendentes = { n: ascendentes.length, cents: prom(ascendentes) }
  t.saltosDescendentes = { n: descendentes.length, cents: prom(descendentes) }
  t.finalesDeFrase = { n: finales.length, cents: prom(finales) }
  const pendientes = largas.map((r) => r.pendienteCentsPorSeg).filter((v) => Number.isFinite(v))
  t.notasLargas = { n: largas.length, pendienteCentsPorSeg: pendientes.length ? Math.round(mediana(pendientes)) : null }
  return t
}

function redactarMensajes(inf) {
  const m = []
  const r = inf.resumen
  if (r.alineacionDudosa) {
    m.push('No pude seguir la partitura con seguridad (hubo mucho que no coincidía con lo escrito). Probá de nuevo o con un fragmento más corto.')
  }
  if (Math.abs(r.offsetGlobalCents) >= UMBRAL_NOTA_DISTINTA_CENTS) {
    const st = r.offsetGlobalCents / 100
    m.push(
      `Todo el fragmento sonó aproximadamente ${Math.abs(st).toFixed(1).replace('.0', '')} semitono(s) ${st < 0 ? 'más grave' : 'más agudo'} que lo escrito: ` +
        'parece que arrancaste en otra nota. Escuchá la nota de partida y volvé a grabar.'
    )
  } else if (Math.abs(r.offsetGlobalCents) >= 25) {
    m.push(
      `Tu afinación general estuvo ${Math.abs(r.offsetGlobalCents)} cents ${r.offsetGlobalCents < 0 ? 'baja' : 'alta'} respecto a lo escrito en todo el fragmento. ` +
        'Si tus intervalos suenan bien entre sí, el problema es la nota de partida más que cada nota. (El puntaje de afinación mide tus notas entre sí, sin contar la afinación general.)'
    )
  }
  const verbo = (lista) => (lista.length === 1 ? 'no se oyó' : 'no se oyeron')
  const rangoTxt = (lista) => (lista.length === 1 ? `el compás ${lista[0]}` : `los compases ${lista[0]} a ${lista[lista.length - 1]}`)
  if (r.compasesSinCantarAlFinal.length) {
    m.push(
      r.ultimoCompasCantado != null
        ? `Dejaste de cantar en el compás ${r.ultimoCompasCantado}: ${verbo(r.compasesSinCantarAlFinal)} ${rangoTxt(r.compasesSinCantarAlFinal)}. Si querés practicar un tramo más corto, elegilo antes de grabar.`
        : `${verbo(r.compasesSinCantarAlFinal)} ${rangoTxt(r.compasesSinCantarAlFinal)}.`
    )
  }
  if (r.compasesSinCantarAlInicio.length) {
    m.push(`No se oyó el comienzo (${rangoTxt(r.compasesSinCantarAlInicio)}): ¿entraste más tarde que el conteo?`)
  }
  if (r.compasesNoEncontrados.length) {
    m.push(
      r.compasesNoEncontrados.length === 1
        ? `No encontré las notas del compás ${r.compasesNoEncontrados[0]}: ¿te las salteaste o cantaste otra cosa?`
        : `No encontré las notas de los compases ${r.compasesNoEncontrados.join(', ')}: ¿te las salteaste o cantaste otra cosa?`
    )
  }
  if (r.notasSinMedir.length) {
    const lista = r.notasSinMedir.slice(0, 4).map((x) => `${x.nombre ? nombreEnEspanol(x.nombre) : 'una nota'} (compás ${x.compas})`).join(', ')
    m.push(`No pude medir ${r.notasSinMedir.length === 1 ? 'esta nota' : 'estas notas'}: ${lista}. Suele pasar con notas muy cortas pegadas a otras, o si se saltearon.`)
  }
  if (r.notasDistintas.length) {
    m.push(`${r.notasDistintas.length} nota(s) parecen distintas de las escritas (más de ${UMBRAL_NOTA_DISTINTA_CENTS} cents de diferencia).`)
  }
  if (r.entradaSeg != null && r.pulsoSeg > 0) {
    const e = r.entradaSeg
    const tiempos = Math.round(Math.abs(e) / r.pulsoSeg)
    const cuanto = `${Math.abs(e).toFixed(1).replace('.', ',')} s${tiempos >= 1 ? ` (${tiempos === 1 ? 'un tiempo' : `unos ${tiempos} tiempos`})` : ''}`
    if (e > Math.max(0.6, r.pulsoSeg)) {
      m.push(`Tu primera nota entró ${cuanto} después de lo escrito. Apoyate en los clics del conteo para ubicar la entrada.`)
    } else if (e < -Math.max(0.4, 0.75 * r.pulsoSeg)) {
      m.push(`Tu primera nota entró ${cuanto} antes de lo escrito. Esperá los clics del conteo para entrar justo.`)
    }
  }
  const vb = r.vibrato
  if (vb && vb.amplias >= 1 && vb.amplias >= 0.4 * vb.largas) {
    m.push(
      `En las notas largas tu vibrato es amplio (oscila unos ±${vb.ampCents} cents, unas ${Math.round(vb.hz)} veces por segundo). ` +
        'En coro suele pedirse más angosto o casi recto para que las voces se fundan: probá sostener notas largas con menos oscilación y apoyo parejo.'
    )
  }
  const t = inf.tendencias
  if (t.saltosAscendentes.n >= 2 && t.saltosAscendentes.cents != null && t.saltosAscendentes.cents <= -20) {
    m.push('Los saltos hacia arriba te quedan bajos: probá preparar la nota de llegada antes de cantarla.')
  }
  if (t.finalesDeFrase.n >= 2 && t.finalesDeFrase.cents != null && t.finalesDeFrase.cents <= -20) {
    m.push('Tendés a bajar al final de las frases: sostené el apoyo hasta cortar la nota.')
  }
  if (t.notasLargas.n >= 2 && t.notasLargas.pendienteCentsPorSeg != null && t.notasLargas.pendienteCentsPorSeg <= -15) {
    m.push('En las notas largas la afinación se va cayendo con el tiempo.')
  }
  const rit = r.ritmo
  if (rit && rit.concluyente === false) {
    m.push(
      rit.motivo === 'notas_repetidas'
        ? 'No pude medir tu ritmo con confianza en este fragmento: tiene muchas notas repetidas en la misma altura y, cantadas ligadas, no se distingue dónde entra cada una. Para el ritmo probá un tramo con cambios de nota, o marcá bien cada sílaba. (La afinación sí se midió.)'
        : 'No pude medir tu ritmo con confianza en este fragmento: se distinguieron muy pocas entradas de nota. Probá con un tramo más largo o cantando con las consonantes bien marcadas. (La afinación sí se midió.)'
    )
  }
  if (rit && rit.tempoRelativo != null && (rit.tempoRelativo < 0.88 || rit.tempoRelativo > 1.12)) {
    m.push(`Cantaste al ${Math.round(rit.tempoRelativo * 100)}% del tempo escrito (${rit.tempoRelativo < 1 ? 'más lento' : 'más rápido'}). Si eso es a propósito para estudiar, está bien.`)
  }
  const malRitmo = inf.compases.filter((c) => c.estadoRitmo === 'rojo')
  if (malRitmo.length) {
    const lista = malRitmo.slice(0, 4).map((c) => c.compas).join(', ')
    const dir = malRitmo.filter((c) => c.ritmoTendencia === 'tarde').length >= malRitmo.length / 2 ? 'tarde' : 'temprano'
    m.push(`Ritmo: en ${malRitmo.length === 1 ? 'el compás' : 'los compases'} ${lista} entrás ${dir === 'tarde' ? 'tarde' : 'antes de tiempo'} respecto al pulso. Probá marcar el pulso con el pie.`)
  }
  const cortas = inf.notas.filter((n) => n.duracionEstado === 'corta')
  if (cortas.length >= 2) {
    m.push(`Cortaste antes de tiempo ${cortas.length} notas largas (por ejemplo en el compás ${cortas[0].compas ?? '?'}): sostenelas todo su valor.`)
  }
  if (!m.length) m.push('Buen resultado: no aparecen tendencias claras de desafinación en este fragmento.')
  return m
}
