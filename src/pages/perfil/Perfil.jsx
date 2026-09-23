import { useState, useEffect } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { suscribirPush } from '../../hooks/usePushSubscription'

const VOCES = ['soprano', 'contralto', 'tenor', 'bajo', 'director']

const TAMANOS = [
  { id: 'normal',  label: 'A',  clase: '',               size: '13px' },
  { id: 'mediana', label: 'A',  clase: 'fuente-mediana', size: '15px' },
  { id: 'grande',  label: 'A',  clase: 'fuente-grande',  size: '17px' },
]

export default function Perfil() {
  const { perfil, usuario, actualizarPerfil, actualizarContrasena } = useAuth()

  const [form, setForm] = useState({
    nombre: '', telefono: '', voz: '',
    fecha_nacimiento: '', dni: '', mail: ''
  })
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState('')
  const [errorMsg, setErrorMsg]     = useState('')
  const [cambioPass, setCambioPass] = useState(false)
  const [nuevaPass, setNuevaPass]   = useState('')
  const [confirmaPass, setConfirmaPass] = useState('')
  const [verNueva, setVerNueva]     = useState(false)
  const [verConfirma, setVerConfirma] = useState(false)
  const [guardandoPass, setGuardandoPass] = useState(false)
  const [mensajePass, setMensajePass] = useState('')
  const [errorPass, setErrorPass]   = useState('')
  const [tamanoFuente, setTamanoFuente] = useState(
    () => localStorage.getItem('tamanoFuente') || 'normal'
  )

  useEffect(() => {
    if (!perfil) return
    setForm({
      nombre: perfil.nombre || '',
      telefono: perfil.telefono || '',
      voz: perfil.voz || '',
      fecha_nacimiento: perfil.fecha_nacimiento || '',
      dni: perfil.dni || '',
      mail: perfil.mail || '',
    })
  }, [perfil])

  function set(campo) { return e => setForm(f => ({ ...f, [campo]: e.target.value })) }

  function cambiarTamano(id) {
    setTamanoFuente(id)
    localStorage.setItem('tamanoFuente', id)
    document.body.classList.remove('fuente-mediana', 'fuente-grande')
    const t = TAMANOS.find(t => t.id === id)
    if (t.clase) document.body.classList.add(t.clase)
    window.dispatchEvent(new Event('tamanoFuenteCambiado'))
  }

  async function handleGuardar(e) {
    e.preventDefault()
    setMensaje(''); setErrorMsg('')
    if (!form.nombre.trim()) { setErrorMsg('El nombre es obligatorio.'); return }
    setGuardando(true)
    const { ok } = await actualizarPerfil({
      nombre: form.nombre.trim(),
      telefono: form.telefono.trim() || null,
      voz: form.voz || null,
      fecha_nacimiento: form.fecha_nacimiento || null,
      dni: form.dni.trim() || null,
      mail: form.mail.trim() || null,
    })
    setGuardando(false)
    if (ok) { setMensaje('Perfil actualizado correctamente.'); setTimeout(() => setMensaje(''), 3000) }
    else setErrorMsg('No se pudo guardar. Intentá de nuevo.')
  }

  async function handleCambioPass(e) {
    e.preventDefault()
    setMensajePass(''); setErrorPass('')
    if (nuevaPass.length < 6) { setErrorPass('La contraseña debe tener al menos 6 caracteres.'); return }
    if (nuevaPass !== confirmaPass) { setErrorPass('Las contraseñas no coinciden.'); return }
    setGuardandoPass(true)
    const { ok } = await actualizarContrasena(nuevaPass)
    setGuardandoPass(false)
    if (ok) {
      setMensajePass('✓ Tu contraseña se actualizó correctamente.')
      setNuevaPass('')
      setConfirmaPass('')
      setTimeout(() => { setMensajePass(''); setCambioPass(false) }, 3000)
    }
    else setErrorPass('No se pudo actualizar la contraseña.')
  }

  const iniciales = perfil?.nombre
    ? perfil.nombre.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div style={{ maxWidth: '560px' }}>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 20px' }}>
        Mi perfil
      </h2>

      {/* Avatar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '24px', background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF' }}>
        <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#1D9E75', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '600', color: 'white', flexShrink: 0 }}>
          {iniciales}
        </div>
        <div>
          <div style={{ fontSize: '16px', fontWeight: '500', color: '#1A1A18' }}>{perfil?.nombre || '—'}</div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px', textTransform: 'capitalize' }}>
            {perfil?.voz && <span style={{ background: '#E1F5EE', color: '#04342C', padding: '2px 8px', borderRadius: '8px', fontWeight: '500', marginRight: '6px' }}>{perfil.voz}</span>}
            {perfil?.rol && <span style={{ background: '#F1EFE8', color: '#5F5E5A', padding: '2px 8px', borderRadius: '8px' }}>{perfil.rol}</span>}
          </div>
        </div>
      </div>

      {/* Formulario */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '22px', border: '1px solid #E8E6DF', marginBottom: '14px' }}>
        <h3 style={estilos.seccionTitulo}>Datos personales</h3>

        {errorMsg && <div style={estilos.alerta('error')}>{errorMsg}</div>}
        {mensaje   && <div style={estilos.alerta('exito')}>{mensaje}</div>}

        <form onSubmit={handleGuardar}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Campo label="Nombre completo *">
              <input value={form.nombre} onChange={set('nombre')} placeholder="María López" style={estilos.input} />
            </Campo>
            <Campo label="Teléfono">
              <input value={form.telefono} onChange={set('telefono')} placeholder="+54 11 0000-0000" style={estilos.input} />
            </Campo>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <Campo label="DNI">
              <input value={form.dni} onChange={set('dni')} placeholder="12345678" style={estilos.input} />
            </Campo>
            <Campo label="Fecha de nacimiento">
              <input type="date" value={form.fecha_nacimiento} onChange={set('fecha_nacimiento')} style={estilos.input} lang="es-AR" />
            </Campo>
          </div>

          <Campo label="Correo electrónico">
            <input value={form.mail} onChange={set('mail')} placeholder="maria@ejemplo.com" style={estilos.input} />
          </Campo>

          <Campo label="Cuerda vocal">
  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
    {VOCES.map(v => (
      <button key={v} type="button" onClick={() => setForm(f => ({ ...f, voz: v }))}
        style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', border: `1.5px solid ${form.voz === v ? '#1D9E75' : '#D3D1C7'}`, background: form.voz === v ? '#E1F5EE' : '#FFFFFF', color: form.voz === v ? '#04342C' : '#5F5E5A', fontWeight: form.voz === v ? '500' : '400', textTransform: 'capitalize' }}>
        {v === 'director' ? 'Director/a' : v}
      </button>
    ))}
  </div>
