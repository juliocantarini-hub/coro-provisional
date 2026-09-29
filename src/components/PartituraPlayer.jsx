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

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5]

const VOCES_COLOR = {
  soprano:   { bg: '#FAECE7', color: '#712B13' },
  contralto: { bg: '#F3EFF8', color: '#3D1C6E' },
  tenor:     { bg: '#E6F1FB', color: '#042C53' },
  bajo:      { bg: '#E1F5EE', color: '#04342C' },
}

const ORDEN_VOZ = { soprano: 0, contralto: 1, tenor: 2, bajo: 3 }

const LUCES_AFINACION = [
  { key: 'grave',   color: '#D85A30', label: 'grave' },
  { key: 'afinado', color: '#1D9E75', label: 'afinado' },
  { key: 'agudo',   color: '#D8A21D', label: 'agudo' },
]

// Cuántas lecturas de frecuencia guardamos para suavizar (mediana) y evitar que un
// solo salto de octava (típico de la autocorrelación con voz cantada) haga
// parpadear el afinador entre colores sin motivo.
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

export default function PartituraPlayer({ partitura }) {
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
  // IDs de eventos programados en Tone.Transport, por voz — permite sumar o cortar
  // una voz en vivo (mientras suena) sin tocar las demás.
  const eventosPorVozRef = useRef({})

  // Por defecto se muestra en la partitura únicamente el pentagrama de la voz propia,
  // para que el cantante no tenga que leer entre las demás voces.
  const [soloMiVoz, setSoloMiVoz] = useState(true)

  const [micActivo, setMicActivo] = useState(false)
  const [miVoz, setMiVoz] = useState(null)
  const [lectura, setLectura] = useState(null) // { freq, cents, nombre, objetivo }
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

  const [activas, setActivas] = useState({})
  // Por defecto se escucha solo la voz registrada en el perfil del cantante
  // (con la posibilidad de activar las demás desde los botones de arriba).
  useEffect(() => {
    if (!vocesOrdenadas.length) return
    const miVozCoral = vozAVozCoral(perfil?.voz)
    const vozPropia = miVozCoral && vocesOrdenadas.find(v => v.vozCoral === miVozCoral)
    const iniciales = {}
    vocesOrdenadas.forEach(v => { iniciales[v.id] = vozPropia ? v.id === vozPropia.id : true })
    setActivas(iniciales)
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
    eventosPorVozRef.current = {}
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
      setTiempoActual(offsetTiempoRef.current + Tone.Transport.seconds)
    }, 100)
    Tone.Transport.start()
    setPausado(false)
  }

  function alternarPlayPausa() {
    if (!reproduciendo) reproducir()
    else if (pausado) reanudar()
    else pausar()
  }

  // Programa en vivo las notas restantes de una voz (a partir de la posición actual)
  // sin tocar lo que ya está sonando de las demás — se usa para que una voz que se
  // activa mientras suena la partitura se sume de inmediato, en vez de recién
  // escucharse la próxima vez que se le da Reproducir.
  function unirVozEnVivo(vozId) {
    const voz = vocesOrdenadas.find(v => v.id === vozId)
    if (!voz) return
    const { sampler } = getPianoSampler()
    if (!sampler) return
    const posicionMusical = tiempoActual * velocidad
    const ids = eventosPorVozRef.current[vozId] || []
    for (const evento of voz.notas) {
      if (!evento.nota) continue
      if (evento.tiempo < posicionMusical) continue // ya pasó, no la tocamos retroactivamente
      const inicio = (evento.tiempo - posicionMusical) / velocidad
      const duracion = evento.duracion / velocidad
      const id = Tone.Transport.scheduleOnce((time) => {
        sampler.triggerAttackRelease(evento.nota, duracion, time)
      }, inicio)
      ids.push(id)
    }
    eventosPorVozRef.current[vozId] = ids
  }

  // Cancela las notas que todavía faltaba tocar de una voz. La nota que esté
  // sonando en este instante (si hay una) termina de sonar naturalmente — no la
  // cortamos de golpe, igual que al pausar.
  function silenciarVozEnVivo(vozId) {
    const ids = eventosPorVozRef.current[vozId] || []
    ids.forEach(id => Tone.Transport.clear(id))
    eventosPorVozRef.current[vozId] = []
  }

  function alternarVoz(vozId) {
    const nuevoActivo = !activas[vozId]
    setActivas(prev => ({ ...prev, [vozId]: nuevoActivo }))
    if (reproduciendo) {
      if (nuevoActivo) unirVozEnVivo(vozId)
      else silenciarVozEnVivo(vozId)
    }
  }

  function soloEstaVoz(vozId) {
    const nuevo = {}
    vocesOrdenadas.forEach(v => {
      const activa = v.id === vozId
      nuevo[v.id] = activa
      if (reproduciendo) {
        if (activa && !activas[v.id]) unirVozEnVivo(v.id)
        else if (!activa && activas[v.id]) silenciarVozEnVivo(v.id)
      }
    })
    setActivas(nuevo)
    setMiVoz(vozId)
  }

  function todasActivas() {
    const nuevo = {}
    vocesOrdenadas.forEach(v => {
      nuevo[v.id] = true
      if (reproduciendo && !activas[v.id]) unirVozEnVivo(v.id)
    })
    setActivas(nuevo)
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

    eventosPorVozRef.current = {}
    let duracionMax = 0
    for (const voz of vocesOrdenadas) {
      if (!activas[voz.id]) continue
      const ids = []
      for (const evento of voz.notas) {
        if (!evento.nota) continue // silencio: no dispara sonido
        if (evento.tiempo < posicionMusical) continue
        const inicio = (evento.tiempo - posicionMusical) / velocidadUsar
        const duracion = evento.duracion / velocidadUsar
        const id = Tone.Transport.scheduleOnce((time) => {
          sampler.triggerAttackRelease(evento.nota, duracion, time)
        }, inicio)
        ids.push(id)
        duracionMax = Math.max(duracionMax, inicio + duracion)
      }
      eventosPorVozRef.current[voz.id] = ids
    }

    Tone.Transport.scheduleOnce(() => detener(), duracionMax + 0.3)

    offsetTiempoRef.current = velocidadUsar > 0 ? posicionMusical / velocidadUsar : 0
    setTiempoActual(offsetTiempoRef.current)
    limpiarIntervalo()
    intervalRef.current = setInterval(() => {
      setTiempoActual(offsetTiempoRef.current + Tone.Transport.seconds)
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

        // Suavizado por mediana: una sola lectura ruidosa u octava mal detectada
        // (algo normal en autocorrelación con voz cantada) queda descartada por
        // las lecturas vecinas en vez de hacer "saltar" el afinador.
        const historial = micRefs.current.historial
        historial.push(freqCruda)
        if (historial.length > VENTANA_SUAVIZADO) historial.shift()
        const ordenado = [...historial].sort((a, b) => a - b)
        const freq = ordenado[Math.floor(ordenado.length / 2)]

        const cercana = frecuenciaANotaCercana(freq)
        let objetivo = null
        const { reproduciendo: reproduciendoAhora, tiempoActual: tiempoAhora, velocidad: velocidadAhora, miVoz: miVozAhora } = vivosRef.current
        if (miVozAhora && reproduciendoAhora) {
          const voz = vocesOrdenadas.find(v => v.id === miVozAhora)
          const notaObjetivo = voz && notaEnInstante(voz.notas, tiempoAhora * velocidadAhora)
          if (notaObjetivo) {
            const midiObjetivo = notaAMidi(notaObjetivo.nota)
            if (midiObjetivo != null) {
              objetivo = {
                nombre: notaObjetivo.nota,
                cents: centsEntre(freq, midiAFrecuencia(midiObjetivo)),
              }
            }
          }
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

  // Umbral: qué tan cerca (en cents) hay que estar para considerarlo "afinado",
  // y de qué lado (agudo/grave) cae si no lo está. 15 cents es un margen más
  // realista para voz cantada que los 12 anteriores (con vibrato natural, un
  // umbral más chico casi nunca llegaba a encender el verde).
  const centsMostrados = lectura?.objetivo ? lectura.objetivo.cents : lectura?.centsCercano
  let estadoAfinacion = null
  if (lectura && centsMostrados != null) {
    const abs = Math.abs(centsMostrados)
    estadoAfinacion = abs <= 15 ? 'afinado' : centsMostrados > 0 ? 'agudo' : 'grave'
  }

  // El bloque entero está siempre en "modo práctica": altura acotada donde solo
  // la partitura scrollea, y el panel de control (voces, reproducción, tempo y
  // afinador) queda siempre a la vista abajo, todo junto como un único bloque —
  // así no hace falta bajar la página para ver el afinador mientras se lee la
  // partitura.
  return (
    <div style={{
      background: '#F8F7F3', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      height: 'min(72vh, 640px)',
    }}>
      <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 18px 12px' }}>
        {vocesOrdenadas.length > 1 && (
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button onClick={() => setSoloMiVoz(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                borderRadius: '8px', border: '1px solid #D3D1C7', cursor: 'pointer',
                background: soloMiVoz ? '#E1F5EE' : '#FFFFFF',
                color: '#04342C', fontSize: '12px', fontWeight: '500',
              }}>
              {soloMiVoz ? '🎼 Mostrando solo tu voz' : '🎼 Mostrando todas las voces'}
            </button>
          </div>
        )}
        <PartituraVisual
          musicxml={partitura.musicxml}
          tiempos={partituraParseada.tiempos}
          divisions={partituraParseada.divisions}
          vozNombre={vocesOrdenadas.find(v => v.id === miVoz)?.nombre}
          soloMiVoz={soloMiVoz}
          tiempoActual={tiempoActual}
          velocidad={velocidad}
          reproduciendo={reproduciendo}
        />
      </div>

      {/* Panel de control integrado: voces, reproducción, tempo y afinador,
          siempre visible como un único bloque pegado abajo. */}
      <div style={{ flex: '0 0 auto', boxShadow: '0 -4px 10px rgba(26,26,24,0.05)' }}>
        <div style={{ padding: '14px 18px 10px', borderTop: '1px solid #E8E6DF' }}>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {vocesOrdenadas.map(voz => {
              const vc = VOCES_COLOR[voz.vozCoral] || { bg: '#F1EFE8', color: '#5F5E5A' }
              const activa = activas[voz.id]
              return (
                <button key={voz.id} onClick={() => alternarVoz(voz.id)}
                  onDoubleClick={() => soloEstaVoz(voz.id)}
                  title="Click: activar/silenciar. Doble click: escuchar solo esta voz."
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '6px',
                    padding: '6px 12px', borderRadius: '16px', cursor: 'pointer',
                    border: `1px solid ${activa ? vc.color + '55' : '#E8E6DF'}`,
                    background: activa ? vc.bg : '#FAFAF7',
                    color: activa ? vc.color : '#8A887F',
                    fontSize: '12px', fontWeight: '500',
                  }}>
                  <span style={{
                    width: '7px', height: '7px', borderRadius: '50%', display: 'inline-block',
                    background: activa ? vc.color : '#C7C5BB',
                  }} />
                  {voz.nombre}
                </button>
              )
            })}
            {vocesOrdenadas.length > 1 && (
              <button onClick={todasActivas}
                style={{ fontSize: '12px', color: '#8A887F', background: 'none', border: 'none', cursor: 'pointer' }}>
                Todas
              </button>
            )}
          </div>
        </div>

        <div style={{ height: '1px', background: '#E8E6DF', margin: '0 18px' }} />

        <div style={{ padding: '12px 18px 4px' }}>
          <div style={{ position: 'relative', height: '3px', borderRadius: '2px', background: '#E8E6DF' }}>
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
            disabled={!Object.values(activas).some(Boolean)}
            title={!reproduciendo ? 'Reproducir' : pausado ? 'Reanudar' : 'Pausar'}
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              width: '46px', height: '46px', borderRadius: '50%', border: 'none', cursor: 'pointer',
              background: '#0F6E56', color: '#FFFFFF',
              boxShadow: '0 3px 8px rgba(15,110,86,0.35)',
              opacity: Object.values(activas).some(Boolean) ? 1 : 0.5,
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

        {/* Afinación */}
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
            <div style={{ marginTop: '12px' }}>
              {vocesOrdenadas.length > 1 && (
                <div style={{ fontSize: '11px', color: '#B4B2A9', marginBottom: '8px' }}>
                  Cantando como: <strong style={{ color: '#5F5E5A' }}>{vocesOrdenadas.find(v => v.id === miVoz)?.nombre}</strong> (doble click en una voz de arriba para cambiarla)
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '10px', padding: '10px 16px' }}>
                <div style={{ minWidth: '54px' }}>
                  <div style={{ fontSize: '22px', fontWeight: '600', color: lectura ? '#1A1A18' : '#D3D1C7', fontFamily: 'Georgia, serif', lineHeight: 1 }}>
                    {lectura ? (lectura.objetivo?.nombre || lectura.nombreCercano) : '—'}
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '14px', flexGrow: 1, justifyContent: 'center' }}>
                  {LUCES_AFINACION.map(luz => {
                    const encendida = estadoAfinacion === luz.key
                    return (
                      <div key={luz.key} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '50%',
                          background: encendida ? luz.color : '#EDEBE3',
                          border: `2px solid ${encendida ? luz.color : '#D3D1C7'}`,
                          boxShadow: encendida ? `0 0 10px ${luz.color}66` : 'none',
                          transition: 'background 0.15s ease, box-shadow 0.15s ease',
                        }} />
                        <span style={{ fontSize: '9px', color: encendida ? '#5F5E5A' : '#B4B2A9', fontWeight: encendida ? '600' : '400' }}>
                          {luz.label}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
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
