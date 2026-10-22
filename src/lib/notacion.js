// Escritura musical de las notas para dibujarlas en el pentagrama.
// Una nota escrita es { paso, alter }: "paso" cuenta las posiciones en el pentagrama (7 por octava, Do4 = 28)
// y "alter" es la alteración (-1 bemol, 0 natural, +1 sostenido). Las notas se nombran con el Do fijo (Do = C).

export const NATURAL = [0, 2, 4, 5, 7, 9, 11] // semitonos de Do, Re, Mi, Fa, Sol, La, Si
export const NOMBRES_NOTA = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si']

export const pasoDe = (letra, octava) => 7 * octava + letra
export const midiDePaso = (paso, alter = 0) => 12 * (Math.floor(paso / 7) + 1) + NATURAL[((paso % 7) + 7) % 7] + alter
export const nombreDePaso = (paso) => NOMBRES_NOTA[((paso % 7) + 7) % 7]

/** Paso de una nota MIDI de tecla blanca, o null si es una tecla negra. */
export function pasoNatural(midi) {
  const i = NATURAL.indexOf(((midi % 12) + 12) % 12)
  return i < 0 ? null : 7 * (Math.floor(midi / 12) - 1) + i
}
