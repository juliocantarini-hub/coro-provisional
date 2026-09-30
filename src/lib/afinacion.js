// Utilidades de afinación: conversión nota↔midi↔frecuencia y detección de tono
// (frecuencia fundamental) a partir de una señal de audio, por autocorrelación.
// Corre entero en el navegador (Web Audio API), no depende de ningún servicio.

const NOMBRES_NOTA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Umbral mínimo de "claridad" (ver detectarFrecuencia) para aceptar una
// lectura de frecuencia como confiable. Más alto = más estricto (se descartan
// más lecturas dudosas, pero el medidor puede sentirse menos responsivo);
// más bajo = más permisivo (responde más rápido, pero deja pasar más ruido).
const UMBRAL_CLARIDAD = 0.85

export function notaAMidi(nombreNota) {
  const m = (nombreNota || '').match(/^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/)
  if (!m) return null
  const [, letra, alt, octavaStr] = m
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letra]
  let ajuste = 0
  if (alt === '#') ajuste = 1
  else if (alt === '##') ajuste = 2
  else if (alt === 'b') ajuste = -1
  else if (alt === 'bb') ajuste = -2
  const octava = parseInt(octavaStr, 10)
  return base + ajuste + (octava + 1) * 12
}

export function midiAFrecuencia(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function midiANombre(midi) {
  const m = Math.round(midi)
  const nombre = NOMBRES_NOTA[((m % 12) + 12) % 12]
  const octava = Math.floor(m / 12) - 1
  return `${nombre}${octava}`
}

// Diferencia en centésimas de semitono entre dos frecuencias (positivo = agudo respecto de la referencia).
export function centsEntre(frecuencia, frecuenciaReferencia) {
  return 1200 * Math.log2(frecuencia / frecuenciaReferencia)
}

// Autocorrelación sobre una ventana de audio (Float32Array, -1..1): busca el primer
// "pozo" después del pico trivial en offset 0 y desde ahí el máximo siguiente —
// es el método clásico (Chris Wilson / html5rocks) para no engancharse en octavas
// falsas. Devuelve la frecuencia fundamental estimada en Hz, o null si hay
// demasiado silencio/ruido para tener una lectura confiable.
export function detectarFrecuencia(buffer, sampleRate) {
  const SIZE = buffer.length

  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buffer[i] * buffer[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.01) return null // demasiado silencio / ruido de fondo

  const MAX_SAMPLES = Math.min(SIZE - 1, Math.floor(sampleRate / 60)) // ~60 Hz, voz grave

  const correlacion = new Float32Array(MAX_SAMPLES + 1)
  for (let lag = 0; lag <= MAX_SAMPLES; lag++) {
    let suma = 0
    for (let i = 0; i < SIZE - lag; i++) suma += buffer[i] * buffer[i + lag]
    correlacion[lag] = suma
  }

  let d = 0
  while (d < MAX_SAMPLES && correlacion[d] > correlacion[d + 1]) d++

  let mejorLag = -1
  let mejorValor = -Infinity
  for (let lag = d; lag <= MAX_SAMPLES; lag++) {
    if (correlacion[lag] > mejorValor) { mejorValor = correlacion[lag]; mejorLag = lag }
  }
  if (mejorLag <= 0) return null

  // "Claridad" de la lectura: cuán marcado es el pico de autocorrelación
  // encontrado comparado con la energía total de la señal (correlacion[0]).
  // Para un tono limpio y periódico (una voz cantando una nota sostenida) da
  // un valor cercano a 1; para ruido o una mezcla de sonidos sin una altura
  // clara (consonantes, silencios, ruido de fondo, la propia voz solapada
  // con el acompañamiento coleándose por el micrófono) da un valor bajo.
  // Antes se aceptaba cualquier pico, por chico que fuera, como una lectura
  // válida — eso era buena parte de por qué el medidor se veía errante:
  // lecturas de baja confianza (básicamente ruido) se mostraban igual que
  // una nota bien cantada. Ahora las descartamos (igual que el silencio) en
  // vez de reportarlas como si fueran una frecuencia real.
  const claridad = correlacion[0] > 0 ? mejorValor / correlacion[0] : 0
  if (claridad < UMBRAL_CLARIDAD) return null

  // Interpolación parabólica alrededor del pico para afinar la estimación del período.
  let lagFino = mejorLag
  if (mejorLag > 0 && mejorLag < MAX_SAMPLES) {
    const c0 = correlacion[mejorLag - 1], c1 = correlacion[mejorLag], c2 = correlacion[mejorLag + 1]
    const denom = (c0 - 2 * c1 + c2)
    if (denom !== 0) lagFino = mejorLag + 0.5 * (c0 - c2) / denom
  }

  return sampleRate / lagFino
}

// Dada una frecuencia detectada, la nota más cercana en afinación estándar (A4=440Hz)
// y cuántas centésimas de semitono se aleja de esa nota (positivo = agudo, negativo = grave).
export function frecuenciaANotaCercana(freq) {
  const semitonos = 12 * Math.log2(freq / 440) + 69
  const midi = Math.round(semitonos)
  const cents = Math.round((semitonos - midi) * 100)
  return { midi, nombre: midiANombre(midi), cents }
}
