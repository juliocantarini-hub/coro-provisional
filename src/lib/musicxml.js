// Convierte un MusicXML (una parte = una voz, como exportan MuseScore/Finale/Sibelius
// para una obra coral SATB) en una lista de eventos de nota por voz, con el tiempo
// absoluto en segundos ya calculado (usando divisions + los cambios de tempo del propio
// archivo). Pensado para programarse directo en Tone.Transport.
//
// Uso (navegador): import { parsearMusicXML } from './musicxml'
//   const partitura = parsearMusicXML(textoXml)
//   partitura.voces -> [{ id, nombre, notas: [{ tiempo, duracion, nota, letra }] }]
//   nota === null significa silencio (no se dispara sonido, pero ocupa tiempo)

const NOMBRE_VOZ = {
  soprano: 'soprano', soprán: 'soprano', 's.': 'soprano', s: 'soprano',
  alto: 'contralto', contralto: 'contralto', a: 'contralto',
  tenor: 'tenor', t: 'tenor',
  bass: 'bajo', bajo: 'bajo', baritone: 'bajo', barítono: 'bajo', b: 'bajo',
}

function detectarVoz(nombreParte) {
  const n = (nombreParte || '').trim().toLowerCase()
  for (const clave of Object.keys(NOMBRE_VOZ)) {
    if (n === clave || n.startsWith(clave)) return NOMBRE_VOZ[clave]
  }
  return null
}

function textoDe(elemento, tag) {
  const hijo = elemento.getElementsByTagName(tag)[0]
  return hijo ? hijo.textContent.trim() : null
}

function pitchANota(pitchEl) {
  const step = textoDe(pitchEl, 'step')
  const octava = textoDe(pitchEl, 'octave')
  const alterTxt = textoDe(pitchEl, 'alter')
  const alter = alterTxt ? parseInt(alterTxt, 10) : 0
  let alteracion = ''
  if (alter === 1) alteracion = '#'
  else if (alter === 2) alteracion = '##'
  else if (alter === -1) alteracion = 'b'
  else if (alter === -2) alteracion = 'bb'
  return `${step}${alteracion}${octava}`
}

// Recorre un <part> y devuelve, por voz interna (<voice> de MusicXML — normalmente
// hay una sola dentro de cada parte SATB), la lista de "eventos crudos" en ticks:
// { tickInicio, ticks, nota, letra, ligaAbre, ligaContinua }
function extraerEventosCrudos(parteEl) {
  const medidas = Array.from(parteEl.getElementsByTagName('measure'))
  let divisions = 1
  let tickAbsoluto = 0
  const eventosPorVoz = {}       // vozId -> [eventos]
  const notaAbiertaPorVoz = {}   // vozId -> evento (para fusionar ligaduras)
  const cambiosTempo = []        // { tick, bpm }
  const medidasTick = []         // { numero, tickInicio } - una por compás, en orden del documento

  for (const medida of medidas) {
    const medidaInicioTick = tickAbsoluto
    const numeroMedida = medida.getAttribute('number')
    medidasTick.push({ numero: numeroMedida, tickInicio: medidaInicioTick })
    let cursor = 0
    let cursorMax = 0

    for (const hijo of Array.from(medida.childNodes)) {
      if (hijo.nodeType !== 1) continue // solo elementos
      const tag = hijo.tagName

      if (tag === 'attributes') {
        const div = textoDe(hijo, 'divisions')
        if (div) divisions = parseFloat(div)
      } else if (tag === 'direction') {
        const sonido = hijo.getElementsByTagName('sound')[0]
        const tempo = sonido && sonido.getAttribute('tempo')
        if (tempo) cambiosTempo.push({ tick: medidaInicioTick + cursor, bpm: parseFloat(tempo) })
      } else if (tag === 'backup') {
        const dur = parseFloat(textoDe(hijo, 'duration') || '0')
        cursor -= dur
      } else if (tag === 'forward') {
        const dur = parseFloat(textoDe(hijo, 'duration') || '0')
        cursor += dur
        cursorMax = Math.max(cursorMax, cursor)
      } else if (tag === 'note') {
        const esSilencio = hijo.getElementsByTagName('rest').length > 0
        const esAcorde = hijo.getElementsByTagName('chord').length > 0
        const dur = parseFloat(textoDe(hijo, 'duration') || '0')
        const vozId = textoDe(hijo, 'voice') || '1'
        const tickInicio = medidaInicioTick + cursor
        const pitchEl = hijo.getElementsByTagName('pitch')[0]
        const nota = pitchEl ? pitchANota(pitchEl) : null
        const lyricEl = hijo.getElementsByTagName('lyric')[0]
        const letra = lyricEl ? textoDe(lyricEl, 'text') : null

        const tieEls = Array.from(hijo.getElementsByTagName('tie'))
        const ligaAbre = tieEls.some(t => t.getAttribute('type') === 'start')
        const ligaContinua = tieEls.some(t => t.getAttribute('type') === 'stop')

        if (!eventosPorVoz[vozId]) eventosPorVoz[vozId] = []

        if (esSilencio) {
          eventosPorVoz[vozId].push({ tickInicio, ticks: dur, nota: null, letra: null })
        } else if (ligaContinua && notaAbiertaPorVoz[vozId] && notaAbiertaPorVoz[vozId].nota === nota) {
          // Continuación de una nota ligada: sumar duración, no disparar sonido nuevo.
          notaAbiertaPorVoz[vozId].ticks += dur
          if (!ligaAbre) notaAbiertaPorVoz[vozId] = null
        } else {
          const evento = { tickInicio, ticks: dur, nota, letra }
          eventosPorVoz[vozId].push(evento)
          notaAbiertaPorVoz[vozId] = ligaAbre ? evento : null
        }

        if (!esAcorde) {
          cursor += dur
          cursorMax = Math.max(cursorMax, cursor)
        }
      }
    }

    tickAbsoluto = medidaInicioTick + cursorMax
  }

  return { eventosPorVoz, divisions, cambiosTempo, ticksTotales: tickAbsoluto, medidasTick }
}

