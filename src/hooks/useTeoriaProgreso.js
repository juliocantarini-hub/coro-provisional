import { useState, useCallback, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './useAuth'
import { LECCIONES } from '../lib/teoria'

// Lecciones de teoría ya completadas. Se guardan en el dispositivo y en Supabase (tabla teoria_progreso,
// ver supabase/teoria_progreso.sql) para que el director las vea en su informe. Si la tabla todavía no existe
// o no hay conexión, sigue funcionando con la copia local; lo que esté solo en el dispositivo se sube después.
// En los proyectos de un solo coro (sin coro_id en perfiles) la fila se guarda sin coro_id.
const clave = (id) => `teoria_vistas_${id}`

function leer(id) {
  if (!id) return []
  try {
    const r = JSON.parse(localStorage.getItem(clave(id)) || '[]')
    return Array.isArray(r) ? r : []
  } catch { return [] }
}
function guardarLocal(id, vistas) {
  try { if (id) localStorage.setItem(clave(id), JSON.stringify(vistas)) } catch { /* sin almacenamiento */ }
}

export function useTeoriaProgreso() {
  const { usuario, perfil } = useAuth()
  const uid = usuario?.id
  const coroId = perfil?.coro_id
  const [vistas, setVistas] = useState(() => leer(uid))

  const subir = useCallback(async (lecciones) => {
    if (!uid || !lecciones.length) return
    try {
      await supabase.from('teoria_progreso').upsert(
        lecciones.map((leccion) => ({ ...(coroId ? { coro_id: coroId } : {}), perfil_id: uid, leccion })),
        { onConflict: 'perfil_id,leccion', ignoreDuplicates: true },
      )
    } catch { /* sin tabla o sin conexión: queda la copia local */ }
  }, [uid, coroId])

  // Al entrar: unir lo local con lo guardado en Supabase y subir lo que falte
  useEffect(() => {
    const locales = leer(uid)
    setVistas(locales)
    if (!uid) return
    let vivo = true
    ;(async () => {
      try {
        const { data, error } = await supabase.from('teoria_progreso').select('leccion').eq('perfil_id', uid)
        if (error || !vivo) return
        const remotas = (data || []).map((f) => f.leccion)
        const todas = [...new Set([...locales, ...remotas])]
        setVistas(todas)
        guardarLocal(uid, todas)
        subir(locales.filter((l) => !remotas.includes(l)))
      } catch { /* sin conexión */ }
    })()
    return () => { vivo = false }
  }, [uid, subir])

  const marcar = useCallback((leccionId) => {
    setVistas((prev) => {
      if (prev.includes(leccionId)) return prev
      const nuevas = [...prev, leccionId]
      guardarLocal(uid, nuevas)
      return nuevas
    })
    subir([leccionId])
  }, [uid, subir])

  return { vistas, marcar, total: LECCIONES.length }
}
