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
//
// Más abajo (MENSAJES_SECCION) están los mensajes que salen al entrar a una pantalla
// puntual, como Repertorio o Calendario.
// ─────────────────────────────────────────────────────────────────────────────

export const MENSAJES = {
  // Primera vez que entra a la app
  primera: {
    emoji: '🎶',
    textos: [
      '¡Llegaste a nuestra App, {nombre}! Para mantenerte al día y estudiar!.',
      'Primera vez por acá, {nombre}. Que sea la primera de muchas!',
      '{nombre}, ya sos parte de nuestra App. Todo lo que necesitás para estar al día.',
    ],
  },

  // Vuelve después de 7 días o más sin entrar
  ausente7: {
    emoji: '👋',
    textos: [
      '¡Ya era hora de que aparezcas por acá, {nombre}! Las partituras te extrañaban.',
      'Mirá quién apareció! Te guardamos el lugar en la coro, {nombre}.',
      'Una semana sin entrar... tu voz descansó bastante. Ahora, a estudiar!',
    ],
  },

  // Vuelve después de 30 días o más sin entrar
  ausente30: {
    emoji: '🕵️',
    textos: [
      '{nombre}, ¡te dimos por desaparecido! Qué alegría verte de nuevo.',
      'Volviste después de más de un mes. Ponete al día!.',
      'Un mes sin señales de vida. Vamos! a ponerse al día!.',
    ],
  },

  // Cumpleaños
  cumple: {
    emoji: '🎂',
    textos: [
      '¡Feliz cumple, {nombre}! Que tengas un lindo día!',
      '¡Feliz cumple, {nombre}! Que sea un gran día!',
      '¡Feliz cumple, {nombre}! Lo mejor para vos!'',
    ],
  },

  // Hay concierto hoy
  concierto: {
    emoji: '🎤',
    textos: [
      'Hoy se canta, {nombre}. Respirá hondo, sonreí y confiá en todo lo que ensayaste.',
      'Día de concierto, {nombre}. A disfrutarlo. ¡Vamos con todo!',
      'Hoy es nuestro concierto, {nombre}. A las {hora}, a dar lo mejor.',
    ],
  },

  // Hay ensayo hoy
  ensayo: {
    emoji: '🎼',
    textos: [
      'Hoy hay ensayo a las {hora}. Recordá estudia las obras!',
      'Hoy toca ensayo ({hora}). Contamos con vos, {nombre}.',
      'Ensayo hoy a las {hora}. Escuchá las obras.',
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

// ═════════════════════════════════════════════════════════════════════════════
// MENSAJES POR PANTALLA
//
// Además del mensaje de Inicio, la app puede sorprender al cantante cuando entra
// a una pantalla en particular (Repertorio, Entrenamiento, Calendario, Avisos).
//
// Situaciones (cada una es una lista de frases; se elige una al azar):
//   muyAusente → hace un mes o más que no pasaba por esa pantalla
//   ausente    → hace unos días que no pasaba por esa pantalla
//   poco       → (solo Repertorio) su dedicación al estudio es baja
//   mucho      → (solo Repertorio) su dedicación al estudio es alta
//
//   {nombre} → primer nombre del cantante
//   {dias}   → días desde la última vez que miró esa pantalla
//   {pct}    → su porcentaje de dedicación (el mismo que ve en Repertorio)
//
// No hace falta que estén todas: si una pantalla no tiene una situación, esa
// situación simplemente no se muestra. Para agregar una pantalla nueva, sumá su
// nombre acá (tiene que ser una de: repertorio, entrenamiento, calendario,
// avisos, encuestas, textos, asistencia, companeros, perfil).
//
// Para probar un mensaje sin esperar a que se dé la situación, abrí esa pantalla
// con ?sorpresa=<pantalla>.<situacion> al final de la dirección. Por ejemplo:
//   https://tu-app.vercel.app/repertorio?sorpresa=repertorio.poco
// ═════════════════════════════════════════════════════════════════════════════

export const MENSAJES_SECCION = {
  repertorio: {
    muyAusente: {
      emoji: '🎼',
      textos: [
        '¡Por fin te ponés a estudiar, {nombre}! Las partituras ya te estaban por mandar un mensajito.',
        'Hace {dias} días que el repertorio no te ve. Lo bueno es que sigue en su lugar, esperándote!',
        '{nombre} en Repertorio después de {dias} días... ¡Esto merece un aplauso! Ahora, a estudiar.',
      ],
    },
    ausente: {
      emoji: '🎼',
      textos: [
        'Ya era hora de pasar por el repertorio, {nombre}. Hace {dias} días que no estudiás.',
        'Las obras te extrañaban, {nombre}. ¡Un ratito de estudio y listo!',
        'Hace {dias} días que no abrís una obra. Escuchá un audio, uno solo... quizás se te hace el hábito!',
      ],
    },
    poco: {
      emoji: '💪',
      textos: [
        'Tu dedicación va por el {pct}%, {nombre}. Esmerate un poco más: el coro (y tu cuerda) te lo van a agradecer.',
        'Un {pct}% de dedicación... ¡se puede mejorar! Abrí una obra y ponele el oído!',
        '{nombre}, el repertorio no se aprende solo. Vas por el {pct}%: ¡vamos que se puede!',
      ],
    },
    mucho: {
      emoji: '🌟',
      textos: [
        '¡Dedicación al {pct}%, {nombre}! Se nota quién estudia. Tu director está chocho.',
        'Vas por el {pct}% de dedicación. ¡Así se hace!',
        '{nombre}, {pct}% de dedicación: las partituras te miran con admiración.',
      ],
    },
  },

  entrenamiento: {
    muyAusente: {
      emoji: '🎤',
      textos: [
        'Tus cuerdas vocales preguntaron por vos: hace más de un mes que no entrenás. ¡A calentar, {nombre}!',
        '¡Volvió el atleta vocal! {dias} días después, {nombre}. Empecemos suave.',
      ],
    },
    ausente: {
      emoji: '🎤',
      textos: [
        'Hace {dias} días que tu voz no hace ejercicio, {nombre}. ¡Unos minutos de calentamiento y a cantar!',
        'La voz también se entrena, {nombre}. Hace {dias} días que no pasabas por acá.',
      ],
    },
  },

  calendario: {
    muyAusente: {
      emoji: '📅',
      textos: [
        '{nombre}, más de un mes sin mirar el calendario. ¡Revisá las fechas antes de que te sorprendan!',
      ],
    },
    ausente: {
      emoji: '📅',
      textos: [
        '¿Sabías que hay un calendario, {nombre}? Hace {dias} días que no lo mirás. ¡Fijate qué se viene!',
        'Hace {dias} días que no revisás el calendario. Que no se te pase nada!',
      ],
    },
  },

  avisos: {
    muyAusente: {
      emoji: '🔔',
      textos: [
        '¡Más de un mes sin mirar los avisos, {nombre}! Ponete al día, que seguro hay novedades.',
      ],
    },
    ausente: {
      emoji: '🔔',
      textos: [
        'Hace {dias} días que no pasás por los avisos, {nombre}. Puede que se te haya escapado algo importante.',
        'Los avisos te estaban esperando, {nombre}. Hace {dias} días que no los lees.',
      ],
    },
  },
}

// ─── Reglas: cuándo se dispara cada situación ───────────────────────────────
// (Podés cambiar estos números)

export const DIAS_SECCION_AUSENTE = 10        // "ausente": 10 días o más sin mirar esa pantalla
export const DIAS_SECCION_MUY_AUSENTE = 30    // "muyAusente": 30 días o más
export const DEDICACION_POCA = 40             // "poco": dedicación por debajo de este %
export const DEDICACION_MUCHA = 70            // "mucho": dedicación de este % o más
export const DIAS_PERSONA_NUEVA = 14          // a quien lleva menos días no se le habla de dedicación
export const MAX_MENSAJES_POR_SESION = 1      // cuántos mensajes como máximo por visita a la app (Inicio + pantallas)

// Cuántos días tienen que pasar antes de repetir la misma situación en la misma pantalla
export const ESPERA_DIAS = { muyAusente: 3, ausente: 3, poco: 7, mucho: 14 }
const ESPERA_POR_DEFECTO = 3

// ─── Lógica ──────────────────────────────────────────────────────────────────

// Días enteros desde una fecha (null si no hay fecha o es inválida)
export function diasDesde(fecha, ahora = new Date()) {
  if (!fecha) return null
  const t = new Date(fecha).getTime()
  if (Number.isNaN(t)) return null
  return Math.max(0, Math.floor((ahora.getTime() - t) / 86400000))
}

// Días sin mirar esa pantalla. Si nunca la miró pero la app ya lo vio activo,
// se cuenta desde su primera actividad. Si no hay ningún dato: null.
export function diasSinVerSeccion({ ultimaVista, primeraActividad } = {}, ahora = new Date()) {
  const dias = diasDesde(ultimaVista, ahora)
  return dias !== null ? dias : diasDesde(primeraActividad, ahora)
}

// ¿Lleva suficiente tiempo en la app como para hablarle de su dedicación?
export function esAntiguo(perfil, primeraActividad, ahora = new Date()) {
  const alta = perfil?.created_at || perfil?.creado_en || primeraActividad
  const dias = diasDesde(alta, ahora)
  return dias !== null && dias >= DIAS_PERSONA_NUEVA
}

export function necesitaDedicacion(seccion) {
  const cat = MENSAJES_SECCION[seccion]
  return !!(cat && (cat.poco || cat.mucho))
}

// Misma cuenta que el porcentaje de dedicación que se ve en Repertorio:
// (cobertura + frecuencia) / 2, con 30 aperturas por obra como tope.
// aperturas = lista con el id de la obra de cada apertura.
export function calcularDedicacion(totalObras, aperturas) {
  if (!totalObras) return null
  const lista = aperturas || []
  const unicas = new Set(lista).size
  const pctCobertura = (unicas / totalObras) * 100
  const promedio = unicas > 0 ? lista.length / unicas : 0
  const pctFrecuencia = Math.min((promedio / 30) * 100, 100)
  return Math.min(100, Math.round((pctCobertura + pctFrecuencia) / 2))
}

// Situaciones posibles para esa pantalla, de mayor a menor prioridad:
// muyAusente / ausente primero, después poco / mucho.
export function situacionesSeccion(seccion, { diasSinVer = null, dedicacion = null, antiguo = false } = {}) {
  const cat = MENSAJES_SECCION[seccion]
  if (!cat) return []
  const salida = []

  if (diasSinVer !== null) {
    if (diasSinVer >= DIAS_SECCION_MUY_AUSENTE) {
      if (cat.muyAusente) salida.push('muyAusente')
      else if (cat.ausente) salida.push('ausente')
    } else if (diasSinVer >= DIAS_SECCION_AUSENTE && cat.ausente) {
      salida.push('ausente')
    }
  }

  if (antiguo && dedicacion !== null) {
    if (dedicacion < DEDICACION_POCA && cat.poco) salida.push('poco')
    else if (dedicacion >= DEDICACION_MUCHA && cat.mucho) salida.push('mucho')
  }

  return salida
}

// ¿Todavía es pronto para repetir esta situación? ultimaFecha es 'AAAA-MM-DD' (día local).
export function enEspera(ultimaFecha, situacion, ahora = new Date()) {
  if (!ultimaFecha) return false
  const [a, m, d] = String(ultimaFecha).split('-').map(Number)
  if (!a || !m || !d) return false
  const hoy = new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate())
  const dias = Math.round((hoy - new Date(a, m - 1, d)) / 86400000)
  return dias < (ESPERA_DIAS[situacion] ?? ESPERA_POR_DEFECTO)
}

export function indiceAlAzarSeccion(seccion, situacion) {
  const n = MENSAJES_SECCION[seccion]?.[situacion]?.textos?.length || 1
  return Math.floor(Math.random() * n)
}

export function armarTextoSeccion(seccion, situacion, idx, { nombre, dias, pct } = {}) {
  const lista = MENSAJES_SECCION[seccion]?.[situacion]?.textos
  if (!lista?.length) return ''
  return lista[idx % lista.length]
    .replaceAll('{nombre}', nombre || 'coralista')
    .replaceAll('{dias}', dias ?? '')
    .replaceAll('{pct}', pct ?? '')
}
