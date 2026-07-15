import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useEventos, formatHora, diasRestantes } from '../hooks/useEventos'
import { useObras } from '../hooks/useObras'
import { useAvisos, tiempoRelativo, TIPO_AVISO } from '../hooks/useAvisos'
import { useArticulos } from '../hooks/useBlog'
import MisPagos from '../components/MisPagos'
import EncuestaDashboard from '../components/EncuestaDashboard'

const ORDEN_ESTADO = { concierto: 0, activo: 1, estudio: 2 }

export default function Inicio() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const { eventos } = useEventos({ soloFuturos: true })
  const { obras }   = useObras()
  const { avisos, noLeidos } = useAvisos()
  const { articulos } = useArticulos({ limite: 3 })

  const proximoEvento = eventos[0]
  const avisosRecientes = avisos.slice(0, 3)
  const diasProx = proximoEvento ? diasRestantes(proximoEvento.fecha_inicio) : null

  const obrasEstudio = [...obras]
    .filter(o => o.estado === 'estudio' || o.estado === 'concierto' || o.estado === 'activo')
    .sort((a, b) => {
      const oa = ORDEN_ESTADO[a.estado] ?? 99
      const ob = ORDEN_ESTADO[b.estado] ?? 99
      if (oa !== ob) return oa - ob
      return (a.orden ?? 0) - (b.orden ?? 0)
    })
    .slice(0, 3)

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    }
  }, [])

  return (
    <div>
      {/* MisPagos arriba — solo si hay alerta (después del día 15 con cuota pendiente) */}
      <MisPagos posicion="arriba" />

      {/* Banner de bienvenida */}
      <div style={{
        background: 'linear-gradient(135deg, #0A4A3A 0%, #0F6E56 100%)',
        borderRadius: '16px', padding: '22px 24px', marginBottom: '20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px',
      }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#FFFFFF', margin: '0 0 4px' }}>
            Hola, {perfil?.nombre?.split(' ')[0] || 'bienvenida/o'} 👋
          </h2>
          <p style={{ fontSize: '13px', color: 'rgba(159,225,203,0.8)', margin: 0, textTransform: 'capitalize' }}>
            {perfil?.voz ? `${perfil.voz} · ${import.meta.env.VITE_CORO_NOMBRE || 'Plataforma coral'}` : 'Plataforma de estudio coral'}
          </p>
        </div>
        {proximoEvento && (
          <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: '12px', padding: '12px 16px', textAlign: 'center', minWidth: '140px' }}>
            <div style={{ fontSize: '10px', color: 'rgba(159,225,203,0.7)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
              {diasProx === 0 ? '¡Hoy!' : diasProx === 1 ? 'Mañana' : `En ${diasProx} días`}
            </div>
            <div style={{ fontSize: '14px', fontWeight: '500', color: '#FFFFFF' }}>{proximoEvento.titulo}</div>
            <div style={{ fontSize: '12px', color: 'rgba(159,225,203,0.7)', marginTop: '2px' }}>
              {formatHora(proximoEvento.fecha_inicio)}
              {proximoEvento.lugar && ` · ${proximoEvento.lugar}`}
            </div>
            <button onClick={() => navigate(`/calendario/${proximoEvento.id}`)}
              style={{ marginTop: '8px', fontSize: '11px', color: '#FFFFFF', background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '500' }}>
              Ver detalle →
            </button>
          </div>
        )}
      </div>

      {/* Stats rápidas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
        <StatCard val={obras.length} label="Obras en repertorio" color="#0F6E56" bg="#E1F5EE" onClick={() => navigate('/repertorio')} />
        <StatCard val={noLeidos} label={noLeidos === 1 ? 'Aviso sin leer' : 'Avisos sin leer'} color={noLeidos > 0 ? '#D85A30' : '#888780'} bg={noLeidos > 0 ? '#FAECE7' : '#F1EFE8'} onClick={() => navigate('/avisos')} />
        <StatCard val={eventos.length} label="Eventos próximos" color="#378ADD" bg="#E6F1FB" onClick={() => navigate('/calendario')} />
      </div>

      {/* Encuesta activa — solo aparece si hay una encuesta abierta */}
      <EncuestaDashboard esAdmin={false} />

      <div style={{ display: 'grid', gridTemplateColumns: window.innerWidth <= 768 ? '1fr' : '1fr 1fr', gap: '16px' }}>
        <Seccion titulo="Estudia esta semana" linkLabel="Ver todo" onLink={() => navigate('/repertorio')}>
          {obrasEstudio.length === 0 ? <Vacio texto="No hay obras activas." /> : obrasEstudio.map(obra => (
            <ItemObra key={obra.id} obra={obra} onClick={() => navigate(`/repertorio/${obra.id}`)} vozUsuario={perfil?.voz} />
          ))}
        </Seccion>

        <Seccion titulo="Últimos avisos" linkLabel="Ver todos" onLink={() => navigate('/avisos')}>
          {avisosRecientes.length === 0 ? <Vacio texto="Sin avisos recientes." /> : avisosRecientes.map(aviso => (
            <ItemAviso key={aviso.id} aviso={aviso} onClick={() => navigate("/avisos")} />
          ))}
        </Seccion>

        <Seccion titulo="Próximos eventos" linkLabel="Ver calendario" onLink={() => navigate('/calendario')}>
          {eventos.length === 0 ? <Vacio texto="No hay eventos próximos." /> : eventos.slice(0, 3).map(ev => (
            <ItemEvento key={ev.id} evento={ev} onClick={() => navigate(`/calendario/${ev.id}`)} />
          ))}
        </Seccion>

        <Seccion titulo="Textos" linkLabel="Ver textos" onLink={() => navigate('/blog')}>
          {articulos.length === 0 ? <Vacio texto="No hay textos aún." /> : articulos.map(art => (
            <ItemBlog key={art.id} articulo={art} onClick={() => navigate(`/blog/${art.id}`)} />
          ))}
        </Seccion>
      </div>

      {/* MisPagos abajo — cuando no hay alerta */}
      <div style={{ marginTop: '16px' }}>
        <MisPagos posicion="abajo" />
      </div>
    </div>
  )
}

