// Audio de la práctica auditiva: toca notas y acordes con el piano de la app (o un tono simple si el piano
// no está disponible). Una sola reproducción a la vez: al empezar otra, se corta la anterior.

import * as Tone from 'tone'
import { midiANombre } from './afinacion'
import { getPianoSampler } from './pianoSampler'

let sintetizador = null
let activo = null // { cancelar }
let generacion = 0 // sube cada vez que se corta el sonido: lo que estaba preparándose se descarta

/** Empieza a bajar las muestras de piano (llamar al abrir un ejercicio, así están listas al escuchar). */
export function precargarPiano() {
  try { getPianoSampler().listo.catch(() => {}) } catch { /* sin piano: suena el tono simple */ }
}

function esperar(ms) { return new Promise((r) => setTimeout(r, ms)) }

async function obtenerInstrumento() {
  await Tone.start()
  if (Tone.getContext().state !== 'running') return null
  try {
    const { sampler, listo } = getPianoSampler()
    await Promise.race([listo, esperar(6000).then(() => { throw new Error('piano no cargó') })])
    return {
      tocar: (midi, dur, t, vel) => sampler.triggerAttackRelease(midiANombre(midi), dur, t, vel),
      soltarTodo: () => { try { sampler.releaseAll() } catch { /* nada sonando */ } },
    }
  } catch {
    if (!sintetizador) {
      sintetizador = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.45, release: 0.7 },
      }).toDestination()
      sintetizador.volume.value = -6
    }
    return {
      tocar: (midi, dur, t, vel) => sintetizador.triggerAttackRelease(Tone.Frequency(midi, 'midi').toFrequency(), dur, t, vel),
      soltarTodo: () => { try { sintetizador.releaseAll() } catch { /* nada sonando */ } },
    }
  }
}

/** Corta lo que esté sonando (y lo que todavía se está preparando para sonar). */
export function detener() {
  generacion++
  if (activo) {
    const a = activo
    activo = null
    a.cancelar()
  }
}

/**
 * Toca notas: [{ midi, inicio, duracion }] (segundos desde el comienzo). Resuelve true cuando termina
 * o false si se cortó antes. Falla (reject) si el navegador no deja activar el audio.
 * Cada nota se dispara en su momento (no se programan por adelantado), así cortar el sonido las cancela todas.
 */
export async function tocarNotas(notas, { vel = 0.8, cola = 0.3 } = {}) {
  detener()
  const mia = generacion
  const instrumento = await obtenerInstrumento()
  if (mia !== generacion) return false // se salió o se pidió otro sonido mientras se preparaba
  if (!instrumento) throw new Error('No se pudo activar el sonido.')
  const temporizadores = []
  let fin = 0
  for (const n of notas) {
    temporizadores.push(setTimeout(() => {
      instrumento.tocar(n.midi, Math.max(0.15, n.duracion * 0.95), Tone.now() + 0.01, n.vel ?? vel)
    }, Math.max(0, n.inicio * 1000)))
    fin = Math.max(fin, n.inicio + n.duracion)
  }
  return new Promise((resolve) => {
    temporizadores.push(setTimeout(() => { activo = null; resolve(true) }, (fin + cola + 0.08) * 1000))
    activo = {
      cancelar() {
        temporizadores.forEach(clearTimeout)
        instrumento.soltarTodo()
        resolve(false)
      },
    }
  })
}
