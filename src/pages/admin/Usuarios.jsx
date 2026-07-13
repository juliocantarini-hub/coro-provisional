import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

const ROLES   = ['cantante', 'director', 'admin']
const VOCES   = ['soprano', 'contralto', 'tenor', 'bajo']
const ESTADOS = ['activo', 'pausa', 'inactivo']

const VOCES_COLOR = {
  soprano:   { bg: '#FAECE7', color: '#712B13' },
  contralto: { bg: '#F3EFF8', color: '#3D1C6E' },
  tenor:     { bg: '#E6F1FB', color: '#042C53' },
  bajo:      { bg: '#E1F5EE', color: '#04342C' },
}

const ROLE_STYLE = {
  cantante: { bg: '#E1F5EE', color: '#04342C' },
  director: { bg: '#FAECE7', color: '#712B13' },
  admin:    { bg: '#E6F1FB', color: '#042C53' },
}

const CAMPOS_DISPONIBLES = [
  { key: 'nombre',           label: 'Nombre' },
  { key: 'telefono',         label: 'Celular' },
  { key: 'dni',              label: 'DNI' },
  { key: 'mail',             label: 'Mail' },
  { key: 'fecha_nacimiento', label: 'Fecha de nacimiento' },
]

function useEsMovil() {
  return window.innerWidth <= 768
}

