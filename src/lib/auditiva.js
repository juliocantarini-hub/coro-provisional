// Práctica auditiva: niveles, generación de ejercicios y corrección.
// No depende de React ni de la red: se puede probar en Node.
//
// Cinco tipos de ejercicio, en 12 niveles de 5 ejercicios cada uno:
//   cual       ¿Cuál sonó? (2 notas escritas) (niveles 1-2)
//   eco        Escuchá y cantá          (niveles 3-5)
//   intervalo  Reconocé el salto        (niveles 6-7)
//   acorde     Alegre, triste o tenso   (niveles 8-9)
//   dictado    Armá la melodía          (niveles 10-12)
// Cada ejercicio se genera al azar cada vez que se hace (no se puede memorizar), dentro de los límites del nivel.

import { midiANombre } from './afinacion'
import { pasoNatural, midiDePaso } from './notacion'
import { APROBADO_PCT, EJERCICIOS_PARA_AVANZAR, EJERCICIOS_POR_NIVEL, ESTRELLAS_MAX, estrellasPara } from './ritmo'

export { APROBADO_PCT, EJERCICIOS_PARA_AVANZAR, EJERCICIOS_POR_NIVEL, ESTRELLAS_MAX, estrellasPara }

// ─── Datos de apoyo ────────────────────────────────────────────────────

/** Rango cómodo de cada cuerda (notas MIDI) para las frases que tienen que cantar. */
export function rangoDeVoz(voz) {
  const v = String(voz || '').toLowerCase()
  if (v.includes('sopr')) return [62, 79]
  if (v.includes('alto') || v.includes('contra') || v.includes('mezzo')) return [55, 72]
  if (v.includes('tenor')) return [48, 67]
  if (v.includes('baj') || v.includes('bar')) return [41, 60]
  return [52, 69]
}

export const ESCALA = [0, 2, 4, 5, 7, 9, 11] // escala mayor
export const NOMBRES_GRADO = ['Do', 'Re', 'Mi', 'Fa', 'Sol', 'La', 'Si', 'Do']
export const COLORES_GRADO = ['#E8756B', '#E99A55', '#E9BF45', '#7DBE6B', '#3FAE83', '#4A9BC4', '#7A82C9', '#B07CC0']

/** Nota MIDI del grado "g" (0 = tónica) de la escala mayor con tónica "raiz". */
export const midiDeGrado = (raiz, g) => raiz + 12 * Math.floor(g / 7) + ESCALA[((g % 7) + 7) % 7]

export const INTERVALOS = [
  { id: '2', semitonos: 2, etiqueta: '2ª', corto: 'salto chico', pista: 'Martinillo' },
  { id: '3', semitonos: 4, etiqueta: '3ª', corto: 'salto mediano', pista: 'Cuando los santos' },
  { id: '4', semitonos: 5, etiqueta: '4ª', corto: 'salto medio', pista: 'Marcha nupcial' },
  { id: '5', semitonos: 7, etiqueta: '5ª', corto: 'salto grande', pista: 'Estrellita, ¿dónde estás?' },
  { id: '8', semitonos: 12, etiqueta: '8ª', corto: 'salto muy grande', pista: 'Over the rainbow' },
]

export const ACORDES = {
  mayor: { etiqueta: 'Alegre', notas: [0, 4, 7] },
  menor: { etiqueta: 'Triste', notas: [0, 3, 7] },
  tenso: { etiqueta: 'Tenso', notas: [0, 3, 6] },
}

// ─── Niveles ───────────────────────────────────────────────────────────

const PREGUNTAS = { cual: 6, intervalo: 6, acorde: 6, dictado: 4, eco: 3 }

