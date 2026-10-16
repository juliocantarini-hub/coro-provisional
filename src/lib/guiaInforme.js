// Guía sonora antes de grabar: primero se toca la nota de partida (para que el
// cantante arranque en el tono correcto) y después, ya grabando, 4 clics al
// tempo de la partitura. Usa su propio AudioContext, separado del reproductor.

import { midiAFrecuencia } from './afinacion'

function crearContexto() {
  const Contexto = window.AudioContext || window.webkitAudioContext
  return new Contexto()
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms))

/** Toca la nota de partida (~1.6 s) y espera a que termine. */
export async function tocarNotaDePartida(midi) {
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
 * Cuenta 4 clics separados por "pulsoSeg" segundos. Llama a alPulso(1..4) en
 * cada uno y devuelve (cuando termina el 4.º pulso) cuántos segundos duró el
 * conteo completo, para ignorar ese tramo en el análisis.
 */
export async function contar(pulsoSeg, alPulso) {
  const ctx = crearContexto()
  if (ctx.state === 'suspended') await ctx.resume()
  const inicio = ctx.currentTime + 0.1
  for (let i = 0; i < 4; i++) {
    const t = inicio + i * pulsoSeg
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.frequency.value = i === 0 ? 1500 : 1000
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.004)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06)
    osc.connect(g).connect(ctx.destination)
    osc.start(t)
    osc.stop(t + 0.08)
  }
  for (let i = 0; i < 4; i++) {
    await esperar(i === 0 ? 100 : pulsoSeg * 1000)
    alPulso(i + 1)
  }
  await esperar(pulsoSeg * 1000) // hasta el "ya": el pulso donde entra la voz
  try { await ctx.close() } catch { /* ya cerrado */ }
  return 0.1 + 4 * pulsoSeg
}
