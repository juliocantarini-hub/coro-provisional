import { supabase } from './supabase'

// Período de estudio: el director puede "empezar un nuevo período" (por ejemplo al comenzar el año) y el
// porcentaje de estudio pasa a contar solo desde esa fecha. No se borra nada: cada inicio queda guardado en
// la tabla estudio_periodos (ver supabase/estudio_periodos.sql) y el vigente es el último.
// Si la tabla todavía no existe, todo sigue contando como antes (todo el historial).

// Fecha (ISO) desde la que se cuenta el estudio, o null si se cuenta todo el historial.
export async function leerEstudioDesde(coroId) {
  try {
    const { data, error } = await supabase.from('estudio_periodos')
      .select('desde').eq('coro_id', coroId)
      .order('created_at', { ascending: false }).limit(1)
    if (error) return null
    return data?.[0]?.desde || null
  } catch { return null }
}

// Todos los inicios de período, del más nuevo al más viejo (para el panel del director).
export async function leerPeriodosEstudio(coroId) {
  const { data, error } = await supabase.from('estudio_periodos')
    .select('id, desde, created_at').eq('coro_id', coroId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data || []
}

export async function empezarPeriodoEstudio(coroId) {
  const { error } = await supabase.from('estudio_periodos').insert({ coro_id: coroId })
  if (error) throw error
}

// Deshace el último inicio de período (vuelve al anterior, o a contar todo si no había otro).
export async function volverPeriodoAnterior(coroId, periodoId) {
  const { data, error } = await supabase.from('estudio_periodos')
    .delete().eq('coro_id', coroId).eq('id', periodoId).select('id')
  if (error) throw error
  if (!data?.length) throw new Error('sin permiso')
}