export const NIVELES = [
  { id: 1, tipo: 'cual', nombre: '¿Cuál sonó? Notas lejanas', descr: 'En el pentagrama hay dos notas, una más aguda y otra más grave. Suena una: tocá la que escuchaste.',
    ejercicios: [{ saltos: [8, 12] }, { saltos: [7, 12] }, { saltos: [5, 9] }, { saltos: [5, 8] }, { saltos: [4, 7] }] },
  { id: 2, tipo: 'cual', nombre: '¿Cuál sonó? Notas cercanas', descr: 'Lo mismo, pero las dos notas están más cerca. Escuchá con atención.',
    ejercicios: [{ saltos: [3, 5] }, { saltos: [2, 4] }, { saltos: [2, 3] }, { saltos: [1, 3] }, { saltos: [1, 2] }] },
  { id: 3, tipo: 'eco', nombre: 'Eco: dos notas', descr: 'Escuchás dos notas en el piano y las cantás.',
    ejercicios: [{ n: 2, pasos: [1, 1] }, { n: 2, pasos: [1, 2] }, { n: 2, pasos: [1, 2] }, { n: 2, pasos: [2, 3] }, { n: 2, pasos: [2, 4] }] },
  { id: 4, tipo: 'eco', nombre: 'Eco: tres notas', descr: 'Una frase de tres notas: escuchala y cantala.',
    ejercicios: [{ n: 3, pasos: [1, 1] }, { n: 3, pasos: [1, 2] }, { n: 3, pasos: [1, 2] }, { n: 3, pasos: [1, 3] }, { n: 3, pasos: [2, 3] }] },
  { id: 5, tipo: 'eco', nombre: 'Eco: cuatro notas', descr: 'Frases más largas, con algún salto.',
    ejercicios: [{ n: 4, pasos: [1, 2] }, { n: 4, pasos: [1, 2] }, { n: 4, pasos: [1, 3] }, { n: 4, pasos: [2, 4] }, { n: 4, pasos: [2, 4] }] },
  { id: 6, tipo: 'intervalo', nombre: 'Reconocé el salto', descr: 'Dos notas que suben: ¿qué tan grande es el salto? Hay canciones que te ayudan.', baja: false,
    ejercicios: [{ pool: ['2', '5'] }, { pool: ['3', '5', '8'] }, { pool: ['2', '3', '5'] }, { pool: ['2', '3', '4', '5'] }, { pool: ['2', '3', '4', '5', '8'] }] },
  { id: 7, tipo: 'intervalo', nombre: 'Saltos que suben y bajan', descr: 'Ahora el salto puede subir o bajar: decí hacia dónde y cuánto.', baja: true,
    ejercicios: [{ pool: ['2', '5'] }, { pool: ['3', '5', '8'] }, { pool: ['2', '3', '5'] }, { pool: ['2', '3', '4', '5'] }, { pool: ['2', '3', '4', '5', '8'] }] },
  { id: 8, tipo: 'acorde', nombre: 'Alegre o triste', descr: 'Suenan tres notas juntas: ¿suena alegre o triste?',
    ejercicios: [{ tipos: ['mayor', 'menor'], inv: [0] }, { tipos: ['mayor', 'menor'], inv: [0] }, { tipos: ['mayor', 'menor'], inv: [0, 1] }, { tipos: ['mayor', 'menor'], inv: [0, 1, 2] }, { tipos: ['mayor', 'menor'], inv: [0, 1, 2] }] },
  { id: 9, tipo: 'acorde', nombre: 'Alegre, triste o tenso', descr: 'Se suma un tercer sonido: el acorde tenso, que pide resolver.',
    ejercicios: [{ tipos: ['mayor', 'menor', 'tenso'], inv: [0] }, { tipos: ['mayor', 'menor', 'tenso'], inv: [0] }, { tipos: ['mayor', 'menor', 'tenso'], inv: [0, 1] }, { tipos: ['mayor', 'menor', 'tenso'], inv: [0, 1, 2] }, { tipos: ['mayor', 'menor', 'tenso'], inv: [0, 1, 2] }] },
  { id: 10, tipo: 'dictado', nombre: 'Armá la melodía: 3 notas', descr: 'Escuchás una melodía y la armás con los botones de colores.',
    ejercicios: [{ n: 3, max: 3, doInicio: true }, { n: 3, max: 4, doInicio: true }, { n: 3, max: 5, doInicio: true }, { n: 3, max: 5, doInicio: false }, { n: 3, max: 8, doInicio: false }] },
  { id: 11, tipo: 'dictado', nombre: 'Armá la melodía: 4 notas', descr: 'Una nota más para recordar.',
    ejercicios: [{ n: 4, max: 4, doInicio: true }, { n: 4, max: 5, doInicio: true }, { n: 4, max: 5, doInicio: false }, { n: 4, max: 6, doInicio: false }, { n: 4, max: 8, doInicio: false }] },
  { id: 12, tipo: 'dictado', nombre: 'Armá la melodía: 5 notas', descr: 'Melodías más largas, con saltos.',
    ejercicios: [{ n: 5, max: 5, doInicio: true }, { n: 5, max: 6, doInicio: false }, { n: 5, max: 7, doInicio: false }, { n: 5, max: 8, doInicio: false }, { n: 5, max: 8, doInicio: false }] },
]