function StatCard({ val, label, color, bg, onClick }) {
  return (
    <div onClick={onClick} style={{ background: bg, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}>
      <div style={{ fontSize: '28px', fontWeight: '600', color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: '12px', color, opacity: 0.8, marginTop: '4px' }}>{label}</div>
    </div>
  )
}

function Seccion({ titulo, linkLabel, onLink, children }) {
  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>{titulo}</h3>
        <button onClick={onLink} style={{ fontSize: '12px', color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>{linkLabel} →</button>
      </div>
      {children}
    </div>
  )
}

function Vacio({ texto }) {
  return <p style={{ fontSize: '13px', color: '#B4B2A9', textAlign: 'center', padding: '16px 0', margin: 0 }}>{texto}</p>
}

function ItemObra({ obra, onClick, vozUsuario }) {
  const tieneAudio = vozUsuario && !!obra[`drive_audio_${vozUsuario}`]
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F1EFE8', cursor: 'pointer' }}>
      <div style={{ width: '34px', height: '34px', borderRadius: '7px', background: obra.estado === 'concierto' ? '#FAECE7' : '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill={obra.estado === 'concierto' ? '#D85A30' : '#1D9E75'}>
          <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
        </svg>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{obra.titulo}</div>
        <div style={{ fontSize: '11px', color: '#888780' }}>{obra.compositor}</div>
      </div>
      {tieneAudio && <span style={{ fontSize: '10px', color: '#D85A30', fontWeight: '600', flexShrink: 0 }}>🎵 Tu voz</span>}
      {obra.progreso === 'estudiada' && <span style={{ fontSize: '10px', color: '#639922', flexShrink: 0 }}>✓</span>}
    </div>
  )
}

function ItemAviso({ aviso, onClick }) {
  const tc = TIPO_AVISO[aviso.tipo] || TIPO_AVISO.material
  return (
    <div onClick={onClick} style={{ padding: '8px 0', borderBottom: '1px solid #F1EFE8', display: 'flex', gap: '8px', alignItems: 'flex-start', cursor: 'pointer' }}>
      <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: aviso.leido ? '#D3D1C7' : tc.dot, marginTop: '5px', flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: aviso.leido ? '400' : '500', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{aviso.titulo}</div>
        <div style={{ fontSize: '11px', color: '#B4B2A9', marginTop: '2px' }}>{tiempoRelativo(aviso.creado_en)}</div>
      </div>
    </div>
  )
}

function ItemEvento({ evento, onClick }) {
  const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
  const fecha = new Date(evento.fecha_inicio)
  const TIPO_BG = { ensayo: '#E1F5EE', concierto: '#FAECE7', reunion: '#E6F1FB', extra: '#F1EFE8' }
  const TIPO_COLOR = { ensayo: '#04342C', concierto: '#712B13', reunion: '#042C53', extra: '#5F5E5A' }
  return (
    <div onClick={onClick} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F1EFE8', cursor: 'pointer', alignItems: 'center' }}>
      <div style={{ width: '38px', textAlign: 'center', background: TIPO_BG[evento.tipo] || '#F1EFE8', borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
        <div style={{ fontSize: '16px', fontWeight: '600', color: TIPO_COLOR[evento.tipo] || '#5F5E5A', lineHeight: 1 }}>{fecha.getDate()}</div>
        <div style={{ fontSize: '9px', color: TIPO_COLOR[evento.tipo] || '#5F5E5A', textTransform: 'uppercase' }}>{MESES[fecha.getMonth()]}</div>
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{evento.titulo}</div>
        <div style={{ fontSize: '11px', color: '#888780' }}>{formatHora(evento.fecha_inicio)}{evento.lugar ? ` · ${evento.lugar}` : ''}</div>
      </div>
    </div>
  )
}

function ItemBlog({ articulo, onClick }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F1EFE8', cursor: 'pointer', alignItems: 'center' }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="#B4B2A9" style={{ flexShrink: 0 }}>
        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
      </svg>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{articulo.titulo}</div>
        <div style={{ fontSize: '11px', color: '#888780' }}>{new Date(articulo.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</div>
      </div>
    </div>
  )
}