// Convierte ticks a segundos respetando los cambios de tempo del propio archivo.
function armarConversorTiempo(cambiosTempo, divisions) {
  const cambios = cambiosTempo.length ? cambiosTempo : [{ tick: 0, bpm: 120 }]
  if (cambios[0].tick > 0) cambios.unshift({ tick: 0, bpm: 120 })
  cambios.sort((a, b) => a.tick - b.tick)

  // Precalcular el tiempo (seg) acumulado al inicio de cada tramo.
  const tramos = []
  let segAcumulados = 0
  for (let i = 0; i < cambios.length; i++) {
    const tickInicio = cambios[i].tick
    const tickFin = i + 1 < cambios.length ? cambios[i + 1].tick : Infinity
    const segPorTick = (60 / cambios[i].bpm) / divisions
    tramos.push({ tickInicio, tickFin, segPorTick, segInicio: segAcumulados })
    if (tickFin !== Infinity) segAcumulados += (tickFin - tickInicio) * segPorTick
  }

  return function tickASegundos(tick) {
    const tramo = tramos.find(t => tick >= t.tickInicio && tick < t.tickFin) || tramos[tramos.length - 1]
    return tramo.segInicio + (tick - tramo.tickInicio) * tramo.segPorTick
  }
}

export function parsearMusicXML(xmlTexto) {
  const parser = new DOMParser()
  const dom = parser.parseFromString(xmlTexto, 'application/xml')

  const errorParseo = dom.getElementsByTagName('parsererror')[0]
  if (errorParseo) throw new Error('El archivo no es un MusicXML válido.')

  const nombresPorId = {}
  const scoreParts = Array.from(dom.getElementsByTagName('score-part'))
  for (const sp of scoreParts) {
    nombresPorId[sp.getAttribute('id')] = textoDe(sp, 'part-name') || sp.getAttribute('id')
  }

  const partesEl = Array.from(dom.getElementsByTagName('part'))
  if (!partesEl.length) throw new Error('El MusicXML no tiene ninguna parte (voz).')

  const voces = []
  let divisionsGlobal = 1
  let cambiosTempoGlobal = []
  let ticksTotalesMax = 0
  const crudosPorParte = []

  for (const parteEl of partesEl) {
    const id = parteEl.getAttribute('id')
    const crudos = extraerEventosCrudos(parteEl)
    crudosPorParte.push({ id, nombre: nombresPorId[id] || id, ...crudos })
    if (crudos.divisions) divisionsGlobal = crudos.divisions
    if (crudos.cambiosTempo.length) cambiosTempoGlobal = crudos.cambiosTempo
    ticksTotalesMax = Math.max(ticksTotalesMax, crudos.ticksTotales)
  }

  const tickASegundos = armarConversorTiempo(cambiosTempoGlobal, divisionsGlobal)

  for (const parte of crudosPorParte) {
    // Si la parte tiene más de una <voice> de MusicXML, las tratamos como
    // sub-voces independientes (caso raro en un coral simple, pero por las dudas).
    const vozIds = Object.keys(parte.eventosPorVoz)
    for (const vozId of vozIds) {
      const eventos = parte.eventosPorVoz[vozId]
        .filter(e => e.ticks > 0)
        .sort((a, b) => a.tickInicio - b.tickInicio)
        .map(e => ({
          tiempo: tickASegundos(e.tickInicio),
          duracion: tickASegundos(e.tickInicio + e.ticks) - tickASegundos(e.tickInicio),
          nota: e.nota,
          letra: e.letra,
        }))

      const sufijo = vozIds.length > 1 ? ` ${vozId}` : ''
      voces.push({
        id: `${parte.id}-${vozId}`,
        nombre: `${parte.nombre}${sufijo}`,
        vozCoral: detectarVoz(parte.nombre),
        notas: eventos,
      })
    }
  }

  // Tiempo de inicio de cada compás, en segundos — para sincronizar un cursor visual
  // con la reproducción. Asumimos que todas las partes de una obra coral SATB tienen
  // la misma cantidad de compases en el mismo orden (caso normal); tomamos la primera.
  const medidas = (crudosPorParte[0]?.medidasTick || []).map(m => ({
    numero: m.numero,
    tiempo: tickASegundos(m.tickInicio),
    tickInicio: m.tickInicio,
  }))

  return {
    voces,
    duracionTotal: tickASegundos(ticksTotalesMax),
    medidas,
    divisions: divisionsGlobal,
  }
}