</Campo>

          <button type="submit" disabled={guardando}
            style={{ marginTop: '8px', height: '40px', padding: '0 20px', borderRadius: '8px', border: 'none', background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
            {guardando ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </form>
      </div>

      {/* Seguridad */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '22px', border: '1px solid #E8E6DF', marginBottom: '14px' }}>
        <h3 style={estilos.seccionTitulo}>Seguridad</h3>
        {!cambioPass ? (
          <button onClick={() => setCambioPass(true)}
            style={{ fontSize: '13px', color: '#0F6E56', background: '#E1F5EE', border: '1px solid #B4D8CE', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer', fontWeight: '500' }}>
            Cambiar contraseña
          </button>
        ) : (
          <form onSubmit={handleCambioPass}>
            {errorPass   && <div style={estilos.alerta('error')}>{errorPass}</div>}
            {mensajePass && <div style={estilos.alerta('exito')}>{mensajePass}</div>}

            <Campo label="Nueva contraseña">
              <div style={{ position: 'relative' }}>
                <input
                  type={verNueva ? 'text' : 'password'}
                  value={nuevaPass}
                  onChange={e => setNuevaPass(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  style={{ ...estilos.input, paddingRight: '40px' }}
                  autoFocus
                />
                <button type="button" onClick={() => setVerNueva(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888780', fontSize: '12px' }}>
                  {verNueva ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </Campo>

            <Campo label="Confirmá la contraseña">
              <div style={{ position: 'relative' }}>
                <input
                  type={verConfirma ? 'text' : 'password'}
                  value={confirmaPass}
                  onChange={e => setConfirmaPass(e.target.value)}
                  placeholder="Repetí la contraseña"
                  style={{ ...estilos.input, paddingRight: '40px' }}
                />
                <button type="button" onClick={() => setVerConfirma(v => !v)}
                  style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#888780', fontSize: '12px' }}>
                  {verConfirma ? 'Ocultar' : 'Ver'}
                </button>
              </div>
            </Campo>

            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              <button type="submit" disabled={guardandoPass}
                style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
                {guardandoPass ? 'Guardando...' : 'Actualizar contraseña'}
              </button>
              <button type="button" onClick={() => { setCambioPass(false); setNuevaPass(''); setConfirmaPass(''); setErrorPass('') }}
                style={{ height: '38px', padding: '0 14px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', color: '#5F5E5A', fontSize: '13px', cursor: 'pointer' }}>
                Cancelar
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Notificaciones */}
      <SeccionNotificaciones usuario={usuario} />

      {/* Tamaño de fuente */}
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '22px', border: '1px solid #E8E6DF' }}>
        <h3 style={estilos.seccionTitulo}>Accesibilidad</h3>
        <p style={{ fontSize: '12px', color: '#888780', marginBottom: '12px' }}>Tamaño del texto en toda la aplicación</p>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {TAMANOS.map(t => {
            const activo = tamanoFuente === t.id
            return (
              <button key={t.id} type="button" onClick={() => cambiarTamano(t.id)}
                style={{
                  width: '48px', height: '40px', borderRadius: '8px', cursor: 'pointer',
                  border: `1.5px solid ${activo ? '#1D9E75' : '#D3D1C7'}`,
                  background: activo ? '#E1F5EE' : '#FFFFFF',
                  color: activo ? '#04342C' : '#5F5E5A',
                  fontWeight: activo ? '600' : '400',
                  fontSize: t.size,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                {t.label}
              </button>
            )
          })}
          <span style={{ fontSize: '12px', color: '#888780', marginLeft: '4px' }}>
            { tamanoFuente === 'normal' ? 'Normal' : tamanoFuente === 'mediana' ? 'Mediano' : 'Grande' }
          </span>
        </div>
      </div>

    </div>
  )
}

function SeccionNotificaciones({ usuario }) {
  const [estado, setEstado] = useState('verificando') // verificando | no_soportado | denegado | suscripto | disponible
  const [activando, setActivando] = useState(false)
  const [errorActivar, setErrorActivar] = useState('')

  async function verificarEstado() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      setEstado('no_soportado')
      return
    }
    if (Notification.permission === 'denied') {
      setEstado('denegado')
      return
    }
    try {
      const registration = await navigator.serviceWorker.ready
      const sub = await registration.pushManager.getSubscription()
      setEstado(sub ? 'suscripto' : 'disponible')
    } catch {
      setEstado('disponible')
    }
  }

  useEffect(() => { verificarEstado() }, [])

  async function handleActivar() {
    setActivando(true)
    setErrorActivar('')
    const resultado = await suscribirPush(usuario)
    setActivando(false)
    if (resultado.ok) {
      await verificarEstado()
    } else if (resultado.motivo === 'permiso_denegado') {
      setEstado('denegado')
    } else {
      setErrorActivar('No se pudo activar. Probá de nuevo en un momento.')
    }
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '22px', border: '1px solid #E8E6DF', marginBottom: '14px' }}>
      <h3 style={estilos.seccionTitulo}>Notificaciones</h3>

      {estado === 'verificando' && (
        <p style={{ fontSize: '13px', color: '#888780' }}>Verificando...</p>
      )}

      {estado === 'no_soportado' && (
        <p style={{ fontSize: '13px', color: '#888780' }}>
          Tu navegador no admite notificaciones push.
        </p>
      )}

      {estado === 'suscripto' && (
        <div style={estilos.alerta('exito')}>✓ Las notificaciones están activadas en este dispositivo.</div>
      )}

      {estado === 'denegado' && (
        <div style={estilos.alerta('error')}>
          Bloqueaste las notificaciones para esta app en algún momento. Para activarlas ahora hay que habilitarlo a mano
          desde la configuración del navegador o del celular (Ajustes → Notificaciones, buscando el nombre de la app;
          o tocando el ícono de información junto a la dirección web y permitiéndolas ahí).
        </div>
      )}

      {estado === 'disponible' && (
        <div>
          <p style={{ fontSize: '13px', color: '#5F5E5A', marginBottom: '12px' }}>
            Activá las notificaciones para enterarte de avisos, ensayos y recordatorios sin tener que abrir la app.
          </p>
          {errorActivar && <div style={estilos.alerta('error')}>{errorActivar}</div>}
          <button onClick={handleActivar} disabled={activando}
            style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: 'none', background: activando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '13px', cursor: activando ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
            {activando ? 'Activando...' : 'Activar notificaciones'}
          </button>
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {children}
    </div>
  )
}

const estilos = {
  seccionTitulo: { fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px', paddingBottom: '10px', borderBottom: '1px solid #F1EFE8' },
  input: { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' },
  alerta: (tipo) => ({
    background: tipo === 'error' ? '#FCEBEB' : '#E1F5EE',
    border: `1px solid ${tipo === 'error' ? '#E24B4A' : '#1D9E75'}`,
    borderRadius: '8px', padding: '10px 12px', fontSize: '13px',
    color: tipo === 'error' ? '#501313' : '#04342C', marginBottom: '14px',
  }),
}