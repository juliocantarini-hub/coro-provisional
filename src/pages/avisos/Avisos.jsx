import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import {
  useAvisos, marcarLeido, marcarTodosLeidos,
  tiempoRelativo, TIPO_AVISO
} from '../../hooks/useAvisos'
import { useEncuesta } from '../../hooks/useEncuestas'
import EncuestaWidget from '../../components/EncuestaWidget'

const FILTROS = [
  { valor: '',         label: 'Todos' },
  { valor: 'material', label: 'Nuevo material' },
  { valor: 'horario',  label: 'Cambio de horario' },
  { valor: 'evento',   label: 'Evento' },
  { valor: 'urgente',  label: 'Urgente' },
  { valor: 'encuesta', label: 'Encuesta' },
  { valor: 'general',  label: 'General' },
]

function compartirWhatsApp(aviso, e) {
  e.stopPropagation()
  const texto = `📢 *${aviso.titulo}*${aviso.cuerpo ? '\n\n' + aviso.cuerpo : ''}`
  window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank')
}

export default function Avisos() {
  const navigate       = useNavigate()
  const { perfil }     = useAuth()
  const [tipo, setTipo] = useState('')
  const [avisoAbierto, setAvisoAbierto] = useState(null)
  const { avisos, cargando, error, noLeidos, recargar } = useAvisos({ tipo: tipo || undefined })

  async function handleAbrir(aviso) {
    if (!aviso.leido && perfil) {
      await marcarLeido(aviso.id, perfil.id)
      recargar()
    }
    setAvisoAbierto(avisoAbierto?.id === aviso.id ? null : aviso)
  }

  async function handleMarcarTodos() {
    if (!perfil) return
    const ids = avisos.filter(a => !a.leido).map(a => a.id)
    await marcarTodosLeidos(ids, perfil.id)
    recargar()
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Avisos
          </h2>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            {noLeidos > 0
              ? <span style={{ color: '#D85A30', fontWeight: '500' }}>{noLeidos} sin leer</span>
              : 'Todo al día'
            }
          </p>
        </div>
        {noLeidos > 0 && (
          <button onClick={handleMarcarTodos}
            style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', border: '1px solid #B4D8CE', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', fontWeight: '500' }}>
            Marcar todos como leídos
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {FILTROS.map(f => (
          <button key={f.valor} onClick={() => setTipo(f.valor)} style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${tipo === f.valor ? '#1D9E75' : '#D3D1C7'}`,
            background: tipo === f.valor ? '#E1F5EE' : 'none',
            color: tipo === f.valor ? '#04342C' : '#5F5E5A',
            fontWeight: tipo === f.valor ? '500' : '400',
          }}>
            {f.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontWeight: '500', fontSize: '12px' }}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3,4].map(i => (
            <div key={i} style={{ height: '80px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && avisos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: '#888780' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="#D3D1C7" style={{ marginBottom: '14px' }}>
            <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
          </svg>
          <p style={{ fontSize: '14px', margin: '0 0 8px' }}>No hay avisos todavía.</p>
        </div>
      )}

      {!cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {avisos.map(aviso => (
            <AvisoCard
              key={aviso.id}
              aviso={aviso}
              estaAbierto={avisoAbierto?.id === aviso.id}
              onAbrir={() => handleAbrir(aviso)}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AvisoCard({ aviso, estaAbierto, onAbrir, navigate }) {
  const tc = TIPO_AVISO[aviso.tipo] || TIPO_AVISO.material
  const { encuesta, resultados, miVoto, votar } = useEncuesta(estaAbierto ? aviso.id : null)

  const obras = aviso.avisos_obras?.map(ao => ao.obras).filter(Boolean) || []
  const eventos = aviso.avisos_eventos?.map(ae => ae.eventos).filter(Boolean) || []

  return (
    <div style={{
      background: '#FFFFFF',
      border: `1px solid ${aviso.leido ? '#E8E6DF' : '#B4D8CE'}`,
      borderLeft: `3px solid ${aviso.leido ? '#E8E6DF' : tc.dot}`,
      borderRadius: '10px',
      overflow: 'hidden',
      opacity: aviso.leido && !estaAbierto ? 0.75 : 1,
      transition: 'border-color 0.12s',
    }}>
      <div onClick={onAbrir} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '10px', fontWeight: '700', color: tc.color, background: tc.bg, padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase', letterSpacing: '0.3px' }}>
              {tc.label}
            </span>
            {!aviso.leido && (
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: tc.dot, display: 'inline-block', flexShrink: 0 }} />
            )}
            <span style={{ fontSize: '11px', color: '#B4B2A9', marginLeft: 'auto' }}>
              {tiempoRelativo(aviso.creado_en)}
            </span>
          </div>
          <div style={{ fontSize: '14px', fontWeight: aviso.leido ? '400' : '500', color: '#1A1A18' }}>
            {aviso.titulo}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9"
          style={{ transform: estaAbierto ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>

      {estaAbierto && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid #F1EFE8' }}>
          {aviso.cuerpo && (
            <p style={{ fontSize: '13px', color: '#5F5E5A', margin: '12px 0 10px', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>
              {aviso.cuerpo}
            </p>
          )}

          <button onClick={e => compartirWhatsApp(aviso, e)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#128C7E', background: '#E7F8F2', border: 'none', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer', fontWeight: '500', marginBottom: '10px' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="#128C7E"><path d="M12.04 2c-5.46 0-9.91 4.45-9.91 9.91 0 1.75.46 3.45 1.32 4.95L2.05 22l5.25-1.38c1.45.79 3.08 1.21 4.74 1.21 5.46 0 9.91-4.45 9.91-9.91S17.5 2 12.04 2zm5.83 14.02c-.24.68-1.42 1.32-1.96 1.4-.5.08-1.14.11-1.84-.12-.42-.13-.97-.31-1.67-.61-2.93-1.27-4.85-4.22-5-4.42-.15-.2-1.19-1.58-1.19-3.02s.75-2.14 1.02-2.44c.27-.29.58-.36.78-.36.2 0 .39 0 .56.01.18.01.42-.07.65.5.24.58.82 2.01.89 2.15.07.15.12.32.02.51-.1.2-.15.32-.29.49-.15.17-.31.38-.44.51-.15.15-.3.31-.13.6.17.29.75 1.24 1.61 2 1.11.99 2.04 1.3 2.33 1.44.29.15.46.13.63-.08.17-.2.72-.84.91-1.13.19-.29.39-.24.65-.15.27.1 1.68.79 1.97.94.29.15.48.22.55.34.07.13.07.75-.17 1.43z"/></svg>
            Compartir por WhatsApp
          </button>

          {obras.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              {obras.map(o => (
                <button key={o.id} onClick={e => { e.stopPropagation(); navigate(`/repertorio/${o.id}`) }}
                  style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', border: 'none', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', marginRight: '6px', marginBottom: '4px' }}>
                  {o.titulo} →
                </button>
              ))}
            </div>
          )}

          {eventos.length > 0 && (
            <div style={{ marginBottom: '8px' }}>
              {eventos.map(e => (
                <button key={e.id} onClick={ev => { ev.stopPropagation(); navigate(`/calendario/${e.id}`) }}
                  style={{ fontSize: '12px', color: '#378ADD', background: '#E6F1FB', border: 'none', padding: '3px 10px', borderRadius: '6px', cursor: 'pointer', fontWeight: '500', marginRight: '6px', marginBottom: '4px' }}>
                  {e.titulo} →
                </button>
              ))}
            </div>
          )}

          {encuesta && (
            <EncuestaWidget
              encuesta={encuesta}
              resultados={resultados}
              miVoto={miVoto}
              votar={votar}
            />
          )}
        </div>
      )}
    </div>
  )
}
