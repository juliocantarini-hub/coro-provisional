import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEventosAdmin, publicarEvento, eliminarEvento, formatFecha, formatHora } from '../../hooks/useEventos'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

const TIPO_COLOR = {
  ensayo:    { bg: '#E1F5EE', color: '#04342C' },
  concierto: { bg: '#FAECE7', color: '#712B13' },
  reunion:   { bg: '#E6F1FB', color: '#042C53' },
  extra:     { bg: '#F1EFE8', color: '#5F5E5A' },
}

async function enviarNotificacionEvento(titulo) {
  try {
    const coro = await getCoroActual()
    if (!coro) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: { coro_id: coro.id, titulo: `Nuevo evento: ${titulo}`, cuerpo: 'Revisá la fecha y confirmá tu asistencia', url: '/calendario' }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

function useEsMovil() {
  return window.innerWidth <= 768
}

export default function EventosLista() {
  const navigate = useNavigate()
  const { eventos, cargando, error, recargar } = useEventosAdmin()
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [procesando, setProcesando] = useState(null)
  const esMovil = useEsMovil()

  async function togglePublicar(ev) {
    setProcesando(ev.id)
    await publicarEvento(ev.id, !ev.publicado)
    if (!ev.publicado) {
      await enviarNotificacionEvento(ev.titulo)
    }
    await recargar()
    setProcesando(null)
  }

  async function handleEliminar(evId) {
    setProcesando(evId)
    await eliminarEvento(evId)
    setConfirmEliminar(null)
    await recargar()
    setProcesando(null)
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Gestión de eventos
          </h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${eventos.length} evento${eventos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => navigate('/admin/eventos/nuevo')}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo evento
        </button>
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>
          {error} <button onClick={recargar} style={{ color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '64px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {/* MÓVIL: tarjetas */}
      {!cargando && esMovil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {eventos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>No hay eventos aún.</div>
          )}
          {eventos.map(ev => {
            const tc = TIPO_COLOR[ev.tipo] || TIPO_COLOR.extra
            const confirmados = ev.asistencias?.filter(a => a.estado === 'confirmado').length || 0
            const total = ev.asistencias?.length || 0
            return (
              <div key={ev.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px', opacity: procesando === ev.id ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{ev.titulo}</div>
                    <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>
                      {formatFecha(ev.fecha_inicio, { corto: true })} · {formatHora(ev.fecha_inicio)}
                    </div>
                  </div>
                  <span style={{ background: tc.bg, color: tc.color, fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', flexShrink: 0, marginLeft: '8px', textTransform: 'capitalize' }}>
                    {ev.tipo}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '12px', color: confirmados > 0 ? '#0F6E56' : '#B4B2A9' }}>
                      {confirmados}/{total} asist.
                    </span>
                    <button onClick={() => togglePublicar(ev)} disabled={!!procesando}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: ev.publicado ? '#0F6E56' : '#D3D1C7', position: 'relative', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: '3px', left: ev.publicado ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s' }} />
                    </button>
                    <span style={{ fontSize: '11px', color: ev.publicado ? '#27500A' : '#888780' }}>
                      {ev.publicado ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => navigate(`/admin/eventos/${ev.id}`)}
                      style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                      Editar
                    </button>
                    <button onClick={() => setConfirmEliminar(ev)}
                      style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DESKTOP: tabla */}
      {!cargando && !esMovil && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px 90px 100px', gap: 0, padding: '10px 16px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Evento</span><span>Tipo</span><span>Fecha</span>
            <span style={{ textAlign: 'center' }}>Asistencias</span>
            <span style={{ textAlign: 'center' }}>Publicado</span>
            <span style={{ textAlign: 'right' }}>Acciones</span>
          </div>
          {eventos.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>No hay eventos aún.</div>
          )}
          {eventos.map((ev, i) => {
            const tc = TIPO_COLOR[ev.tipo] || TIPO_COLOR.extra
            const confirmados = ev.asistencias?.filter(a => a.estado === 'confirmado').length || 0
            const total = ev.asistencias?.length || 0
            return (
              <div key={ev.id} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 100px 90px 100px', gap: 0, padding: '12px 16px', alignItems: 'center', borderBottom: i < eventos.length - 1 ? '1px solid #F1EFE8' : 'none', opacity: procesando === ev.id ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{ev.titulo}</div>
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>{formatHora(ev.fecha_inicio)}{ev.lugar ? ` · ${ev.lugar}` : ''}</div>
                </div>
                <span style={{ background: tc.bg, color: tc.color, fontSize: '10px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px', textTransform: 'capitalize', display: 'inline-block' }}>{ev.tipo}</span>
                <span style={{ fontSize: '12px', color: '#5F5E5A' }}>{formatFecha(ev.fecha_inicio, { corto: true })}</span>
                <div style={{ textAlign: 'center', fontSize: '12px', color: confirmados > 0 ? '#0F6E56' : '#B4B2A9', fontWeight: '500' }}>{confirmados}/{total}</div>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => togglePublicar(ev)} disabled={!!procesando}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: procesando ? 'not-allowed' : 'pointer', background: ev.publicado ? '#0F6E56' : '#D3D1C7', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '3px', left: ev.publicado ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => navigate(`/admin/eventos/${ev.id}`)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>Editar</button>
                  <button onClick={() => setConfirmEliminar(ev)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px 24px', maxWidth: '360px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 10px' }}>Eliminar evento</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: '1.6', margin: '0 0 24px' }}>
              ¿Eliminás <strong>"{confirmEliminar.titulo}"</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={() => handleEliminar(confirmEliminar.id)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: 'none', background: '#A32D2D', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}