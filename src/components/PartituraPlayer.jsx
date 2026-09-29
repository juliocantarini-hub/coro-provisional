import { useState, useEffect, useMemo, useRef } from 'react'
import * as Tone from 'tone'
import { parsearMusicXML } from '../lib/musicxml'
import { getPianoSampler } from '../lib/pianoSampler'
import { tomarControlReproduccion, liberarControlReproduccion } from '../lib/reproductorActivo'
import {
  notaAMidi, midiAFrecuencia, centsEntre, detectarFrecuencia, frecuenciaANotaCercana,
} from '../lib/afinacion'

const VELOCIDADES = [0.5, 0.75, 1, 1.25, 1.5]

const VOCES_COLOR = {
  soprano:   { bg: '#FAECE7', color: '#712B13' },
  contralto: { bg: '#F3EFF8', color: '#3D1C6E' },
  tenor:     { bg: '#E6F1FB', color: '#042C53' },
  bajo:      { bg: '#E1F5EE', color: '#04342C' },
}

const ORDEN_VOZ = { soprano: 0, contralto: 1, tenor: 2, bajo: 3 }

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
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

  const [micActivo, setMicActivo] = useState(false)
  const [miVoz, setMiVoz] = useState(null)
  const [lectura, setLectura] = useState(null) // { freq, cents, nombre, objetivo }
  const [errorMic, setErrorMic] = useState('')
  const micRefs = useRef({ contexto: null, analyser: null, stream: null, intervalo: null })

  const partituraParseada = useMemo(() => {
    try {
      return parsearMusicXML(partitura.musicxml)
    } catch (e) {
      return null
    }
  }, [partitura.musicxml])

  // Voces detectadas, ordenadas SATB. Todas empiezan activas (mezcla completa).
  const vocesOrdenadas = useMemo(() => {
    if (!partituraParseada) return []
    return [...partituraParseada.voces].sort((a, b) => {
      const oa = ORDEN_VOZ[a.vozCoral] ?? 99
      const ob = ORDEN_VOZ[b.vozCoral] ?? 99
      return oa - ob
    })
  }, [partituraParseada])

  const [activas, setActivas] = useState({})
  useEffect(() => {
    const iniciales = {}
    vocesOrdenadas.forEach(v => { iniciales[v.id] = true })
    setActivas(iniciales)
    if (vocesOrdenadas.length && !miVoz) setMiVoz(vocesOrdenadas[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vocesOrdenadas])

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

      micRefs.current = { contexto, analyser, stream, intervalo: null }

      const buffer = new Float32Array(analyser.fftSize)
      micRefs.current.intervalo = setInterval(() => {
        analyser.getFloatTimeDomainData(buffer)
        const freq = detectarFrecuencia(buffer, contexto.sampleRate)
        if (!freq) { setLectura(null); return }

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
      }, 90)

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
    micRefs.current = { contexto: null, analyser: null, stream: null, intervalo: null }
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

  // Umbral visual: qué tan cerca (en cents) hay que estar para considerarlo "afinado".
  const centsMostrados = lectura?.objetivo ? lectura.objetivo.cents : lectura?.centsCercano
  let colorAfinacion = '#B4B2A9'
  if (lectura && centsMostrados != null) {
    const abs = Math.abs(centsMostrados)
    colorAfinacion = abs <= 12 ? '#1D9E75' : abs <= 40 ? '#D8A21D' : '#D85A30'
  }

  return (
    <div style={{ background: '#F8F7F3', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px' }}>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
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

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', flexWrap: 'wrap' }}>
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
      </div>

      <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #E8E6DF' }}>
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
            {vocesOrdenadas.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', color: '#888780' }}>¿Qué voz estás cantando?</span>
                {vocesOrdenadas.map(voz => (
                  <button key={voz.id} onClick={() => setMiVoz(voz.id)}
                    style={{
                      padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                      background: miVoz === voz.id ? '#0F6E56' : '#F1EFE8',
                      color: miVoz === voz.id ? '#FFFFFF' : '#5F5E5A',
                    }}>
                    {voz.nombre}
                  </button>
                ))}
              </div>
            )}

            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '10px', padding: '16px', textAlign: 'center' }}>
              <div style={{ fontSize: '28px', fontWeight: '600', color: lectura ? '#1A1A18' : '#D3D1C7', fontFamily: 'Georgia, serif' }}>
                {lectura ? (lectura.objetivo?.nombre || lectura.nombreCercano) : '—'}
              </div>
              <div style={{ fontSize: '12px', color: '#888780', marginBottom: '10px' }}>
                {lectura?.objetivo
                  ? 'nota que estás cantando ahora en la partitura'
                  : reproduciendo ? 'silencio en este instante' : 'nota más cercana a lo que cantás'}
              </div>

              <div style={{ position: 'relative', height: '10px', background: '#F1EFE8', borderRadius: '6px', overflow: 'hidden' }}>
                <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: '2px', background: '#D3D1C7' }} />
                {lectura && centsMostrados != null && (
                  <div style={{
                    position: 'absolute', top: 0, bottom: 0, width: '8px', borderRadius: '4px',
                    background: colorAfinacion,
                    left: `calc(${Math.max(0, Math.min(100, 50 + centsMostrados / 1))}% - 4px)`,
                  }} />
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#B4B2A9', marginTop: '4px' }}>grave · afinado · agudo</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
