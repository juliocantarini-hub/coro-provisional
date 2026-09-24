import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCoroActual } from '../lib/coro'

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

// Intenta suscribir al usuario a las notificaciones push. La usan tanto el
// intento automático al iniciar sesión como el botón "Activar notificaciones"
// de Mi perfil (para quien nunca llegó a decidir, o a quien falló el intento
// automático). Si el usuario ya bloqueó el permiso antes, el navegador
// resuelve requestPermission() como 'denied' sin mostrar nada — eso no se
// puede reabrir por código, solo a mano desde la configuración del navegador.
export async function suscribirPush(user) {
  if (!user) return { ok: false, motivo: 'sin_usuario' }
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, motivo: 'no_soportado' }
  }

  try {
    const registration = await navigator.serviceWorker.ready
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      return { ok: false, motivo: 'permiso_denegado' }
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })

    const { endpoint, keys } = subscription.toJSON()

    // Si este mismo navegador tenía un endpoint distinto guardado de una
    // suscripción anterior (el navegador lo rota de tanto en tanto), borramos
    // esa fila vieja para no dejarla viva recibiendo notificaciones en paralelo
    // con la nueva (causaba que a algunos les llegara la misma notificación
    // duplicada).
    try {
      const endpointAnterior = localStorage.getItem('corum_push_endpoint')
      if (endpointAnterior && endpointAnterior !== endpoint) {
        await supabase.from('push_suscripciones')
          .delete()
          .eq('perfil_id', user.id)
          .eq('endpoint', endpointAnterior)
      }
    } catch (err) {
      console.error('Error al limpiar suscripción push anterior:', err)
    }

    const coro = await getCoroActual()

    const datos = {
      perfil_id: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth
    }
    if (coro) datos.coro_id = coro.id

    await supabase.from('push_suscripciones').upsert(
      datos,
      { onConflict: 'perfil_id,endpoint' }
    )

    try { localStorage.setItem('corum_push_endpoint', endpoint) } catch {}

    return { ok: true }
  } catch (err) {
    console.error('Error al suscribir push:', err)
    return { ok: false, motivo: 'error', error: err }
  }
}

// Intento automático y silencioso al iniciar sesión (comportamiento existente,
// sin cambios). No muestra nada si falla o si el permiso ya estaba bloqueado.
export function usePushSubscription(user) {
  useEffect(() => {
    if (!user) return
    suscribirPush(user)
  }, [user])
}
