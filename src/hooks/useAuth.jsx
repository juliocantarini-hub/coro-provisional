import { useState, useEffect, createContext, useContext } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const auth = useAuthLogic()
  return <AuthContext.Provider value={auth}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>')
  return ctx
}

function useAuthLogic() {
  const [usuario, setUsuario] = useState(null)
  const [perfil, setPerfil]   = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError]     = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUsuario(session?.user ?? null)
      if (session?.user) cargarPerfil(session.user.id)
      else setCargando(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUsuario(session?.user ?? null)
        if (session?.user) cargarPerfil(session.user.id)
        else {
          setPerfil(null)
          setCargando(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  async function cargarPerfil(userId) {
    try {
      const coro = await getCoroActual()

      // Setear el coro activo en la sesión de Supabase
      await supabase.rpc('set_coro_activo', { p_coro_id: coro.id })

      const { data, error } = await supabase
        .from('perfiles')
        .select('*')
        .eq('id', userId)
        .eq('coro_id', coro.id)
        .single()

      if (error) throw error

      const { data: authData } = await supabase.auth.getUser()
      const meta = authData?.user?.user_metadata
      const updates = {}
      if (!data.voz && meta?.voz) updates.voz = meta.voz
      if (!data.mail) updates.mail = authData?.user?.email
      if (Object.keys(updates).length > 0) {
        await supabase.from('perfiles').update(updates).eq('id', userId).eq('coro_id', coro.id)
        Object.assign(data, updates)
      }

      setPerfil(data)
    } catch (err) {
      console.error('Error cargando perfil:', err)
    } finally {
      setCargando(false)
    }
  }

  async function login(email, password) {
    setError(null)
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    if (error) {
      setError(traducirError(error.message))
      return { ok: false, error: traducirError(error.message) }
    }
    return { ok: true, data }
  }

  async function loginConGoogle() {
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/`,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (error) setError(traducirError(error.message))
  }

  async function registro(email, password, nombre, voz, fecha_nacimiento, dni, telefono) {
    setError(null)
    try {
      const coro = await getCoroActual()
      const { data, error } = await supabase.auth.signUp({
        email: email.trim().toLowerCase(),
        password,
        options: {
          data: {
            nombre: nombre.trim(),
            voz: voz || null,
            fecha_nacimiento: fecha_nacimiento || null,
            dni: dni || null,
            telefono: telefono || null,
            coro_id: coro.id,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      })
      if (error) {
        setError(traducirError(error.message))
        return { ok: false, error: traducirError(error.message) }
      }
      return {
        ok: true,
        necesitaConfirmacion: !data.session,
        data,
      }
    } catch (err) {
      setError('Error al obtener datos del coro.')
      return { ok: false, error: 'Error al obtener datos del coro.' }
    }
  }

  async function recuperarContrasena(email) {
    setError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim().toLowerCase(),
      { redirectTo: `${window.location.origin}/reset-password` }
    )
    if (error) {
      setError(traducirError(error.message))
      return { ok: false, error: traducirError(error.message) }
    }
    return { ok: true }
  }

  async function actualizarContrasena(nuevaContrasena) {
    setError(null)
    const { error } = await supabase.auth.updateUser({
      password: nuevaContrasena,
    })
    if (error) {
      setError(traducirError(error.message))
      return { ok: false, error: traducirError(error.message) }
    }
    return { ok: true }
  }

  async function actualizarPerfil(datos) {
    if (!usuario) return { ok: false, error: 'No hay sesión activa' }
    const coro = await getCoroActual()
    const { data, error } = await supabase
      .from('perfiles')
      .update({ ...datos, actualizado_en: new Date().toISOString() })
      .eq('id', usuario.id)
      .eq('coro_id', coro.id)
      .select()
      .single()
    if (error) return { ok: false, error: error.message }
    setPerfil(data)
    return { ok: true, data }
  }

  async function cerrarSesion() {
    await supabase.auth.signOut()
    setPerfil(null)
    setUsuario(null)
    try { sessionStorage.removeItem('corum_vista_inicial_aplicada') } catch {}
  }

  const esAdmin    = perfil?.rol === 'admin'
  const esDirector = perfil?.rol === 'director' || esAdmin
  const esCantante = !!perfil

  return {
    usuario, perfil, cargando, error, setError,
    login, loginConGoogle, registro,
    recuperarContrasena, actualizarContrasena,
    actualizarPerfil, cerrarSesion,
    esAdmin, esDirector, esCantante,
  }
}

function traducirError(msg) {
  if (!msg) return 'Ocurrió un error inesperado.'
  const m = msg.toLowerCase()
  if (m.includes('invalid login credentials'))  return 'Correo o contraseña incorrectos.'
  if (m.includes('email not confirmed'))        return 'Confirmá tu correo antes de ingresar. Revisá tu bandeja de entrada.'
  if (m.includes('user already registered'))   return 'Ya existe una cuenta con ese correo.'
  if (m.includes('password should be'))        return 'La contraseña debe tener al menos 6 caracteres.'
  if (m.includes('rate limit'))                return 'Demasiados intentos. Esperá unos minutos antes de volver a intentarlo.'
  if (m.includes('network'))                   return 'Error de conexión. Revisá tu internet e intentá de nuevo.'
  if (m.includes('user not found'))            return 'No encontramos una cuenta con ese correo.'
  return 'Ocurrió un error inesperado. Intentá de nuevo.'
}