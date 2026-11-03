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
  { id: 'mapa', titulo: 'El mapa de la obra', descr: 'Repeticiones, casillas, D.C., coda, calderón y dinámicas.', disponible: true },
  { id: 'pulso', titulo: 'Pulso y compás', descr: 'Sentí el pulso y entendé el 4/4, el 3/4 y el 6/8.', disponible: true },
  { id: 'figuras', titulo: 'Figuras y silencios', descr: 'Notas largas y cortas, y cuándo no cantar.', disponible: true },
  { id: 'claves', titulo: 'Pentagrama y claves', descr: 'Arriba es agudo, abajo es grave. Las claves de sol y de fa.', disponible: true },
  { id: 'notas', titulo: 'Las notas y el teclado', descr: 'Ubicá en el piano la nota que ves.', disponible: true },
  { id: 'alteraciones', titulo: 'Alteraciones', descr: 'Sostenidos, bemoles y becuadros: qué cambian.', disponible: true },
  { id: 'intervalos', titulo: 'Intervalos por oído', descr: 'Reconocé los saltos entre notas.', disponible: true },
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
// Alteraciones escritas: "F#5" sostenido, "Bb4" bemol, "Fn5" becuadro. Como en la partitura, una alteración
// vale para el resto del compás en esa misma nota: un "F5" después de un "F#5" suena sostenido (alter) sin signo escrito.
const SIGNO = { '#': ['sostenido', 1], b: ['bemol', -1], n: ['becuadro', 0] }
export function frase(texto) {
  const r = {}
  for (const [voz, compases] of Object.entries(texto)) {
    r[voz] = compases.map((c) => {
      const vigentes = {}
      return c.trim().split(/\s+/).map((tok) => {
        const [nota, dur] = tok.split(':')
        const m = nota.match(/^([A-G])([#bn]?)(\d)$/)
        const paso = 7 * Number(m[3]) + LETRA[m[1]]
        const n = { paso, dur: Number(dur) }
        if (m[2]) {
          const [signo, alter] = SIGNO[m[2]]
          n.signo = signo
          vigentes[paso] = alter
        }
        if (vigentes[paso]) n.alter = vigentes[paso]
        return n
      })
    })
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
        const midi = midiDePaso(n.paso, n.alter || 0) + (TRANSPORTE[n.v] || 0)
        sampler.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), n.dur * seg * 0.92)
        if (n.v === guia) onNota?.({ voz: n.v, compas: n.m, i: n.i })
      }
    }, 150 + pulso * seg * 1000))
  }
  timers.push(setTimeout(() => onFin?.(), 150 + total * seg * 1000 + 250))
  return () => { timers.forEach(clearTimeout); try { sampler.releaseAll() } catch { /* nada */ } }
}

export async function tocarNota(paso, voz, alter = 0) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  await listo
  sampler.triggerAttackRelease(Tone.Frequency(midiDePaso(paso, alter) + (TRANSPORTE[voz] || 0), 'midi').toNote(), 1.6)
}

// Notas de un compás suelto ("C5:1 D5:1 E5:2") → [{ paso, dur }]
export const motivo = (texto) => frase({ x: [texto] }).x[0]

// Toca compases en el orden de un recorrido (repeticiones, D.C., etc.).
// compases[i] = [{ paso, dur, vel?, calderon? }]; onCompas(i, k) avisa qué compás suena (k = posición en el recorrido).
// opciones por compás: respira (corta un poco la última nota para respirar).
export async function tocarRecorrido({ compases, orden, tempo = 100, onCompas, onFin, respiraciones = [] }) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  await listo
  const seg = 60 / tempo
  const timers = []
  let t = 0.15
  orden.forEach((ci, k) => {
    const inicio = t
    timers.push(setTimeout(() => onCompas?.(ci, k), inicio * 1000))
    const notas = compases[ci]
    notas.forEach((n, j) => {
      let dur = n.dur * seg * (n.calderon ? 2.6 : 1)
      const corte = j === notas.length - 1 && respiraciones.includes(ci) ? 0.35 : 0
      const ataque = t
      timers.push(setTimeout(() => {
        sampler.triggerAttackRelease(Tone.Frequency(midiDePaso(n.paso, n.alter || 0), 'midi').toNote(), Math.max(0.1, (dur - corte) * 0.92), undefined, n.vel ?? 0.7)
      }, ataque * 1000))
      t += dur
    })
  })
  timers.push(setTimeout(() => onFin?.(), (t + 0.3) * 1000))
  return () => { timers.forEach(clearTimeout); try { sampler.releaseAll() } catch { /* nada */ } }
}

