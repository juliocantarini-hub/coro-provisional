// Entrenamiento rítmico: niveles, ejercicios generados por la app, partitura (MusicXML) y corrección.
// No depende de React ni de la red: se puede probar en Node.
//
// Notación de los ejercicios (texto): compases separados por "|"; dentro de cada compás, figuras separadas
// por espacios. Cada figura es su duración en tiempos de negra (4 = redonda, 2 = blanca, 1 = negra, 0.5 = corchea,
// 0.25 = semicorchea, 1.5 = negra con puntillo…). Una "r" adelante es un silencio ("r1" = silencio de negra).

export const APROBADO_PCT = 80          // porcentaje mínimo para aprobar un ejercicio
export const EJERCICIOS_PARA_AVANZAR = 3 // ejercicios aprobados para abrir el nivel siguiente

export const NIVELES = [
  {
    id: 1, nombre: 'Redondas', descr: 'Un sonido por compás: sentí el pulso y entrá justo.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '4|4' },
      { tempo: 60, c: '4|4|4' },
      { tempo: 66, c: '4|4|4|4' },
      { tempo: 72, c: '4|4|4|4' },
      { tempo: 72, c: '4|4|4|4|4|4' },
    ],
  },
  {
    id: 2, nombre: 'Blancas', descr: 'Dos sonidos por compás, alternando con redondas.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '2 2|2 2' },
      { tempo: 60, c: '2 2|2 2|2 2' },
      { tempo: 66, c: '4|2 2|2 2|4' },
      { tempo: 66, c: '2 2|4|2 2|2 2' },
      { tempo: 72, c: '2 2|2 2|4|2 2' },
    ],
  },
  {
    id: 3, nombre: 'Negras', descr: 'Un sonido en cada pulso, mezclado con blancas.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '1 1 1 1|1 1 1 1' },
      { tempo: 60, c: '1 1 2|1 1 2|1 1 1 1' },
      { tempo: 66, c: '2 1 1|1 1 2|2 2|4' },
      { tempo: 66, c: '1 1 1 1|2 2|1 1 2|4' },
      { tempo: 72, c: '1 2 1|2 1 1|1 1 1 1|4' },
    ],
  },
  {
    id: 4, nombre: 'Silencios', descr: 'Los silencios también cuentan: no toques, pero seguí el pulso.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '1 1 r1 1|1 r1 1 1' },
      { tempo: 60, c: 'r1 1 1 1|1 1 1 r1|4' },
      { tempo: 66, c: '1 r1 2|1 1 r1 1|4' },
      { tempo: 66, c: 'r2 1 1|2 r1 1|1 r1 1 1|4' },
      { tempo: 72, c: '1 r1 r1 1|r1 1 1 1|2 1 r1|4' },
    ],
  },
  {
    id: 5, nombre: 'Corcheas', descr: 'Dos sonidos por pulso: la mitad de una negra.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '1 1 0.5 0.5 1|1 0.5 0.5 1 1' },
      { tempo: 60, c: '0.5 0.5 1 1 1|1 1 0.5 0.5 1|2 1 1' },
      { tempo: 66, c: '1 0.5 0.5 1 1|0.5 0.5 0.5 0.5 2|1 1 2' },
      { tempo: 66, c: '0.5 0.5 0.5 0.5 0.5 0.5 0.5 0.5|1 1 0.5 0.5 1|4' },
      { tempo: 72, c: '1 0.5 0.5 0.5 0.5 1|0.5 0.5 1 1 1|1 1 1 0.5 0.5|4' },
    ],
  },
  {
    id: 6, nombre: 'Semicorcheas', descr: 'Cuatro sonidos por pulso. Despacio y con precisión.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '0.25 0.25 0.25 0.25 1 1 1|1 1 0.25 0.25 0.25 0.25 1' },
      { tempo: 60, c: '1 0.25 0.25 0.25 0.25 1 1|0.25 0.25 0.25 0.25 1 1 1|4' },
      { tempo: 60, c: '0.5 0.25 0.25 1 2|1 0.5 0.25 0.25 2|4' },
      { tempo: 66, c: '0.25 0.25 0.5 0.5 0.5 2|1 0.5 0.25 0.25 1 1|4' },
      { tempo: 66, c: '0.25 0.25 0.25 0.25 0.25 0.25 0.25 0.25 2|0.5 0.5 0.25 0.25 0.5 2|4' },
    ],
  },
  {
    id: 7, nombre: 'Puntillos', descr: 'El puntillo alarga la figura la mitad de su valor.', compas: [4, 4],
    ejercicios: [
      { tempo: 60, c: '1.5 0.5 1 1|1.5 0.5 2|4' },
      { tempo: 60, c: '1 1.5 0.5 1|1.5 0.5 1.5 0.5|4' },
      { tempo: 60, c: '3 1|3 1|2 1.5 0.5|4' },
      { tempo: 66, c: '0.75 0.25 1 2|1 0.75 0.25 2|1.5 0.5 1 1|4' },
      { tempo: 66, c: '1.5 0.5 1.5 0.5|0.75 0.25 0.75 0.25 2|3 1|4' },
    ],
  },
  {
    id: 8, nombre: 'Compás de 3/4', descr: 'Tres pulsos por compás, como en un vals.', compas: [3, 4],
    ejercicios: [
      { tempo: 72, c: '1 1 1|1 1 1|3' },
      { tempo: 72, c: '2 1|1 2|1 1 1|3' },
      { tempo: 72, c: '1 1 1|2 1|1 0.5 0.5 1|3' },
      { tempo: 72, c: '1.5 0.5 1|3|1 1 1|1 2' },
      { tempo: 76, c: '1 r1 1|2 1|0.5 0.5 1 1|1 1 1|3' },
    ],
  },
]

