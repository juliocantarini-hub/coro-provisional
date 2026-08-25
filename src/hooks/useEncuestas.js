import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// Lógica compartida para ver el detalle de UNA encuesta puntual (votar, ver resultados, ver quién votó qué)
function useEncuestaBase(fetchEncuesta, deps) {
  const [encuesta, setEncuesta] = useState(null)
  const [opciones, setOpciones] = useState([])
  const [votos, setVotos] = useState([])
  const [miPerfilId, setMiPerfilId] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)

    const { data: userData } = await supabase.auth.getSession()
    const perfilId = userData?.session?.user?.id || null
    setMiPerfilId(perfilId)

    const encuestaData = await fetchEncuesta()

    if (!encuestaData) {
      setEncuesta(null)
      setOpciones([])
      setVotos([])
      setCargando(false)
      return
    }

    setEncuesta(encuestaData)

    const { data: opcionesData } = await supabase
      .from('encuesta_opciones')
      .select('*')
      .eq('encuesta_id', encuestaData.id)
      .order('orden', { ascending: true })

    setOpciones(opcionesData || [])

    const { data: votosData } = await supabase
      .from('encuesta_votos')
      .select('*')
      .eq('encuesta_id', encuestaData.id)

    setVotos(votosData || [])
    setCargando(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { cargar() }, [cargar])

  async function votar(opcionId) {
    if (!encuesta || encuesta.estado !== 'abierta' || !miPerfilId) return

    if (encuesta.permite_multiple) {
      const yaVotado = votos.find(v => v.opcion_id === opcionId && v.perfil_id === miPerfilId)
      if (yaVotado) {
        await supabase.from('encuesta_votos').delete().eq('id', yaVotado.id)
      } else {
        await supabase.from('encuesta_votos').insert({
          encuesta_id: encuesta.id,
          opcion_id: opcionId,
          perfil_id: miPerfilId
        })
      }
    } else {
      const misVotos = votos.filter(v => v.perfil_id === miPerfilId)
      if (misVotos.length) {
        await supabase.from('encuesta_votos').delete().in('id', misVotos.map(v => v.id))
      }
      await supabase.from('encuesta_votos').insert({
        encuesta_id: encuesta.id,
        opcion_id: opcionId,
        perfil_id: miPerfilId
      })
    }
    await cargar()
  }

  function resultados() {
    const votantes = new Set(votos.map(v => v.perfil_id)).size
    return opciones.map(op => {
      const count = votos.filter(v => v.opcion_id === op.id).length
      const porcentaje = votantes ? Math.round((count / votantes) * 100) : 0
      return { ...op, count, porcentaje }
    })
  }

  function miVoto() {
    return votos.filter(v => v.perfil_id === miPerfilId).map(v => v.opcion_id)
  }

  // Solo para Admin: quién votó qué opción (el voto NO es anónimo)
  // Join manual (no embed automático) porque perfiles tiene PK compuesta (id, coro_id)
  // — el mismo id (ej. cuenta de soporte) puede repetirse en distintos coros.
  async function detalleVotos() {
    if (!encuesta) return []

    const { data: votosData } = await supabase
      .from('encuesta_votos')
      .select('opcion_id, perfil_id')
      .eq('encuesta_id', encuesta.id)

    const votosConPerfil = votosData || []
    const perfilIds = [...new Set(votosConPerfil.map(v => v.perfil_id))]

    let nombresPorId = {}
    if (perfilIds.length) {
      const { data: perfilesData } = await supabase
        .from('perfiles')
        .select('id, nombre')
        .eq('coro_id', encuesta.coro_id)
        .in('id', perfilIds)

      nombresPorId = (perfilesData || []).reduce((acc, p) => {
        acc[p.id] = p.nombre
        return acc
      }, {})
    }

    return opciones.map(op => ({
      ...op,
      votantes: votosConPerfil
        .filter(v => v.opcion_id === op.id)
        .map(v => nombresPorId[v.perfil_id] || 'Sin nombre')
    }))
  }

  return { encuesta, opciones, votos, miPerfilId, cargando, votar, resultados, miVoto, detalleVotos, recargar: cargar }
}

// Lado aviso: trae la encuesta ligada a un aviso puntual (avisoId null = no busca nada)
export function useEncuesta(avisoId) {
  return useEncuestaBase(async () => {
    if (!avisoId) return null
    const { data } = await supabase
      .from('encuestas')
      .select('*')
      .eq('aviso_id', avisoId)
      .maybeSingle()
    return data
  }, [avisoId])
}

// Detalle de una encuesta puntual por id (para votar o para el detalle del Admin)
export function useEncuestaPorId(encuestaId) {
  return useEncuestaBase(async () => {
    if (!encuestaId) return null
    const { data } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('id', encuestaId)
      .maybeSingle()
    return data
  }, [encuestaId])
}

