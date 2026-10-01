import { useState, useEffect, useMemo, useRef } from 'react'
import * as Tone from 'tone'
import { useAuth } from '../hooks/useAuth'
import { parsearMusicXML } from '../lib/musicxml'
import { getPianoSampler } from '../lib/pianoSampler'
import { tomarControlReproduccion, liberarControlReproduccion } from '../lib/reproductorActivo'
import {
  notaAMidi, midiAFrecuencia, centsEntre, detectarFrecuencia, frecuenciaANotaCercana, calcularRms,
} from '../lib/afinacion'
import PartituraVisual from './PartituraVisual'
import PianoVisual from './PianoVisual'
import MedidorAfinacion from './MedidorAfinacion'

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5]

const ORDEN_VOZ = { soprano: 0, contralto: 1, tenor: 2, bajo: 3 }

// Cada cuánto releemos el reloj del Transport para mover el cursor/barra de
// progreso. Antes eran 100ms: parte de por qué el cursor se sentía adelantado
// al sonido era esta resolución gruesa, sumada a la latencia real de salida
// de audio (altavoz/Bluetooth) que latenciaSalidaSeg() intenta descontar pero
// no siempre puede medir con exactitud (sobre todo en Bluetooth, donde el
// navegador no expone la latencia real del dispositivo). Bajar el intervalo
// no elimina esa latencia de hardware, pero sí achica el margen de error
// propio de nuestro muestreo.
const INTERVALO_CURSOR_MS = 50

// Cuántas lecturas de frecuencia guardamos para suavizar (mediana) y evitar que un
// solo salto de octava (típico de la autocorrelación con voz cantada) haga
// saltar el medidor de un lado a otro sin motivo.
const VENTANA_SUAVIZADO = 5

// El registro vocal del perfil puede tener más matices que las 4 voces corales
// de la partitura (mezzosoprano, barítono) — los mapeamos a la voz SATB más cercana.
function vozAVozCoral(voz) {
  if (!voz) return null
  const v = voz.trim().toLowerCase()
  if (v === 'mezzosoprano' || v === 'mezzo') return 'contralto'
  if (v === 'baritono' || v === 'barítono') return 'bajo'
  if (['soprano', 'contralto', 'tenor', 'bajo'].includes(v)) return v
  return null
}