export const EJERCICIOS_POR_NIVEL = 5
export const ESTRELLAS_MAX = 3
export const nivelPorId = (id) => NIVELES.find((n) => n.id === id)

/** Estrellas de un ejercicio según su mejor porcentaje: 80 → 1, 88 → 2, 95 → 3. */
export function estrellasPara(pct) {
  if (pct == null) return 0
  if (pct >= 95) return 3
  if (pct >= 88) return 2
  if (pct >= APROBADO_PCT) return 1
  return 0
}

// ─── Armado del ejercicio ────────────────────────────────────────────────

const EPS = 1e-6
const NOMBRE_FIGURA = new Map([ // duración en tiempos de negra → { divisiones (semicorchea = 1), tipo, puntillo }
  [4, { d: 16, tipo: 'whole', punto: false }],
  [3, { d: 12, tipo: 'half', punto: true }],
  [2, { d: 8, tipo: 'half', punto: false }],
  [1.5, { d: 6, tipo: 'quarter', punto: true }],
  [1, { d: 4, tipo: 'quarter', punto: false }],
  [0.75, { d: 3, tipo: 'eighth', punto: true }],
  [0.5, { d: 2, tipo: 'eighth', punto: false }],
  [0.25, { d: 1, tipo: '16th', punto: false }],
])

function leerCompas(texto) {
  return texto.trim().split(/\s+/).map((tok) => {
    const silencio = tok.startsWith('r')
    const dur = Number(silencio ? tok.slice(1) : tok)
    if (!NOMBRE_FIGURA.has(dur)) throw new Error(`Figura no válida: ${tok}`)
    return { dur, silencio }
  })
}

/** Devuelve el ejercicio nº "numero" (1 a 5) del nivel, con tiempos en segundos listos para sonar y corregir. */
export function armarEjercicio(nivelId, numero) {
  const nivel = nivelPorId(nivelId)
  const base = nivel?.ejercicios[numero - 1]
  if (!base) return null
  return construirEjercicio({
    nivel: nivelId, numero, tempo: base.tempo, pulsosPorCompas: nivel.compas[0], tipoPulso: nivel.compas[1],
    compases: base.c.split('|').map(leerCompas), titulo: `${nivel.nombre} · ejercicio ${numero}`,
  })
}

/**
 * Arma un ejercicio a partir de compases ya leídos: [[{ dur, silencio }]] (un arreglo de figuras por compás).
 * Lo usan los ejercicios de Ritmo y los dictados rítmicos.
 */
export function construirEjercicio({ nivel, numero, tempo, pulsosPorCompas, tipoPulso, compases, titulo }) {
  const pulsoSeg = 60 / tempo
  const entradas = [] // notas y silencios en orden
  const notas = []    // solo lo que hay que tocar
  let t = 0
  compases.forEach((fig, c) => {
    const suma = fig.reduce((s, f) => s + f.dur, 0)
    if (Math.abs(suma - pulsosPorCompas) > EPS) throw new Error(`Nivel ${nivel} ej. ${numero}, compás ${c + 1}: suma ${suma}, debía ser ${pulsosPorCompas}`)
    for (const f of fig) {
      const e = { compas: c + 1, dur: f.dur, silencio: !!f.silencio, inicioPulsos: t, inicioSeg: t * pulsoSeg, durSeg: f.dur * pulsoSeg }
      entradas.push(e)
      if (!f.silencio) { e.indiceNota = notas.length; notas.push(e) }
      t += f.dur
    }
  })
  return {
    nivel, numero, tempo, pulsoSeg, pulsosPorCompas, tipoPulso, compases,
    entradas, notas, duracionPulsos: t, duracionSeg: t * pulsoSeg, titulo,
  }
}