export const nivelPorId = (id) => NIVELES.find((n) => n.id === id)

// ─── Azar ──────────────────────────────────────────────────────────────

const entero = (rnd, a, b) => a + Math.floor(rnd() * (b - a + 1))
const elegir = (rnd, lista) => lista[Math.floor(rnd() * lista.length)]

// ─── Generadores de preguntas ──────────────────────────────────────────

const DUR_NOTA = 0.85
const SEP = 1.0 // segundos entre el comienzo de una nota y la siguiente

const naturalesEntre = (a, b) => {
  const r = []
  for (let m = a; m <= b; m++) if (pasoNatural(m) != null) r.push(m)
  return r
}

/** Dos notas escritas en el pentagrama (teclas blancas); suena una sola y hay que tocar la que sonó. */
function preguntaCual(rnd, { saltos }) {
  const nat = naturalesEntre(60, 79) // de Do4 a Sol5
  const pares = []
  for (const a of nat) for (const b of nat) if (b > a && b - a >= saltos[0] && b - a <= saltos[1]) pares.push([a, b])
  const [a, b] = elegir(rnd, pares)
  const orden = rnd() < 0.5 ? [a, b] : [b, a] // de izquierda a derecha, como se lee
  const opciones = orden.map((m) => ({ midi: m, paso: pasoNatural(m), alter: 0 }))
  const correcta = entero(rnd, 0, 1)
  return {
    tipo: 'cual',
    clave: 'sol',
    opciones,
    correcta,
    notas: [{ midi: opciones[correcta].midi, inicio: 0, duracion: 1.3 }],
    referencia: opciones.map((o, i) => ({ midi: o.midi, inicio: i * SEP, duracion: DUR_NOTA })),
  }
}

// Cuántas posiciones del pentagrama hay entre las dos notas de cada intervalo (la 2ª es la siguiente, la 3ª salta una, etc.)
const PASOS_INTERVALO = { '2': 1, '3': 2, '4': 3, '5': 4, '8': 7 }

function preguntaIntervalo(rnd, { pool }, baja) {
  const idElegido = elegir(rnd, pool)
  const it = INTERVALOS.find((i) => i.id === idElegido)
  const desciende = baja && rnd() < 0.5
  // La nota de abajo es una tecla blanca (Do4 a La4) y la de arriba se escribe según el intervalo, con su alteración si hace falta
  const grave = elegir(rnd, naturalesEntre(60, 69))
  const pasoGrave = pasoNatural(grave)
  const pasoAgudo = pasoGrave + PASOS_INTERVALO[it.id]
  const agudo = grave + it.semitonos
  const escritas = [{ paso: pasoGrave, alter: 0 }, { paso: pasoAgudo, alter: agudo - midiDePaso(pasoAgudo, 0) }]
  const midis = [grave, agudo]
  if (desciende) { escritas.reverse(); midis.reverse() }
  return {
    tipo: 'intervalo',
    clave: 'sol',
    notas: midis.map((m, i) => ({ midi: m, inicio: i * SEP, duracion: DUR_NOTA })),
    grafia: escritas,
    correcta: { id: it.id, baja: desciende },
    pool,
    conDireccion: !!baja,
  }
}

