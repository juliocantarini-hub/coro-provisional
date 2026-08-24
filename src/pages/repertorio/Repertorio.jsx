import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useObras } from '../../hooks/useObras'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'

const ESTADOS = [
  { valor: '',          label: 'Todas' },
  { valor: 'concierto', label: 'Próximo ensayo' },
  { valor: 'estudio',   label: 'En estudio' },
  { valor: 'activo',    label: 'Repertorio activo' },
]

const BADGE = {
  estudio:   { bg: '#E1F5EE', color: '#04342C', txt: 'En estudio' },
  activo:    { bg: '#EAF3DE', color: '#27500A', txt: 'Repertorio activo' },
  concierto: { bg: '#FAECE7', color: '#712B13', txt: 'Próximo ensayo' },
  archivado: { bg: '#F1EFE8', color: '#888780', txt: 'Archivado' },
}

const ORDEN_ESTADO = { concierto: 0, estudio: 1, activo: 2, archivado: 3 }

function Badge({ estado }) {
  const b = BADGE[estado] || BADGE.archivado
  return (
    <span style={{
      background: b.bg, color: b.color,
      fontSize: '10px', fontWeight: '600',
      padding: '2px 8px', borderRadius: '10px',
      textTransform: 'uppercase', letterSpacing: '0.3px',
    }}>
      {b.txt}
    </span>
  )
}

function MatIcon({ tiene, title }) {
  return (
    <span title={title} style={{
      width: '22px', height: '22px', borderRadius: '4px',
      background: tiene ? '#E1F5EE' : '#F1EFE8',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    }}>
      {tiene
        ? <svg width="12" height="12" viewBox="0 0 24 24" fill="#0F6E56"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/></svg>
        : <svg width="12" height="12" viewBox="0 0 24 24" fill="#D3D1C7"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>
      }
    </span>
  )
}

function useDedicacion(usuarioId, obras) {
  const [porcentaje, setPorcentaje] = useState(null)

  useEffect(() => {
    if (!usuarioId || !obras || obras.length === 0) return
    const obraIds = obras.map(o => o.id)
    const totalObras = obraIds.length
    async function cargar() {
      const { data } = await supabase
        .from('actividad_estudio')
        .select('obra_id')
        .eq('usuario_id', usuarioId)
        .eq('tipo', 'apertura')
        .in('obra_id', obraIds)
      if (!data) return
      const obrasUnicas      = new Set(data.map(a => a.obra_id))
      const pctCobertura      = (obrasUnicas.size / totalObras) * 100
      const promedioAperturas = obrasUnicas.size > 0 ? data.length / obrasUnicas.size : 0
      const pctFrecuencia     = Math.min((promedioAperturas / 30) * 100, 100)
      setPorcentaje(Math.min(100, Math.round((pctCobertura + pctFrecuencia) / 2)))
    }
    cargar()
  }, [usuarioId, obras])

  return porcentaje
}

export default function Repertorio() {
  const navigate = useNavigate()
  const { perfil } = useAuth()
  const [busqueda, setBusqueda] = useState('')
  const [estadoFiltro, setEstadoFiltro] = useState('')

  const { obras, cargando, error, recargar } = useObras({
    estado: estadoFiltro || undefined,
    busqueda: busqueda || undefined,
  })

  const obrasFiltradas = useMemo(() => {
    return [...obras].sort((a, b) => {
      const oa = ORDEN_ESTADO[a.estado] ?? 99
      const ob = ORDEN_ESTADO[b.estado] ?? 99
      return oa - ob
    })
  }, [obras])

  const dedicacion = useDedicacion(perfil?.id, obras)

  const colorDedicacion = dedicacion === null ? '#888780'
    : dedicacion >= 70 ? '#27500A'
    : dedicacion >= 40 ? '#D85A30'
    : '#E24B4A'

  const bgDedicacion = dedicacion === null ? '#F1EFE8'
    : dedicacion >= 70 ? '#EAF3DE'
    : dedicacion >= 40 ? '#FAECE7'
    : '#FCEBEB'

  return (
    <div>
      <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 4px' }}>
            Repertorio
          </h2>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${obrasFiltradas.length} obra${obrasFiltradas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        {dedicacion !== null && (
          <div style={{ background: bgDedicacion, border: `1px solid ${colorDedicacion}22`, borderRadius: '10px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', color: '#5F5E5A' }}>Tu dedicación al estudio:</span>
            <span style={{ fontSize: '15px', fontWeight: '700', color: colorDedicacion }}>{dedicacion}%</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', gap: '10px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9"
            style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input type="text" placeholder="Buscar por título o compositor..."
            value={busqueda} onChange={e => setBusqueda(e.target.value)}
            style={{ width: '100%', height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px 0 32px', fontSize: '13px', background: '#FFFFFF', color: '#1A1A18', outline: 'none' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {ESTADOS.map(e => (
          <button key={e.valor} onClick={() => setEstadoFiltro(e.valor)}
            style={{
              padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
              border: `1px solid ${estadoFiltro === e.valor ? '#1D9E75' : '#D3D1C7'}`,
              background: estadoFiltro === e.valor ? '#E1F5EE' : 'none',
              color: estadoFiltro === e.valor ? '#04342C' : '#5F5E5A',
              fontWeight: estadoFiltro === e.valor ? '500' : '400',
              transition: 'all 0.12s',
            }}>
            {e.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontSize: '12px', fontWeight: '500' }}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height: '76px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && !error && obrasFiltradas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#888780' }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="#D3D1C7" style={{ marginBottom: '12px' }}>
            <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
          </svg>
          <p style={{ fontSize: '14px', margin: '0 0 8px' }}>No hay obras que coincidan.</p>
          <button onClick={() => { setBusqueda(''); setEstadoFiltro('') }}
            style={{ fontSize: '12px', color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
            Limpiar filtros
          </button>
        </div>
      )}

      {!cargando && !error && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {obrasFiltradas.map(obra => (
            <div key={obra.id} onClick={() => navigate(`/repertorio/${obra.id}`)}
              style={{
                background: '#FFFFFF',
                border: obra.estado === 'concierto' ? '1px solid #F0C5B4' : '1px solid #E8E6DF',
                borderLeft: obra.estado === 'concierto' ? '3px solid #D85A30' : '1px solid #E8E6DF',
                borderRadius: '10px', padding: '14px 16px',
                display: 'flex', alignItems: 'center', gap: '14px',
                cursor: 'pointer', transition: 'border-color 0.12s, box-shadow 0.12s',
              }}
              onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)' }}
              onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
            >
              <div style={{ width: '42px', height: '42px', borderRadius: '8px', background: obra.estado === 'concierto' ? '#FAECE7' : '#F1EFE8', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill={obra.estado === 'concierto' ? '#D85A30' : '#1D9E75'}>
                  <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{obra.titulo}</span>
                  <Badge estado={obra.estado} />
                  {obra.progreso === 'estudiada' && (
                    <span style={{ fontSize: '10px', color: '#639922', fontWeight: '600' }}>✓ Estudiada</span>
                  )}
                </div>
                <div style={{ fontSize: '12px', color: '#888780', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                  <span>{obra.compositor || 'Compositor desconocido'}</span>
                  <span style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    <MatIcon tiene={!!obra.drive_partitura_id} title="Partitura PDF" />
                    <MatIcon tiene={!!obra.drive_audio_general} title="Audio general" />
                    {perfil?.voz && (
                      <MatIcon tiene={!!obra[`drive_audio_${perfil.voz}`]} title={`Audio ${perfil.voz}`} />
                    )}
                  </span>
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#D3D1C7" style={{ flexShrink: 0 }}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
              </svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}