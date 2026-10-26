// CORUM — Edge Function "crear-cantante": un director/admin crea la cuenta de un cantante de su coro.
// Desplegar en: supabase.com → proyecto → Edge Functions → crear-cantante (pegar este archivo).
// No hace falta configurar claves: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY las trae Supabase.
//
// Seguridad: solo puede llamarla alguien con sesión iniciada que sea director o admin DEL MISMO coro al que
// quiere agregar el cantante. (La versión anterior no lo verificaba: cualquiera con la clave pública de la
// app podía crear cuentas en cualquier coro.)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function responder(cuerpo: unknown, status = 200) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. ¿Quién llama? Tiene que tener sesión y ser director/admin del coro
    const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
    const { data: sesion, error: sesionError } = await supabase.auth.getUser(token)
    if (sesionError || !sesion?.user) {
      return responder({ error: 'Necesitás iniciar sesión.' }, 401)
    }

    const { email, password, nombre, voz, telefono, fecha_nacimiento, dni, coro_id } = await req.json()

    if (!email || !password || !nombre || !coro_id) {
      return responder({ error: 'Faltan datos: nombre, email y contraseña son obligatorios.' }, 400)
    }

    const { data: quien } = await supabase
      .from('perfiles').select('rol, coro_id').eq('id', sesion.user.id).single()
    if (!quien || !['director', 'admin'].includes(quien.rol) || quien.coro_id !== coro_id) {
      return responder({ error: 'No tenés permiso para agregar cantantes a este coro.' }, 403)
    }

    // 2. Crear usuario en Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    })
    if (authError) {
      return responder({ error: authError.message }, 400)
    }
    const userId = authData.user.id

    // 3. Completar el perfil (el trigger ya lo crea al dar de alta el usuario; si no, se crea acá)
    const { error: perfilError } = await supabase
      .from('perfiles')
      .upsert({
        id: userId,
        nombre,
        mail: email,
        voz: voz || null,
        telefono: telefono || null,
        fecha_nacimiento: fecha_nacimiento || null,
        dni: dni || null,
        coro_id,
        rol: 'cantante',
        estado: 'activo',
      }, { onConflict: 'id' })

    if (perfilError) {
      await supabase.auth.admin.deleteUser(userId)
      return responder({ error: perfilError.message }, 400)
    }

    return responder({ ok: true, user_id: userId })
  } catch (e) {
    return responder({ error: (e as Error).message }, 500)
  }
})
