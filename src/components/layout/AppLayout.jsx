import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import Sidebar from './Sidebar'
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
            <button onClick={() => setAbierto(false)}
              style={{ position: 'absolute', top: '10px', right: '-44px', width: '36px', height: '36px', borderRadius: '50%', background: '#0A4A3A', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.3)', zIndex: 51 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>
          )}
          <Sidebar
            seccionAdmin={seccionAdminEfectiva}
            toggleAdmin={toggleAdmin}
            onNavegar={() => setAbierto(false)}
          />
        </div>
      )}

      {esMovil && !abierto && (
        <button onClick={() => setAbierto(true)}
          style={{ position: 'fixed', top: '12px', left: '12px', zIndex: 60, width: '40px', height: '40px', borderRadius: '10px', background: '#0F6E56', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
            <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
          </svg>
        </button>
      )}

      <MensajeSorpresa key={mensajeSeccion?.tipo} mensaje={mensajeSeccion} onCerrar={cerrarMensajeSeccion} />

      <main style={{ marginLeft: esMovil ? 0 : '210px', padding: esMovil ? '60px 16px 24px' : '28px 32px', flex: 1, minHeight: '100vh', width: esMovil ? '100%' : 'auto', zoom: zoom }}>
        {children}
      </main>
    </div>
  )
}