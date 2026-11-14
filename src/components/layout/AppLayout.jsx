import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar, { nombreSeccion } from './Sidebar'
import { useAvisos } from '../../hooks/useAvisos'
import { supabase } from '../../lib/supabase'
import { usePushSubscription } from '../../hooks/usePushSubscription'
import { useAuth } from '../../hooks/useAuth'
import { useRegistrarAcceso } from '../../hooks/useMensajeSorpresa'
import { useRegistrarActividad } from '../../hooks/useActividad'
import { useMensajeSeccion } from '../../hooks/useMensajeSeccion'
import MensajeSorpresa from '../MensajeSorpresa'

function useEsMovil() {
  const [esMovil, setEsMovil] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setEsMovil(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return esMovil
}

function getZoom() {
  const t = localStorage.getItem('tamanoFuente')
  if (t === 'mediana') return 1.07
  if (t === 'grande')  return 1.14
  return 1
}

export default function AppLayout({ children }) {
  const esMovil = useEsMovil()
  const location = useLocation()
  const navigate = useNavigate()
  const [abierto, setAbierto] = useState(false)
  const [seccionAdmin, setSeccionAdmin] = useState(
    location.pathname.startsWith('/admin')
  )
  const [zoom, setZoom] = useState(getZoom)
  const [user, setUser] = useState(null)
  const { perfil } = useAuth()
  const { noLeidos, recargar: recargarAvisos } = useAvisos()

  // Mantiene al día el contador de avisos sin leer: se vuelve a consultar al cambiar
  // de pantalla y cuando la app vuelve a primer plano (por ejemplo, al tocar una notificación).
  useEffect(() => { recargarAvisos() }, [location.pathname]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const alVolver = () => { if (document.visibilityState === 'visible') recargarAvisos() }
    document.addEventListener('visibilitychange', alVolver)
    window.addEventListener('focus', alVolver)
    return () => {
      document.removeEventListener('visibilitychange', alVolver)
      window.removeEventListener('focus', alVolver)
    }
  }, [recargarAvisos])
  const { lado, seccion } = nombreSeccion(location.pathname)

  // Al entrar (login), admins/directores arrancan del lado Admin en vez de Cantante.
  // Se aplica una sola vez por sesión del navegador (no cada vez que vuelven a Inicio).
  useEffect(() => {
    if (!perfil) return
    let yaAplicado = false
    try {
      yaAplicado = !!sessionStorage.getItem('corum_vista_inicial_aplicada')
      if (!yaAplicado) sessionStorage.setItem('corum_vista_inicial_aplicada', '1')
    } catch {}
    if (yaAplicado) return
    const esAdminODirector = perfil.rol === 'admin' || perfil.rol === 'director'
    if (esAdminODirector && location.pathname === '/') {
      setSeccionAdmin(true)
      navigate('/admin', { replace: true })
    }
  }, [perfil])

  useEffect(() => {
    const fn = () => setZoom(getZoom())
    window.addEventListener('tamanoFuenteCambiado', fn)
    return () => window.removeEventListener('tamanoFuenteCambiado', fn)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setUser(data.session?.user ?? null)
    })
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null)
    })
    return () => listener.subscription.unsubscribe()
  }, [])

  usePushSubscription(user)
  useRegistrarAcceso(perfil)
  useRegistrarActividad(perfil)
  // Debe ir después de useRegistrarAcceso: ese congela el cálculo de ausencia antes de que lo use
  const { mensaje: mensajeSeccion, cerrar: cerrarMensajeSeccion } = useMensajeSeccion(perfil)

  function toggleAdmin(valor) {
    setSeccionAdmin(valor)
  }

  const esAdmin = location.pathname.startsWith('/admin')
  const seccionAdminEfectiva = seccionAdmin

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#F1EFE8' }}>

      {esMovil && abierto && (
        <div onClick={() => setAbierto(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 40 }} />
      )}

      {(!esMovil || abierto) && (
        <div style={{ position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 50, display: 'flex', flexDirection: 'column', zoom: zoom }}>
          {esMovil && (
            <button onClick={() => setAbierto(false)} aria-label="Cerrar menú"
              style={{ position: 'absolute', top: 'calc(12px + env(safe-area-inset-top, 0px))', right: '-56px', width: '44px', height: '44px', borderRadius: '50%', background: '#FFFFFF', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 12px rgba(0,0,0,0.25)', zIndex: 51 }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#1A1A18" aria-hidden="true">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
          <Sidebar
            seccionAdmin={seccionAdminEfectiva}
            toggleAdmin={toggleAdmin}
            onNavegar={() => setAbierto(false)}
            ancho={esMovil ? 288 : 232}
            compacto={!esMovil}
          />
        </div>
      )}

      {/* Celular: barra superior fija (menú, coro y sección, avisos) */}
      {esMovil && (
        <header style={{
          position: 'fixed', top: 0, left: 0, right: 0, zIndex: 30,
          paddingTop: 'env(safe-area-inset-top, 0px)',
          background: '#0F6E56', borderBottom: '1px solid rgba(0,0,0,0.15)',
        }}>
          <div style={{ height: '56px', display: 'flex', alignItems: 'center', gap: '4px', padding: '0 6px' }}>
            <button onClick={() => setAbierto(true)} aria-label="Abrir menú"
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {import.meta.env.VITE_CORO_NOMBRE || 'Coro'}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: '600', color: '#9FE1CB', textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {seccion ? `${lado} · ${seccion}` : lado}
              </div>
            </div>
            <button onClick={() => { setSeccionAdmin(false); navigate('/avisos') }}
              aria-label={noLeidos > 0 ? `Avisos, ${noLeidos} sin leer` : 'Avisos'}
              style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="#FFFFFF" aria-hidden="true">
                <path d="M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z"/>
              </svg>
              {noLeidos > 0 && (
                <span style={{ position: 'absolute', top: '6px', right: '5px', minWidth: '16px', height: '16px', borderRadius: '8px', background: '#D85A30', color: '#FFFFFF', fontSize: '10px', fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', border: '2px solid #0F6E56' }}>
                  {noLeidos > 9 ? '9+' : noLeidos}
                </span>
              )}
            </button>
          </div>
        </header>
      )}

      <MensajeSorpresa key={mensajeSeccion?.tipo} mensaje={mensajeSeccion} onCerrar={cerrarMensajeSeccion} />

      <main style={{
        marginLeft: esMovil ? 0 : '232px',
        // En mobile, la barra superior fija mide 56px — este padding le deja lugar.
        // Se suma env(safe-area-inset-top) porque, instalada como PWA, la barra de
        // estado del teléfono puede superponerse al contenido si no se reserva.
        padding: esMovil ? 'calc(72px + env(safe-area-inset-top, 0px)) 16px 24px' : '28px 32px',
        flex: 1, minHeight: '100vh', width: esMovil ? '100%' : 'auto', zoom: zoom,
      }}>
        {children}
      </main>
    </div>
  )
}