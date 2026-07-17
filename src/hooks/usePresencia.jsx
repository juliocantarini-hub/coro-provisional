import { useEffect, useState, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

const PresenciaContext = createContext([])         // ids (compatibilidad con lo existente)
const PresenciaDetalleContext = createContext([])  // [{ id, nombre }]

export function PresenciaProvider({ perfil, children }) {
  const [activos, setActivos] = useState([])
  const [activosDetalle, setActivosDetalle] = useState([])

  useEffect(() => {
    if (!perfil?.id) return

    let canal

    async function iniciarPresencia() {
      const coro = await getCoroActual()
      const nombreCanal = coro ? `presencia-${coro.slug}` : 'presencia-coro'

      canal = supabase.channel(nombreCanal)

      function actualizarDesdeEstado() {
        const state = canal.presenceState()
        const detalle = Object.values(state)
          .map(presencias => presencias[0])
          .filter(Boolean)
        setActivosDetalle(detalle)
        setActivos(detalle.map(p => p.id))
      }

      canal
        .on('presence', { event: 'sync' }, actualizarDesdeEstado)
        .on('presence', { event: 'join' }, actualizarDesdeEstado)
        .on('presence', { event: 'leave' }, actualizarDesdeEstado)
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await canal.track({ id: perfil.id, nombre: perfil.nombre })
          }
        })
    }

    iniciarPresencia()

    return () => {
      if (canal) {
        canal.untrack()
        supabase.removeChannel(canal)
      }
    }
  }, [perfil?.id])

  return (
    <PresenciaContext.Provider value={activos}>
      <PresenciaDetalleContext.Provider value={activosDetalle}>
        {children}
      </PresenciaDetalleContext.Provider>
    </PresenciaContext.Provider>
  )
}

export function usePresencia() {
  return useContext(PresenciaContext)
}

export function usePresenciaDetalle() {
  return useContext(PresenciaDetalleContext)
}
