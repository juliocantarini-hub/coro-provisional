import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import EncuestaDashboard from '../../components/EncuestaDashboard'

export default function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats]       = useState(null)
  const [cargando, setCargando] = useState(true)

  useEffect(() => {
    async function cargar() {
      const coro = await getCoroActual()
      const [usuarios, obras, eventos, avisos, asistencias] = await Promise.all([
        supabase.from('perfiles').select('id, rol, estado', { count: 'exact' }).eq('coro_id', coro.id),
        supabase.from('obras').select('id, publicada', { count: 'exact' }).eq('coro_id', coro.id),
        supabase.from('eventos').select('id, publicado, fecha_inicio').eq('coro_id', coro.id).gte('fecha_inicio', new Date().toISOString()),
        supabase.from('avisos').select('id, publicado', { count: 'exact' }).eq('coro_id', coro.id),
        supabase.from('asistencias').select('estado').eq('estado', 'pendiente'),
      ])
      setStats({
        totalUsuarios:    usuarios.count || 0,
        usuariosActivos:  (usuarios.data || []).filter(u => u.estado === 'activo').length,
        totalObras:       obras.count || 0,
        obrasPublicadas:  (obras.data || []).filter(o => o.publicada).length,
        eventosFuturos:   eventos.data?.length || 0,
        avisosPublicados: (avisos.data || []).filter(a => a.publicado).length,
        asistPendientes:  asistencias.data?.length || 0,
      })
      setCargando(false)
    }
    cargar()
  }, [])

  const acciones = [
    { label: 'Nueva obra',    sub: 'Subir partitura y audios', ruta: '/admin/obras/nueva',   color: '#0F6E56', bg: '#E1F5EE' },
    { label: 'Nuevo evento',  sub: 'Ensayo o concierto',       ruta: '/admin/eventos/nuevo', color: '#378ADD', bg: '#E6F1FB' },
    { label: 'Nuevo aviso',   sub: 'Comunicado al coro',       ruta: '/admin/avisos',        color: '#D85A30', bg: '#FAECE7' },
    { label: 'Nuevo texto',   sub: 'Publicar en Textos',       ruta: '/admin/blog/nuevo',    color: '#7C3AED', bg: '#F3EFF8' },
  ]

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 4px' }}>
        Panel de administración
      </h2>
      <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 24px' }}>
        Resumen del estado del coro
      </p>

      {cargando ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: '80px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '24px' }}>
          <StatCard val={stats.usuariosActivos} label="Cantantes activos" color="#0F6E56" bg="#E1F5EE" onClick={() => navigate('/admin/usuarios')} />
          <StatCard val={stats.obrasPublicadas} label="Obras publicadas"  color="#1D9E75" bg="#E1F5EE" onClick={() => navigate('/admin/obras')} />
          <StatCard val={stats.eventosFuturos}  label="Eventos próximos"  color="#378ADD" bg="#E6F1FB" onClick={() => navigate('/admin/eventos')} />
          <StatCard val={stats.asistPendientes} label="Asistencias pend." color={stats.asistPendientes > 0 ? '#D85A30' : '#888780'} bg={stats.asistPendientes > 0 ? '#FAECE7' : '#F1EFE8'} onClick={() => navigate('/admin/eventos')} />
        </div>
      )}

      {/* Encuesta activa — solo aparece si hay una encuesta abierta */}
      <EncuestaDashboard esAdmin={true} />

      <div style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
          Acciones rápidas
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
          {acciones.map(a => (
            <button key={a.ruta} onClick={() => navigate(a.ruta)}
              style={{ background: a.bg, border: 'none', borderRadius: '12px', padding: '16px 14px', cursor: 'pointer', textAlign: 'left', transition: 'transform 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
              onMouseLeave={e => e.currentTarget.style.transform = 'none'}
            >
              <div style={{ fontSize: '14px', fontWeight: '600', color: a.color, marginBottom: '4px' }}>+ {a.label}</div>
              <div style={{ fontSize: '11px', color: a.color, opacity: 0.7 }}>{a.sub}</div>
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
          Gestión
        </h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {[
            { label: 'Usuarios y roles',   sub: `${stats?.totalUsuarios || '—'} registrados`,  ruta: '/admin/usuarios' },
            { label: 'Obras y repertorio', sub: `${stats?.totalObras || '—'} obras en total`,   ruta: '/admin/obras' },
            { label: 'Eventos y ensayos',  sub: `${stats?.eventosFuturos || '—'} próximos`,     ruta: '/admin/eventos' },
            { label: 'Textos publicados', sub: `${stats?.avisosPublicados || '—'} publicados`, ruta: '/admin/blog' },
          ].map(item => (
            <div key={item.ruta} onClick={() => navigate(item.ruta)}
              style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', transition: 'border-color 0.12s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = '#B4D8CE'}
              onMouseLeave={e => e.currentTarget.style.borderColor = '#E8E6DF'}
            >
              <div>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{item.label}</div>
                <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{item.sub}</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#D3D1C7"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ val, label, color, bg, onClick }) {
  return (
    <div onClick={onClick} style={{ background: bg, borderRadius: '12px', padding: '16px', cursor: 'pointer', transition: 'transform 0.12s' }}
      onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
      onMouseLeave={e => e.currentTarget.style.transform = 'none'}
    >
      <div style={{ fontSize: '28px', fontWeight: '600', color, lineHeight: 1 }}>{val}</div>
      <div style={{ fontSize: '12px', color, opacity: 0.75, marginTop: '4px' }}>{label}</div>
    </div>
  )
}