// ─── Pulso y compás ──────────────────────────────────────────────────────────
// Toca una serie de pulsos con clic (el primero de cada compás más fuerte) y, opcionalmente, música de piano.
// acento(i) → 'fuerte' | 'medio' | 'debil'. eventos: [{ t (en pulsos), midis: [..], dur (en pulsos), vel }].
// Los clics se programan en el reloj de audio (precisos); el piano y los avisos a la pantalla, con temporizadores.
const CLIC = { fuerte: [1050, 0.38], medio: [820, 0.24], debil: [660, 0.14] }

// resonancia: false acorta la cola del piano, para que cada nota dure lo que la figura y no tape los silencios
// ni siga sonando al terminar el ejemplo (se restablece al final).
export async function tocarPulsos({ tempo = 90, pulsos, acento = () => 'debil', eventos = [], clic = true, onPulso, onFin, resonancia = true }) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  if (eventos.length) await listo
  const releaseOriginal = sampler.release
  if (!resonancia) sampler.release = 0.12
  const restablecer = () => { if (!resonancia) setTimeout(() => { sampler.release = releaseOriginal }, 200) }
  const ctx = Tone.getContext().rawContext
  const seg = 60 / tempo
  const salida = ctx.createGain()
  salida.connect(ctx.destination)
  const t0 = ctx.currentTime + 0.45
  const timers = []
  for (let i = 0; i < pulsos; i++) {
    const t = t0 + i * seg
    if (clic) {
      const [f, vol] = CLIC[acento(i)] || CLIC.debil
      const o = ctx.createOscillator()
      const g = ctx.createGain()
      o.type = 'sine'
      o.frequency.value = f
      g.gain.setValueAtTime(0.0001, t)
      g.gain.exponentialRampToValueAtTime(vol, t + 0.006)
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.12)
      o.connect(g).connect(salida)
      o.start(t)
      o.stop(t + 0.15)
    }
    timers.push(setTimeout(() => onPulso?.(i), (t - ctx.currentTime) * 1000))
  }
  // El piano va en el mismo reloj que el clic: cada nota se programa con su momento exacto, un ratito antes
  // (si se disparara "ahora" desde el temporizador, Tone le suma su anticipación y llega tarde respecto del clic).
  // Programar de a poco, y no todo de entrada, permite que "Parar" corte la música.
  const ANTES = 0.3
  for (const e of eventos) {
    const t = t0 + e.t * seg
    timers.push(setTimeout(() => {
      for (const m of e.midis) sampler.triggerAttackRelease(Tone.Frequency(m, 'midi').toNote(), e.dur * seg * (resonancia ? 0.9 : 0.97), t, e.vel ?? 0.6)
    }, Math.max(0, (t - ANTES - ctx.currentTime) * 1000)))
    if (e.alSonar) timers.push(setTimeout(e.alSonar, Math.max(0, (t - ctx.currentTime) * 1000)))
  }
  timers.push(setTimeout(() => { restablecer(); onFin?.() }, (t0 + pulsos * seg - ctx.currentTime) * 1000 + 300))
  return () => {
    timers.forEach(clearTimeout)
    try { salida.gain.value = 0; salida.disconnect() } catch { /* nada */ }
    try { sampler.releaseAll() } catch { /* nada */ }
    restablecer()
  }
}

// Acentos típicos de cada compás (por pulso dentro del compás)
export function acentoDe(compas) {
  return (i) => {
    const p = i % compas.pulsos
    if (p === 0) return 'fuerte'
    if (compas.medio?.includes(p)) return 'medio'
    return 'debil'
  }
}

export const COMPASES = {
  '2/4': { arriba: 2, abajo: 4, pulsos: 2, tempo: 96 },
  '3/4': { arriba: 3, abajo: 4, pulsos: 3, tempo: 104 },
  '4/4': { arriba: 4, abajo: 4, pulsos: 4, tempo: 96, medio: [2] },
  '6/8': { arriba: 6, abajo: 8, pulsos: 6, tempo: 168, medio: [3], grupos: 3 },
}

