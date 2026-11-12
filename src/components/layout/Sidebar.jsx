import { useState, useEffect, useLayoutEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../../hooks/useAuth'
import { useAvisos } from '../../hooks/useAvisos'
import { usePresencia } from '../../hooks/usePresencia'
import { useEncuestasActivas } from '../../hooks/useEncuestas'

// Menú agrupado por tema (modelo "lista con secciones"): cada grupo tiene un título
// chico arriba; el primero va sin título.
const NAV_CANTANTE = [
  { titulo: '', items: [
    { ruta: '/',           label: 'Inicio',         icono: 'inicio' },
  ] },
  { titulo: 'Mi coro', items: [
    { ruta: '/repertorio', label: 'Repertorio',     icono: 'musica' },
    { ruta: '/entrenamiento', label: 'Entrenamiento', icono: 'entrenamiento' },
    { ruta: '/calendario', label: 'Calendario',     icono: 'calendario' },
    { ruta: '/avisos',     label: 'Avisos',         icono: 'campana', badge: true },
    { ruta: '/encuestas',  label: 'Encuestas',      icono: 'encuestas', badgeEncuestas: true },
    { ruta: '/blog',       label: 'Textos',         icono: 'blog' },
  ] },
  { titulo: 'Yo', items: [
    { ruta: '/asistencia', label: 'Mi asistencia',  icono: 'asistencia' },
    { ruta: '/companeros', label: 'Mis compañeros', icono: 'usuarios', presencia: true },
    { ruta: '/perfil',     label: 'Mi perfil',      icono: 'perfil' },
  ] },
]

const NAV_ADMIN = [
  { titulo: '', items: [
    { ruta: '/admin',              label: 'Dashboard',  icono: 'dashboard' },
  ] },
  { titulo: 'Contenido', items: [
    { ruta: '/admin/obras',        label: 'Obras',      icono: 'musica' },
    { ruta: '/admin/eventos',      label: 'Eventos',    icono: 'calendario' },
    { ruta: '/admin/avisos',       label: 'Avisos',     icono: 'campana' },
    { ruta: '/admin/encuestas',    label: 'Encuestas',  icono: 'encuestas' },
    { ruta: '/admin/blog',         label: 'Textos',     icono: 'blog' },
  ] },
  { titulo: 'Seguimiento', items: [
    { ruta: '/admin/asistencia',   label: 'Asistencia', icono: 'asistencia' },
    { ruta: '/admin/estudio',      label: 'Estudio',    icono: 'estudio' },
    { ruta: '/admin/entrenamiento', label: 'Entrenamiento', icono: 'entrenamiento' },
    { ruta: '/admin/estadistica',  label: 'Estadística', icono: 'estadistica' },
  ] },
  { titulo: 'Personas y pagos', items: [
    { ruta: '/admin/usuarios',     label: 'Cantantes',  icono: 'usuarios', presencia: true },
    { ruta: '/admin/pagos',        label: 'Pagos',      icono: 'pagos' },
  ] },
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
  // Estudio: libro abierto (distinto de Asistencia y de Estadística)
  estudio:    "M21 5c-1.11-.35-2.33-.5-3.5-.5-1.95 0-4.05.4-5.5 1.5-1.45-1.1-3.55-1.5-5.5-1.5S2.45 4.9 1 6v14.65c0 .25.25.5.5.5.1 0 .15-.05.25-.05C3.1 20.45 5.05 20 6.5 20c1.95 0 4.05.4 5.5 1.5 1.35-.85 3.8-1.5 5.5-1.5 1.65 0 3.35.3 4.75 1.05.1.05.15.05.25.05.25 0 .5-.25.5-.5V6c-.6-.45-1.25-.75-2-1zm0 13.5c-1.1-.35-2.3-.5-3.5-.5-1.7 0-4.15.65-5.5 1.5V8c1.35-.85 3.8-1.5 5.5-1.5 1.2 0 2.4.15 3.5.5v11.5z",
  // Asistencia: planilla con broche y tilde (distinta de Eventos/Calendario)
  asistencia: "M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z",
  asistente:  "M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z",
  pagos: "M11.8 10.9c-2.27-.59-3-1.2-3-2.15 0-1.09 1.01-1.85 2.7-1.85 1.78 0 2.44.85 2.5 2.1h2.21c-.07-1.72-1.12-3.3-3.21-3.81V3h-3v2.16c-1.94.42-3.5 1.68-3.5 3.61 0 2.31 1.91 3.46 4.7 4.13 2.5.6 3 1.48 3 2.41 0 .69-.49 1.79-2.7 1.79-2.06 0-2.87-.92-2.98-2.1h-2.2c.12 2.19 1.76 3.42 3.68 3.83V21h3v-2.15c1.95-.37 3.5-1.5 3.5-3.55 0-2.84-2.43-3.81-4.7-4.4z",
  encuestas:  "M5 9h3v11H5zm11-5h3v16h-3zM10.5 13h3v8h-3z",
  estadistica: "M16 6l2.29 2.29-4.88 4.88-4-4L2 16.59 3.41 18l6-6 4 4 6.3-6.29L22 12V6z",
  ayuda:      "M11 18h2v-2h-2v2zm1-16C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm0-14c-2.21 0-4 1.79-4 4h2c0-1.1.9-2 2-2s2 .9 2 2c0 2-3 1.75-3 5h2c0-2.25 3-2.5 3-5 0-2.21-1.79-4-4-4z",
  salir:      "M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z",
}

// Colores del menú (verde oscuro, como siempre)
const C = {
  fondo: '#0A4A3A',
  texto: 'rgba(255,255,255,0.88)',
  textoSuave: 'rgba(255,255,255,0.62)',
  titulo: 'rgba(159,225,203,0.75)',
  linea: 'rgba(255,255,255,0.10)',
  acento: '#5DCAA5',
  activoTexto: '#FFFFFF',
  activoFondo: 'rgba(29,158,117,0.28)',
  pie: '#083D30',
  rojo: '#F0A58C',
  nombreCoro: '#9FE1CB',
  logo: 'rgba(159,225,203,0.7)',
}

// Nombre de la sección según la ruta (lo usa la barra superior del celular)
export function nombreSeccion(pathname) {
  const esAdminRuta = pathname.startsWith('/admin')
  const grupos = esAdminRuta ? NAV_ADMIN : NAV_CANTANTE
  let mejor = null
  for (const g of grupos) {
    for (const it of g.items) {
      const coincide = it.ruta === '/' || it.ruta === '/admin'
        ? pathname === it.ruta
        : pathname.startsWith(it.ruta)
      if (coincide && (!mejor || it.ruta.length > mejor.ruta.length)) mejor = it
    }
  }
  return { lado: esAdminRuta ? 'Admin' : 'Cantante', seccion: mejor?.label || '' }
}

// En el celular cada renglón mide al menos 44px (para el dedo); en la compu va más compacto
// así entran todas las secciones sin scroll en una pantalla de notebook.
function getPadding(compacto) {
  const t = localStorage.getItem('tamanoFuente')
  if (compacto) {
    if (t === 'grande')  return '5px 16px 5px 14px'
    if (t === 'mediana') return '6px 16px 6px 14px'
    return '8px 16px 8px 14px'
  }
  if (t === 'grande')  return '9px 16px 9px 14px'
  if (t === 'mediana') return '11px 16px 11px 14px'
  return '12px 16px 12px 14px'
}

function getZoom() {
  const t = localStorage.getItem('tamanoFuente')
  if (t === 'mediana') return 1.07
  if (t === 'grande')  return 1.14
  return 1
}

function LogoCorum() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px 14px' }}>
      <svg width="18" height="18" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path d="M 78 20 A 38 38 0 1 0 78 80" stroke={C.logo} strokeWidth="7" strokeLinecap="round" fill="none" />
        <line x1="28" y1="38" x2="66" y2="38" stroke={C.logo} strokeWidth="6" strokeLinecap="round" />
        <line x1="28" y1="50" x2="66" y2="50" stroke={C.logo} strokeWidth="6" strokeLinecap="round" />
        <line x1="28" y1="62" x2="66" y2="62" stroke={C.logo} strokeWidth="6" strokeLinecap="round" />
      </svg>
      <div>
        <div style={{ fontSize: '10px', fontWeight: '700', color: C.logo, letterSpacing: '2px', lineHeight: 1 }}>CORUM</div>
        <div style={{ fontSize: '8px', color: C.logo, letterSpacing: '0.5px', lineHeight: 1.4 }}>by Recurso Coral</div>
      </div>
    </div>
  )
}

