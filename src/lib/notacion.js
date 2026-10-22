// Escritura musical de las notas para dibujarlas en el pentagrama.
// Una nota escrita es { paso, alter }: "paso" cuenta las posiciones en el pentagrama (7 por octava, Do4 = 28)
// y "alter" es la alteración (-1 bemol, 0 natural, +1 sostenido). Así se evita escribir un La# donde corresponde un Si♭.

export const NATURAL = [0, 2, 4, 5, 7, 9, 11] // semitonos de Do, Re, Mi, Fa, Sol, La, Si

export const pasoDe = (letra, octava) => 7 * octava + letra
export const midiDePaso = (paso, alter = 0) => 12 * (Math.floor(paso / 7) + 1) + NATURAL[((paso % 7) + 7) % 7] + alter

/** Paso de una nota MIDI de tecla blanca, o null si es una tecla negra. */
export function pasoNatural(midi) {
  const i = NATURAL.indexOf(((midi % 12) + 12) % 12)
  return i < 0 ? null : 7 * (Math.floor(midi / 12) - 1) + i
}

// Tonalidades mayores que se usan (hasta dos alteraciones en la armadura)
export const TONALIDADES = {
  C:  { letra: 0, alter: 0,  pc: 0,  armadura: null, alteradas: {} },
  G:  { letra: 4, alter: 0,  pc: 7,  armadura: { tipo: 'sostenido', n: 1 }, alteradas: { 3: 1 } },
  D:  { letra: 1, alter: 0,  pc: 2,  armadura: { tipo: 'sostenido', n: 2 }, alteradas: { 3: 1, 0: 1 } },
  F:  { letra: 3, alter: 0,  pc: 5,  armadura: { tipo: 'bemol', n: 1 },     alteradas: { 6: -1 } },
  Bb: { letra: 6, alter: -1, pc: 10, armadura: { tipo: 'bemol', n: 2 },     alteradas: { 6: -1, 2: -1 } },
}
export const IDS_TONALIDAD = Object.keys(TONALIDADES)
export const tonalidadDeMidi = (raiz) => IDS_TONALIDAD.find((id) => TONALIDADES[id].pc === ((raiz % 12) + 12) % 12) || null

/** Cómo se escribe el grado "g" (0 = tónica) de la escala mayor de la tonalidad. */
export function grafiaDeGrado(tonId, raizMidi, g) {
  const t = TONALIDADES[tonId]
  const octava = Math.floor((raizMidi - t.alter) / 12) - 1
  const paso = pasoDe(t.letra, octava) + g
  return { paso, alter: t.alteradas[((paso % 7) + 7) % 7] || 0 }
}

/** Clave que se usa para escribir un grupo de notas: sol para lo agudo y fa para lo grave. */
export const claveSegun = (midis) => (midis.reduce((s, m) => s + m, 0) / midis.length < 59 ? 'fa' : 'sol')

/** Escribe una nota MIDI con la ortografía de la tonalidad más cercana (sostenidos) cuando no hay otra información. */
export function grafiaLibre(midi) {
  const n = pasoNatural(midi)
  if (n != null) return { paso: n, alter: 0 }
  const abajo = pasoNatural(midi - 1)
  return { paso: abajo, alter: 1 }
}
