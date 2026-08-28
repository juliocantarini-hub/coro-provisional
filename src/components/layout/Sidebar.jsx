import { useState, useEffect } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAvisos } from '../../hooks/useAvisos'
import { usePresencia } from '../../hooks/usePresencia'
import { useEncuestasActivas } from '../../hooks/useEncuestas'

const NAV_CANTANTE = [
  { ruta: '/',           label: 'Inicio',         icono: 'inicio' },
  { ruta: '/repertorio', label: 'Repertorio',     icono: 'musica' },
  { ruta: '/entrenamiento', label: 'Entrenamiento', icono: 'entrenamiento' },
  { ruta: '/calendario', label: 'Calendario',     icono: 'calendario' },
  { ruta: '/avisos',     label: 'Avisos',         icono: 'campana', badge: true },
  { ruta: '/encuestas',  label: 'Encuestas',      icono: 'encuestas', badgeEncuestas: true },
  { ruta: '/blog',       label: 'Textos',         icono: 'blog' },
  { ruta: '/asistencia', label: 'Mi asistencia',  icono: 'calendario' },
  { ruta: '/companeros', label: 'Mis compañeros', icono: 'usuarios', presencia: true },
  { ruta: '/perfil',     label: 'Mi perfil',      icono: 'perfil' },
]

const NAV_ADMIN = [
  { ruta: '/admin',              label: 'Dashboard',  icono: 'dashboard' },
  { ruta: '/admin/obras',        label: 'Obras',      icono: 'musica' },
  { ruta: '/admin/eventos',      label: 'Eventos',    icono: 'calendario' },
  { ruta: '/admin/asistencia',   label: 'Asistencia', icono: 'calendario' },
  { ruta: '/admin/estudio',      label: 'Estudio',    icono: 'estudio' },
  { ruta: '/admin/avisos',       label: 'Avisos',     icono: 'campana' },
  { ruta: '/admin/encuestas',    label: 'Encuestas',  icono: 'encuestas' },
  { ruta: '/admin/blog',         label: 'Textos',     icono: 'blog' },
  { ruta: '/admin/usuarios',     label: 'Cantantes',  icono: 'usuarios', presencia: true },
  { ruta: '/admin/pagos',        label: 'Pagos',      icono: 'pagos' },
  { ruta: '/admin/asistente',    label: 'Asistente',  icono: 'asistente' },
]
const ICONOS = {
  inicio:     "M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z",
  musica:     "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
  entrenamiento: "M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5-3c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z",
  calendario: "M19 3h-1V1h-2v2H8V1H6v2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z",
  campana:    "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  blog:       "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z",
  perfil:     "M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z",
  dashboard:  "M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z",
  usuarios:   "M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z",
  estudio:    "M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 14l-5-5 1.41-1.41L12 14.17l7.59-7.59L21 8l-9 9z",
  asistente:  "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z",
  pagos: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
  encuestas:  "M5 9h3v11H5zm11-5h3v16h-3zM10.5 13h3v8h-3z",
}

function getPadding() {
  const t = localStorage.getItem('tamanoFuente')
  if (t === 'grande')  return '7px 16px'
  if (t === 'mediana') return '9px 16px'
  return '10px 16px'
}

function getZoom() {
  const t = localStorage.getItem('tamanoFuente')
  if (t === 'mediana') return 1.07
  if (t === 'grande')  return 1.14
  return 1
}

function LogoCorum() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px', paddingTop: '24px', paddingBottom: '15px', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
        <svg width="22" height="22" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M 78 20 A 38 38 0 1 0 78 80" stroke="rgba(159,225,203,0.7)" strokeWidth="7" strokeLinecap="round" fill="none" />
          <line x1="28" y1="38" x2="66" y2="38" stroke="rgba(159,225,203,0.7)" strokeWidth="6" strokeLinecap="round" />
          <line x1="28" y1="50" x2="66" y2="50" stroke="rgba(159,225,203,0.7)" strokeWidth="6" strokeLinecap="round" />
          <line x1="28" y1="62" x2="66" y2="62" stroke="rgba(159,225,203,0.7)" strokeWidth="6" strokeLinecap="round" />
        </svg>
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: 'rgba(159,225,203,0.7)', letterSpacing: '2px', lineHeight: 1 }}>CORUM</div>
          <div style={{ fontSize: '8px', color: 'rgba(159,225,203,0.45)', letterSpacing: '0.5px', lineHeight: 1.4 }}>by Recurso Coral</div>
        </div>
      </div>
    </div>
  )
}