function Insignia({ children }) {
  return (
    <span style={{ background: '#D85A30', color: 'white', fontSize: '10px', fontWeight: '600', borderRadius: '10px', padding: '1px 7px' }}>
      {children}
    </span>
  )
}

export default function Sidebar({ seccionAdmin, toggleAdmin, onNavegar, ancho = 232, compacto = false }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { perfil, cerrarSesion, esAdmin, esDirector } = useAuth()
  const { noLeidos } = useAvisos()
  const activos = usePresencia()
  const { encuestas: encuestasActivas } = useEncuestasActivas()
  const encuestasPendientes = encuestasActivas.filter(e => !e.yaVote).length
  const [mostrarAyuda, setMostrarAyuda] = useState(false)
  const [zoom, setZoom] = useState(getZoom)
  const [padding, setPadding] = useState(() => getPadding(compacto))

  useEffect(() => {
    const fn = () => { setZoom(getZoom()); setPadding(getPadding(compacto)) }
    window.addEventListener('tamanoFuenteCambiado', fn)
    return () => window.removeEventListener('tamanoFuenteCambiado', fn)
  }, [compacto])

  useEffect(() => { setPadding(getPadding(compacto)) }, [compacto])

  // Si el menú no entra en el alto de la pantalla, se achica entero (en vez de mostrar barra de scroll)
  const [ajuste, setAjuste] = useState(1)
  const ajusteRef = useRef(1)
  const refCaja = useRef(null)
  const refCabeza = useRef(null)
  const refLista = useRef(null)
  const refPie = useRef(null)

  useLayoutEffect(() => {
    function medir() {
      const caja = refCaja.current, cab = refCabeza.current, lista = refLista.current, pie = refPie.current
      if (!caja || !cab || !lista || !pie) return
      const disponible = caja.getBoundingClientRect().height
      const necesario = cab.getBoundingClientRect().height + lista.getBoundingClientRect().height + pie.getBoundingClientRect().height
      if (!disponible || !necesario) return
      let nuevo = ajusteRef.current * (disponible / necesario)
      nuevo = Math.max(0.6, Math.min(1, Math.floor(nuevo * 1000) / 1000))
      if (Math.abs(nuevo - ajusteRef.current) > 0.005) {
        ajusteRef.current = nuevo
        setAjuste(nuevo)
      }
    }
    medir()
    const ro = new ResizeObserver(medir)
    ;[refCaja, refCabeza, refLista, refPie].forEach(r => r.current && ro.observe(r.current))
    window.addEventListener('resize', medir)
    return () => { ro.disconnect(); window.removeEventListener('resize', medir) }
  }, [])

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

  const puedeAdmin = esAdmin || esDirector
  const esMenuAdmin = seccionAdmin && puedeAdmin
  const grupos = esMenuAdmin ? NAV_ADMIN : NAV_CANTANTE
  const cantidadActivos = activos.length
  const nombre = perfil?.nombre?.split(' ')[0] || '—'
  const rol = perfil?.rol === 'director' ? 'Director' : perfil?.rol === 'admin' ? 'Admin' : (perfil?.voz || 'Cantante')

  const segmento = (on, color) => ({
    flex: 1, minHeight: '36px', fontSize: '13px', border: 'none', cursor: 'pointer', borderRadius: '8px',
    background: on ? color : 'transparent',
    color: on ? '#FFFFFF' : C.textoSuave,
    fontWeight: on ? '600' : '500',
  })

  return (
    <div style={{ width: `${ancho}px`, height: '100vh', background: C.fondo, display: 'flex', flexDirection: 'column', borderRight: `1px solid ${C.linea}`, overflow: 'hidden' }} ref={refCaja}>
      <div style={{ display: 'flex', flexDirection: 'column', height: `${100 / (zoom * ajuste)}%`, zoom: zoom * ajuste }}>

        {/* Coro y quién soy */}
        <div ref={refCabeza} style={{ padding: 'calc(18px + env(safe-area-inset-top, 0px)) 16px 14px', borderBottom: `1px solid ${C.linea}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '38px', height: '38px', background: '#1D9E75', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: C.nombreCoro, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {import.meta.env.VITE_CORO_NOMBRE || 'Coro'}
              </div>
              <div style={{ fontSize: '12px', color: C.textoSuave, marginTop: '1px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DCAA5', display: 'inline-block', flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textTransform: 'capitalize' }}>{nombre} · {rol}</span>
              </div>
            </div>
          </div>

          {/* Cantante / Admin */}
          {puedeAdmin && (
            <div role="group" aria-label="Lado de la app" style={{ display: 'flex', gap: '4px', marginTop: '14px', background: 'rgba(0,0,0,0.25)', borderRadius: '10px', padding: '3px' }}>
              <button onClick={() => { toggleAdmin(false); handleNavegar('/') }} style={segmento(!seccionAdmin, '#1D9E75')}>Cantante</button>
              <button onClick={() => { toggleAdmin(true); handleNavegar('/admin') }} style={segmento(seccionAdmin, '#D85A30')}>Admin</button>
            </div>
          )}
        </div>

        {/* Secciones */}
        <nav aria-label="Menú principal" style={{ flex: 1, overflowY: 'auto', minHeight: 0, scrollbarWidth: 'none' }}>
          <div ref={refLista} style={{ padding: '4px 0 10px' }}>
          {grupos.map((grupo, gi) => (
            <div key={gi}>
              {grupo.titulo && (
                <div style={{ padding: compacto ? '10px 16px 2px 18px' : '14px 16px 4px 18px', fontSize: '10.5px', fontWeight: '700', color: C.titulo, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                  {grupo.titulo}
                </div>
              )}
              {grupo.items.map(item => {
                const activo = isActive(item.ruta, esMenuAdmin)
                return (
                  <button key={item.ruta} onClick={() => handleNavegar(item.ruta)}
                    aria-current={activo ? 'page' : undefined}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '12px',
                      padding: padding, border: 'none', cursor: 'pointer',
                      background: activo ? C.activoFondo : 'none',
                      borderLeft: `4px solid ${activo ? C.acento : 'transparent'}`,
                      color: activo ? C.activoTexto : C.texto,
                      fontWeight: activo ? '700' : '400',
                      fontSize: '14px', textAlign: 'left',
                    }}>
                    <svg width="19" height="19" viewBox="0 0 24 24" fill={activo ? C.acento : C.textoSuave} aria-hidden="true">
                      <path d={ICONOS[item.icono] || ICONOS.inicio} />
                    </svg>
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.badge && noLeidos > 0 && <Insignia>{noLeidos > 9 ? '9+' : noLeidos}</Insignia>}
                    {item.badgeEncuestas && encuestasPendientes > 0 && <Insignia>{encuestasPendientes > 9 ? '9+' : encuestasPendientes}</Insignia>}
                    {item.presencia && cantidadActivos > 0 && (
                      <span title="En línea ahora" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#5DCAA5', display: 'inline-block' }} />
                        <span style={{ fontSize: '11px', fontWeight: '600', color: '#9FE1CB' }}>{cantidadActivos}</span>
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          ))}
          </div>
        </nav>

        {/* Abajo fijo */}
        <div ref={refPie} style={{ flexShrink: 0, background: C.pie, borderTop: `1px solid ${C.linea}` }}>
          {mostrarAyuda && (
            <div style={{ margin: '10px 12px 4px', background: '#0F6E56', borderRadius: '10px', padding: '12px 14px', position: 'relative', border: '1px solid rgba(255,255,255,0.15)' }}>
              <button onClick={() => setMostrarAyuda(false)} aria-label="Cerrar ayuda"
                style={{ position: 'absolute', top: '6px', right: '8px', background: 'none', border: 'none', color: C.textoSuave, cursor: 'pointer', fontSize: '14px', lineHeight: 1 }}>
                ✕
              </button>
              <div style={{ fontSize: '12px', color: '#FFFFFF', fontWeight: '600', marginBottom: '5px' }}>📲 Acceso directo</div>
              <div style={{ fontSize: '12px', color: C.texto, lineHeight: '1.6' }}>
                Si no elegiste instalar la app podés agregar un acceso directo en tu pantalla de inicio, tocá los <strong style={{ color: '#FFFFFF' }}>⋮</strong> de Chrome y elegí <strong style={{ color: '#FFFFFF' }}>"Agregar a pantalla de inicio"</strong>
              </div>
            </div>
          )}
          <button onClick={() => setMostrarAyuda(v => !v)}
            style={{ width: '100%', minHeight: compacto ? '36px' : '44px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 0 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: C.texto, textAlign: 'left' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill={C.textoSuave} aria-hidden="true"><path d={ICONOS.ayuda} /></svg>
            Ayuda
          </button>
          <button onClick={cerrarSesion}
            style={{ width: '100%', minHeight: compacto ? '36px' : '44px', display: 'flex', alignItems: 'center', gap: '12px', padding: '0 16px 0 18px', border: 'none', background: 'none', cursor: 'pointer', fontSize: '14px', color: C.rojo, textAlign: 'left' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill={C.rojo} aria-hidden="true"><path d={ICONOS.salir} /></svg>
            Cerrar sesión
          </button>
          <LogoCorum />
        </div>
      </div>
    </div>
  )
}
