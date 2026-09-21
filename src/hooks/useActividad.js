import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import {
  clasificarRuta,
  establecerPerfilActivo,
  registrarActividad,
  registrarSesionSiCorresponde,
} from '../lib/actividad'

// Se usa una sola vez, en AppLayout: registra los ingresos y las pantallas
// que va mirando la persona (ver src/lib/actividad.js).
export function useRegistrarActividad(perfil) {
  const perfilId = perfil?.id
  const { pathname } = useLocation()

  // Ingresos a la app (al abrirla y al volver después de un rato)
  useEffect(() => {
    if (!perfilId) return
    establecerPerfilActivo(perfilId)
    registrarSesionSiCorresponde()

    const alVolver = () => {
      if (document.visibilityState === 'visible') registrarSesionSiCorresponde()
    }
    document.addEventListener('visibilitychange', alVolver)
    return () => document.removeEventListener('visibilitychange', alVolver)
  }, [perfilId])

  // Pantallas que mira
  useEffect(() => {
    if (!perfilId) return
    establecerPerfilActivo(perfilId)
    const ruta = clasificarRuta(pathname)
    if (ruta) registrarActividad(ruta.tipo, { refId: ruta.refId, detalle: ruta.detalle })
  }, [perfilId, pathname])
}