export default function Sidebar({ seccionAdmin, toggleAdmin, onNavegar }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil, cerrarSesion, esAdmin, esDirector } = useAuth()
  const { noLeidos } = useAvisos()
  const activos = usePresencia()
  const { encuestas: encuestasActivas } = useEncuestasActivas()
  const encuestasPendientes = encuestasActivas.filter(e => !e.yaVote).length
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const [zoom, setZoom] = useState(getZoom)
  const [padding, setPadding] = useState(getPadding)

  useEffect(() => {
    const fn = () => { setZoom(getZoom()); setPadding(getPadding()) }
    window.addEventListener('tamanoFuenteCambiado', fn)
    return () => window.removeEventListener('tamanoFuenteCambiado', fn)
  }, [])

  const iniciales = perfil?.nombre
    ? perfil.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  function isActive(ruta, esMenuAdmin) {
    if (esMenuAdmin) {
      if (ruta === '/admin') return location.pathname === '/admin'
      return location.pathname.startsWith(ruta)
    } else {
      if (location.pathname.startsWith('/admin')) return false
      if (ruta === '/') return location.pathname === '/'
      return location.pathname.startsWith(ruta)
    }
  }

  function handleNavegar(ruta) {
    navigate(ruta)
    if (onNavegar) onNavegar()
  }

  const esMenuAdmin = seccionAdmin && (esAdmin || esDirector)
  const navItems = esMenuAdmin ? NAV_ADMIN : NAV_CANTANTE
  const cantidadActivos = activos.length

  return (
    <div style={{ width: '210px', height: '100vh', background: '#0A4A3A', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', zoom: zoom }}>

        {/* Logo */}
        <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '34px', height: '34px', background: '#1D9E75', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <div>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '14px', color: '#9FE1CB' }}>{import.meta.env.VITE_CORO_NOMBRE || 'Coro'}</div>
              <div style={{ fontSize: '10px', color: 'rgba(159,225,203,0.5)' }}>Plataforma coral</div>
            </div>
          </div>
        </div>

        {/* Toggle Cantante/Admin */}
{(esAdmin || esDirector) && (
  <div style={{ padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }}>
    <div style={{ display: 'flex', background: 'rgba(0,0,0,0.25)', borderRadius: '8px', overflow: 'hidden' }}>
      <button onClick={() => { toggleAdmin(false); handleNavegar('/') }}
        style={{ flex: 1, padding: '5px 0', fontSize: '11px', border: 'none', cursor: 'pointer', background: !seccionAdmin ? '#1D9E75' : 'none', color: !seccionAdmin ? '#FFFFFF' : 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
        Cantante
      </button>
      <button onClick={() => { toggleAdmin(true); handleNavegar('/admin') }}
        style={{ flex: 1, padding: '5px 0', fontSize: '11px', border: 'none', cursor: 'pointer', background: seccionAdmin ? '#D85A30' : 'none', color: seccionAdmin ? '#FFFFFF' : 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
        Admin
      </button>
    </div>
  </div>
)}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 0', overflowY: 'auto', minHeight: 0 }}>
          {navItems.map(item => {
            const activo = isActive(item.ruta, esMenuAdmin)
            return (
              <button key={item.ruta} onClick={() => handleNavegar(item.ruta)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: padding, border: 'none', cursor: 'pointer',
                  background: activo ? 'rgba(29,158,117,0.25)' : 'none',
                  borderLeft: `2px solid ${activo ? '#5DCAA5' : 'transparent'}`,
                  color: activo ? '#FFFFFF' : 'rgba(255,255,255,0.6)',
                  fontSize: '13px', textAlign: 'left',
                }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor">
                  <path d={ICONOS[item.icono] || ICONOS.inicio} />
                </svg>
                <span style={{ flex: 1 }}>{item.label}</span>
                {item.badge && noLeidos > 0 && (
                  <span style={{ background: '#D85A30', color: 'white', fontSize: '10px', borderRadius: '10px', padding: '1px 6px' }}>
                    {noLeidos > 9 ? '9+' : noLeidos}
                  </span>
                )}
                {item.badgeEncuestas && encuestasPendientes > 0 && (
                  <span style={{ background: '#D85A30', color: 'white', fontSize: '10px', borderRadius: '10px', padding: '1px 6px' }}>
                    {encuestasPendientes > 9 ? '9+' : encuestasPendientes}
                  </span>
                )}
                {item.presencia && cantidadActivos > 0 && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                    <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DCAA5', display: 'inline-block' }} />
                    <span style={{ fontSize: '10px', color: 'rgba(159,225,203,0.8)' }}>{cantidadActivos}</span>
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div style={{ flexShrink: 0, background: '#0A4A3A' }}>
          {mostrarAyuda && (
            <div style={{ margin: '0 14px 10px', background: '#0F6E56', borderRadius: '10px', padding: '12px 14px', position: 'relative', border: '1px solid rgba(255,255,255,0.15)' }}>
              <button onClick={() => setMostrarAyuda(false)}
                style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>
                ✕
              </button>
              <div style={{ fontSize: '11px', color: '#FFFFFF', fontWeight: '600', marginBottom: '5px' }}>📲 Acceso directo</div>
              <div style={{ fontSize: '11px', color: 'rgba(159,225,203,0.85)', lineHeight: '1.6' }}>
                Si no elegiste instalar la app podés agregar un acceso directo en tu pantalla de inicio, tocá los <strong style={{ color: '#FFFFFF' }}>⋮</strong> de Chrome y elegí <strong style={{ color: '#FFFFFF' }}>"Agregar a pantalla de inicio"</strong>
              </div>
            </div>
          )}

          <div style={{ padding: '12px 14px 10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '600', color: 'white' }}>
                  {iniciales}
                </div>
                <span style={{ position: 'absolute', bottom: 0, right: 0, width: 8, height: 8, borderRadius: '50%', background: '#5DCAA5', border: '1.5px solid #0A4A3A', display: 'block' }} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.9)', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {perfil?.nombre?.split(' ')[0] || '—'}
                </div>
                <div style={{ fontSize: '10px', color: 'rgba(159,225,203,0.6)', textTransform: 'capitalize' }}>
                  {perfil?.voz || perfil?.rol || '—'}
                </div>
              </div>
              <button onClick={() => setMostrarAyuda(v => !v)}
                style={{ width: '24px', height: '24px', borderRadius: '50%', background: mostrarAyuda ? '#1D9E75' : 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '12px', fontWeight: '600', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                ?
              </button>
            </div>
          </div>

          <div style={{ height: '8px' }} />

          <div style={{ padding: '10px 14px 0' }}>
            <button onClick={cerrarSesion}
              style={{ width: '100%', padding: '6px', fontSize: '11px', color: 'rgba(255,255,255,0.45)', background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '6px', cursor: 'pointer' }}>
              Cerrar sesión
            </button>
            <LogoCorum />
          </div>
        </div>
      </div>
    </div>
  )
}