const RAICES_ACORDE = [60, 62, 64] // Do, Re y Mi: sus acordes se escriben sin sostenidos ni bemoles raros

function preguntaAcorde(rnd, { tipos, inv }) {
  const tipo = elegir(rnd, tipos)
  const raiz = elegir(rnd, RAICES_ACORDE)
  const pasoRaiz = pasoNatural(raiz)
  let notas = ACORDES[tipo].notas.map((s, i) => {
    const paso = pasoRaiz + 2 * i
    return { midi: raiz + s, paso, alter: raiz + s - midiDePaso(paso, 0) }
  })
  const k = elegir(rnd, inv)
  for (let i = 0; i < k; i++) {
    const [primera, ...resto] = notas
    notas = [...resto, { midi: primera.midi + 12, paso: primera.paso + 7, alter: primera.alter }]
  }
  return {
    tipo: 'acorde',
    clave: 'sol',
    notas: notas.map((n) => ({ midi: n.midi, inicio: 0, duracion: 2.0 })),
    grafia: notas.map((n) => ({ paso: n.paso, alter: n.alter })),
    correcta: tipo,
    tipos,
  }
}

function gradosDeFrase(rnd, n, pasos, maxGrado) {
  const g = [entero(rnd, 0, Math.min(4, maxGrado))]
  for (let i = 1; i < n; i++) {
    const prev = g[i - 1]
    let sig = prev
    for (let intento = 0; intento < 40 && sig === prev; intento++) {
      const paso = entero(rnd, pasos[0], pasos[1]) * (rnd() < 0.5 ? -1 : 1)
      const c = prev + paso
      if (c >= 0 && c <= maxGrado) sig = c
    }
    if (sig === prev) sig = prev + (prev + 1 <= maxGrado ? 1 : -1)
    g.push(sig)
  }
  return g
}

// Las frases del eco y las melodías del dictado usan solo teclas blancas (escala de Do mayor), siempre en clave de sol.
// Así los nombres (Do, Re, Mi…) coinciden con las notas escritas y no hacen falta alteraciones.
const PASO_DO4 = 28

/** Los hombres cantan una octava más grave de lo que se escribe en clave de sol: el piano suena una octava abajo. */
const octavaGrave = (voz) => /ten|baj|bar/i.test(String(voz || ''))

function preguntaEco(rnd, { n, pasos }, voz) {
  const base = entero(rnd, PASO_DO4, PASO_DO4 + 4) // de Do4 a Sol4
  const grados = gradosDeFrase(rnd, n, pasos, 7)
  const escritas = grados.map((g) => ({ paso: base + g, alter: 0 }))
  const bajar = octavaGrave(voz) ? 12 : 0
  const midis = escritas.map((e) => midiDePaso(e.paso) - bajar)
  return {
    tipo: 'eco',
    clave: 'sol',
    notas: escritas.map((e, i) => ({ midi: midis[i], inicio: i * SEP, duracion: DUR_NOTA, nombre: midiANombre(midis[i]), pulsoSeg: SEP })),
    grafia: escritas,
    grados,
  }
}

