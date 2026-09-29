import { useState, useEffect, useMemo, useRef } from 'react'
import * as Tone from 'tone'
import { parsearMusicXML } from '../lib/musicxml'
import { getPianoSampler } from '../lib/pianoSampler'
import { tomarControlReproduccion, liberarControlReproduccion } from '../lib/reproductorActivo'

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

export default function PartituraPlayer({ partitura }) {
  const [reproduciendo, setReproduciendo] = useState(false)
  const [velocidad, setVelocidad] = useState(1)
  const [tiempoActual, setTiempoActual] = useState(0)
  const [error, setError] = useState('')
  const intervalRef = useRef(null)

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
  }, [vocesOrdenadas])

  useEffect(() => {
    if (!partituraParseada) setError('No pudimos leer este archivo MusicXML.')
  }, [partituraParseada])

  useEffect(() => {
    return () => detener()
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

  if (error) {
    return (
      <div style={{ fontSize: '13px', color: '#A32D2D', padding: '10px 0' }}>{error}</div>
    )
  }

  if (!partituraParseada) return null

  const duracionTotal = partitura.duracion_seg || partituraParseada.duracionTotal

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
    </div>
  )
}
