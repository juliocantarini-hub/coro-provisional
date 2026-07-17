import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useEvento, confirmarAsistencia, formatFecha, formatHora, esFuturo } from '../../hooks/useEventos'
import { useAuth } from '../../hooks/useAuth'
import { descargarICS } from '../../lib/ics'

const TIPO_COLOR = {
  ensayo:    { bg: '#E1F5EE', color: '#04342C', dot: '#1D9E75' },
  concierto: { bg: '#FAECE7', color: '#712B13', dot: '#D85A30' },
  reunion:   { bg: '#E6F1FB', color: '#042C53', dot: '#378ADD' },
  extra:     { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780' },
}

const ASISTENCIA_OPTS = [
  { valor: 'confirmado', label: 'Asistiré',    emoji: '✓', bg: '#EAF3DE', color: '#27500A', border: '#639922' },
  { valor: 'no_asiste',  label: 'No podré ir', emoji: '✕', bg: '#FCEBEB', color: '#501313', border: '#E24B4A' },
  { valor: 'pendiente',  label: 'Aún no sé',   emoji: '?', bg: '#F1EFE8', color: '#888780', border: '#D3D1C7' },
]

export default function EventoDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { usuario, perfil, esAdmin, esDirector } = useAuth()
  const { evento, cargando, error, recargar } = useEvento(id)

  const [asistencia, setAsistencia] = useState('pendiente')
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState('')
  const [tabAdmin, setTabAdmin]     = useState('info')

  useEffect(() => {
    if (!evento || !perfil) return
    const mia = evento.asistencias?.find(a => a.perfil_id === perfil.id)
    setAsistencia(mia?.estado || 'pendiente')
  }, [evento, perfil])

  async function handleAsistencia(nuevoEstado) {
    if (!usuario || guardando) return
    setGuardando(true)
    const { ok } = await confirmarAsistencia(id, perfil.id, nuevoEstado)
    if (ok) {
      setAsistencia(nuevoEstado)
      const msgs = { confirmado: '¡Asistencia confirmada!', no_asiste: 'Registrado que no podés asistir.', pendiente: 'Quedó como pendiente.' }
      setMensaje(msgs[nuevoEstado])
      setTimeout(() => setMensaje(''), 3000)
      await recargar()
    }
    setGuardando(false)
  }

  if (cargando) {
    return (
      <div>
        <div style={{ height: '20px', width: '100px', background: '#F1EFE8', borderRadius: '6px', marginBottom: '20px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        {[1,2,3].map(i => <div key={i} style={{ height: '80px', background: '#F1EFE8', borderRadius: '12px', marginBottom: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      </div>
    )
  }

  if (error || !evento) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <p style={{ color: '#A32D2D', marginBottom: '16px' }}>{error || 'Evento no encontrado.'}</p>
        <button onClick={() => navigate('/calendario')} style={{ color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
          ← Volver al calendario
        </button>
      </div>
    )
  }

  const tc = TIPO_COLOR[evento.tipo] || TIPO_COLOR.extra
  const futuro = esFuturo(evento.fecha_inicio)
  const totalAsist  = evento.asistencias?.length || 0
  const confirmados = evento.asistencias?.filter(a => a.estado === 'confirmado').length || 0
  const noAsisten   = evento.asistencias?.filter(a => a.estado === 'no_asiste').length || 0
  const pendientes  = evento.asistencias?.filter(a => a.estado === 'pendiente').length || 0

  return (
    <div>
      <button onClick={() => navigate('/calendario')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Volver al calendario
      </button>

      {/* Cabecera */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '14px', padding: '22px', marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
          <div style={{ background: tc.bg, borderRadius: '12px', padding: '12px 10px', textAlign: 'center', flexShrink: 0, minWidth: '56px' }}>
            <div style={{ fontSize: '24px', fontWeight: '600', color: tc.color, lineHeight: 1 }}>
              {new Date(evento.fecha_inicio).getDate()}
            </div>
            <div style={{ fontSize: '11px', color: tc.color, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '3px' }}>
              {new Date(evento.fecha_inicio).toLocaleDateString('es-AR', { month: 'short' })}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
              <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
                {evento.titulo}
              </h2>
              <span style={{ fontSize: '11px', background: tc.bg, color: tc.color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize' }}>
                {evento.tipo}
              </span>
            </div>
            <div style={{ fontSize: '13px', color: '#5F5E5A', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <span>
                🕐 {formatFecha(evento.fecha_inicio, { conDia: true })} · {formatHora(evento.fecha_inicio)}
                {evento.fecha_fin && ` – ${formatHora(evento.fecha_fin)}`}
              </span>
              {evento.lugar && (
                
                <a 
                  href={'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(evento.direccion || evento.lugar)}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#0F6E56', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}
                >
                  📍 {evento.lugar}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="#0F6E56">
                    <path d="M19 19H5V5h7V3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z"/>
                  </svg>
                </a>
              )}
              {evento.direccion && <span style={{ fontSize: '12px', color: '#888780' }}>{evento.direccion}</span>}
            </div>
            <button onClick={() => descargarICS(evento)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginTop: '10px', padding: '6px 12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#0F6E56', fontSize: '12px', fontWeight: '500', cursor: 'pointer' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zm-7-7h5v5h-5z"/></svg>
              Exportar a tu calendario personal
            </button>
            <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '5px 0 0', lineHeight: '1.4' }}>
              Se descarga un archivo del evento. Abrilo desde tus descargas y elegí tu app de calendario (Google, Apple, Outlook) para agregarlo automáticamente.
            </p>
          </div>
        </div>
      </div>

      {/* Tabs admin */}
      {(esAdmin || esDirector) && (
        <div style={{ display: 'flex', borderBottom: '1px solid #E8E6DF', marginBottom: '14px' }}>
          {['info', 'asistencias'].map(tab => (
            <button key={tab} onClick={() => setTabAdmin(tab)} style={{
              padding: '8px 16px', fontSize: '13px', cursor: 'pointer',
              background: 'none', border: 'none',
              borderBottom: `2px solid ${tabAdmin === tab ? '#0F6E56' : 'transparent'}`,
              color: tabAdmin === tab ? '#0F6E56' : '#888780',
              fontWeight: tabAdmin === tab ? '500' : '400',
              marginBottom: '-1px',
            }}>
              {tab === 'info' ? 'Información' : `Asistencias (${confirmados}/${totalAsist})`}
            </button>
          ))}
        </div>
      )}

      {/* Tab: Info */}
      {(!esAdmin && !esDirector || tabAdmin === 'info') && (
        <>
          {futuro && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
                Tu asistencia
              </h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ASISTENCIA_OPTS.map(op => (
                  <button key={op.valor} onClick={() => handleAsistencia(op.valor)} disabled={guardando}
                    style={{ flex: 1, minWidth: '100px', padding: '10px 12px', borderRadius: '10px', cursor: guardando ? 'not-allowed' : 'pointer', border: `1.5px solid ${asistencia === op.valor ? op.border : '#D3D1C7'}`, background: asistencia === op.valor ? op.bg : '#FFFFFF', color: asistencia === op.valor ? op.color : '#888780', fontSize: '13px', fontWeight: asistencia === op.valor ? '600' : '400', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '16px', marginBottom: '2px' }}>{op.emoji}</div>
                    {op.label}
                  </button>
                ))}
              </div>
              {mensaje && (
                <div style={{ marginTop: '10px', fontSize: '12px', color: '#27500A', background: '#EAF3DE', padding: '7px 10px', borderRadius: '7px' }}>
                  {mensaje}
                </div>
              )}
            </div>
          )}

          {evento.eventos_obras?.length > 0 && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
                Repertorio previsto
              </h3>
              {evento.eventos_obras.sort((a, b) => a.orden - b.orden).map(eo => eo.obras && (
                <div key={eo.obra_id} onClick={() => navigate(`/repertorio/${eo.obra_id}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F1EFE8', cursor: 'pointer' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="#1D9E75"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{eo.obras.titulo}</div>
                    <div style={{ fontSize: '11px', color: '#888780' }}>{eo.obras.compositor}</div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="#D3D1C7"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
                </div>
              ))}
            </div>
          )}

          {evento.notas && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px', marginBottom: '14px' }}>
              <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }}>
                Notas logísticas
              </h3>
              <p style={{ fontSize: '13px', color: '#5F5E5A', lineHeight: '1.6', margin: 0 }}>{evento.notas}</p>
            </div>
          )}
        </>
      )}

      {/* Tab: Asistencias */}
      {(esAdmin || esDirector) && tabAdmin === 'asistencias' && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '18px' }}>
            {[
              { label: 'Confirman',  val: confirmados, bg: '#EAF3DE', color: '#27500A' },
              { label: 'No asisten', val: noAsisten,   bg: '#FCEBEB', color: '#501313' },
              { label: 'Pendientes', val: pendientes,  bg: '#F1EFE8', color: '#888780' },
            ].map(s => (
              <div key={s.label} style={{ background: s.bg, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', fontWeight: '600', color: s.color }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: s.color, marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
          {evento.asistencias?.length === 0 && (
            <p style={{ fontSize: '13px', color: '#888780', textAlign: 'center', padding: '16px' }}>Nadie confirmó asistencia aún.</p>
          )}
          {evento.asistencias?.sort((a, b) => (a.perfiles?.nombre || '').localeCompare(b.perfiles?.nombre || '')).map(a => {
            const map = { confirmado: { bg: '#EAF3DE', color: '#27500A', txt: 'Confirma' }, no_asiste: { bg: '#FCEBEB', color: '#501313', txt: 'No asiste' }, pendiente: { bg: '#F1EFE8', color: '#888780', txt: 'Pendiente' } }
            const s = map[a.estado] || map.pendiente
            return (
              <div key={a.perfil_id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid #F1EFE8' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{a.perfiles?.nombre || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize' }}>{a.perfiles?.voz || '—'}</div>
                </div>
                <span style={{ fontSize: '11px', background: s.bg, color: s.color, padding: '3px 10px', borderRadius: '8px', fontWeight: '500' }}>{s.txt}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}