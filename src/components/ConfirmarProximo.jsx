import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { confirmarAsistencia, formatHora } from '../hooks/useEventos'

// Tarjeta de Inicio: "¿Venís al ensayo de mañana?" para el próximo ensayo o evento
// que empieza en las próximas 48 horas. Se responde con un toque y se puede cambiar
// hasta que empiece.
const VENTANA_MS = 48 * 60 * 60 * 1000

function cuando(fecha) {
  const d = new Date(fecha)
  const hoy = new Date()
  const manana = new Date(); manana.setDate(hoy.getDate() + 1)
  if (d.toDateString() === hoy.toDateString()) return 'hoy'
  if (d.toDateString() === manana.toDateString()) return 'mañana'
  return 'el ' + d.toLocaleDateString('es-AR', { weekday: 'long' })
}

export default function ConfirmarProximo({ eventos, perfil }) {
  const navigate = useNavigate()
  const ahora = Date.now()
  const evento = (eventos || []).find(e => {
    const t = new Date(e.fecha_inicio).getTime()
    return t > ahora && t - ahora <= VENTANA_MS
  })
  const inicial = evento?.asistencias?.find(a => a.perfil_id === perfil?.id)?.estado || 'pendiente'
  const [estado, setEstado] = useState(inicial)
  const [cambiando, setCambiando] = useState(false)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => { setEstado(inicial); setCambiando(false) }, [evento?.id, inicial])

  if (!evento || !perfil) return null

  async function responder(nuevo) {
    setGuardando(true)
    const { ok } = await confirmarAsistencia(evento.id, perfil.id, nuevo)
    setGuardando(false)
    if (ok) { setEstado(nuevo); setCambiando(false) }
  }

  const esEnsayo = evento.tipo === 'ensayo'
  const nombre = esEnsayo ? `al ensayo de ${cuando(evento.fecha_inicio)}` : `a ${evento.titulo}`
  const detalle = `${esEnsayo ? '' : cuando(evento.fecha_inicio).replace(/^./, c => c.toUpperCase()) + ' · '}${formatHora(evento.fecha_inicio)}${evento.lugar ? ` · ${evento.lugar}` : ''}`
  const respondio = estado === 'confirmado' || estado === 'no_asiste'

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderLeft: `4px solid ${estado === 'no_asiste' ? '#E24B4A' : '#1D9E75'}`, borderRadius: '14px', padding: '14px 16px', marginBottom: '16px' }}>
      {respondio && !cambiando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '180px' }}>
            <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A18' }}>
              {estado === 'confirmado' ? `✓ Confirmaste que vas ${nombre}` : `Avisaste que no vas ${nombre}`}
            </div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{detalle}</div>
          </div>
          <button onClick={() => setCambiando(true)}
            style={{ fontSize: '12px', color: '#0F6E56', background: 'none', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: '500' }}>
            Cambiar
          </button>
        </div>
      ) : (
        <div>
          <div onClick={() => navigate(`/calendario/${evento.id}`)} style={{ cursor: 'pointer' }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1A18' }}>¿Venís {nombre}?</div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{detalle}</div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => responder('confirmado')} disabled={guardando}
              style={{ flex: 1, height: '42px', borderRadius: '10px', border: '1.5px solid #639922', background: estado === 'confirmado' ? '#EAF3DE' : '#FFFFFF', color: '#27500A', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              ✓ Voy
            </button>
            <button onClick={() => responder('no_asiste')} disabled={guardando}
              style={{ flex: 1, height: '42px', borderRadius: '10px', border: '1.5px solid #E24B4A', background: estado === 'no_asiste' ? '#FCEBEB' : '#FFFFFF', color: '#501313', fontSize: '14px', fontWeight: '600', cursor: 'pointer' }}>
              ✕ No puedo
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
