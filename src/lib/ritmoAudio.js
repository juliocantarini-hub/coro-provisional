// Audio del entrenamiento rítmico: conteo, pulso, sonido del ejemplo y registro de los toques.
// Usa su propio AudioContext (compartido por toda la app) y no depende del reproductor de obras.
//
// Cómo se mide cuándo toca el cantante: cada toque trae su marca de tiempo (performance.now) y se
// la convierte al reloj del audio con getOutputTimestamp(), que ya descuenta la latencia de salida.
// Lo que quede de diferencia constante lo absorbe la corrección (corregir() en ritmo.js).

import * as Tone from 'tone'
import { getPianoSampler } from './pianoSampler'

let contextoCompartido = null

/** Empieza a bajar las muestras de piano (llamar al abrir un ejercicio, así están listas al escuchar). */
export function precargarPiano() {
  try { getPianoSampler().listo.catch(() => {}) } catch { /* sin piano: suena el tono simple */ }
}

function obtenerContexto() {
  if (!contextoCompartido || contextoCompartido.state === 'closed') {
    const Contexto = window.AudioContext || window.webkitAudioContext
    contextoCompartido = new Contexto({ latencyHint: 'interactive' })
  }
  return contextoCompartido
}

// Clic de pulso: seno corto; el primero del compás suena más agudo
function clic(ctx, t, { acento = false, volumen = 0.25 } = {}, nodos) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = acento ? 880 : 660
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.008)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.18)
  nodos.push(osc, g)
}

// Sonido del ejemplo: tono suave con la duración de la figura (así se oyen las blancas más largas que las negras)
function tono(ctx, t, dur, nodos) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'triangle'
  osc.frequency.value = 392
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.01)
  g.gain.setValueAtTime(0.4, t + Math.max(0.011, dur - 0.05))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur + 0.02)
  nodos.push(osc, g)
}

// Respuesta al toque del cantante: "tok" de palillo en el aro del tambor (rim click). Seco, agudo y fuerte,
// bien distinto del clic del pulso y del piano del ejemplo, y se oye aun en el parlante del teléfono.
function sonidoToque(ctx) {
  const t = ctx.currentTime + 0.003
  const salida = ctx.createGain()
  salida.gain.value = 0.6
  salida.connect(ctx.destination)

  // Resonancias metálicas del aro: dos tonos agudos que caen enseguida
  const tono = (tipo, f0, f1, pico, dur) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = tipo
    o.frequency.setValueAtTime(f0, t)
    o.frequency.exponentialRampToValueAtTime(f1, t + dur)
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(pico, t + 0.002)
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
    o.connect(g).connect(salida)
    o.start(t)
    o.stop(t + dur + 0.02)
  }
  tono('sine', 1850, 1650, 0.55, 0.09)
  tono('triangle', 3100, 2800, 0.3, 0.05)
  // Cuerpo del golpe: un "toc" grave y cortísimo (el palillo sobre el parche)
  tono('sine', 330, 200, 0.5, 0.05)

  // Chasquido: ruido filtrado en agudos, muy corto
  const largo = Math.floor(ctx.sampleRate * 0.035)
  const buf = ctx.createBuffer(1, largo, ctx.sampleRate)
  const datos = buf.getChannelData(0)
  for (let i = 0; i < largo; i++) datos[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / largo, 2)
  const ruido = ctx.createBufferSource()
  ruido.buffer = buf
  const filtro = ctx.createBiquadFilter()
  filtro.type = 'bandpass'
  filtro.frequency.value = 4200
  filtro.Q.value = 1.2
  const gr = ctx.createGain()
  gr.gain.value = 0.9
  ruido.connect(filtro).connect(gr).connect(salida)
  ruido.start(t)
}

