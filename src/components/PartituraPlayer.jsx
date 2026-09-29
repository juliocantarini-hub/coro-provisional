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
  const [velocidad, setVelocidad] = useState(1)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  const [verPartitura, setVerPartitura] = useState(false)

  const [micActivo, setMicActivo] = useState(false)
  const [miVoz, setMiVoz] = useState(null)
  const [lectura, setLectura] = useState(null) // { freq, cents, nombre, objetivo }
  const [errorMic, setErrorMic] = useState('')
  const micRefs = useRef({ contexto: null, analyser: null, stream: null, intervalo: null, historial: [] })

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
    setReproduciendo(false)
    setTiempoActual(0)
    liberarControlReproduccion(detener)
  }

  function alternarVoz(vozId) {
    setActivas(prev => ({ ...prev, [vozId]: !prev[vozId] }))
  }

  function soloEstaVoz(vozId) {
    const nuevo = {}
    vocesOrdenadas.forEach(v => { nuevo[v.id] = v.id === vozId })
    setActivas(nuevo)
    setMiVoz(vozId)
  }

  function todasActivas() {
    const nuevo = {}
    vocesOrdenadas.forEach(v => { nuevo[v.id] = true })
    setActivas(nuevo)
  }

  async function reproducir() {
    if (!partituraParseada) return
    tomarControlReproduccion(detener)

    const { sampler, listo } = getPianoSampler()
    await listo

    Tone.Transport.cancel(0)
    Tone.Transport.stop()
    Tone.Transport.position = 0

    let duracionMax = 0
    for (const voz of vocesOrdenadas) {
      if (!activas[voz.id]) continue
      for (const evento of voz.notas) {
        if (!evento.nota) continue // silencio: no dispara sonido
        const inicio = evento.tiempo / velocidad
        const duracion = evento.duracion / velocidad
        Tone.Transport.scheduleOnce((time) => {
          sampler.triggerAttackRelease(evento.nota, duracion, time)
        }, inicio)
        duracionMax = Math.max(duracionMax, inicio + duracion)
      }
    }

    Tone.Transport.scheduleOnce(() => detener(), duracionMax + 0.3)

    const inicioReal = Date.now()
    limpiarIntervalo()
    intervalRef.current = setInterval(() => {
      setTiempoActual((Date.now() - inicioReal) / 1000)
    }, 200)

    Tone.Transport.start()
    setReproduciendo(true)
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
        if (miVoz && reproduciendo) {
          const voz = vocesOrdenadas.find(v => v.id === miVoz)
          const notaObjetivo = voz && notaEnInstante(voz.notas, tiempoActual * velocidad)
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

  // Con la partitura visible, el bloque entero pasa a "modo práctica": altura
  // acotada donde solo la partitura scrollea, y el panel de control (voces,
  // reproducción, tempo y afinador) queda siempre a la vista abajo, todo junto
  // como un único bloque — así no hace falta bajar la página para ver el
  // afinador mientras se lee la partitura. Sin la partitura visible, el bloque
  // vuelve a su alto natural (compacto), como antes.
  return (
    <div style={{
      background: '#F8F7F3', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      ...(verPartitura ? { height: 'min(72vh, 640px)' } : {}),
    }}>
      {verPartitura && (
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
      )}

      {/* Panel de control integrado: voces, reproducción, tempo y afinador,
          siempre visible como un único bloque pegado abajo. */}
      <div style={{ flex: '0 0 auto', ...(verPartitura ? { boxShadow: '0 -4px 10px rgba(26,26,24,0.05)' } : {}) }}>
        <div style={{ padding: '14px 18px 10px', ...(verPartitura ? { borderTop: '1px solid #E8E6DF' } : {}) }}>
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
                    padding: '7px 14px', borderRadius: '20px', cursor: 'pointer',
                    border: `1px solid ${activa ? vc.color : '#D3D1C7'}`,
                    background: activa ? vc.bg : '#FFFFFF',
                    color: activa ? vc.color : '#B4B2A9',
                    fontSize: '13px', fontWeight: '500',
                  }}>
                  {activa ? '🔊' : '🔇'} {voz.nombre}
                </button>
              )
            })}
            {vocesOrdenadas.length > 1 && (
              <button onClick={todasActivas}
                style={{ fontSize: '12px', color: '#5F5E5A', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
                Escuchar todas
              </button>
            )}
          </div>
        </div>

        <div style={{ height: '1px', background: '#E8E6DF', margin: '0 18px' }} />

        <div style={{ padding: '10px 18px 6px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button onClick={reproduciendo ? detener : reproducir}
            disabled={!Object.values(activas).some(Boolean)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '9px 18px',
              borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '13px', fontWeight: '600',
              background: reproduciendo ? '#FCEBEB' : '#0F6E56',
              color: reproduciendo ? '#A32D2D' : '#FFFFFF',
              opacity: Object.values(activas).some(Boolean) ? 1 : 0.5,
            }}>
            {reproduciendo ? '⏹ Detener' : '▶ Reproducir'}
          </button>

          <span style={{ fontSize: '12px', color: '#888780', fontVariantNumeric: 'tabular-nums' }}>
            {formatoTiempo(tiempoActual)} / {formatoTiempo(duracionTotal / velocidad)}
          </span>
        </div>

        <div style={{ padding: '0 18px 10px', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '12px', color: '#888780' }}>Tempo:</span>
            {VELOCIDADES.map(v => (
              <button key={v} onClick={() => setVelocidad(v)}
                style={{
                  padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                  background: velocidad === v ? '#378ADD' : '#F1EFE8',
                  color: velocidad === v ? '#FFFFFF' : '#5F5E5A',
                }}>
                {v === 1 ? 'Normal' : `${v}x`}
              </button>
            ))}
          </div>

          <button onClick={() => setVerPartitura(v => !v)}
            style={{
              marginLeft: 'auto',
              display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 14px',
              borderRadius: '20px', border: `1px solid ${verPartitura ? '#0F6E56' : '#D3D1C7'}`,
              background: verPartitura ? '#E1F5EE' : '#FFFFFF',
              color: verPartitura ? '#04342C' : '#5F5E5A',
              fontSize: '13px', fontWeight: '500', cursor: 'pointer',
            }}>
            {verPartitura ? '🎼 Ocultar partitura' : '🎼 Ver partitura'}
          </button>
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
