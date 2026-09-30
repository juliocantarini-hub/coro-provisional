// Utilidades de afinación: conversión nota↔midi↔frecuencia y detección de tono
// (frecuencia fundamental) a partir de una señal de audio, por autocorrelación.
// Corre entero en el navegador (Web Audio API), no depende de ningún servicio.

const NOMBRES_NOTA = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

// Umbral mínimo de "claridad" (ver detectarFrecuencia) para aceptar una
// lectura de frecuencia como confiable. Ya hubo un intento anterior con este
// umbral en 0.85: resultó demasiado estricto y rechazaba lecturas válidas de
// voz cantada real (sobre todo a capela, sin acompañamiento de referencia),
// así que se sacó por completo — pero sin ningún filtro, cualquier ruido de
// fondo o ruido propio del micrófono con algo de periodicidad también se
// aceptaba como si fuera una nota cantada. 0.5 es un punto medio: pensado
// para dejar pasar una voz cantando (aunque sea con un tono imperfecto/
// respirado) y al mismo tiempo cortar ruido sin una periodicidad marcada.
const UMBRAL_CLARIDAD = 0.5

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

// Volumen (RMS) de una ventana de audio (Float32Array, -1..1). Se usa tanto
// para el filtro de silencio de detectarFrecuencia como, por separado, para
// calibrar en vivo cuánto se cuela el acompañamiento por el parlante hacia
// el mic (ver PartituraPlayer, activarMicrofono).
export function calcularRms(buffer) {
  let suma = 0
  for (let i = 0; i < buffer.length; i++) suma += buffer[i] * buffer[i]
  return Math.sqrt(suma / buffer.length)
}

// Autocorrelación sobre una ventana de audio (Float32Array, -1..1): busca el primer
// "pozo" después del pico trivial en offset 0 y desde ahí el máximo siguiente —
// es el método clásico (Chris Wilson / html5rocks) para no engancharse en octavas
// falsas. Devuelve la frecuencia fundamental estimada en Hz, o null si hay
// demasiado silencio/ruido para tener una lectura confiable.
export function detectarFrecuencia(buffer, sampleRate) {
  const SIZE = buffer.length

  const rms = calcularRms(buffer)
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
  // Para un tono periódico (una voz cantando, aunque no sea perfecta) da un
  // valor relativamente alto; para ruido sin una altura definida da un valor
  // bajo. La descartamos (igual que el silencio) en vez de reportarla como
  // si fuera una frecuencia real.
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
