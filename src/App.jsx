import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './hooks/useAuth'
import { PresenciaProvider } from './hooks/usePresencia'
import RutaProtegida from './components/RutaProtegida'
import AppLayout from './components/layout/AppLayout'

// Auth
import Login               from './pages/auth/Login'
import Registro            from './pages/auth/Registro'
import RecuperarContrasena from './pages/auth/RecuperarContrasena'
import ResetContrasena     from './pages/auth/ResetContrasena'

// Cantante
import Inicio          from './pages/Inicio'
import Repertorio      from './pages/repertorio/Repertorio'
import ObraDetalle     from './pages/repertorio/ObraDetalle'
import Calendario      from './pages/calendario/Calendario'
import EventoDetalle   from './pages/calendario/EventoDetalle'
import Avisos          from './pages/avisos/Avisos'
import { Blog, ArticuloDetalle } from './pages/blog/Blog'
import Perfil          from './pages/perfil/Perfil' 
import MisCompaneros   from './pages/cantantes/MisCompaneros' 
import MiAsistencia    from './pages/asistencia/MiAsistencia' 
import AsistenciaAdmin from './pages/admin/AsistenciaAdmin'

// Admin
import AdminDashboard  from './pages/admin/AdminDashboard'
import Usuarios        from './pages/admin/Usuarios'
import ObrasLista      from './pages/admin/ObrasLista'
import ObraForm        from './pages/admin/ObraForm'
import EventosLista    from './pages/admin/EventosLista'
import EventoForm      from './pages/admin/EventoForm'
import { AvisosAdmin } from './pages/admin/AvisosAdmin'
import { ArticulosAdmin, ArticuloForm } from './pages/admin/ArticulosAdmin'
import EstudioAdmin    from './pages/admin/EstudioAdmin'
import AsistenteRepertorio from './pages/admin/AsistenteRepertorio'
import PagosAdmin from './pages/admin/PagosAdmin'
import CrearCantante from './pages/admin/CrearCantante'

function RutaPublica({ children }) {
  const { usuario, cargando } = useAuth()
  if (cargando) return null
  if (usuario)  return <Navigate to="/" replace />
  return children
}

function ConLayout({ children }) {
  return <AppLayout>{children}</AppLayout>
}

function ConPresencia({ children }) {
  const { perfil } = useAuth()
  return <PresenciaProvider perfil={perfil}>{children}</PresenciaProvider>
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ConPresencia>
          <Routes>
            <Route path="/login" element={<RutaPublica><Login /></RutaPublica>} />
            <Route path="/registro" element={<RutaPublica><Registro /></RutaPublica>} />
            <Route path="/recuperar" element={<RutaPublica><RecuperarContrasena /></RutaPublica>} />
            <Route path="/reset-password" element={<ResetContrasena />} />

            <Route path="/" element={<RutaProtegida><ConLayout><Inicio /></ConLayout></RutaProtegida>} />
            <Route path="/repertorio" element={<RutaProtegida><ConLayout><Repertorio /></ConLayout></RutaProtegida>} />
            <Route path="/repertorio/:id" element={<RutaProtegida><ConLayout><ObraDetalle /></ConLayout></RutaProtegida>} />
            <Route path="/calendario" element={<RutaProtegida><ConLayout><Calendario /></ConLayout></RutaProtegida>} />
            <Route path="/calendario/:id" element={<RutaProtegida><ConLayout><EventoDetalle /></ConLayout></RutaProtegida>} />
            <Route path="/avisos" element={<RutaProtegida><ConLayout><Avisos /></ConLayout></RutaProtegida>} />
            <Route path="/blog" element={<RutaProtegida><ConLayout><Blog /></ConLayout></RutaProtegida>} />
            <Route path="/blog/:id" element={<RutaProtegida><ConLayout><ArticuloDetalle /></ConLayout></RutaProtegida>} />
            <Route path="/asistencia" element={<RutaProtegida><ConLayout><MiAsistencia /></ConLayout></RutaProtegida>} />
            <Route path="/companeros" element={<RutaProtegida><ConLayout><MisCompaneros /></ConLayout></RutaProtegida>} />
            <Route path="/perfil" element={<RutaProtegida><ConLayout><Perfil /></ConLayout></RutaProtegida>} />

            <Route path="/admin" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><AdminDashboard /></ConLayout></RutaProtegida>} />
            <Route path="/admin/usuarios" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><Usuarios /></ConLayout></RutaProtegida>} />
            <Route path="/admin/cantantes/nuevo" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><CrearCantante /></ConLayout></RutaProtegida>} />
            <Route path="/admin/obras" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ObrasLista /></ConLayout></RutaProtegida>} />
            <Route path="/admin/obras/nueva" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ObraForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/obras/:id" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ObraForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/eventos" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><EventosLista /></ConLayout></RutaProtegida>} />
            <Route path="/admin/eventos/nuevo" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><EventoForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/eventos/:id" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><EventoForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/asistencia" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><AsistenciaAdmin /></ConLayout></RutaProtegida>} />
            <Route path="/admin/pagos" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><PagosAdmin /></ConLayout></RutaProtegida>} />
            <Route path="/admin/avisos" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><AvisosAdmin /></ConLayout></RutaProtegida>} />
            <Route path="/admin/blog" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ArticulosAdmin /></ConLayout></RutaProtegida>} />
            <Route path="/admin/blog/nuevo" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ArticuloForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/blog/:id" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><ArticuloForm /></ConLayout></RutaProtegida>} />
            <Route path="/admin/estudio" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><EstudioAdmin /></ConLayout></RutaProtegida>} />

            <Route path="/admin/asistente" element={<RutaProtegida rolesPermitidos={['admin','director']}><ConLayout><AsistenteRepertorio /></ConLayout></RutaProtegida>} />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ConPresencia>
      </AuthProvider>
    </BrowserRouter>
  )
}