export function crearMotorRitmo() {
  const ctx = obtenerContexto()
  let actual = null // { parar }
  let piano = null  // { sampler } una vez cargado

  const latencia = () => {
    const l = Number.isFinite(ctx.outputLatency) ? ctx.outputLatency : 0
    return l || ctx.baseLatency || 0
  }

  // Marca de tiempo de un evento (performance.now) → reloj del audio
  function ctxDePerf(perfMs) {
    try {
      const ts = ctx.getOutputTimestamp ? ctx.getOutputTimestamp() : null
      if (ts && ts.performanceTime > 0 && ts.contextTime > 0) {
        return ts.contextTime + (perfMs - ts.performanceTime) / 1000
      }
    } catch { /* se usa el cálculo de respaldo */ }
    return ctx.currentTime - latencia() + (perfMs - performance.now()) / 1000
  }

  /** Hay que llamarlo dentro de un toque/clic del usuario: algunos navegadores bloquean el audio hasta entonces. */
  async function asegurar() {
    if (ctx.state !== 'running') {
      try { await ctx.resume() } catch { /* se informa abajo */ }
    }
    return ctx.state === 'running'
  }

  /** Baja (si hace falta) y activa el piano del ejemplo. Devuelve false si no se pudo: entonces suena el tono simple. */
  async function prepararPiano() {
    if (piano) return true
    try {
      const { sampler, listo } = getPianoSampler()
      await Promise.race([listo, new Promise((_, rechazar) => setTimeout(() => rechazar(new Error('piano no cargó')), 6000))])
      await Tone.start()
      if (Tone.getContext().state !== 'running') return false
      piano = { sampler }
      return true
    } catch {
      return false
    }
  }

  function parar() {
    if (actual) { actual.parar(); actual = null }
  }

  /**
   * Un compás de conteo y después el ejercicio, con el pulso sonando.
   * tonos: true → suena el ejemplo (escuchar); false → solo pulso, y se registran los toques (practicar).
   * onConteo(n) en cada clic del conteo; onPulso(b) en cada pulso del ejercicio (0, 1, 2…); onEntrada(i) cuando llega cada figura (nota o silencio); onFin() al terminar.
   * Devuelve { toques, tomarToque(perfMs), parar }.
   */
  function correr(ej, { tonos = false, gracia = 0.45, onConteo, onPulso, onEntrada, onFin } = {}) {
    parar()
    const nodos = []
    const p = ej.pulsoSeg
    const nConteo = ej.pulsosPorCompas
    const t0 = ctx.currentTime + 0.15
    const inicio = t0 + nConteo * p

    for (let k = 0; k < nConteo; k++) clic(ctx, t0 + k * p, { acento: k === 0, volumen: 0.32 }, nodos)
    const nPulsos = Math.ceil(ej.duracionPulsos - 1e-6)
    for (let b = 0; b < nPulsos; b++) {
      clic(ctx, inicio + b * p, { acento: b % ej.pulsosPorCompas === 0, volumen: tonos ? 0.1 : 0.26 }, nodos)
    }
    if (tonos && piano) {
      // Piano: se programa en el reloj de Tone, desplazado para que coincida con el del conteo
      const dif = Tone.getContext().currentTime - ctx.currentTime
      for (const e of ej.notas) {
        const dur = Math.max(0.1, e.durSeg * 0.95)
        try { piano.sampler.triggerAttackRelease('B4', dur, inicio + e.inicioSeg + dif, 0.85) } catch { /* se pierde esa nota */ }
      }
      nodos.push({ stop() { try { piano.sampler.releaseAll() } catch { /* nada que soltar */ } } })
    } else if (tonos) {
      for (const e of ej.notas) tono(ctx, inicio + e.inicioSeg, Math.max(0.1, Math.min(e.durSeg * 0.9, e.durSeg - 0.04)), nodos)
    }

    const eventos = []
    for (let k = 0; k < nConteo; k++) eventos.push({ t: t0 + k * p, f: () => onConteo && onConteo(k + 1) })
    ej.entradas.forEach((e, i) => eventos.push({ t: inicio + e.inicioSeg, f: () => onEntrada && onEntrada(i) }))
    for (let b = 0; b < nPulsos; b++) eventos.push({ t: inicio + b * p, f: () => onPulso && onPulso(b) })
    eventos.sort((a, c) => a.t - c.t)
    const fin = inicio + ej.duracionSeg + gracia

    let idx = 0
    let terminado = false
    const toques = []
    let timer = null

    const detener = () => {
      terminado = true
      if (timer) { clearInterval(timer); timer = null }
    }
    const control = {
      toques,
      tomarToque(perfMs) {
        if (terminado) return null
        const ms = perfMs > 1e12 ? perfMs - performance.timeOrigin : perfMs
        const seg = ctxDePerf(ms) - inicio
        if (seg < -0.35) return null // durante el conteo no vale
        sonidoToque(ctx)
        toques.push(seg)
        return seg
      },
      parar() {
        detener()
        for (const n of nodos) {
          try { if (typeof n.stop === 'function') n.stop() } catch { /* ya terminó */ }
          try { n.disconnect() } catch { /* ya desconectado */ }
        }
        if (actual === control) actual = null
      },
    }
    actual = control

    timer = setInterval(() => {
      const ahora = ctx.currentTime - latencia()
      while (idx < eventos.length && eventos[idx].t <= ahora) eventos[idx++].f()
      if (ahora >= fin) {
        detener()
        if (actual === control) actual = null
        if (onFin) onFin()
      }
    }, 20)
    return control
  }

  return { asegurar, prepararPiano, correr, parar }
}