// ─── MusicXML de una sola línea de ritmo ────────────────────────────────

/** Partitura (MusicXML) del ejercicio: una línea, una sola altura, para leer solo el ritmo. */
export function musicXmlDe(ej) {
  const [pulsos, tipo] = [ej.pulsosPorCompas, ej.tipoPulso]
  const medidas = ej.compases.map((fig, i) => {
    const notas = fig.map((f) => {
      const d = NOMBRE_FIGURA.get(f.dur)
      const completoCompas = f.silencio && Math.abs(f.dur - pulsos) < EPS
      const cuerpo = f.silencio
        ? `<rest${completoCompas ? ' measure="yes"' : ''}/>`
        : '<pitch><step>B</step><octave>4</octave></pitch>'
      return `<note>${cuerpo}<duration>${d.d}</duration><voice>1</voice>${completoCompas ? '' : `<type>${d.tipo}</type>`}${d.punto ? '<dot/>' : ''}</note>`
    }).join('')
    const atributos = i === 0
      ? `<attributes><divisions>4</divisions><key><fifths>0</fifths></key><time><beats>${pulsos}</beats><beat-type>${tipo}</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>`
      : ''
    return `<measure number="${i + 1}">${atributos}${notas}</measure>`
  }).join('')
  return `<?xml version="1.0" encoding="UTF-8"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name></part-name></score-part></part-list><part id="P1">${medidas}</part></score-partwise>`
}

// ─── Corrección ─────────────────────────────────────────────────────────

