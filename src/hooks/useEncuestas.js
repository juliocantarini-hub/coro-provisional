import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

// Lógica compartida entre "encuesta de un aviso puntual" y "encuesta activa del coro"
function useEncuestaBase(fetchEncuesta, deps) {
  const [encuesta, setEncuesta] = useState(null)
  const [opciones, setOpciones] = useState([])
  const [votos, setVotos] = useState([])
  const [miPerfilId, setMiPerfilId] = useState(null)
  const [cargando, setCargando] = useState(true)

  const cargar = useCallback(async () => {
    setCargando(true)

    const { data: userData } = await supabase.auth.getUser()
    const perfilId = userData?.user?.id || null
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

  return { encuesta, opciones, votos, miPerfilId, cargando, votar, resultados, miVoto, recargar: cargar }
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

// Lado dashboard: trae la encuesta abierta más reciente del coro actual
export function useEncuestaActiva() {
  return useEncuestaBase(async () => {
    const coro = await getCoroActual()
    if (!coro) return null
    const { data } = await supabase
      .from('encuestas')
      .select('*, avisos(titulo)')
      .eq('coro_id', coro.id)
      .eq('estado', 'abierta')
      .order('creado_en', { ascending: false })
      .limit(1)
      .maybeSingle()
    return data
  }, [])
}

// Para el lado admin: crear, cerrar y reabrir encuestas
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

    return encuestaData
  }

  async function cerrarEncuesta(encuestaId) {
    await supabase.from('encuestas').update({ estado: 'cerrada' }).eq('id', encuestaId)
  }

  async function reabrirEncuesta(encuestaId) {
    await supabase.from('encuestas').update({ estado: 'abierta' }).eq('id', encuestaId)
  }

  return { crearEncuesta, cerrarEncuesta, reabrirEncuesta }
}