// Lado cantante: solo encuestas ABIERTAS del coro, con flag de si ya votó cada una
// Usar en la tarjeta resumen de Inicio y en el badge del menú (conteo de pendientes)
export function useEncuestasActivas() {
  const [encuestas, setEncuestas] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    if (!coro) {
      setEncuestas([])
      setCargando(false)
      return
    }

    const { data: userData } = await supabase.auth.getSession()
    const perfilId = userData?.session?.user?.id || null

    const { data: encuestasData } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('coro_id', coro.id)
      .eq('estado', 'abierta')
      .order('creado_en', { ascending: false })

    const lista = encuestasData || []

    if (lista.length && perfilId) {
      const { data: votosData } = await supabase
        .from('encuesta_votos')
        .select('encuesta_id')
        .eq('perfil_id', perfilId)
        .in('encuesta_id', lista.map(e => e.id))

      const votadas = new Set((votosData || []).map(v => v.encuesta_id))
      setEncuestas(lista.map(e => ({ ...e, yaVote: votadas.has(e.id) })))
    } else {
      setEncuestas(lista.map(e => ({ ...e, yaVote: false })))
    }

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { encuestas, cargando, recargar: cargar }
}

// Lado cantante — vista dedicada "Encuestas": TODAS (abiertas arriba, cerradas abajo con sus resultados)
export function useEncuestasCantante() {
  const [encuestas, setEncuestas] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    if (!coro) {
      setEncuestas([])
      setCargando(false)
      return
    }

    const { data: userData } = await supabase.auth.getSession()
    const perfilId = userData?.session?.user?.id || null

    const { data: abiertasData } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('coro_id', coro.id)
      .eq('estado', 'abierta')
      .order('creado_en', { ascending: false })

    const { data: cerradasData } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('coro_id', coro.id)
      .eq('estado', 'cerrada')
      .order('creado_en', { ascending: false })

    const lista = [...(abiertasData || []), ...(cerradasData || [])]

    if (lista.length && perfilId) {
      const { data: votosData } = await supabase
        .from('encuesta_votos')
        .select('encuesta_id')
        .eq('perfil_id', perfilId)
        .in('encuesta_id', lista.map(e => e.id))

      const votadas = new Set((votosData || []).map(v => v.encuesta_id))
      setEncuestas(lista.map(e => ({ ...e, yaVote: votadas.has(e.id) })))
    } else {
      setEncuestas(lista.map(e => ({ ...e, yaVote: false })))
    }

    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { encuestas, cargando, recargar: cargar }
}

// Lado Admin: TODAS las encuestas del coro (abiertas y cerradas)
export function useEncuestasAdmin() {
  const [encuestas, setEncuestas] = useState([])
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    if (!coro) {
      setEncuestas([])
      setCargando(false)
      return
    }

    const { data } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('coro_id', coro.id)
      .order('creado_en', { ascending: false })

    setEncuestas(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  return { encuestas, cargando, recargar: cargar }
}

async function enviarNotificacionEncuesta(coroId, pregunta) {
  try {
    if (!coroId) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: { coro_id: coroId, titulo: `Nueva encuesta: ${pregunta}`, cuerpo: '' }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

// Para el lado admin: crear, cerrar, reabrir y eliminar encuestas
export function useCrearEncuesta() {
  async function crearEncuesta({ avisoId, coroId, pregunta, permiteMultiple, opciones }) {
    const { data: encuestaData, error } = await supabase
      .from('encuestas')
      .insert({ aviso_id: avisoId, coro_id: coroId, pregunta, permite_multiple: permiteMultiple })
      .select()
      .single()

    if (error) throw error

    const filas = opciones
      .filter(texto => texto.trim())
      .map((texto, i) => ({ encuesta_id: encuestaData.id, texto: texto.trim(), orden: i }))

    if (filas.length) {
      const { error: errorOpciones } = await supabase.from('encuesta_opciones').insert(filas)
      if (errorOpciones) throw errorOpciones
    }

    await enviarNotificacionEncuesta(coroId, pregunta)

    return encuestaData
  }

  async function cerrarEncuesta(encuestaId) {
    await supabase.from('encuestas').update({ estado: 'cerrada' }).eq('id', encuestaId)
  }

  async function reabrirEncuesta(encuestaId) {
    await supabase.from('encuestas').update({ estado: 'abierta' }).eq('id', encuestaId)
  }

  async function eliminarEncuesta(encuestaId) {
    // Orden importa por las FK: primero votos, después opciones, recién ahí la encuesta
    await supabase.from('encuesta_votos').delete().eq('encuesta_id', encuestaId)
    await supabase.from('encuesta_opciones').delete().eq('encuesta_id', encuestaId)
    const { error } = await supabase.from('encuestas').delete().eq('id', encuestaId)
    if (error) throw error
  }

  return { crearEncuesta, cerrarEncuesta, reabrirEncuesta, eliminarEncuesta }
}
