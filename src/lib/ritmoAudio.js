// Audio del entrenamiento rítmico: conteo, pulso, sonido del ejemplo y registro de los toques.
// Usa su propio AudioContext (compartido por toda la app) y no depende del reproductor de obras.
//
// Cómo se mide cuándo toca el cantante: cada toque trae su marca de tiempo (performance.now) y se
// la convierte al reloj del audio con getOutputTimestamp(), que ya descuenta la latencia de salida.
// Lo que quede de diferencia constante lo absorbe la corrección (corregir() en ritmo.js).

let contextoCompartido = null

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

// Respuesta al toque del cantante: "tum" grave y seco, distinto del clic del pulso
function sonidoToque(ctx) {
  const t = ctx.currentTime + 0.003
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.setValueAtTime(220, t)
  osc.frequency.exponentialRampToValueAtTime(140, t + 0.09)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(0.5, t + 0.006)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.15)
}

export function crearMotorRitmo() {
  const ctx = obtenerContexto()
  let actual = null // { parar }

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

  function parar() {
    if (actual) { actual.parar(); actual = null }
  }

  /**
   * Un compás de conteo y después el ejercicio, con el pulso sonando.
   * tonos: true → suena el ejemplo (escuchar); false → solo pulso, y se registran los toques (practicar).
   * onConteo(n) en cada clic del conteo; onEntrada(i) cuando llega cada figura (nota o silencio); onFin() al terminar.
   * Devuelve { toques, tomarToque(perfMs), parar }.
   */
  function correr(ej, { tonos = false, gracia = 0.45, onConteo, onEntrada, onFin } = {}) {
    parar()
    const nodos = []
    const p = ej.pulsoSeg
    const nConteo = ej.pulsosPorCompas
    const t0 = ctx.currentTime + 0.15
    const inicio = t0 + nConteo * p

    for (let k = 0; k < nConteo; k++) clic(ctx, t0 + k * p, { acento: k === 0, volumen: 0.32 }, nodos)
    const nPulsos = Math.ceil(ej.duracionPulsos - 1e-6)
    for (let b = 0; b < nPulsos; b++) {
      clic(ctx, inicio + b * p, { acento: b % ej.pulsosPorCompas === 0, volumen: tonos ? 0.14 : 0.26 }, nodos)
    }
    if (tonos) {
      for (const e of ej.notas) tono(ctx, inicio + e.inicioSeg, Math.max(0.1, Math.min(e.durSeg * 0.9, e.durSeg - 0.04)), nodos)
    }

    const eventos = []
    for (let k = 0; k < nConteo; k++) eventos.push({ t: t0 + k * p, f: () => onConteo && onConteo(k + 1) })
    ej.entradas.forEach((e, i) => eventos.push({ t: inicio + e.inicioSeg, f: () => onEntrada && onEntrada(i) }))
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

  return { asegurar, correr, parar }
}