// Músicas cortas de ejemplo (4 compases): bajo fuerte en el 1, acordes suaves en el resto y una melodía.
// Do mayor: C3=48, G2=43; acordes en la octava 4; melodía en la 5.
const ACORDE = { C: [64, 67], G7: [65, 71] }
const BAJO = { C: 48, G7: 43 }
export function musicaDe(clave) {
  const ev = []
  const armonia = ['C', 'G7', 'G7', 'C']
  if (clave === '3/4') {
    const melodia = [[76, 3], [74, 3], [77, 3], [76, 3]]
    armonia.forEach((a, c) => {
      const t = c * 3
      ev.push({ t, midis: [BAJO[a]], dur: 1, vel: 0.85 })
      ev.push({ t: t + 1, midis: ACORDE[a], dur: 1, vel: 0.28 }, { t: t + 2, midis: ACORDE[a], dur: 1, vel: 0.28 })
      ev.push({ t, midis: [melodia[c][0]], dur: melodia[c][1], vel: 0.6 })
    })
  } else if (clave === '4/4') {
    const melodia = [[72, 74, 76, 72], [74, 77, 79, 77], [76, 74, 71, 74], [72, null, null, null]]
    armonia.forEach((a, c) => {
      const t = c * 4
      ev.push({ t, midis: [BAJO[a]], dur: 1, vel: 0.85 }, { t: t + 2, midis: [BAJO[a] + 7], dur: 1, vel: 0.5 })
      ev.push({ t: t + 1, midis: ACORDE[a], dur: 1, vel: 0.28 }, { t: t + 3, midis: ACORDE[a], dur: 1, vel: 0.28 })
      melodia[c].forEach((m, j) => m && ev.push({ t: t + j, midis: [m], dur: c === 3 ? 4 : 1, vel: 0.55 }))
    })
  } else if (clave === '2/4') {
    // Polca: bajo en el 1, acorde en el 2
    const armonia2 = ['C', 'G7', 'G7', 'C']
    const melodia = [[[79, 0.5], [76, 0.5], [76, 1]], [[77, 0.5], [74, 0.5], [74, 1]], [[71, 0.5], [74, 0.5], [77, 0.5], [74, 0.5]], [[72, 2]]]
    armonia2.forEach((a, c) => {
      const t = c * 2
      ev.push({ t, midis: [BAJO[a]], dur: 1, vel: 0.85 }, { t: t + 1, midis: ACORDE[a], dur: 1, vel: 0.3 })
      let p = 0
      for (const [m, d] of melodia[c]) { ev.push({ t: t + p, midis: [m], dur: d, vel: 0.55 }); p += d }
    })
  } else if (clave === '6/8') {
    const melodia = [[[76, 2], [77, 1], [79, 2], [77, 1]], [[76, 3], [74, 3]], [[74, 2], [76, 1], [77, 2], [74, 1]], [[72, 6]]]
    armonia.forEach((a, c) => {
      const t = c * 6
      ev.push({ t, midis: [BAJO[a]], dur: 2, vel: 0.85 }, { t: t + 3, midis: [BAJO[a] + 7], dur: 2, vel: 0.55 })
      ev.push({ t: t + 1, midis: ACORDE[a], dur: 1, vel: 0.22 }, { t: t + 2, midis: ACORDE[a], dur: 1, vel: 0.22 })
      ev.push({ t: t + 4, midis: ACORDE[a], dur: 1, vel: 0.22 }, { t: t + 5, midis: ACORDE[a], dur: 1, vel: 0.22 })
      let p = 0
      for (const [m, d] of melodia[c]) { ev.push({ t: t + p, midis: [m], dur: d, vel: 0.55 }); p += d }
    })
  }
  return ev
}

// Melodía simple sin clic: notas [{ midi o midis, dur }] una tras otra. onNota(i) avisa cuál suena.
export function tocarNotas({ notas, tempo = 80, onNota, onFin, juntas = false }) {
  let t = 0
  const eventos = []
  notas.forEach((n, k) => {
    eventos.push({ t, midis: n.midis || [n.midi], dur: n.dur || 1, vel: n.vel ?? 0.65, alSonar: onNota ? () => onNota(k) : null })
    if (!juntas) t += n.dur || 1
  })
  const total = juntas ? Math.max(...notas.map((n) => n.dur || 1)) : t
  return tocarPulsos({
    tempo, pulsos: Math.ceil(total), clic: false, eventos, onFin,
  })
}

export const midiDe = (n) => midiDePaso(n.paso, n.alter || 0)
