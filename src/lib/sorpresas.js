// ─────────────────────────────────────────────────────────────────────────────
// MENSAJES SORPRESA
//
// Acá están todos los textos que la app le muestra a cada cantante según lo que
// hizo (o dejó de hacer). Podés editarlos libremente: cada situación es una
// lista y la app elige una frase al azar.
//
//   {nombre} → primer nombre del cantante
//   {hora}   → hora del ensayo / concierto de hoy (solo en 'ensayo' y 'concierto')
//
// Para probar un mensaje sin esperar a que se dé la situación, abrí la app con
// ?sorpresa=<situacion> al final de la dirección. Por ejemplo:
//   https://tu-app.vercel.app/?sorpresa=ausente7
// Situaciones: primera, ausente7, ausente30, cumple, concierto, ensayo
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAJES = {
  // Primera vez que entra a la app
  primera: {
    emoji: '🎶',
    textos: [
      '¡Llegaste al coro digital, {nombre}! Acá nadie desafina (en la app, al menos).',
      'Primera vez por acá, {nombre}. Tranqui: para entrar no hace falta afinar.',
      '{nombre}, ya sos parte de la app. Ahora falta aprenderse todas las obras... de a una.',
    ],
  },

  // Vuelve después de 7 días o más sin entrar
  ausente7: {
    emoji: '👋',
    textos: [
      '¡Ya era hora de que aparezcas por acá, {nombre}! Las partituras te extrañaban.',
      'Mirá quién apareció. Te guardamos el lugar en la cuerda, {nombre}.',
      'Una semana sin entrar... tu voz descansó de sobra. Ahora, a calentar.',
    ],
  },

  // Vuelve después de 30 días o más sin entrar
  ausente30: {
    emoji: '🕵️',
    textos: [
      '{nombre}, ¡te dimos por desaparecido! Qué alegría verte de nuevo.',
      'Volviste después de más de un mes. Las obras cambiaron un poco; con un par de repasos te ponés al día.',
      'Un mes sin señales de vida. Menos mal que cantar es como andar en bicicleta.',
    ],
  },

  // Cumpleaños
  cumple: {
    emoji: '🎂',
    textos: [
      '¡Feliz cumple, {nombre}! Hoy tenés permiso para llevar la melodía... y la torta.',
      '¡Feliz cumpleaños, {nombre}! Que el año que viene sea todo en tono mayor.',
      'Hoy cumplís años y el coro entero te canta. Desafinado, pero con cariño.',
    ],
  },

  // Hay concierto hoy
  concierto: {
    emoji: '🎤',
    textos: [
      'Hoy se canta, {nombre}. Respirá hondo, sonreí y confiá en todo lo que ensayaste.',
      'Día de concierto: tomá agua, cuidá la voz y disfrutá. ¡Vas a brillar!',
      'Hoy el escenario es nuestro. A las {hora}, a dar lo mejor.',
    ],
  },

  // Hay ensayo hoy
  ensayo: {
    emoji: '🎼',
    textos: [
      'Hoy hay ensayo a las {hora}. Recordá: agua, calentar la voz y dejar el enojo del laburo afuera.',
      'Hoy toca ensayo ({hora}). Tu cuerda cuenta con vos, {nombre}.',
      'Ensayo hoy a las {hora}. Ojo con los sostenidos: no muerden, pero tampoco perdonan.',
    ],
  },
}

// Situaciones que dependen del día (se muestran como máximo una vez por día)
export const TIPOS_DEL_DIA = ['cumple', 'concierto', 'ensayo']

// Cuántos días sin entrar activan cada mensaje de ausencia
export const DIAS_AUSENCIA_CORTA = 7
export const DIAS_AUSENCIA_LARGA = 30

// ─── Lógica ──────────────────────────────────────────────────────────────────

// 'primera' | 'ausente30' | 'ausente7' | null
// Si la columna ultimo_acceso todavía no existe en la base, no hace nada.
export function tipoPorAusencia(perfil, ahora = new Date()) {
  if (!perfil || !('ultimo_acceso' in perfil)) return null
  if (!perfil.ultimo_acceso) return 'primera'
  const dias = (ahora - new Date(perfil.ultimo_acceso)) / 86400000
  if (dias >= DIAS_AUSENCIA_LARGA) return 'ausente30'
  if (dias >= DIAS_AUSENCIA_CORTA) return 'ausente7'
  return null
}

export function esCumple(perfil, ahora = new Date()) {
  const f = perfil?.fecha_nacimiento
  if (!f) return false
  const [, mes, dia] = String(f).slice(0, 10).split('-').map(Number)
  return mes === ahora.getMonth() + 1 && dia === ahora.getDate()
}

function mismoDia(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

// Primer evento de hoy del tipo pedido ('ensayo' | 'concierto'), o undefined
export function eventoDeHoy(eventos, tipo, ahora = new Date()) {
  return (eventos || []).find(e =>
    e.tipo === tipo && e.fecha_inicio && mismoDia(new Date(e.fecha_inicio), ahora)
  )
}

export function armarTexto(tipo, idx, { nombre, hora } = {}) {
  const lista = MENSAJES[tipo]?.textos
  if (!lista?.length) return ''
  return lista[idx % lista.length]
    .replaceAll('{nombre}', nombre || 'coralista')
    .replaceAll('{hora}', hora || '')
}

export function indiceAlAzar(tipo) {
  const n = MENSAJES[tipo]?.textos?.length || 1
  return Math.floor(Math.random() * n)
}

export function fechaLocal(ahora = new Date()) {
  const m = String(ahora.getMonth() + 1).padStart(2, '0')
  const d = String(ahora.getDate()).padStart(2, '0')
  return `${ahora.getFullYear()}-${m}-${d}`
}
