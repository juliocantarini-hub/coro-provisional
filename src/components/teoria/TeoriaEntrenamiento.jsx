import { useState } from 'react'
import BotonVolver from '../BotonVolver'
import LeccionTuVoz from './LeccionTuVoz'
import LeccionMapa from './LeccionMapa'
import LeccionPulso from './LeccionPulso'
import LeccionFiguras from './LeccionFiguras'
import LeccionClaves from './LeccionClaves'
import LeccionNotas from './LeccionNotas'
import LeccionAlteraciones from './LeccionAlteraciones'
import LeccionIntervalos from './LeccionIntervalos'
import { LECCIONES, COLOR_TEORIA, FONDO_TEORIA, BORDE_TEORIA } from '../../lib/teoria'

// "Entendé la partitura": lista de lecciones y la lección abierta.
const COMPONENTES = { 'tu-voz': LeccionTuVoz, mapa: LeccionMapa, pulso: LeccionPulso,
  figuras: LeccionFiguras, claves: LeccionClaves, notas: LeccionNotas, alteraciones: LeccionAlteraciones, intervalos: LeccionIntervalos,
}

export default function TeoriaEntrenamiento({ prog, voz, onSalir, onIrRitmo }) {
  const [abierta, setAbierta] = useState(null)

  if (abierta) {
    const Leccion = COMPONENTES[abierta]
    const n = LECCIONES.findIndex((l) => l.id === abierta) + 1
    const siguiente = LECCIONES[n] || null
    return (
      <div>
        <BotonVolver texto="Lecciones" onClick={() => setAbierta(null)} />
        <div style={{ fontSize: '12px', fontWeight: 600, color: COLOR_TEORIA, marginBottom: '6px' }}>Lección {n}</div>
        <Leccion key={abierta} voz={voz} onCompletar={() => prog.marcar(abierta)}
          siguiente={siguiente} onSiguiente={() => siguiente && setAbierta(siguiente.id)} onVolver={() => setAbierta(null)} onIrRitmo={onIrRitmo} />
      </div>
    )
  }

  return (
    <div>
      <BotonVolver texto="Entrenamiento" onClick={onSalir} />
      <div style={{ background: FONDO_TEORIA, border: `1px solid ${BORDE_TEORIA}`, borderRadius: '12px', padding: '10px 14px', marginBottom: '12px', fontSize: '13px', color: '#5B2350', lineHeight: 1.4 }}>
        Lecciones cortas para orientarte en la partitura. No hace falta saber leer música.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {LECCIONES.map((l, i) => {
          const vista = prog.vistas.includes(l.id)
          return (
            <div key={l.id} onClick={() => l.disponible && setAbierta(l.id)} style={{
              background: '#FFFFFF', border: `1px solid ${vista ? '#9FD9C5' : '#E8E6DF'}`, borderRadius: '12px',
              padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '12px',
              cursor: l.disponible ? 'pointer' : 'default', opacity: l.disponible ? 1 : 0.55,
            }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '13px', fontWeight: 700,
                background: vista ? '#DDF3E9' : l.disponible ? FONDO_TEORIA : '#F1EFE8',
                color: vista ? '#0F6E56' : l.disponible ? COLOR_TEORIA : '#888780',
              }}>{vista ? '✓' : i + 1}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{l.titulo}</div>
                <div style={{ fontSize: '12px', color: '#888780', lineHeight: 1.4 }}>{l.disponible ? l.descr : 'Próximamente'}</div>
              </div>
              {l.disponible && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9" style={{ flexShrink: 0 }}><path d="M8 5v14l11-7z" /></svg>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
