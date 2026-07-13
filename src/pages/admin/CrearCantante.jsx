import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

const VOCES = ['soprano', 'mezzosoprano', 'contralto', 'tenor', 'baritono', 'bajo', 'director']

function soloDigitos(str) {
  return str.split('').filter(c => c >= '0' && c <= '9').join('')
}

export default function CrearCantante() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    nombre: '', email: '', password: '', voz: '',
    telefono: '', fecha_nacimiento: '', fecha_nacimiento_display: '', dni: '',
  })
  const [errores, setErrores] = useState({})
  const [errorGlobal, setErrorGlobal] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [exito, setExito] = useState(false)

  function set(campo) {
    return e => {
      setForm(f => ({ ...f, [campo]: e.target.value }))
      setErrores(er => ({ ...er, [campo]: undefined }))
    }
  }

  function handleFechaTexto(e) {
    const nums = soloDigitos(e.target.value)
    let result = ''
    if (nums.length <= 2) result = nums
    else if (nums.length <= 4) result = nums.slice(0, 2) + '/' + nums.slice(2)
    else result = nums.slice(0, 2) + '/' + nums.slice(2, 4) + '/' + nums.slice(4, 8)
    setForm(f => ({ ...f, fecha_nacimiento_display: result }))
    const partes = result.split('/')
    if (partes.length === 3 && partes[2].length === 4) {
      const iso = partes[2] + '-' + partes[1].padStart(2, '0') + '-' + partes[0].padStart(2, '0')
      if (!isNaN(new Date(iso).getTime())) {
        setForm(f => ({ ...f, fecha_nacimiento: iso }))
      }
    } else {
      setForm(f => ({ ...f, fecha_nacimiento: '' }))
    }
  }

  function handleFechaCalendario(e) {
    const iso = e.target.value
    setForm(f => ({ ...f, fecha_nacimiento: iso }))
    if (iso) {
      const partes = iso.split('-')
      setForm(f => ({ ...f, fecha_nacimiento_display: partes[2] + '/' + partes[1] + '/' + partes[0] }))
    }
  }

  function validar() {
    const e = {}
    if (!form.nombre.trim())            e.nombre   = 'Ingresá el nombre completo.'
    if (!form.email.trim())             e.email    = 'Ingresá el correo electrónico.'
    else if (!form.email.includes('@')) e.email    = 'Escribí un correo válido.'
    if (!form.voz)                      e.voz      = 'Seleccioná la cuerda vocal.'
    if (!form.password)                 e.password = 'Ingresá una contraseña provisoria.'
    else if (form.password.length < 6)  e.password = 'La contraseña debe tener al menos 6 caracteres.'
    return e
  }

  async function handleGuardar() {
    setErrorGlobal('')
    const e = validar()
    if (Object.keys(e).length) { setErrores(e); return }
    setGuardando(true)

    const coro = await getCoroActual()
    if (!coro) { setErrorGlobal('No se pudo identificar el coro.'); setGuardando(false); return }

    const { data: { session } } = await supabase.auth.getSession()
    const token = session?.access_token

    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/crear-cantante`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            email: form.email.trim(),
            password: form.password,
            nombre: form.nombre.trim(),
            voz: form.voz,
            telefono: form.telefono.trim() || null,
            fecha_nacimiento: form.fecha_nacimiento || null,
            dni: form.dni.trim() || null,
            coro_id: coro.id,
          })
        }
      )
      const data = await res.json()
      if (!res.ok || data.error) {
        setErrorGlobal(data.error || 'No se pudo crear el cantante.')
        setGuardando(false)
        return
      }
      setExito(true)
    } catch (err) {
      setErrorGlobal('Error de conexión. Intentá de nuevo.')
    }
    setGuardando(false)
  }

  if (exito) {
    navigate('/admin/usuarios', { state: { mensaje: `${form.nombre} fue agregado correctamente.` } })
    return null
  }

  return (
    <div style={{ maxWidth: '480px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/admin/cantantes')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Volver
        </button>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
          Agregar cantante
        </h2>
      </div>

      {errorGlobal && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>
          {errorGlobal}
        </div>
      )}

      <Campo label="Nombre completo *" error={errores.nombre}>
        <input type="text" value={form.nombre} onChange={set('nombre')} placeholder="María López" style={inputStyle(errores.nombre)} autoFocus />
      </Campo>

      <Campo label="Correo electrónico *" error={errores.email}>
        <input type="email" value={form.email} onChange={set('email')} placeholder="maria@ejemplo.com" style={inputStyle(errores.email)} />
      </Campo>

      <Campo label="Cuerda vocal *" error={errores.voz}>
        <select value={form.voz} onChange={set('voz')} style={{ ...inputStyle(errores.voz), color: form.voz ? '#1A1A18' : '#B4B2A9', cursor: 'pointer', appearance: 'none' }}>
          <option value="" disabled>Seleccioná la voz</option>
          {VOCES.map(v => (
            <option key={v} value={v}>
              {v === 'director' ? 'Director/a' : v === 'mezzosoprano' ? 'Mezzosoprano' : v === 'baritono' ? 'Barítono' : v.charAt(0).toUpperCase() + v.slice(1)}
            </option>
          ))}
        </select>
      </Campo>

      <Campo label="Teléfono / Celular">
        <input type="tel" value={form.telefono} onChange={set('telefono')} placeholder="+54 11 0000-0000" style={inputStyle()} />
      </Campo>

      <Campo label="Fecha de nacimiento">
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <input type="text" placeholder="DD/MM/AAAA" value={form.fecha_nacimiento_display || ''} onChange={handleFechaTexto} style={inputStyle()} />
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <input type="date" value={form.fecha_nacimiento || ''} onChange={handleFechaCalendario}
              style={{ position: 'absolute', opacity: 0, width: '40px', height: '40px', top: 0, left: 0, cursor: 'pointer' }} />
            <div style={{ width: '40px', height: '42px', border: '1px solid #D3D1C7', borderRadius: '8px', background: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="#888780">
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5C3.9 3 3 3.9 3 5v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
            </div>
          </div>
        </div>
      </Campo>

      <Campo label="DNI">
        <input type="text" value={form.dni} onChange={set('dni')} placeholder="12345678" style={inputStyle()} />
      </Campo>

      <Campo label="Contraseña provisoria *" error={errores.password}>
        <input type="text" value={form.password} onChange={set('password')} placeholder="Mínimo 6 caracteres" style={inputStyle(errores.password)} />
      </Campo>
      <p style={{ fontSize: '11px', color: '#888780', margin: '-8px 0 14px' }}>
        El cantante podrá cambiarla después desde su perfil.
      </p>

      <button onClick={handleGuardar} disabled={guardando}
        style={{ width: '100%', height: '42px', borderRadius: '8px', border: 'none', background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '500', marginTop: '8px' }}>
        {guardando ? 'Creando cantante...' : 'Agregar cantante'}
      </button>
    </div>
  )
}

function Campo({ label, error, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: '12px', color: '#A32D2D', margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}

function inputStyle(error) {
  return {
    width: '100%', height: '42px', border: `1px solid ${error ? '#E24B4A' : '#D3D1C7'}`,
    borderRadius: '8px', padding: '0 14px', fontSize: '14px', color: '#1A1A18',
    background: '#FFFFFF', outline: 'none', boxSizing: 'border-box',
  }
}
