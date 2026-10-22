// Práctica auditiva: niveles, generación de ejercicios y corrección.
// No depende de React ni de la red: se puede probar en Node.
//
// Cinco tipos de ejercicio, en 12 niveles de 5 ejercicios cada uno:
//   direccion  ¿Sube o baja?            (niveles 1-2)
//   eco        Escuchá y cantá          (niveles 3-5)
//   intervalo  Reconocé el salto        (niveles 6-7)
//   acorde     Alegre, triste o tenso   (niveles 8-9)
//   dictado    Armá la melodía          (niveles 10-12)
// Cada ejercicio se genera al azar cada vez que se hace (no se puede memorizar), dentro de los límites del nivel.

import { midiANombre } from './afinacion'
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

const PREGUNTAS = { direccion: 6, intervalo: 6, acorde: 6, dictado: 4, eco: 3 }

export const NIVELES = [
  { id: 1, tipo: 'direccion', nombre: '¿Sube o baja? Saltos grandes', descr: 'Suenan dos notas: ¿la segunda es más aguda o más grave?',
    ejercicios: [{ saltos: [8, 12] }, { saltos: [7, 12] }, { saltos: [5, 9] }, { saltos: [5, 8] }, { saltos: [4, 7] }] },
  { id: 2, tipo: 'direccion', nombre: '¿Sube o baja? Saltos chicos', descr: 'Lo mismo, pero las notas están más cerca. Escuchá con atención.',
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

function preguntaDireccion(rnd, { saltos }) {
  const salto = entero(rnd, saltos[0], saltos[1])
  const sube = rnd() < 0.5
  const base = sube ? entero(rnd, 52, 70 - salto) : entero(rnd, 56 + salto, 76)
  const b = sube ? base + salto : base - salto
  return {
    tipo: 'direccion',
    notas: [{ midi: base, inicio: 0, duracion: DUR_NOTA }, { midi: b, inicio: SEP, duracion: DUR_NOTA }],
    correcta: sube ? 'sube' : 'baja',
  }
}

function preguntaIntervalo(rnd, { pool }, baja) {
  const idElegido = elegir(rnd, pool)
  const it = INTERVALOS.find((i) => i.id === idElegido)
  const desciende = baja && rnd() < 0.5
  const base = desciende ? entero(rnd, 53 + it.semitonos, 72) : entero(rnd, 52, 70 - it.semitonos)
  const b = desciende ? base - it.semitonos : base + it.semitonos
  return {
    tipo: 'intervalo',
    notas: [{ midi: base, inicio: 0, duracion: DUR_NOTA }, { midi: b, inicio: SEP, duracion: DUR_NOTA }],
    correcta: { id: it.id, baja: desciende },
    pool,
    conDireccion: !!baja,
  }
}

function preguntaAcorde(rnd, { tipos, inv }) {
  const tipo = elegir(rnd, tipos)
  const raiz = entero(rnd, 48, 59)
  let notas = ACORDES[tipo].notas.map((s) => raiz + s)
  const k = elegir(rnd, inv)
  for (let i = 0; i < k; i++) notas = [...notas.slice(1), notas[0] + 12]
  return {
    tipo: 'acorde',
    notas: notas.map((m) => ({ midi: m, inicio: 0, duracion: 2.0 })),
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

function preguntaEco(rnd, { n, pasos }, voz) {
  const [lo, hi] = rangoDeVoz(voz)
  const raiz = entero(rnd, lo, Math.max(lo, hi - 12))
  const grados = gradosDeFrase(rnd, n, pasos, 7)
  return {
    tipo: 'eco',
    notas: grados.map((g, i) => ({ midi: midiDeGrado(raiz, g), inicio: i * SEP, duracion: DUR_NOTA, nombre: midiANombre(midiDeGrado(raiz, g)), pulsoSeg: SEP })),
    grados,
  }
}

function preguntaDictado(rnd, { n, max, doInicio }) {
  const maxGrado = max - 1
  const raiz = entero(rnd, 53, 62)
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
  const escala = Array.from({ length: max }, (_, g) => ({ midi: midiDeGrado(raiz, g), inicio: g * 0.45, duracion: 0.4 }))
  return {
    tipo: 'dictado',
    raiz,
    max,
    grados,
    escala,
    notas: grados.map((g, i) => ({ midi: midiDeGrado(raiz, g), inicio: i * 0.9, duracion: 0.8 })),
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
    if (nivel.tipo === 'direccion') p = preguntaDireccion(rnd, par)
    else if (nivel.tipo === 'intervalo') p = preguntaIntervalo(rnd, par, nivel.baja)
    else if (nivel.tipo === 'acorde') p = preguntaAcorde(rnd, par)
    else if (nivel.tipo === 'eco') p = preguntaEco(rnd, par, voz)
    else p = preguntaDictado(rnd, par)
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
