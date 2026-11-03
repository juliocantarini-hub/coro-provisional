import { useState, useCallback, useEffect } from 'react'
import { useAuth } from './useAuth'
import { LECCIONES } from '../lib/teoria'

// Lecciones de teoría ya vistas. Por ahora se guarda en el dispositivo (sin tabla en Supabase).
const clave = (id) => `teoria_vistas_${id}`

function leer(id) {
  if (!id) return []
  try {
    const r = JSON.parse(localStorage.getItem(clave(id)) || '[]')
    return Array.isArray(r) ? r : []
  } catch { return [] }
}

export function useTeoriaProgreso() {
  const { usuario } = useAuth()
  const uid = usuario?.id
  const [vistas, setVistas] = useState(() => leer(uid))
  useEffect(() => { setVistas(leer(uid)) }, [uid])

  const marcar = useCallback((leccionId) => {
    setVistas((prev) => {
      if (prev.includes(leccionId)) return prev
      const nuevas = [...prev, leccionId]
      try { if (uid) localStorage.setItem(clave(uid), JSON.stringify(nuevas)) } catch { /* sin almacenamiento */ }
      return nuevas
    })
  }, [uid])

  return { vistas, marcar, total: LECCIONES.length }
}