function formatoTiempo(seg) {
  if (!isFinite(seg) || seg < 0) seg = 0
  const m = Math.floor(seg / 60)
  const s = Math.floor(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Busca, dentro de las notas de una voz, la que está sonando en el instante dado
// (tiempo en segundos, a velocidad normal — sin escalar por el multiplicador de tempo).
function notaEnInstante(notas, tiempo) {
  for (const n of notas) {
    if (n.nota && tiempo >= n.tiempo && tiempo < n.tiempo + n.duracion) return n
  }
  return null
}

// Cuánto tarda el audio en volverse audible después de que el Transport dice
// que "ya sonó" (buffer de salida del dispositivo — altavoz, Bluetooth, etc.):
// Tone.Transport.seconds avanza en el reloj interno de audio, pero hay una
// latencia real hasta que eso se escucha. Sin descontarla, el cursor/barra de
// progreso corren ligeramente ADELANTADOS de lo que se oye. outputLatency es
// el valor más preciso cuando el navegador lo expone; si no, se usa
// baseLatency como aproximación, y si tampoco existe, no se descuenta nada.
function latenciaSalidaSeg() {
  try {
    const ctx = Tone.getContext().rawContext
    return ctx.outputLatency || ctx.baseLatency || 0
  } catch (e) {
    return 0
  }
}

export default function PartituraPlayer({ partitura, pantallaCompleta }) {
  const { perfil } = useAuth()
  const [reproduciendo, setReproduciendo] = useState(false)
  const [pausado, setPausado] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)
  // Segundos reales ya transcurridos ANTES del tramo actual del Transport — el
  // tiempo mostrado/usado es esto más Tone.Transport.seconds. Tone.Transport.seconds
  // es el mismo reloj que dispara el audio (a diferencia de Date.now()), así que
  // usarlo evita que la barra de progreso/cursor se desincronice del sonido.
  const offsetTiempoRef = useRef(0)

  const [miVoz, setMiVoz] = useState(null)

  const [micActivo, setMicActivo] = useState(false)
  const [lectura, setLectura] = useState(null) // { freq, nombreCercano, centsCercano, objetivo }
  const [errorMic, setErrorMic] = useState('')
  const micRefs = useRef({ contexto: null, analyser: null, stream: null, intervalo: null, historial: [] })
  // El intervalo del micrófono se crea una sola vez (al activarlo) y no se vuelve a
  // crear en cada render, así que su callback no puede leer reproduciendo/pausado/
  // tiempoActual/velocidad/miVoz directamente (quedarían "congelados" en el valor que
  // tenían al activar el mic). Este ref se mantiene al día en cada render para que el
  // callback siempre lea el valor actual.
  const vivosRef = useRef({ reproduciendo, pausado, tiempoActual, velocidad, miVoz })
  useEffect(() => {
    vivosRef.current = { reproduciendo, pausado, tiempoActual, velocidad, miVoz }
  })

  // Piano en modo "ver las notas": sin usar el micrófono, muestra en el piano
  // la nota de la voz propia que está sonando en el audio en cada instante —
  // útil para seguir la partitura de oído/vista sin tener que cantar.
  const [pianoNotasAbierto, setPianoNotasAbierto] = useState(false)

  // Ayuda de "Practicar afinación": antes había un texto debajo del piano que
  // cambiaba todo el tiempo según lo que se estaba cantando (o el aviso de
  // auriculares, que aparecía y desaparecía) — eso hacía que el bloque
  // cambiara de alto todo el rato y el resto de la pantalla "saltara" para
  // arriba y abajo mientras se cantaba. En vez de eso, un signo de ayuda fijo
  // que el cantante abre cuando quiere (no cambia de tamaño solo).
  const [ayudaAfinacionAbierta, setAyudaAfinacionAbierta] = useState(false)

  // Menú flotante de velocidad (se abre con el ícono de hamburguesa, en vez de
  // tener las 5 opciones siempre expuestas en la barra de controles) y, por
  // separado, la posición "en vivo" mientras se arrastra la barra de progreso
  // (null = no se está arrastrando; si no, la fracción 0-1 bajo el dedo/mouse,
  // que todavía no se aplicó — recién se busca esa posición al soltar).
  const [velocidadMenuAbierto, setVelocidadMenuAbierto] = useState(false)
  const [arrastreFraccion, setArrastreFraccion] = useState(null)

  const partituraParseada = useMemo(() => {
    try {
      return parsearMusicXML(partitura.musicxml)
    } catch (e) {
      return null
    }
  }, [partitura.musicxml])

  // Voces detectadas, ordenadas SATB.
  const vocesOrdenadas = useMemo(() => {
    if (!partituraParseada) return []
    return [...partituraParseada.voces].sort((a, b) => {
      const oa = ORDEN_VOZ[a.vozCoral] ?? 99
      const ob = ORDEN_VOZ[b.vozCoral] ?? 99
      return oa - ob
    })
  }, [partituraParseada])

  // Se practica siempre y únicamente la voz registrada en el perfil del cantante
  // (o la primera de la partitura si no tiene una asignada) — mostrar y poder
  // sumar las demás voces es redundante con Repertorio, que ya tiene la partitura
  // y el audio completos con todas las voces.
  useEffect(() => {
    if (!vocesOrdenadas.length) return
    const miVozCoral = vozAVozCoral(perfil?.voz)
    const vozPropia = miVozCoral && vocesOrdenadas.find(v => v.vozCoral === miVozCoral)
    setMiVoz(vozPropia ? vozPropia.id : vocesOrdenadas[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocesOrdenadas, perfil?.voz])

  useEffect(() => {
    if (!partituraParseada) setError('No pudimos leer este archivo MusicXML.')
  }, [partituraParseada])

  useEffect(() => {
    return () => { detener(); detenerMicrofono() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function limpiarIntervalo() {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
  }

  function detener() {
    Tone.Transport.cancel(0)
    Tone.Transport.stop()
    const { sampler } = getPianoSampler()
    if (sampler) sampler.releaseAll()
    limpiarIntervalo()
    offsetTiempoRef.current = 0
    setReproduciendo(false)
    setPausado(false)
    setTiempoActual(0)
    liberarControlReproduccion(detener)
  }

  // Pausa el transporte sin cancelar las notas ya programadas: al reanudar sigue
  // sonando desde el mismo punto, sin tener que volver a armar toda la partitura.
  // Tone.Transport.seconds queda "congelado" mientras está pausado, así que ni
  // siquiera hace falta recalcular ningún punto de referencia al reanudar.
  function pausar() {
    Tone.Transport.pause()
    limpiarIntervalo()
    setPausado(true)
  }

  function reanudar() {
    limpiarIntervalo()
    intervalRef.current = setInterval(() => {
      setTiempoActual(Math.max(0, offsetTiempoRef.current + Tone.Transport.seconds - latenciaSalidaSeg()))
    }, INTERVALO_CURSOR_MS)
    Tone.Transport.start()
    setPausado(false)
  }

  function alternarPlayPausa() {
    if (!reproduciendo) reproducir()
    else if (pausado) reanudar()
    else pausar()
  }

  // Arranca (o reinicia) la reproducción desde una posición musical dada (en
  // segundos "de partitura", sin escalar por tempo), a una velocidad dada. reproducir()
  // y cambiarVelocidad() son casos particulares de esto: uno arranca desde el
  // principio, el otro desde donde va la reproducción pero a otro tempo.
  async function reproducirDesde(posicionMusical, velocidadUsar) {
    const { sampler, listo } = getPianoSampler()
    await listo

    Tone.Transport.cancel(0)
    Tone.Transport.stop()
    Tone.Transport.position = 0

    const voz = vocesOrdenadas.find(v => v.id === miVoz)
    let duracionMax = 0
    if (voz) {
      for (const evento of voz.notas) {
        if (!evento.nota) continue // silencio: no dispara sonido
        if (evento.tiempo < posicionMusical) continue
        const inicio = (evento.tiempo - posicionMusical) / velocidadUsar
        const duracion = evento.duracion / velocidadUsar
        Tone.Transport.scheduleOnce((time) => {
          sampler.triggerAttackRelease(evento.nota, duracion, time)
        }, inicio)
        duracionMax = Math.max(duracionMax, inicio + duracion)
      }
    }

    Tone.Transport.scheduleOnce(() => detener(), duracionMax + 0.3)

    offsetTiempoRef.current = velocidadUsar > 0 ? posicionMusical / velocidadUsar : 0
    setTiempoActual(offsetTiempoRef.current)
    limpiarIntervalo()
    intervalRef.current = setInterval(() => {
      setTiempoActual(Math.max(0, offsetTiempoRef.current + Tone.Transport.seconds - latenciaSalidaSeg()))
    }, INTERVALO_CURSOR_MS)

    Tone.Transport.start()
    setReproduciendo(true)
    setPausado(false)
  }

  function reproducir() {
    if (!partituraParseada) return
    tomarControlReproduccion(detener)
    reproducirDesde(0, velocidad)
  }

  // Ir directo a una posición musical dada (en segundos "de partitura", sin
  // escalar por tempo). Si ya estaba sonando, sigue sonando desde el nuevo
  // punto; si estaba pausada o detenida, deja todo listo en la nueva posición
  // sin arrancar el audio solo, para que Reproducir/Reanudar retome justo
  // desde ahí. Usado tanto por la barra de progreso como por tocar un compás
  // directamente en la partitura.
  async function irAPosicionMusical(posicionMusical) {
    if (!partituraParseada) return
    if (!reproduciendo) tomarControlReproduccion(detener)
    const estabaSonando = reproduciendo && !pausado
    await reproducirDesde(posicionMusical, velocidad)
    if (!estabaSonando) {
      Tone.Transport.pause()
      limpiarIntervalo()
      setPausado(true)
    }
  }

  // Click/tap en la barra de progreso: fracción (0 a 1) del total de la obra.
  function buscarPosicion(fraccion) {
    if (!partituraParseada) return
    const duracion = partitura.duracion_seg || partituraParseada.duracionTotal
    const f = Math.min(1, Math.max(0, fraccion))
    return irAPosicionMusical(f * duracion)
  }

  // Click/tap directo sobre un compás de la partitura: PartituraVisual ya
  // resolvió a qué tick corresponde el punto tocado (usando la propia
  // detección de coordenadas de OSMD), acá solo lo traducimos al segundo
  // "de partitura" más cercano usando el mismo arreglo `tiempos` que ya usa
  // el cursor — así cantar desde ahí vuelve a sonar exactamente igual que si
  // se hubiera llegado tocando la barra de progreso.
  function buscarPosicionPorTick(tick) {
    if (!partituraParseada) return
    const tiempos = partituraParseada.tiempos
    if (!tiempos || !tiempos.length) return
    let posicionMusical = tiempos[0].tiempo
    for (const p of tiempos) {
      if (p.tickInicio <= tick) posicionMusical = p.tiempo
      else break
    }
    return irAPosicionMusical(posicionMusical)
  }

  // Botones "compás anterior" / "compás siguiente": saltan al principio del
  // compás vecino al que está sonando ahora mismo (no al compás actual), para
  // poder tomar carrera y repetir un pasaje desde un poco antes, o adelantarse
  // uno a uno. Cada toque mueve un compás más — apretar varias veces seguidas
  // retrocede/avanza esa misma cantidad de compases.
  function saltarCompas(direccion) {
    if (!partituraParseada) return
    const medidas = partituraParseada.medidas
    if (!medidas || !medidas.length) return
    const posicionMusical = tiempoActual * velocidad
    let indice = 0
    for (let i = 0; i < medidas.length; i++) {
      if (medidas[i].tiempo <= posicionMusical) indice = i
      else break
    }
    const nuevoIndice = Math.max(0, Math.min(medidas.length - 1, indice + direccion))
    irAPosicionMusical(medidas[nuevoIndice].tiempo)
  }

  // Cambiar el tempo mientras suena antes no hacía nada audible: las notas ya
  // estaban programadas a la velocidad vieja. Ahora se reprograma lo que falta,
  // a la nueva velocidad, desde la posición actual (sin volver al principio).
  //
  // reproducirDesde() siempre termina arrancando el Transport (para sonar).
  // Eso estaba bien mientras se estaba reproduciendo de verdad, pero
  // "reproduciendo" sigue siendo true también en PAUSA (pausar() no lo pone en
  // false) — así que cambiar la velocidad estando en pausa reprogramaba todo
  // y de paso REANUDABA el audio solo, sin que el cantante tocara play. Ahora,
  // si estaba en pausa, volvemos a pausar apenas termina de reprogramar: la
  // nueva velocidad queda lista para cuando el cantante retome, pero el audio
  // no arranca solo.
  async function cambiarVelocidad(nueva) {
    if (nueva === velocidad) return
    const vieja = velocidad
    const estabaPausado = pausado
    setVelocidad(nueva)
    if (reproduciendo) {
      const posicionMusical = tiempoActual * vieja
      await reproducirDesde(posicionMusical, nueva)
      if (estabaPausado) {
        Tone.Transport.pause()
        limpiarIntervalo()
        setPausado(true)
      }
    }
  }

  // ─── Afinación con micrófono ────────────────────────────────────────────
  async function activarMicrofono() {
    setErrorMic('')
    if (!navigator.mediaDevices?.getUserMedia) {
      setErrorMic('Tu navegador no permite usar el micrófono acá.')
      return
    }
    try {
      // Por defecto el navegador aplica tres cosas al micrófono, pensadas
      // para llamadas de voz: supresión de ruido, control automático de
      // ganancia y cancelación de eco. Las tres las dejamos desactivadas:
      // en la práctica atenuaban tanto la señal que la propia voz del
      // cantante dejaba de detectarse bien. Probamos con la cancelación de
      // eco activada para filtrar el acompañamiento que se cuela por el
      // parlante (sin auriculares) — funcionó para eso, pero de paso
      // bloqueaba también la voz real del cantante en esa misma situación
      // (sin auriculares + acompañamiento sonando no detectaba nada, ni
      // siquiera cantando bien). La volvemos a desactivar: en vez de un
      // filtro genérico del navegador, más abajo calibramos nosotros mismos
      // cuánto se cuela el acompañamiento, específicamente para este caso.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      })
      const Ctx = window.AudioContext || window.webkitAudioContext
      const contexto = new Ctx()
      const fuente = contexto.createMediaStreamSource(stream)
      const analyser = contexto.createAnalyser()
      analyser.fftSize = 2048
      fuente.connect(analyser)

      micRefs.current = {
        contexto, analyser, stream, intervalo: null, historial: [], ultimaNotaObjetivo: undefined,
        deteccionesSeguidas: 0,
        // Piso de volumen (RMS) que se cuela del acompañamiento por el
        // parlante hacia el mic, sin auriculares. Se calibra solo (ver más
        // abajo) y arranca en null: hasta la primera calibración no exigimos
        // nada por encima del umbral de silencio fijo de detectarFrecuencia.
        pisoBleed: null,
      }

      const buffer = new Float32Array(analyser.fftSize)
      micRefs.current.intervalo = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer)

        // Necesitamos saber si la partitura está sonando y si la voz propia
        // tiene una nota en este instante ANTES de decidir si esta lectura
        // cuenta o no — tanto para la calibración del "piso" de acompañamiento
        // (más abajo) como para la corrección de octava de siempre.
        //
        // "reproduciendo" queda en true también durante la PAUSA (pausar() no
        // lo pone en false, solo prende "pausado" — ver el comentario junto a
        // "estabaSonando" más arriba en este archivo). Si usáramos
        // "reproduciendo" solo, en pausa
        // seguiríamos tomando como objetivo la nota de la partitura
        // congelada en el instante donde se pausó, y comparando lo que
        // realmente se canta contra esa nota vieja — exactamente la causa de
        // que en pausa el piano no siguiera la voz y el medidor mostrara una
        // desafinación que no era real. "sonandoAhora" es reproduciendo Y
        // NO pausado: solo true mientras la partitura de verdad avanza.
        const { reproduciendo: reproduciendoAhora, pausado: pausadoAhora, tiempoActual: tiempoAhora, velocidad: velocidadAhora, miVoz: miVozAhora } = vivosRef.current
        const sonandoAhora = reproduciendoAhora && !pausadoAhora
        let objetivoFreq = null
        let notaObjetivoNombre = null
        let notaObjetivoTiempo = null
        let hayNotaPropia = false
        if (miVozAhora && sonandoAhora) {
          const voz = vocesOrdenadas.find(v => v.id === miVozAhora)
          const notaObjetivo = voz && notaEnInstante(voz.notas, tiempoAhora * velocidadAhora)
          if (notaObjetivo) {
            hayNotaPropia = true
            const midiObjetivo = notaAMidi(notaObjetivo.nota)
            if (midiObjetivo != null) {
              objetivoFreq = midiAFrecuencia(midiObjetivo)
              notaObjetivoNombre = notaObjetivo.nota
              // El instante de inicio de la nota (único por nota, aunque se
              // repita la misma altura) — se lo pasamos al piano como
              // "ataqueId" para que pueda distinguir "sigue sonando la misma
              // nota" de "empezó una nota nueva de la misma altura" (do-do-do).
              notaObjetivoTiempo = notaObjetivo.tiempo
            }
          }
        }

        const rms = calcularRms(buffer)

        // Calibración: en los silencios de LA PROPIA VOZ (no hay nota que
        // cantar en este instante) mientras el acompañamiento sigue sonando,
        // lo que capta el mic es, por definición, solo el acompañamiento
        // colándose desde el parlante — no hay voz real que pueda estar
        // aportando. Promediamos ese volumen (con más peso a las lecturas
        // recientes, por si cambia el volumen del parlante) como referencia
        // de "esto es puro acompañamiento, no cantaron nada".
        if (sonandoAhora && !hayNotaPropia) {
          const ALPHA_CALIBRACION = 0.2
          micRefs.current.pisoBleed = micRefs.current.pisoBleed == null
            ? rms
            : micRefs.current.pisoBleed * (1 - ALPHA_CALIBRACION) + rms * ALPHA_CALIBRACION
        }

        // Mientras no haya auriculares y el acompañamiento esté sonando,
        // parte de lo que capta el mic es directamente ese acompañamiento
        // colándose — no la voz. Si ya calibramos cuánto "piso" de
        // acompañamiento hay (arriba), exigimos que el volumen actual lo
        // supere con margen antes de confiar en la lectura; si no lo supera,
        // lo más probable es que sea el acompañamiento solo, sin voz real
        // encima, y no mostramos nada (en vez de, por ejemplo, prender el
        // piano con la nota que toca el acompañamiento).
        //
        // Este piso más exigente solo tiene sentido MIENTRAS SUENA el
        // acompañamiento — es la razón de ser de toda esta calibración. En
        // pausa (que es cuando, siguiendo el flujo recomendado, se termina
        // cantando) no hay acompañamiento que se pueda colar, así que
        // usamos el piso de silencio de siempre (0.01): si no, quedaba un
        // piso "viejo" calibrado de cuando sonaba el acompañamiento, que
        // podía ser más alto de lo que da cantar solo y sin querer tapaba
        // la voz real — el piano se quedaba pegado en la última nota que
        // sí había alcanzado a pasar ese piso, en vez de seguir lo que se
        // estaba cantando.
        const MARGEN_SOBRE_PISO = 1.6
        const umbralRms = (sonandoAhora && micRefs.current.pisoBleed != null)
          ? Math.max(0.01, micRefs.current.pisoBleed * MARGEN_SOBRE_PISO)
          : 0.01
        if (rms < umbralRms) {
          micRefs.current.historial = []
          micRefs.current.deteccionesSeguidas = 0
          setLectura(null)
          return
        }

        const freqCruda = detectarFrecuencia(buffer, contexto.sampleRate)
        if (!freqCruda) {
          micRefs.current.historial = []
          micRefs.current.deteccionesSeguidas = 0
          setLectura(null)
          return
        }
        micRefs.current.deteccionesSeguidas = (micRefs.current.deteccionesSeguidas || 0) + 1

        // Si hay una nota objetivo en este instante, corregimos la lectura
        // cruda antes de compararla: la autocorrelación con voz cantada
        // suele "engancharse" en un armónico o subarmónico — no solo al
        // doble/mitad (error de octava), sino a veces al triple/tercio
        // (por ejemplo detecta SOL3 como si fuera DO2, una octava y quinta
        // más abajo: 1/3 de la frecuencia real). Probamos la lectura cruda
        // multiplicada por cada una de esas razones y nos quedamos con la
        // que cae más cerca de la nota objetivo — como ya sabemos qué nota
        // debería sonar, un error de "engancharse" en la detección no se
        // confunde con estar realmente desafinado.
        //
        // OJO: acá probamos solo octava (2, 1/2, 4, 1/4) y octava+quinta
        // (3, 1/3) — las dos que se confirmaron en la práctica. Agregamos
        // también quinta sola (1.5, 2/3) en un intento anterior, pero una
        // quinta está mucho más cerca en altura que una octava, así que de
        // cuadro a cuadro con una lectura apenas ruidosa el "más cercano"
        // podía saltar entre la lectura real (razón 1) y una falsa lectura
        // "a distancia de quinta" — el medidor terminaba moviéndose para
        // cualquier lado y casi nunca se quedaba quieto en afinado. Las
        // sacamos.
        const RAZONES_ENGANCHE = [1, 2, 0.5, 3, 1 / 3, 4, 0.25]
        const freqCorregida = objetivoFreq
          ? RAZONES_ENGANCHE.reduce((mejor, razon) => {
              const candidata = freqCruda * razon
              const distanciaMejor = Math.abs(centsEntre(mejor, objetivoFreq))
              const distanciaCandidata = Math.abs(centsEntre(candidata, objetivoFreq))
              return distanciaCandidata < distanciaMejor ? candidata : mejor
            }, freqCruda)
          : freqCruda

        // Si cambió la nota objetivo (la melodía avanzó a la siguiente nota),
        // arrancamos el suavizado de cero. Si no hacíamos esto, el historial
        // quedaba con lecturas de la nota ANTERIOR mezcladas con las de la
        // nueva durante un puñado de cuadros (hasta ~400ms) cada vez que
        // cambiaba de nota — en una melodía con notas cortas eso pasa
        // constantemente, y era la causa principal de que el medidor y el
        // piano se vieran errantes en vez de seguir la melodía con firmeza.
        if (notaObjetivoNombre !== micRefs.current.ultimaNotaObjetivo) {
          micRefs.current.historial = []
          micRefs.current.ultimaNotaObjetivo = notaObjetivoNombre
        }

        // Suavizado por mediana: una sola lectura ruidosa (ya corregida de
        // octava) queda descartada por las lecturas vecinas en vez de hacer
        // "saltar" el medidor.
        const historial = micRefs.current.historial
        historial.push(freqCorregida)
        if (historial.length > VENTANA_SUAVIZADO) historial.shift()
        const ordenado = [...historial].sort((a, b) => a - b)
        const freq = ordenado[Math.floor(ordenado.length / 2)]

        const cercana = frecuenciaANotaCercana(freq)

        // Que exista una nota objetivo y que se haya detectado ALGÚN sonido no
        // alcanza para decir "está cantando esa nota". Cualquier ruido de
        // fondo (o el propio ruido de base del micrófono) pasa el filtro de
        // silencio de detectarFrecuencia y, ya corregido de octava, puede caer
        // en cualquier punto dentro de esa octava — antes de este chequeo
        // mostrábamos igual el nombre de la nota objetivo (el de la
        // partitura, no el que realmente se oyó), así que la tecla se prendía
        // con la nota "correcta" aunque no se hubiera cantado nada, por
        // ejemplo con el acompañamiento silenciado y la partitura avanzando
        // sola. Ahora solo la tratamos como "está cantando esa nota" si lo
        // detectado, ya corregido de octava, cae razonablemente cerca del
        // objetivo (menos de un semitono); más allá de eso asumimos que no es
        // esa nota, y mostramos lo que realmente se detectó (nombreCercano)
        // en vez de la nota de la partitura.
        const centsRespectoObjetivo = objetivoFreq ? centsEntre(freq, objetivoFreq) : null
        const TOLERANCIA_OBJETIVO_CENTS = 70
        const cantandoElObjetivo =
          centsRespectoObjetivo != null && Math.abs(centsRespectoObjetivo) <= TOLERANCIA_OBJETIVO_CENTS
        const objetivo = cantandoElObjetivo
          ? { nombre: notaObjetivoNombre, cents: centsRespectoObjetivo, tiempo: notaObjetivoTiempo }
          : null

        // Un solo cuadro con una lectura de frecuencia (aunque haya pasado el
        // filtro de silencio y de claridad de detectarFrecuencia) todavía
        // puede ser un pico aislado de ruido — una voz cantando se sostiene
        // por mucho más que un cuadro (80ms). Pedimos un par de cuadros
        // seguidos con lectura antes de mostrar algo: así un blip suelto no
        // prende el piano ni mueve el medidor, pero una nota real cantada
        // (que dura cientos de milisegundos) no se nota más lenta.
        const MIN_DETECCIONES_SEGUIDAS = 2
        if (micRefs.current.deteccionesSeguidas < MIN_DETECCIONES_SEGUIDAS) {
          return
        }

        setLectura({ freq, nombreCercano: cercana.nombre, centsCercano: cercana.cents, objetivo })
      }, 80)

      setMicActivo(true)
    } catch (e) {
      setErrorMic('No pudimos acceder al micrófono. Revisá los permisos del navegador.')
    }
  }

  function detenerMicrofono() {
    const { contexto, stream, intervalo } = micRefs.current
    if (intervalo) clearInterval(intervalo)
    if (stream) stream.getTracks().forEach(t => t.stop())
    if (contexto && contexto.state !== 'closed') contexto.close()
    micRefs.current = { contexto: null, analyser: null, stream: null, intervalo: null, historial: [], ultimaNotaObjetivo: undefined, deteccionesSeguidas: 0, pisoBleed: null }
    setMicActivo(false)
    setLectura(null)
  }

  // Prende/apaga el mic — y si el piano en modo "ver las notas" estaba abierto,
  // lo cierra, para no mostrar dos pianos (uno con lo cantado y otro con lo que
  // suena) al mismo tiempo.
  function alternarMicrofono() {
    if (micActivo) {
      detenerMicrofono()
    } else {
      setPianoNotasAbierto(false)
      activarMicrofono()
    }
  }

  // Igual que arriba pero al revés: abrir el piano de "ver las notas" apaga el
  // micrófono si estaba prendido.
  function alternarPianoNotas() {
    if (micActivo) detenerMicrofono()
    setPianoNotasAbierto(v => !v)
  }

  if (error) {
    return (
      <div style={{ fontSize: '13px', color: '#A32D2D', padding: '10px 0' }}>{error}</div>
    )
  }

  if (!partituraParseada) return null

  const duracionTotal = partitura.duracion_seg || partituraParseada.duracionTotal
  const duracionEscalada = duracionTotal / velocidad
  const progresoPct = duracionEscalada > 0 ? Math.min(100, Math.max(0, (tiempoActual / duracionEscalada) * 100)) : 0
  // Mientras se arrastra la barra de progreso, mostramos la posición bajo el
  // dedo/mouse en vez de la real (que todavía no cambió — recién se busca al
  // soltar, ver el manejador onPointerUp de la barra).
  const progresoMostradoPct = arrastreFraccion != null ? arrastreFraccion * 100 : progresoPct
  const tiempoMostrado = arrastreFraccion != null ? arrastreFraccion * duracionEscalada : tiempoActual

  // Qué centésimas mostramos en el medidor: si hay una nota de la partitura
  // sonando ahora mismo en la voz propia, comparamos contra ESA nota (lo que
  // realmente importa al practicar); si no, mostramos qué tan cerca está de
  // la nota más próxima en afinación estándar, como referencia general.
  const centsMostrados = lectura?.objetivo ? lectura.objetivo.cents : lectura?.centsCercano

  // Nota de la voz propia que está sonando en el audio en este instante —
  // la misma cuenta que usa el afinador para saber qué nota "debería" sonar,
  // pero acá se usa para mostrarla en el piano tal cual, sin comparar contra
  // el micrófono.
  const vozPropia = vocesOrdenadas.find(v => v.id === miVoz)
  const notaSonandoInfo = vozPropia ? notaEnInstante(vozPropia.notas, tiempoActual * velocidad) : null
  const notaSonandoAhora = notaSonandoInfo?.nota || null

  // El bloque entero está siempre en "modo práctica": altura acotada donde solo
  // la partitura scrollea, y el panel de control (reproducción, tempo y
  // afinador) queda siempre a la vista abajo, todo junto como un único bloque —
  // así no hace falta bajar la página para ver el afinador mientras se lee la
  // partitura. En pantalla completa (abierto desde Entrenamiento) ocupa toda la
  // altura disponible del contenedor en vez de una altura fija acotada.
  return (
    <div style={{
      background: '#F8F7F3', border: pantallaCompleta ? 'none' : '1px solid #E8E6DF',
      borderRadius: pantallaCompleta ? 0 : '12px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: pantallaCompleta ? '100%' : 'min(72vh, 640px)',
    }}>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 18px 12px' }}>
        <PartituraVisual
          musicxml={partitura.musicxml}
          tiempos={partituraParseada.tiempos}
          divisions={partituraParseada.divisions}
          vozNombre={vocesOrdenadas.find(v => v.id === miVoz)?.nombre}
          tiempoActual={tiempoActual}
          velocidad={velocidad}
          reproduciendo={reproduciendo}
          onClickCompas={buscarPosicionPorTick}
        />
      </div>

      {/* Panel de control integrado: reproducción, tempo y afinador de la voz
          propia, siempre visible como un único bloque pegado abajo. Mostrar u
          oír las demás voces quedó afuera: para eso ya está Repertorio, que
          tiene la partitura y el audio completos con todas las voces. */}
      <div style={{ flex: '0 0 auto', boxShadow: '0 -4px 10px rgba(26,26,24,0.05)' }}>
        <div style={{ padding: '14px 18px 4px', borderTop: '1px solid #E8E6DF' }}>
          {/* Área de toque más alta que la barra visual (3px es muy fino para
              tocar con el dedo) — permite ir directo a un punto de la partitura
              tocando/clickeando en la barra, y también arrastrar el círculo
              para buscar una posición antes de soltar. Mientras se arrastra
              (arrastreFraccion no es null) solo actualizamos la posición
              mostrada en pantalla, sin re-programar el audio en cada
              movimiento — eso recién pasa una vez, al soltar, para no generar
              decenas de saltos/recalculos mientras el dedo se mueve. */}
          <div
            onPointerDown={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              e.currentTarget.setPointerCapture(e.pointerId)
              setArrastreFraccion(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
            }}
            onPointerMove={(e) => {
              if (arrastreFraccion == null) return
              const rect = e.currentTarget.getBoundingClientRect()
              setArrastreFraccion(Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)))
            }}
            onPointerUp={() => {
              if (arrastreFraccion == null) return
              buscarPosicion(arrastreFraccion)
              setArrastreFraccion(null)
            }}
            onPointerCancel={() => setArrastreFraccion(null)}
            style={{
              position: 'relative', height: '20px', display: 'flex', alignItems: 'center',
              cursor: 'pointer', touchAction: 'none',
            }}>
            <div style={{ position: 'relative', width: '100%', height: '3px', borderRadius: '2px', background: '#E8E6DF' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '2px',
                width: `${progresoMostradoPct}%`, background: '#1D9E75',
                transition: arrastreFraccion == null ? 'width 0.1s linear' : 'none',
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${progresoMostradoPct}%`, transform: 'translate(-50%, -50%)',
                width: arrastreFraccion != null ? '16px' : '12px', height: arrastreFraccion != null ? '16px' : '12px',
                borderRadius: '50%',
                background: '#0F6E56', border: '2.5px solid #FFFFFF', boxShadow: '0 1px 3px rgba(26,26,24,0.3)',
                transition: arrastreFraccion == null ? 'left 0.1s linear, width 0.1s, height 0.1s' : 'none',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
            <span style={{ fontSize: '11px', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
              {formatoTiempo(tiempoMostrado)}
            </span>
            <span style={{ fontSize: '11px', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
              -{formatoTiempo(Math.max(0, duracionEscalada - tiempoMostrado))}
            </span>
          </div>
        </div>

        {/* Fila de transporte, al estilo de un reproductor de música: menú de
            velocidad (hamburguesa) — compás anterior — reproducir/pausar —
            compás siguiente — volver al inicio. Reemplaza la fila anterior,
            donde las 5 velocidades estaban siempre expuestas junto al botón
            de reproducir. */}
        <div style={{ padding: '4px 18px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
          {/* Velocidad: antes era un grupo de 5 botones siempre visible acá
              mismo; ahora vive detrás de este ícono, en un menú flotente que
              se abre encima del botón, para no ocupar espacio permanente en
              una fila que ya tiene bastante. */}
          <div style={{ position: 'relative' }}>
            <button onClick={() => setVelocidadMenuAbierto(a => !a)}
              title="Velocidad" aria-label="Velocidad"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                background: velocidadMenuAbierto ? '#EAE7DD' : 'transparent', color: '#5F5E5A',
              }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2.5" width="14" height="2" rx="1" />
                <rect x="1" y="7" width="14" height="2" rx="1" />
                <rect x="1" y="11.5" width="14" height="2" rx="1" />
              </svg>
            </button>
            {velocidadMenuAbierto && (
              <>
                {/* Capa invisible de pantalla completa: tocar afuera del menú lo cierra. */}
                <div onClick={() => setVelocidadMenuAbierto(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                <div style={{
                  position: 'absolute', bottom: '100%', left: 0, marginBottom: '8px', zIndex: 10,
                  display: 'flex', flexDirection: 'column', gap: '2px', minWidth: '96px',
                  background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px',
                  padding: '4px', boxShadow: '0 4px 14px rgba(26,26,24,0.18)',
                }}>
                  {VELOCIDADES.map(v => (
                    <button key={v} onClick={() => { cambiarVelocidad(v); setVelocidadMenuAbierto(false) }}
                      style={{
                        padding: '7px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
                        fontSize: '13px', textAlign: 'left', whiteSpace: 'nowrap',
                        fontWeight: velocidad === v ? '700' : '500',
                        background: velocidad === v ? '#EAE7DD' : 'transparent',
                        color: velocidad === v ? '#04342C' : '#5F5E5A',
                      }}>
                      {v === 1 ? 'Normal' : `${v}x`}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Compás anterior: salta al principio del compás de ANTES del que
              suena ahora (no al actual) — pensado para tomar carrera y
              repetir un pasaje desde un poco antes. Cada toque retrocede un
              compás más. */}
          <button onClick={() => saltarCompas(-1)}
            disabled={!vocesOrdenadas.length}
            title="Compás anterior" aria-label="Compás anterior"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#5F5E5A',
              opacity: vocesOrdenadas.length ? 1 : 0.5,
            }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="2" y="2" width="2" height="12" rx="1" />
              <path d="M14 2.5v11a.5.5 0 0 1-.76.42l-8-5.5a.5.5 0 0 1 0-.84l8-5.5a.5.5 0 0 1 .76.42z" />
            </svg>
          </button>

          <button onClick={alternarPlayPausa}
            disabled={!vocesOrdenadas.length}
            title={!reproduciendo ? 'Reproducir' : pausado ? 'Reanudar' : 'Pausar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '50px', height: '50px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#0F6E56', color: '#FFFFFF',
              boxShadow: '0 3px 8px rgba(15,110,86,0.35)',
              opacity: vocesOrdenadas.length ? 1 : 0.5,
            }}>
            {reproduciendo && !pausado ? (
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.5v13l11-6.5-11-6.5z" /></svg>
            )}
          </button>

          {/* Compás siguiente: avanza al principio del próximo compás. Cada
              toque adelanta uno más. */}
          <button onClick={() => saltarCompas(1)}
            disabled={!vocesOrdenadas.length}
            title="Compás siguiente" aria-label="Compás siguiente"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#5F5E5A',
              opacity: vocesOrdenadas.length ? 1 : 0.5,
            }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
              <rect x="12" y="2" width="2" height="12" rx="1" />
              <path d="M2 2.5v11a.5.5 0 0 0 .76.42l8-5.5a.5.5 0 0 0 0-.84l-8-5.5A.5.5 0 0 0 2 2.5z" />
            </svg>
          </button>

          {/* Volver al inicio: mismo comportamiento que el botón "Detener" de
              antes (vuelve al segundo 0 y corta el audio), reubicado acá y
              siempre presente (antes solo aparecía mientras sonaba, lo que
              corría el resto de los botones de lugar cada vez). */}
          <button onClick={detener}
            disabled={!reproduciendo}
            title="Volver al inicio" aria-label="Volver al inicio"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '38px', height: '38px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: 'transparent', color: '#5F5E5A',
              opacity: reproduciendo ? 1 : 0.5,
            }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13.5 8A5.5 5.5 0 1 1 8 2.5c1.7 0 3.2.77 4.2 2" />
              <path d="M12.5 1.8v3h-3" />
            </svg>
          </button>
        </div>

        <div style={{ height: '1px', background: '#E8E6DF', margin: '0 18px' }} />

        {/* Afinación (con micrófono) y piano de "ver las notas" (sin micrófono):
            dos formas de usar el piano, una sola a la vez. */}
        <div style={{ padding: '12px 18px 14px' }}>
          {/* Centrados en la pantalla, como pidió Julio (antes arrancaban
              pegados a la izquierda). El botón de ayuda ahora vive siempre
              acá en el medio, no solo con el mic activo: explica el flujo de
              práctica en general (piano Y afinación), así que tiene sentido
              aunque todavía no se haya prendido el micrófono. */}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center' }}>
            <button onClick={alternarPianoNotas}
              title="Ver en el piano las notas que van sonando, sin usar el micrófono"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                borderRadius: '20px', border: `1px solid ${pianoNotasAbierto ? '#0F6E56' : '#D3D1C7'}`,
                background: pianoNotasAbierto ? '#E1F5EE' : '#FFFFFF',
                color: pianoNotasAbierto ? '#04342C' : '#5F5E5A',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}>
              {pianoNotasAbierto ? '🎹 Cerrar piano' : '🎹 Piano'}
            </button>

            <button onClick={alternarMicrofono}
              title="Cantá y mirá en el medidor y el piano qué tan afinado estás"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                borderRadius: '20px', border: `1px solid ${micActivo ? '#D85A30' : '#D3D1C7'}`,
                background: micActivo ? '#FAECE7' : '#FFFFFF',
                color: micActivo ? '#712B13' : '#5F5E5A',
                fontSize: '13px', fontWeight: '500', cursor: 'pointer',
              }}>
              {micActivo ? '🎤 Apagar micrófono' : '🎤 Practicar afinación'}
            </button>

            {/* Ayuda: el texto aparecía antes pegado debajo de estos botones y
                empujaba el piano/medidor hacia abajo al abrirse (un bloque
                que cambiaba de alto). Es un menú flotante — mismo patrón que
                el de velocidad en la barra de transporte — que se superpone
                sin mover nada de lugar, con una capa invisible atrás para
                cerrarlo tocando afuera. Se abre hacia ARRIBA (bottom: 100%,
                no top): esta fila está cerca del borde inferior del panel, y
                desplegado hacia abajo el contenido quedaba tapado/afuera de
                la pantalla. */}
            <div style={{ position: 'relative' }}>
              <button onClick={() => setAyudaAfinacionAbierta(a => !a)}
                title="Cómo practicar la afinación"
                aria-label="Cómo practicar la afinación"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
                  borderRadius: '20px', border: `1px solid ${ayudaAfinacionAbierta ? '#8A8878' : '#D3D1C7'}`,
                  background: ayudaAfinacionAbierta ? '#EFEEE7' : '#FFFFFF',
                  color: '#5F5E5A', fontSize: '13px', fontWeight: '500', cursor: 'pointer',
                }}>
                ❓ Ayuda
              </button>
              {ayudaAfinacionAbierta && (
                <>
                  <div onClick={() => setAyudaAfinacionAbierta(false)} style={{ position: 'fixed', inset: 0, zIndex: 9 }} />
                  <div style={{
                    position: 'absolute', bottom: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
                    zIndex: 10, width: '260px', maxWidth: '72vw',
                    fontSize: '12px', color: '#5F5E5A', background: '#FFFFFF', lineHeight: '1.5',
                    border: '1px solid #E8E6DF', borderRadius: '10px', padding: '12px 14px',
                    boxShadow: '0 4px 14px rgba(26,26,24,0.18)',
                  }}>
                    Para practicar la afinación, escuchá primero una sección, pausá
                    y repetila cantándola. Tu afinación se refleja en las teclas del
                    piano, y el medidor de afinación muestra tu rango: si se
                    mantiene en verde y amarillo, tu afinación es estable.
                    <br /><br />
                    La primera vez el navegador va a pedir permiso para usar el
                    micrófono — hace falta aceptarlo para que esto funcione.
                  </div>
                </>
              )}
            </div>
          </div>

          {errorMic && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '8px' }}>{errorMic}</div>}

          {micActivo && (
            <div style={{ marginTop: '14px' }}>
              <MedidorAfinacion cents={centsMostrados} />
              {/* El piano tiene dos momentos distintos acá. Mientras la
                  partitura está REALMENTE sonando (reproduciendo Y no
                  pausado — "reproduciendo" solo se queda en true durante la
                  pausa, no alcanza para distinguir "sonando" de "pausado",
                  ver el comentario en activarMicrofono), muestra la nota de
                  LA PARTITURA (la misma fuente que el modo "🎹 Piano",
                  notaSonandoAhora): una referencia visual estable de "esto
                  es lo que hay que cantar", para mirar/imitar antes de
                  pausar. Pero en pausa — que es cuando en la práctica se
                  termina cantando, según el flujo recomendado (ver el botón
                  "?") — notaSonandoAhora queda clavada en la nota de donde
                  se pausó y ya no sirve de nada; ahí mostramos lo que el mic
                  realmente detecta, para que el piano siga reflejando lo que
                  se está cantando. */}
              <PianoVisual
                notaActiva={(reproduciendo && !pausado) ? notaSonandoAhora : (lectura?.objetivo?.nombre || lectura?.nombreCercano || null)}
                ataqueId={(reproduciendo && !pausado) ? notaSonandoInfo?.tiempo : lectura?.objetivo?.tiempo}
              />
            </div>
          )}

          {/* Sin texto dinámico debajo del piano (antes "nota que suena
              ahora en tu voz" / "silencio en este instante" / "reproducí la
              obra para ver las notas", que iba cambiando todo el tiempo y
              hacía que el diseño subiera y bajara). Solo el piano. */}
          {pianoNotasAbierto && !micActivo && (
            <div style={{ marginTop: '14px' }}>
              <PianoVisual notaActiva={notaSonandoAhora} ataqueId={notaSonandoInfo?.tiempo} />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