function preguntaDictado(rnd, { n, max, doInicio }, numero) {
  const maxGrado = max - 1
  const grados = []
  for (let i = 0; i < n; i++) {
    let g
    for (let intento = 0; intento < 40; intento++) {
      g = (i === 0 && doInicio) ? 0 : entero(rnd, 0, maxGrado)
      if (i === 0 || g !== grados[i - 1]) break
    }
    if (i > 0 && g === grados[i - 1]) g = grados[i - 1] === 0 ? 1 : grados[i - 1] - 1
    grados.push(g)
  }
  const escala = Array.from({ length: max }, (_, g) => ({ midi: midiDePaso(PASO_DO4 + g), inicio: g * 0.45, duracion: 0.4 }))
  return {
    tipo: 'dictado',
    clave: 'sol',
    // Los primeros ejercicios de cada nivel se arman con la escalera de colores; los últimos, ubicando las notas en el pentagrama
    entrada: numero >= 4 ? 'pentagrama' : 'escalera',
    max,
    grados,
    escala,
    grafiaEscala: Array.from({ length: max }, (_, g) => ({ paso: PASO_DO4 + g, alter: 0 })),
    grafia: grados.map((g) => ({ paso: PASO_DO4 + g, alter: 0 })),
    notas: grados.map((g, i) => ({ midi: midiDePaso(PASO_DO4 + g), inicio: i * 0.9, duracion: 0.8 })),
  }
}

/** Arma el ejercicio nº "numero" (1 a 5) del nivel, con preguntas al azar. "voz" solo cuenta en los ecos. */
export function armarEjercicio(nivelId, numero, { voz = null, rnd = Math.random } = {}) {
  const nivel = nivelPorId(nivelId)
  const par = nivel?.ejercicios[numero - 1]
  if (!par) return null
  const cuantas = PREGUNTAS[nivel.tipo]
  const preguntas = []
  for (let i = 0; i < cuantas; i++) {
    let p
    if (nivel.tipo === 'cual') p = preguntaCual(rnd, par)
    else if (nivel.tipo === 'intervalo') p = preguntaIntervalo(rnd, par, nivel.baja)
    else if (nivel.tipo === 'acorde') p = preguntaAcorde(rnd, par)
    else if (nivel.tipo === 'eco') p = preguntaEco(rnd, par, voz)
    else p = preguntaDictado(rnd, par, numero)
    preguntas.push(p)
  }
  return { nivel: nivelId, numero, tipo: nivel.tipo, titulo: `${nivel.nombre} · ejercicio ${numero}`, preguntas }
}

// ─── Corrección ────────────────────────────────────────────────────────

/** Puntaje de una pregunta de elegir: { puntos, total }. */
export function corregirRespuesta(pregunta, respuesta) {
  if (pregunta.tipo === 'dictado') {
    const total = pregunta.grados.length
    let puntos = 0
    for (let i = 0; i < total; i++) if (respuesta && respuesta[i] === pregunta.grados[i]) puntos++
    return { puntos, total }
  }
  if (pregunta.tipo === 'intervalo') {
    const ok = respuesta && respuesta.id === pregunta.correcta.id && (!pregunta.conDireccion || respuesta.baja === pregunta.correcta.baja)
    return { puntos: ok ? 1 : 0, total: 1 }
  }
  return { puntos: respuesta === pregunta.correcta ? 1 : 0, total: 1 }
}

const VALOR_NOTA_ECO = { verde: 1, amarillo: 0.75, rojo: 0.25, nota_distinta: 0, no_detectada: 0 }

/** Puntaje de un eco a partir del informe del motor de afinación: { puntos, total, notas:[{estado, valor}] }. */
export function puntajeEco(informe) {
  const notas = (informe.notas || []).map((n) => ({ estado: n.estado, valor: VALOR_NOTA_ECO[n.estado] ?? null, desviacion: n.desviacionRelativaCents ?? n.desviacionCents ?? null }))
  const contables = notas.filter((n) => n.valor != null)
  const puntos = contables.reduce((s, n) => s + n.valor, 0)
  return { puntos, total: contables.length, notas }
}

/** Porcentaje del ejercicio a partir de los { puntos, total } de cada pregunta. */
export function porcentajeEjercicio(resultados) {
  const total = resultados.reduce((s, r) => s + r.total, 0)
  const puntos = resultados.reduce((s, r) => s + r.puntos, 0)
  return total ? Math.round((puntos / total) * 100) : 0
}

// ─── Progreso ──────────────────────────────────────────────────────────

/** Igual que en ritmo.js, pero con los niveles de práctica auditiva. */
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
