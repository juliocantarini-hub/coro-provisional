// Guía sonora antes de grabar: primero se toca la nota de partida (para que el
// cantante arranque en el tono correcto) y después, ya grabando, 4 clics al
// tempo de la partitura. Usa su propio AudioContext, separado del reproductor.

import * as Tone from 'tone'
import { midiAFrecuencia, midiANombre } from './afinacion'
import { getPianoSampler } from './pianoSampler'

function crearContexto() {
  const Contexto = window.AudioContext || window.webkitAudioContext
  return new Contexto()
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

// Clic suave y redondo (tipo "toc" de madera): seno grave, ataque de 10 ms y caída de ~0.15 s.
// Antes era un "tic" muy corto y agudo. "acento" = primer clic del conteo.
function clicSuave(ctx, t, { acento = false, volumen = 0.3 } = {}) {
  const osc = ctx.createOscillator()
  const g = ctx.createGain()
  osc.type = 'sine'
  osc.frequency.value = acento ? 880 : 660
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(volumen, t + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16)
  osc.connect(g).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.2)
}

/** Empieza a bajar las muestras de piano (llamar al abrir el panel, así están listas al grabar). */
export function prepararPianoDeGuia() {
  try { getPianoSampler().listo.catch(() => {}) } catch { /* sin piano: se usará el tono simple */ }
}

// Nota de partida con el sonido de piano del reproductor. Devuelve false si no se pudo
// (sin conexión para bajar las muestras, audio bloqueado…): entonces se usa el tono simple.
async function tocarNotaConPiano(midi) {
  try {
    const { sampler, listo } = getPianoSampler()
    await Promise.race([listo, esperar(5000).then(() => { throw new Error('piano no cargó') })])
    await Tone.start()
    if (Tone.getContext().state !== 'running') return false
    sampler.triggerAttackRelease(midiANombre(midi), 1.6, undefined, 0.8)
    await esperar(2000)
    return true
  } catch {
    return false
  }
}

/** Toca la nota de partida (~2 s, piano) y espera a que termine. */
export async function tocarNotaDePartida(midi) {
  if (await tocarNotaConPiano(midi)) return
  await tocarNotaSimple(midi)
}

/**
 * Toca en piano la melodía del primer compás elegido (con su ritmo) y espera a que termine.
 * "notasDelCompas": notas con { midi, inicio, duracion } en segundos relativos al inicio del
 * fragmento (el primer compás arranca en 0; puede haber silencio antes de la primera nota); "duracionSeg": lo que
 * dura el compás. Devuelve true si sonó; false si el piano no estaba disponible (el que llama puede
 * usar entonces la nota de partida suelta como respaldo).
 */
export async function tocarPrimerCompas(notasDelCompas, duracionSeg) {
  try {
    if (!notasDelCompas.length) return false
    const { sampler, listo } = getPianoSampler()
    await Promise.race([listo, esperar(5000).then(() => { throw new Error('piano no cargó') })])
    await Tone.start()
    if (Tone.getContext().state !== 'running') return false
    const base = 0 // el compás empieza en 0: si arranca con silencio, ese silencio se respeta
    const t0 = Tone.now() + 0.1
    for (const n of notasDelCompas) {
      sampler.triggerAttackRelease(midiANombre(n.midi), Math.max(0.15, n.duracion * 0.95), t0 + (n.inicio - base), 0.8)
    }
    await esperar(Math.max(0.5, duracionSeg - base) * 1000 + 500)
    return true
  } catch {
    return false
  }
}

/**
 * Guía opcional MIENTRAS se graba: toca en piano la melodía de la voz del cantante, nota por
 * nota, al ritmo escrito, a partir de este mismo instante (el momento en que entra la voz).
 * Solo tiene sentido con auriculares: sin ellos el piano se colaría en la grabación.
 * "notas": { midi, inicio, duracion } en segundos desde el inicio del fragmento.
 * Devuelve { detener() } o null si el piano no está disponible (no se toca nada).
 */
export function iniciarGuiaPiano(notas) {
  try {
    const { sampler } = getPianoSampler()
    if (!sampler?.loaded) return null
    const timers = []
    for (const n of notas) {
      timers.push(setTimeout(() => {
        try { sampler.triggerAttackRelease(midiANombre(n.midi), Math.max(0.15, n.duracion * 0.95), undefined, 0.55) } catch { /* ya detenido */ }
      }, Math.max(0, n.inicio * 1000)))
    }
    return {
      detener() {
        timers.forEach(clearTimeout)
        try { sampler.releaseAll() } catch { /* nada sonando */ }
      },
    }
  } catch {
    return null
  }
}

/** Respaldo: tono simple (seno + 2.º armónico) de ~1.6 s. */
async function tocarNotaSimple(midi) {
  const ctx = crearContexto()
  if (ctx.state === 'suspended') await ctx.resume()
  const t0 = ctx.currentTime + 0.05
  const ganancia = ctx.createGain()
  ganancia.connect(ctx.destination)
  ganancia.gain.setValueAtTime(0, t0)
  ganancia.gain.linearRampToValueAtTime(0.25, t0 + 0.05)
  ganancia.gain.setValueAtTime(0.25, t0 + 1.3)
  ganancia.gain.linearRampToValueAtTime(0, t0 + 1.6)
  for (const [mult, amp] of [[1, 1], [2, 0.3]]) { // fundamental + un poco de 2.º armónico: suena menos "frío"
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    g.gain.value = amp
    osc.type = 'sine'
    osc.frequency.value = midiAFrecuencia(midi) * mult
    osc.connect(g).connect(ganancia)
    osc.start(t0)
    osc.stop(t0 + 1.65)
  }
  await esperar(1800)
  try { await ctx.close() } catch { /* ya cerrado */ }
}

/**
 * Conteo previo de UN COMPÁS entero: "clics" clics (uno por pulso del compás, el primero acentuado)
 * separados por "pulsoSeg" segundos. Llama a alPulso(1..clics) en cada uno y espera un pulso más
 * (hasta el "ya": el pulso donde entra la voz). Devuelve cuántos segundos duró el conteo completo.
 */
export async function contar(pulsoSeg, alPulso, clics = 4) {
  const ctx = crearContexto()
  if (ctx.state === 'suspended') await ctx.resume()
  const inicio = ctx.currentTime + 0.1
  for (let i = 0; i < clics; i++) clicSuave(ctx, inicio + i * pulsoSeg, { acento: i === 0, volumen: 0.35 })
  for (let i = 0; i < clics; i++) {
    await esperar(i === 0 ? 100 : pulsoSeg * 1000)
    alPulso(i + 1)
  }
  await esperar(pulsoSeg * 1000) // hasta el "ya": el pulso donde entra la voz
  try { await ctx.close() } catch { /* ya cerrado */ }
  return 0.1 + clics * pulsoSeg
}
