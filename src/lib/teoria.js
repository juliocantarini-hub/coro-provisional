import * as Tone from 'tone'
import { getPianoSampler } from './pianoSampler'
import { midiDePaso } from './notacion'

// ─────────────────────────────────────────────────────────────────────────────
// "Entendé la partitura": lecciones cortas de teoría para coreutas que aprenden
// de oído pero trabajan con partituras. El objetivo es reconocer y ubicar,
// no nombrar ni escribir.
// ─────────────────────────────────────────────────────────────────────────────

export const COLOR_TEORIA = '#8E3E7C'
export const FONDO_TEORIA = '#F7E8F3'
export const BORDE_TEORIA = '#E9CFE2'

// disponible: false → se muestra como "Próximamente"
export const LECCIONES = [
  { id: 'tu-voz', titulo: 'Tu voz en la partitura', descr: 'Encontrá tu renglón, seguilo y ubicá los compases.', disponible: true },
  { id: 'mapa', titulo: 'El mapa de la obra', descr: 'Repeticiones, casillas, D.C., coda, calderón y dinámicas.', disponible: false },
  { id: 'pulso', titulo: 'Pulso y compás', descr: 'Sentí el pulso y entendé el 4/4, el 3/4 y el 6/8.', disponible: false },
  { id: 'figuras', titulo: 'Figuras y silencios', descr: 'Notas largas y cortas, y cuándo no cantar.', disponible: false },
  { id: 'claves', titulo: 'Pentagrama y claves', descr: 'Arriba es agudo, abajo es grave. Las claves de sol y de fa.', disponible: false },
  { id: 'notas', titulo: 'Las notas y el teclado', descr: 'Ubicá en el piano la nota que ves.', disponible: false },
  { id: 'alteraciones', titulo: 'Alteraciones', descr: 'Sostenidos, bemoles y becuadros: qué cambian.', disponible: false },
  { id: 'intervalos', titulo: 'Intervalos por oído', descr: 'Reconocé los saltos entre notas.', disponible: false },
]

export const NOMBRE_VOZ_SATB = { S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Bajo' }

// Voz del perfil → renglón de la partitura SATB.
// Mezzo y barítono cantan en una u otra línea según la obra.
export function vozSATB(voz) {
  const v = String(voz || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
  if (v.startsWith('sopr')) return { principal: 'S', validas: ['S'] }
  if (v.startsWith('mezzo')) return { principal: 'S', validas: ['S', 'A'], nombre: 'Mezzo' }
  if (v.startsWith('contr') || v.startsWith('alto')) return { principal: 'A', validas: ['A'] }
  if (v.startsWith('ten')) return { principal: 'T', validas: ['T'] }
  if (v.startsWith('bari')) return { principal: 'B', validas: ['T', 'B'], nombre: 'Barítono' }
  if (v.startsWith('baj')) return { principal: 'B', validas: ['B'] }
  return null
}

// Convierte la frase escrita ("E5:1") a { paso, dur }. dur en pulsos (1 negra, 2 blanca, 4 redonda).
const LETRA = { C: 0, D: 1, E: 2, F: 3, G: 4, A: 5, B: 6 }
export function frase(texto) {
  const r = {}
  for (const [voz, compases] of Object.entries(texto)) {
    r[voz] = compases.map((c) => c.trim().split(/\s+/).map((tok) => {
      const [nota, dur] = tok.split(':')
      return { paso: 7 * Number(nota.slice(1)) + LETRA[nota[0]], dur: Number(dur) }
    }))
  }
  return r
}

// Los tenores leen en clave de sol con un 8 abajo: suenan una octava más grave de lo escrito.
const TRANSPORTE = { T: -12 }

// Toca una frase en el piano. voces: las que suenan; guia: la voz cuyas notas se van marcando (onNota).
// Devuelve una función para detener. Cada ataque se dispara con un temporizador, así "Parar" corta todo.
export async function tocarFrase({ frase: f, voces, guia, desde, hasta, tempo = 76, onNota, onFin }) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  await listo
  const seg = 60 / tempo
  const ataques = new Map() // pulso → notas que empiezan ahí
  let total = 0
  for (const v of voces) {
    let pulso = 0
    for (let m = desde; m < hasta; m++) {
      f[v][m].forEach((n, i) => {
        if (!ataques.has(pulso)) ataques.set(pulso, [])
        ataques.get(pulso).push({ v, m, i, ...n })
        pulso += n.dur
      })
    }
    total = Math.max(total, pulso)
  }
  const timers = []
  for (const [pulso, notas] of ataques) {
    timers.push(setTimeout(() => {
      for (const n of notas) {
        const midi = midiDePaso(n.paso) + (TRANSPORTE[n.v] || 0)
        sampler.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), n.dur * seg * 0.92)
        if (n.v === guia) onNota?.({ voz: n.v, compas: n.m, i: n.i })
      }
    }, 150 + pulso * seg * 1000))
  }
  timers.push(setTimeout(() => onFin?.(), 150 + total * seg * 1000 + 250))
  return () => { timers.forEach(clearTimeout); try { sampler.releaseAll() } catch { /* nada */ } }
}

export async function tocarNota(paso, voz) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  await listo
  sampler.triggerAttackRelease(Tone.Frequency(midiDePaso(paso) + (TRANSPORTE[voz] || 0), 'midi').toNote(), 1.6)
}