const mediana = (v) => {
  if (!v.length) return 0
  const s = [...v].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Tolerancia (seg) del ejercicio: hasta 0,15 pulso, y más chica si hay figuras muy rápidas (mínimo 70 ms). */
export function toleranciaSeg(ej) {
  let minimo = Infinity
  for (let i = 0; i < ej.notas.length; i++) {
    const sig = ej.notas[i + 1]
    const dur = sig ? sig.inicioPulsos - ej.notas[i].inicioPulsos : ej.notas[i].dur
    if (dur > 0) minimo = Math.min(minimo, dur)
  }
  const pulsos = Math.min(0.15, 0.25 * (Number.isFinite(minimo) ? minimo : 1))
  return Math.max(0.07, pulsos * ej.pulsoSeg)
}

/**
 * Compara los toques con las entradas escritas.
 * "toques": segundos desde el inicio del ejercicio (después del conteo), en cualquier orden.
 * Devuelve { pct, aprobado, notas:[{estado:'ok'|'leve'|'fuera'|'falta', errorMs, direccion}], extras, desfaseMs, mensajes }.
 */
export function corregir(ej, toques, { latenciaMs = 0 } = {}) {
  const esperados = ej.notas.map((n) => n.inicioSeg)
  const N = esperados.length
  const tol = toleranciaSeg(ej)
  const ventana = Math.max(0.5 * ej.pulsoSeg, 2.5 * tol)
  const taps = toques.map((t) => t - latenciaMs / 1000).sort((a, b) => a - b)

  // Emparejamiento en orden, de costo mínimo (programación dinámica): un toque con cada nota, o ninguno
  const INF = 1e9
  const dp = Array.from({ length: N + 1 }, () => new Array(taps.length + 1).fill(INF))
  const prev = Array.from({ length: N + 1 }, () => new Array(taps.length + 1).fill(null))
  dp[0][0] = 0
  for (let i = 0; i <= N; i++) {
    for (let j = 0; j <= taps.length; j++) {
      const base = dp[i][j]
      if (base >= INF) continue
      if (i < N && base + ventana < dp[i + 1][j]) { dp[i + 1][j] = base + ventana; prev[i + 1][j] = 'falta' }       // no se tocó esta nota
      if (j < taps.length && base + ventana < dp[i][j + 1]) { dp[i][j + 1] = base + ventana; prev[i][j + 1] = 'extra' } // toque de más
      if (i < N && j < taps.length) {
        const e = Math.abs(taps[j] - esperados[i])
        if (e <= ventana && base + e < dp[i + 1][j + 1]) { dp[i + 1][j + 1] = base + e; prev[i + 1][j + 1] = 'par' }
      }
    }
  }
  const parejas = new Array(N).fill(null) // índice de toque por nota
  let i = N, j = taps.length
  while (i > 0 || j > 0) {
    const how = prev[i][j]
    if (how === 'par') { parejas[i - 1] = j - 1; i--; j-- } else if (how === 'falta') i--; else if (how === 'extra') j--; else break
  }

  // Desfase constante (latencia del dispositivo o del que toca): se quita para juzgar el ritmo, y se avisa si es grande
  const errores = []
  parejas.forEach((tj, k) => { if (tj != null) errores.push(taps[tj] - esperados[k]) })
  // Con 2 toques solo se corrige si los dos erraron parecido (si no, no hay forma de saber qué es desfase y qué es error)
  const consistentes = errores.length === 2 && Math.abs(errores[0] - errores[1]) <= tol
  const desfase = errores.length >= 3 || consistentes ? Math.max(-0.25, Math.min(0.25, mediana(errores))) : 0

  const notas = esperados.map((te, k) => {
    const tj = parejas[k]
    if (tj == null) return { estado: 'falta', errorMs: null, direccion: null }
    const err = taps[tj] - te - desfase
    const a = Math.abs(err)
    const estado = a <= tol ? 'ok' : a <= 1.6 * tol ? 'leve' : 'fuera'
    return { estado, errorMs: Math.round(err * 1000), direccion: err > 0 ? 'tarde' : 'antes' }
  })
  const usados = new Set(parejas.filter((x) => x != null))
  const extras = taps.length - usados.size
  const ok = notas.filter((n) => n.estado === 'ok').length
  const leves = notas.filter((n) => n.estado === 'leve').length
  const pct = N ? Math.max(0, Math.min(100, Math.round(((ok + 0.5 * leves - extras) / N) * 100))) : 0

  const mensajes = []
  const faltan = notas.filter((n) => n.estado === 'falta').length
  if (faltan) mensajes.push(faltan === 1 ? 'Te faltó tocar una entrada.' : `Te faltaron ${faltan} entradas.`)
  if (extras) mensajes.push(extras === 1 ? 'Tocaste una vez de más (¿en un silencio?).' : `Tocaste ${extras} veces de más (¿en los silencios?).`)
  const malos = notas.filter((n) => n.estado === 'leve' || n.estado === 'fuera')
  const tardes = malos.filter((n) => n.direccion === 'tarde').length
  const antes = malos.length - tardes
  if (malos.length >= 2 && tardes >= 2 * antes) mensajes.push('Tendés a llegar tarde a las entradas: probá adelantarte un poquito al pulso.')
  else if (malos.length >= 2 && antes >= 2 * tardes) mensajes.push('Tendés a apurarte: esperá un poco más el pulso antes de tocar.')
  if (Math.abs(desfase) > 0.12) {
    mensajes.push(`Tus toques salieron en promedio ${Math.round(Math.abs(desfase) * 1000)} ms ${desfase > 0 ? 'después' : 'antes'} del pulso. Lo tomamos en cuenta, pero con auriculares Bluetooth el retraso es normal.`)
  }
  return { pct, aprobado: pct >= APROBADO_PCT, notas, extras, desfaseMs: Math.round(desfase * 1000), toleranciaMs: Math.round(tol * 1000), mensajes }
}

// ─── Progreso (puro: sirve igual con datos locales o de la base) ─────────

/**
 * "filas": { nivel, ejercicio, mejor_pct, intentos } del cantante.
 * "nivelHasta": nivel que el director le abrió a mano (0 si no hay).
 */
export function estadoNiveles(filas, nivelHasta = 0) {
  const porNivel = new Map()
  for (const f of filas || []) {
    if (!porNivel.has(f.nivel)) porNivel.set(f.nivel, [])
    porNivel.get(f.nivel).push(f)
  }
  let anteriorAprobado = true
  return NIVELES.map((n) => {
    const fs = porNivel.get(n.id) || []
    const aprobados = fs.filter((f) => (f.mejor_pct ?? 0) >= APROBADO_PCT).length
    const estrellas = fs.reduce((s, f) => s + estrellasPara(f.mejor_pct), 0)
    const abierto = n.id === 1 || anteriorAprobado || n.id <= nivelHasta
    const superado = aprobados >= EJERCICIOS_PARA_AVANZAR
    anteriorAprobado = superado
    return { id: n.id, abierto, superado, aprobados, estrellas, estrellasMax: EJERCICIOS_POR_NIVEL * ESTRELLAS_MAX, porEjercicio: fs }
  })
}