function imprimirListado(usuarios, camposSeleccionados) {
  const voces = ['soprano', 'contralto', 'tenor', 'bajo']
  const soloActivos = usuarios.filter(u => u.estado === 'activo' && u.rol !== 'director' && u.rol !== 'admin')
  const porVoz = voces.reduce((acc, v) => {
    acc[v] = soloActivos.filter(u => u.voz === v)
    return acc
  }, {})
  const sinVoz = soloActivos.filter(u => !u.voz || !voces.includes(u.voz))
  const directores = usuarios.filter(u => (u.rol === 'director' || u.rol === 'admin') && u.estado === 'activo')
  const director = directores[0]

  const campos = CAMPOS_DISPONIBLES.filter(c => camposSeleccionados.includes(c.key))
  const filaHeader = `<tr>${campos.map(c => `<th>${c.label}</th>`).join('')}</tr>`

  function seccion(titulo, lista) {
    if (!lista.length) return ''
    const filas = lista.map(u => `
      <tr>
        ${campos.map(c => {
          if (c.key === 'fecha_nacimiento' && u[c.key]) {
            return `<td>${new Date(u[c.key] + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</td>`
          }
          return `<td>${u[c.key] || '—'}</td>`
        }).join('')}
      </tr>
    `).join('')
    return `
      <div class="seccion">
        <h2>${titulo} <span class="count">(${lista.length})</span></h2>
        <table>
          <thead>${filaHeader}</thead>
          <tbody>${filas}</tbody>
        </table>
      </div>
    `
  }

  const html = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Listado de cantantes</title>
      <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: Georgia, serif; font-size: 13px; color: #1A1A18; padding: 32px; }
        .encabezado { margin-bottom: 28px; }
        h1 { font-size: 22px; font-weight: normal; margin-bottom: 2px; }
        .director { font-size: 13px; color: #0F6E56; margin-bottom: 4px; }
        .fecha { font-size: 11px; color: #888780; }
        .seccion { margin-bottom: 28px; page-break-inside: avoid; }
        h2 { font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: #0F6E56; border-bottom: 2px solid #0F6E56; padding-bottom: 6px; margin-bottom: 12px; }
        .count { font-weight: normal; color: #888780; font-size: 12px; }
        table { width: 100%; border-collapse: collapse; }
        th { text-align: left; font-size: 11px; font-weight: 600; color: #5F5E5A; text-transform: uppercase; letter-spacing: 0.3px; padding: 6px 8px; border-bottom: 1px solid #D3D1C7; }
        td { padding: 7px 8px; border-bottom: 1px solid #F1EFE8; font-size: 13px; }
        tr:last-child td { border-bottom: none; }
        @media print { body { padding: 16px; } }
      </style>
    </head>
    <body>
      <div class="encabezado">
        <h1>${import.meta.env.VITE_CORO_NOMBRE || "Mi Coro"}</h1>
        ${director ? `<div class="director">Director/a: ${director.nombre}</div>` : ''}
        <div class="fecha">Generado el ${new Date().toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
      </div>
      ${seccion('Sopranos', porVoz.soprano)}
      ${porVoz.mezzo?.length ? seccion('Mezzos', porVoz.mezzo) : ''}
      ${seccion('Contraltos', porVoz.contralto)}
      ${seccion('Tenores', porVoz.tenor)}
      ${porVoz.baritono?.length ? seccion('Barítono', porVoz.baritono) : ''}
      ${seccion('Bajos', porVoz.bajo)}
      ${sinVoz.length ? seccion('Sin cuerda asignada', sinVoz) : ''}
      ${seccion('Dirección', directores)}
    </body>
    </html>
  `

  const ventana = window.open('', '_blank')
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  setTimeout(() => ventana.print(), 500)
}

export default function Usuarios() {
  const [usuarios, setUsuarios]     = useState([])
  const [cargando, setCargando]     = useState(true)
  const [busqueda, setBusqueda]     = useState('')
  const [editando, setEditando]     = useState(null)
  const [guardando, setGuardando]   = useState(false)
  const [mensaje, setMensaje]       = useState('')
  const [confirmDesactivar, setConfirmDesactivar] = useState(null)
  const [confirmEliminar, setConfirmEliminar]     = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [resetPass, setResetPass]   = useState(null)
  const [nuevaPass, setNuevaPass]   = useState('')
  const [confirmarPass, setConfirmarPass] = useState('')
  const [resetando, setResetando]   = useState(false)
  const [mostrarImprimir, setMostrarImprimir] = useState(false)
  const [camposImprimir, setCamposImprimir]   = useState(['nombre', 'telefono', 'mail'])
  const esMovil = useEsMovil()

  const cargar = useCallback(async () => {
    setCargando(true)
    const coro = await getCoroActual()
    const { data } = await supabase.from('perfiles').select('*').eq('coro_id', coro.id).order('nombre')
    setUsuarios(data || [])
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = usuarios.filter(u =>
    !busqueda ||
    u.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.voz?.toLowerCase().includes(busqueda.toLowerCase()) ||
    u.rol?.toLowerCase().includes(busqueda.toLowerCase())
  )

  const activos    = usuarios.filter(u => u.estado === 'activo').length
  const pendientes = usuarios.filter(u => u.estado === 'pendiente').length

  function actualizarLocal(id, cambios) {
    setUsuarios(prev => prev.map(u => u.id === id ? { ...u, ...cambios } : u))
  }

  async function guardarEdicion() {
    if (!editando) return
    setGuardando(true)
    const scrollY = window.scrollY
    const id = editando.id
    const cambios = {
      rol: editando.rol,
      voz: editando.voz,
      estado: editando.estado,
      mail: editando.mail || null,
      fecha_nacimiento: editando.fecha_nacimiento || null,
      dni: editando.dni || null,
      telefono: editando.telefono || null,
    }
    const { error } = await supabase.from('perfiles').update(cambios).eq('id', id)
    setGuardando(false)
    if (error) {
      setMensaje('Error al guardar. Intentá de nuevo.')
      setTimeout(() => setMensaje(''), 3000)
      return
    }
    setEditando(null)
    actualizarLocal(id, cambios)
    setMensaje('Usuario actualizado.')
    setTimeout(() => setMensaje(''), 3000)
    requestAnimationFrame(() => window.scrollTo(0, scrollY))
  }

  async function handleDesactivar() {
    if (!confirmDesactivar) return
    setProcesando(true)
    await supabase.from('perfiles').update({ estado: 'inactivo' }).eq('id', confirmDesactivar.id)
    actualizarLocal(confirmDesactivar.id, { estado: 'inactivo' })
    setProcesando(false)
    setConfirmDesactivar(null)
    setMensaje('Cantante desactivado.')
    setTimeout(() => setMensaje(''), 3000)
  }

  async function handleEliminar() {
    if (!confirmEliminar) return
    setProcesando(true)
    await supabase.from('perfiles').delete().eq('id', confirmEliminar.id)
    setUsuarios(prev => prev.filter(u => u.id !== confirmEliminar.id))
    setProcesando(false)
    setConfirmEliminar(null)
    setMensaje('Cantante eliminado. Recordá borrarlo también de Supabase Auth.')
    setTimeout(() => setMensaje(''), 5000)
  }

  async function handleResetPassword() {
    if (!resetPass) return
    if (!nuevaPass || nuevaPass.length < 6) {
      setMensaje('La contraseña debe tener al menos 6 caracteres.')
      setTimeout(() => setMensaje(''), 3000)
      return
    }
    if (nuevaPass !== confirmarPass) {
      setMensaje('Las contraseñas no coinciden.')
      setTimeout(() => setMensaje(''), 3000)
      return
    }
    setResetando(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ user_id: resetPass.id, new_password: nuevaPass }),
        }
      )
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Error desconocido')
      // ✅ FIX: cerrar modal PRIMERO, luego mostrar mensaje en la lista
      setResetPass(null)
      setNuevaPass('')
      setConfirmarPass('')
      setMensaje(`Contraseña de ${resetPass.nombre} actualizada correctamente.`)
      setTimeout(() => setMensaje(''), 4000)
    } catch (err) {
      setMensaje(`Error: ${err.message}`)
      setTimeout(() => setMensaje(''), 4000)
    } finally {
      setResetando(false)
    }
  }

  const navigate = useNavigate()
  const location = useLocation()

  // Mensaje desde CrearCantante
  useEffect(() => {
    if (location.state?.mensaje) {
      setMensaje(location.state.mensaje)
      setTimeout(() => setMensaje(''), 4000)
      window.history.replaceState({}, '')
    }
  }, [])

  function abrirReset(u) {
    setResetPass(u)
    setNuevaPass('')
    setConfirmarPass('')
    setBusqueda('')
  }

  useEffect(() => {
    if (resetPass) setBusqueda('')
  }, [resetPass])

  function toggleCampo(key) {
    setCamposImprimir(prev =>
      prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]
    )
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>Cantantes y Director/a</h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : (
              <>
                <span>{activos} activo{activos !== 1 ? 's' : ''}</span>
                {pendientes > 0 && (
                  <span style={{ marginLeft: '8px', color: '#D85A30', fontWeight: '500' }}>
                    · {pendientes} pendiente{pendientes !== 1 ? 's' : ''}
                  </span>
                )}
              </>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setMostrarImprimir(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            🖨 Imprimir listado
          </button>
          <button onClick={() => navigate('/admin/cantantes/nuevo')}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', fontSize: '13px', cursor: 'pointer', fontWeight: '500' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Agregar cantante
          </button>
        </div>
      </div>

      {mensaje && (
        <div style={{ background: '#EAF3DE', border: '1px solid #A8D080', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#27500A', marginBottom: '16px' }}>
          {mensaje}
        </div>
      )}

      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '320px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9"
          style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar cantante..."
          autoComplete="off"
          style={{ width: '100%', height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px 0 32px', fontSize: '13px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }} />
      </div>

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: '64px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {/* MÓVIL: tarjetas */}
      {!cargando && esMovil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>
              No hay cantantes que coincidan.
            </div>
          )}
          {filtrados.map(u => {
            const vc = VOCES_COLOR[u.voz] || { bg: '#F1EFE8', color: '#888780' }
            const rs = ROLE_STYLE[u.rol] || ROLE_STYLE.cantante
            return (
              <div key={u.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px', opacity: u.estado === 'inactivo' ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{u.nombre}</div>
                    <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>{u.mail || '—'}</div>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                    {u.voz && <span style={{ fontSize: '10px', background: vc.bg, color: vc.color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize' }}>{u.voz}</span>}
                    <span style={{ fontSize: '10px', background: rs.bg, color: rs.color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize' }}>{u.rol}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  <button onClick={() => setEditando({ ...u })}
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                    Editar
                  </button>
                  <button onClick={() => abrirReset(u)}
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#5F5E5A' }}>
                    Contraseña
                  </button>
                  {u.estado === 'activo' && (
                    <button onClick={() => setConfirmDesactivar(u)}
                      style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>
                      Desactivar
                    </button>
                  )}
                  <button onClick={() => setConfirmEliminar(u)}
                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DESKTOP: tabla */}
      {!cargando && !esMovil && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 160px', padding: '10px 16px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Nombre</span><span>Voz</span><span>Rol</span><span>Estado</span><span style={{ textAlign: 'right' }}>Acciones</span>
          </div>
          {filtrados.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>
              No hay cantantes que coincidan.
            </div>
          )}
          {filtrados.map((u, i) => {
            const vc = VOCES_COLOR[u.voz] || { bg: '#F1EFE8', color: '#888780' }
            const rs = ROLE_STYLE[u.rol] || ROLE_STYLE.cantante
            const esUltimo = i === filtrados.length - 1
            return (
              <div key={u.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 160px', padding: '11px 16px', alignItems: 'center', borderBottom: esUltimo ? 'none' : '1px solid #F1EFE8', opacity: u.estado === 'inactivo' ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{u.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '1px' }}>{u.mail || '—'}</div>
                </div>
                <span style={{ fontSize: '10px', background: vc.bg, color: vc.color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize', display: 'inline-block' }}>{u.voz || '—'}</span>
                <span style={{ fontSize: '10px', background: rs.bg, color: rs.color, padding: '2px 8px', borderRadius: '10px', fontWeight: '600', textTransform: 'capitalize', display: 'inline-block' }}>{u.rol}</span>
                <span style={{ fontSize: '11px', color: u.estado === 'activo' ? '#27500A' : '#888780', textTransform: 'capitalize' }}>{u.estado}</span>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditando({ ...u })}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                    Editar
                  </button>
                  <button onClick={() => abrirReset(u)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#5F5E5A' }}>
                    Pass
                  </button>
                  <button onClick={() => setConfirmEliminar(u)}
                    style={{ padding: '4px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal imprimir listado */}
      {mostrarImprimir && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 6px' }}>Imprimir listado</h3>
            <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 20px' }}>Elegí los campos a incluir. Se agrupan por cuerda.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
              {CAMPOS_DISPONIBLES.map(c => (
                <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer', fontSize: '13px', color: '#1A1A18' }}>
                  <input type="checkbox" checked={camposImprimir.includes(c.key)} onChange={() => toggleCampo(c.key)}
                    style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#0F6E56' }} />
                  {c.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setMostrarImprimir(false)}
                style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button onClick={() => { imprimirListado(usuarios, camposImprimir); setMostrarImprimir(false) }}
                disabled={camposImprimir.length === 0}
                style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: camposImprimir.length === 0 ? '#D3D1C7' : '#0F6E56', color: '#FFFFFF', cursor: camposImprimir.length === 0 ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                🖨 Generar e imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset password */}
      {resetPass && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 4px' }}>Cambiar contraseña</h3>
            <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 20px' }}>{resetPass.nombre}</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}>
              <input type="password" value={nuevaPass} onChange={e => setNuevaPass(e.target.value)}
                placeholder="Nueva contraseña" autoComplete="new-password" style={inputStyle} />
              <input type="password" value={confirmarPass} onChange={e => setConfirmarPass(e.target.value)}
                placeholder="Repetí la contraseña" autoComplete="new-password" style={inputStyle} />
            </div>
            {nuevaPass && confirmarPass && nuevaPass !== confirmarPass && (
              <p style={{ fontSize: '12px', color: '#A32D2D', margin: '-12px 0 16px', background: '#FCEBEB', padding: '6px 10px', borderRadius: '6px' }}>
                Las contraseñas no coinciden.
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => { setResetPass(null); setNuevaPass(''); setConfirmarPass('') }}
                style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button onClick={handleResetPassword} disabled={resetando}
                style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: resetando ? '#7FB5A8' : '#0F6E56', color: '#FFFFFF', cursor: resetando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {resetando ? 'Guardando...' : 'Guardar contraseña'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal editar */}
      {editando && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px', overflowY: 'auto' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '440px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)', margin: 'auto' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 4px' }}>Editar usuario</h3>
            <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 16px' }}>{editando.nombre}</p>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Voz</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {VOCES.map(v => (
                  <button key={v} onClick={() => setEditando(e => ({ ...e, voz: v }))}
                    style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${editando.voz === v ? '#1D9E75' : '#D3D1C7'}`, background: editando.voz === v ? '#E1F5EE' : '#FFFFFF', color: editando.voz === v ? '#04342C' : '#5F5E5A', textTransform: 'capitalize' }}>
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Rol</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ROLES.map(r => {
                  const rs = ROLE_STYLE[r]
                  return (
                    <button key={r} onClick={() => setEditando(e => ({ ...e, rol: r }))}
                      style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${editando.rol === r ? rs.color : '#D3D1C7'}`, background: editando.rol === r ? rs.bg : '#FFFFFF', color: editando.rol === r ? rs.color : '#5F5E5A', textTransform: 'capitalize' }}>
                      {r}
                    </button>
                  )
                })}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Estado</label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {ESTADOS.map(es => (
                  <button key={es} onClick={() => setEditando(e => ({ ...e, estado: es }))}
                    style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${editando.estado === es ? '#0F6E56' : '#D3D1C7'}`, background: editando.estado === es ? '#E1F5EE' : '#FFFFFF', color: editando.estado === es ? '#04342C' : '#5F5E5A', textTransform: 'capitalize' }}>
                    {es}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Correo electrónico</label>
              <input value={editando.mail || ''} onChange={e => setEditando(ed => ({ ...ed, mail: e.target.value }))}
                placeholder="correo@ejemplo.com" style={inputStyle} />
            </div>
            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Teléfono / Celular</label>
              <input value={editando.telefono || ''} onChange={e => setEditando(ed => ({ ...ed, telefono: e.target.value }))}
                placeholder="+54 11 0000-0000" style={inputStyle} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
              <div>
                <label style={labelStyle}>DNI</label>
                <input value={editando.dni || ''} onChange={e => setEditando(ed => ({ ...ed, dni: e.target.value }))}
                  placeholder="12345678" style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Fecha de nacimiento</label>
                <input type="date" value={editando.fecha_nacimiento || ''} onChange={e => setEditando(ed => ({ ...ed, fecha_nacimiento: e.target.value }))}
                  style={inputStyle} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              <button onClick={() => setEditando(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={guardarEdicion} disabled={guardando} style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {guardando ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal desactivar */}
      {confirmDesactivar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 8px' }}>Desactivar cantante</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: '1.6', margin: '0 0 8px' }}>
              ¿Desactivás a <strong>{confirmDesactivar.nombre}</strong>?
            </p>
            <p style={{ fontSize: '12px', color: '#888780', margin: '0 0 24px', background: '#F1EFE8', padding: '8px 10px', borderRadius: '8px' }}>
              Ya no podrá ingresar a la app. Podés volver a activarlo en cualquier momento editando su perfil.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmDesactivar(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button onClick={handleDesactivar} disabled={procesando}
                style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: procesando ? '#F0C5B4' : '#A32D2D', color: '#FFFFFF', cursor: procesando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {procesando ? 'Desactivando...' : 'Sí, desactivar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal eliminar */}
      {confirmEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '28px', maxWidth: '400px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 8px' }}>Eliminar cantante</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: '1.6', margin: '0 0 8px' }}>
              ¿Eliminás definitivamente a <strong>{confirmEliminar.nombre}</strong>?
            </p>
            <p style={{ fontSize: '12px', color: '#888780', margin: '0 0 24px', background: '#FCEBEB', padding: '8px 10px', borderRadius: '8px' }}>
              Esta acción no se puede deshacer. Recordá eliminar también el usuario en Supabase Auth.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
                Cancelar
              </button>
              <button onClick={handleEliminar} disabled={procesando}
                style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: procesando ? '#F0C5B4' : '#A32D2D', color: '#FFFFFF', cursor: procesando ? 'not-allowed' : 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {procesando ? 'Eliminando...' : 'Sí, eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.4px' }
const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }
