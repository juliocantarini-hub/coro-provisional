import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { construirEjercicio, corregir } from '../lib/ritmo'
import { crearMotorRitmo } from '../lib/ritmoAudio'
import { leerLatencia, guardarLatencia, borrarLatencia } from '../lib/ritmoLatencia'
import { VERDE, boton } from './RitmoUI'

// Ajuste del retraso de los toques: suenan 8 clics y se toca con cada uno. Se mide cuánto después (o antes) llegan los
// toques respecto del clic y se guarda ese retraso para descontarlo en los ejercicios de ritmo.

const F = { dur: 1, silencio: false }
const EJ = construirEjercicio({ nivel: 0, numero: 0, tempo: 75, pulsosPorCompas: 4, tipoPulso: 4, compases: [[F, F, F, F], [F, F, F, F]], titulo: 'Ajuste' })

export default function RitmoCalibrar({ onCerrar }) {
  const motorRef = useRef(null)
  const ctlRef = useRef(null)
  const [fase, setFase] = useState('listo') // listo | midiendo | resultado
  const [conteo, setConteo] = useState(null)
  const [pulsado, setPulsado] = useState(false)
  const [medido, setMedido] = useState(null) // { ms } | { error }
  const [guardado, setGuardado] = useState(leerLatencia())
  const [sinAudio, setSinAudio] = useState(false)
  const ej = useMemo(() => EJ, [])

  useEffect(() => () => { if (motorRef.current) motorRef.current.parar() }, [])

  const empezar = async () => {
    if (!motorRef.current) motorRef.current = crearMotorRitmo()
    const ok = await motorRef.current.asegurar()
    if (!ok) { setSinAudio(true); return }
    setSinAudio(false); setMedido(null); setConteo(0); setFase('midiendo')
    ctlRef.current = motorRef.current.correr(ej, {
      tonos: false,
      onConteo: (n) => setConteo(n),
      onEntrada: () => setConteo(null),
      onFin: () => {
        setConteo(null)
        const toques = ctlRef.current ? ctlRef.current.toques.slice() : []
        const r = corregir(ej, toques, { latenciaMs: 0 })
        const tocadas = r.notas.filter((n) => n.estado !== 'falta').length
        setMedido(tocadas >= 6 ? { ms: r.desfaseMs } : { error: true })
        setFase('resultado')
      },
    })
  }

  const tocar = useCallback((marca) => {
    if (fase !== 'midiendo' || !ctlRef.current) return
    ctlRef.current.tomarToque(marca)
    setPulsado(true)
    setTimeout(() => setPulsado(false), 90)
  }, [fase])

  useEffect(() => {
    if (fase !== 'midiendo') return undefined
    const alTeclear = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tocar(e.timeStamp) } }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [fase, tocar])

  const cancelar = () => { if (ctlRef.current) ctlRef.current.parar(); setConteo(null); setFase('listo') }
  const guardar = () => { guardarLatencia(medido.ms); setGuardado(leerLatencia()); onCerrar() }
  const quitar = () => { borrarLatencia(); setGuardado(0) }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 210, background: '#F1EFE8', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px', borderBottom: '1px solid #E8E6DF', background: '#FFFFFF' }}>
        <button onClick={() => { if (ctlRef.current) ctlRef.current.parar(); onCerrar() }} title="Volver"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #D3D1C7', background: '#FFFFFF', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>Ajustar el retraso de tus toques</div>
      </div>

      <div style={{ flex: '1 1 auto', overflowY: 'auto', padding: '18px 16px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: '#5F5E5A', lineHeight: 1.55 }}>
            Entre que oís el pulso y tu toque llega a la app pasa un ratito (el parlante, los auriculares Bluetooth, la pantalla). Acá lo medimos para descontarlo y que no te baje el puntaje.
            <div style={{ marginTop: '8px' }}>Vas a oír un compás de conteo y 8 clics. <b>Tocá el botón justo con cada clic</b>, como si fuera una orquesta: no esperes a oírlo, tocá cuando sientas que cae.</div>
            <div style={{ marginTop: '8px', color: '#888780', fontSize: '12px' }}>Ajuste actual: <b>{guardado} ms</b>{guardado === 0 ? ' (ninguno)' : ''}</div>
          </div>

          {conteo != null && fase === 'midiendo' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {[1, 2, 3, 4].map((i) => (
                <div key={i} style={{ width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px', background: i <= conteo ? VERDE : '#EAE7DD', color: i <= conteo ? '#FFFFFF' : '#888780' }}>{i}</div>
              ))}
            </div>
          )}
          {fase === 'midiendo' && <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: VERDE }}>{conteo != null ? 'Contá y esperá…' : '¡Tocá con cada clic!'}</div>}

          {sinAudio && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#501313' }}>No pudimos activar el sonido. Revisá que el teléfono no esté en silencio.</div>}

          {fase === 'resultado' && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', textAlign: 'center' }}>
              {medido?.error ? (
                <div style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: 1.5 }}>No alcanzamos a medir (hacen falta al menos 6 toques cerca de los clics). Probá de nuevo.</div>
              ) : (
                <>
                  <div style={{ fontSize: '34px', fontWeight: 700, color: VERDE }}>{medido.ms > 0 ? '+' : ''}{medido.ms} ms</div>
                  <div style={{ fontSize: '13px', color: '#5F5E5A', lineHeight: 1.5, marginTop: '4px' }}>
                    {medido.ms > 20 ? 'Tus toques llegan después del clic. Lo vamos a descontar.' : medido.ms < -20 ? 'Tus toques llegan antes del clic (te adelantás). Lo vamos a compensar.' : 'Casi no hay retraso. ¡Muy bien!'}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ borderTop: '1px solid #E8E6DF', background: '#FFFFFF', padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          {fase === 'listo' && (
            <>
              <button onClick={empezar} style={{ ...boton(true), width: '100%' }}>▶ Empezar a medir</button>
              {guardado !== 0 && <button onClick={quitar} style={{ background: 'none', border: 'none', color: '#888780', fontSize: '12px', textDecoration: 'underline', cursor: 'pointer' }}>Quitar el ajuste</button>}
            </>
          )}
          {fase === 'midiendo' && (
            <>
              <button onPointerDown={(e) => { e.preventDefault(); tocar(e.nativeEvent.timeStamp) }} onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '132px', height: '132px', borderRadius: '50%', border: 'none', cursor: 'pointer', background: pulsado ? '#0A5441' : VERDE, color: '#FFFFFF', fontSize: '15px', fontWeight: 700,
                  boxShadow: pulsado ? 'inset 0 3px 8px rgba(0,0,0,0.3)' : '0 4px 12px rgba(15,110,86,0.35)', transform: pulsado ? 'scale(0.96)' : 'scale(1)', transition: 'transform 60ms',
                  touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
                }}>TOCÁ ACÁ</button>
              <button onClick={cancelar} style={{ background: 'none', border: 'none', color: '#888780', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
            </>
          )}
          {fase === 'resultado' && (
            <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
              <button onClick={empezar} style={boton(medido?.error)}>🔁 Medir de nuevo</button>
              {!medido?.error && <button onClick={guardar} style={boton(true)}>✓ Guardar</button>}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
