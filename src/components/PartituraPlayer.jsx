import { useState, useEffect, useMemo, useRef } from 'react'
import * as Tone from 'tone'
import { useAuth } from '../hooks/useAuth'
import { parsearMusicXML } from '../lib/musicxml'
import { getPianoSampler } from '../lib/pianoSampler'
import { tomarControlReproduccion, liberarControlReproduccion } from '../lib/reproductorActivo'
import {
  notaAMidi, midiAFrecuencia, centsEntre, detectarFrecuencia, frecuenciaANotaCercana,
} from '../lib/afinacion'
import PartituraVisual from './PartituraVisual'
import PianoVisual from './PianoVisual'
import MedidorAfinacion from './MedidorAfinacion'

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5]

const ORDEN_VOZ = { soprano: 0, contralto: 1, tenor: 2, bajo: 3 }

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
  // crear en cada render, así que su callback no puede leer reproduciendo/tiempoActual/
  // velocidad/miVoz directamente (quedarían "congelados" en el valor que tenían al
  // activar el mic). Este ref se mantiene al día en cada render para que el callback
  // siempre lea el valor actual.
  const vivosRef = useRef({ reproduciendo, tiempoActual, velocidad, miVoz })
  useEffect(() => {
    vivosRef.current = { reproduciendo, tiempoActual, velocidad, miVoz }
  })

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
    }, 100)
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
    }, 100)

    Tone.Transport.start()
    setReproduciendo(true)
    setPausado(false)
  }

  function reproducir() {
    if (!partituraParseada) return
    tomarControlReproduccion(detener)
    reproducirDesde(0, velocidad)
  }

  // Ir directo a un punto de la partitura (click/tap en la barra de progreso).
  // Si ya estaba sonando, sigue sonando desde el nuevo punto; si estaba pausada
  // o detenida, deja todo listo en la nueva posición sin arrancar el audio solo,
  // para que Reproducir/Reanudar retome justo desde ahí.
  async function buscarPosicion(fraccion) {
    if (!partituraParseada) return
    const duracion = partitura.duracion_seg || partituraParseada.duracionTotal
    const f = Math.min(1, Math.max(0, fraccion))
    const posicionMusical = f * duracion
    if (!reproduciendo) tomarControlReproduccion(detener)
    const estabaSonando = reproduciendo && !pausado
    await reproducirDesde(posicionMusical, velocidad)
    if (!estabaSonando) {
      Tone.Transport.pause()
      limpiarIntervalo()
      setPausado(true)
    }
  }

  // Cambiar el tempo mientras suena antes no hacía nada audible: las notas ya
  // estaban programadas a la velocidad vieja. Ahora se reprograma lo que falta,
  // a la nueva velocidad, desde la posición actual (sin volver al principio).
  function cambiarVelocidad(nueva) {
    if (nueva === velocidad) return
    const vieja = velocidad
    setVelocidad(nueva)
    if (reproduciendo) {
      const posicionMusical = tiempoActual * vieja
      reproducirDesde(posicionMusical, nueva)
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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const Ctx = window.AudioContext || window.webkitAudioContext
      const contexto = new Ctx()
      const fuente = contexto.createMediaStreamSource(stream)
      const analyser = contexto.createAnalyser()
      analyser.fftSize = 2048
      fuente.connect(analyser)

      micRefs.current = { contexto, analyser, stream, intervalo: null, historial: [] }

      const buffer = new Float32Array(analyser.fftSize)
      micRefs.current.intervalo = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer)
        const freqCruda = detectarFrecuencia(buffer, contexto.sampleRate)
        if (!freqCruda) {
          micRefs.current.historial = []
          setLectura(null)
          return
        }

        // Si hay una nota objetivo en este instante (se está reproduciendo la
        // partitura), la buscamos ANTES de suavizar: la autocorrelación con voz
        // cantada suele "engancharse" en un armónico (típicamente el doble o la
        // mitad de la frecuencia real), lo que antes hacía que el medidor casi
        // nunca marcara "afinado" aunque el cantante estuviera bien. Como ya
        // sabemos qué nota debería sonar, corregimos la lectura cruda a la
        // octava más cercana a esa nota antes de compararla — así un error de
        // octava en la detección no se confunde con estar realmente desafinado.
        let objetivoFreq = null
        const { reproduciendo: reproduciendoAhora, tiempoActual: tiempoAhora, velocidad: velocidadAhora, miVoz: miVozAhora } = vivosRef.current
        let notaObjetivoNombre = null
        if (miVozAhora && reproduciendoAhora) {
          const voz = vocesOrdenadas.find(v => v.id === miVozAhora)
          const notaObjetivo = voz && notaEnInstante(voz.notas, tiempoAhora * velocidadAhora)
          if (notaObjetivo) {
            const midiObjetivo = notaAMidi(notaObjetivo.nota)
            if (midiObjetivo != null) {
              objetivoFreq = midiAFrecuencia(midiObjetivo)
              notaObjetivoNombre = notaObjetivo.nota
            }
          }
        }

        const freqCorregida = objetivoFreq
          ? freqCruda * Math.pow(2, Math.round(Math.log2(objetivoFreq / freqCruda)))
          : freqCruda

        // Suavizado por mediana: una sola lectura ruidosa (ya corregida de
        // octava) queda descartada por las lecturas vecinas en vez de hacer
        // "saltar" el medidor.
        const historial = micRefs.current.historial
        historial.push(freqCorregida)
        if (historial.length > VENTANA_SUAVIZADO) historial.shift()
        const ordenado = [...historial].sort((a, b) => a - b)
        const freq = ordenado[Math.floor(ordenado.length / 2)]

        const cercana = frecuenciaANotaCercana(freq)
        const objetivo = objetivoFreq
          ? { nombre: notaObjetivoNombre, cents: centsEntre(freq, objetivoFreq) }
          : null

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
    micRefs.current = { contexto: null, analyser: null, stream: null, intervalo: null, historial: [] }
    setMicActivo(false)
    setLectura(null)
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

  // Qué centésimas mostramos en el medidor: si hay una nota de la partitura
  // sonando ahora mismo en la voz propia, comparamos contra ESA nota (lo que
  // realmente importa al practicar); si no, mostramos qué tan cerca está de
  // la nota más próxima en afinación estándar, como referencia general.
  const centsMostrados = lectura?.objetivo ? lectura.objetivo.cents : lectura?.centsCercano

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
              tocando/clickeando en la barra, no solo mirarla. */}
          <div
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              buscarPosicion((e.clientX - rect.left) / rect.width)
            }}
            style={{ position: 'relative', height: '20px', display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
            <div style={{ position: 'relative', width: '100%', height: '3px', borderRadius: '2px', background: '#E8E6DF' }}>
              <div style={{
                position: 'absolute', left: 0, top: 0, height: '100%', borderRadius: '2px',
                width: `${progresoPct}%`, background: '#1D9E75',
              }} />
              <div style={{
                position: 'absolute', top: '50%', left: `${progresoPct}%`, transform: 'translate(-50%, -50%)',
                width: '12px', height: '12px', borderRadius: '50%',
                background: '#0F6E56', border: '2.5px solid #FFFFFF', boxShadow: '0 1px 3px rgba(26,26,24,0.3)',
              }} />
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
            <span style={{ fontSize: '11px', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
              {formatoTiempo(tiempoActual)}
            </span>
            <span style={{ fontSize: '11px', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
              -{formatoTiempo(Math.max(0, duracionEscalada - tiempoActual))}
            </span>
          </div>
        </div>

        <div style={{ padding: '4px 18px 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={alternarPlayPausa}
            disabled={!vocesOrdenadas.length}
            title={!reproduciendo ? 'Reproducir' : pausado ? 'Reanudar' : 'Pausar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '46px', height: '46px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#0F6E56', color: '#FFFFFF',
              boxShadow: '0 3px 8px rgba(15,110,86,0.35)',
              opacity: vocesOrdenadas.length ? 1 : 0.5,
            }}>
            {reproduciendo && !pausado ? (
              <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
                <rect x="3" y="2" width="3.5" height="12" rx="1" /><rect x="9.5" y="2" width="3.5" height="12" rx="1" />
              </svg>
            ) : (
              <svg width="17" height="17" viewBox="0 0 16 16" fill="currentColor"><path d="M3 1.5v13l11-6.5-11-6.5z" /></svg>
            )}
          </button>

          {reproduciendo && (
            <button onClick={detener} title="Detener"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #D3D1C7', cursor: 'pointer',
                background: '#FFFFFF', color: '#5F5E5A',
              }}>
              <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor"><rect x="2" y="2" width="12" height="12" rx="2" /></svg>
            </button>
          )}

          {/* Selector de tempo con el mismo estilo de "grupo segmentado" que ya
              usa la app (ver las pestañas de Entrenamiento): fondo neutro y el
              valor activo resaltado en blanco con sombra, en vez de un menú
              desplegable aparte. */}
          <div style={{ display: 'flex', gap: '2px', background: '#EAE7DD', borderRadius: '16px', padding: '3px' }}>
            {VELOCIDADES.map(v => (
              <button key={v} onClick={() => cambiarVelocidad(v)}
                style={{
                  padding: '5px 9px', borderRadius: '13px', border: 'none', cursor: 'pointer',
                  fontSize: '11px', whiteSpace: 'nowrap',
                  fontWeight: velocidad === v ? '700' : '500',
                  background: velocidad === v ? '#FFFFFF' : 'transparent',
                  color: velocidad === v ? '#04342C' : '#5F5E5A',
                  boxShadow: velocidad === v ? '0 1px 3px rgba(26,26,24,0.12)' : 'none',
                }}>
                {v === 1 ? 'Normal' : `${v}x`}
              </button>
            ))}
          </div>
        </div>

        <div style={{ height: '1px', background: '#E8E6DF', margin: '0 18px' }} />

        {/* Afinación: medidor de centésimas + piano resaltando la nota que se
            está cantando en cada instante. */}
        <div style={{ padding: '12px 18px 14px' }}>
          <button onClick={micActivo ? detenerMicrofono : activarMicrofono}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
              borderRadius: '20px', border: `1px solid ${micActivo ? '#D85A30' : '#D3D1C7'}`,
              background: micActivo ? '#FAECE7' : '#FFFFFF',
              color: micActivo ? '#712B13' : '#5F5E5A',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}>
            {micActivo ? '🎤 Apagar micrófono' : '🎤 Practicar afinación'}
          </button>

          {errorMic && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '8px' }}>{errorMic}</div>}

          {micActivo && (
            <div style={{ marginTop: '14px' }}>
              <MedidorAfinacion cents={centsMostrados} />
              <PianoVisual notaActiva={lectura?.nombreCercano || null} />
              <div style={{ fontSize: '11px', color: '#888780', marginTop: '6px' }}>
                {lectura?.objetivo
                  ? 'nota que estás cantando ahora en la partitura'
                  : reproduciendo ? 'silencio en este instante' : 'nota más cercana a lo que cantás'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
