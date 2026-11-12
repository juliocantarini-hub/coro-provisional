import { useState, useEffect } from 'react'
import { useListasAsistencia, useRegistrosLista, crearLista, eliminarLista, marcarAsistencia, marcarVarios, respuestasDelDia, resetearAsistencia } from '../../hooks/useAsistencia'
import { supabase } from '../../lib/supabase'

const ESTADO_STYLE = {
  presente:    { bg: '#EAF3DE', color: '#27500A', txt: 'Presente',    emoji: '✓' },
  ausente:     { bg: '#FCEBEB', color: '#501313', txt: 'Ausente',     emoji: '✕' },
  justificado: { bg: '#E6F1FB', color: '#042C53', txt: 'Justificado', emoji: '○' },
}

export default function AsistenciaAdmin() {
  const { listas, cargando, recargar } = useListasAsistencia()
  const [listaActiva, setListaActiva] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)
  const [form, setForm] = useState({ fecha: '', descripcion: '' })
  const [guardando, setGuardando] = useState(false)
  const [mensaje, setMensaje] = useState('')
  const [confirmEliminar, setConfirmEliminar] = useState(null)

  // Nueva lista: arranca con la fecha de hoy y, si hay un ensayo o evento ese día
  // en el calendario, con su nombre como descripción.
  function abrirForm() {
    const hoy = new Date()
    const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
    setForm({ fecha, descripcion: '' })
    setMostrarForm(true)
  }

  useEffect(() => {
    if (!mostrarForm || !form.fecha || form.descripcion) return
    let cancelado = false
    respuestasDelDia(form.fecha).then(r => {
      if (!cancelado && r?.evento) setForm(f => (f.descripcion ? f : { ...f, descripcion: r.evento.titulo }))
    })
    return () => { cancelado = true }
  }, [mostrarForm, form.fecha])

  async function handleCrear() {
    if (!form.fecha || !form.descripcion.trim()) return
    setGuardando(true)
    const { ok, data } = await crearLista(form.fecha, form.descripcion.trim())
    setGuardando(false)
    if (ok) {
      setMostrarForm(false)
      setForm({ fecha: '', descripcion: '' })
      await recargar()
      setListaActiva(data)
    }
  }

  async function handleEliminar(id) {
    await eliminarLista(id)
    setConfirmEliminar(null)
    if (listaActiva?.id === id) setListaActiva(null)
    recargar()
  }

  async function handleReset() {
    setGuardando(true)
    await resetearAsistencia()
    setGuardando(false)
    setConfirmReset(false)
    setListaActiva(null)
    setMensaje('Historial reseteado.')
    setTimeout(() => setMensaje(''), 3000)
    recargar()
  }

  if (listaActiva) {
    return <TomarAsistencia lista={listaActiva} onVolver={() => { setListaActiva(null); recargar() }} onTituloActualizado={(nuevoTitulo) => setListaActiva(l => ({ ...l, descripcion: nuevoTitulo }))} />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Asistencia
          </h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${listas.length} lista${listas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setConfirmReset(true)}
            style={{ padding: '8px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>
            Resetear año
          </button>
          <button onClick={abrirForm}
            style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
            Nueva lista
          </button>
        </div>
      </div>

      {mensaje && <div style={{ background: '#E1F5EE', border: '1px solid #1D9E75', borderRadius: '8px', padding: '10px 14px', fontSize: '13px', color: '#04342C', marginBottom: '16px' }}>{mensaje}</div>}

      {/* Formulario nueva lista */}
      {mostrarForm && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <h3 style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18', margin: '0 0 14px' }}>Nueva lista de asistencia</h3>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: '1', minWidth: '140px' }}>
              <label style={labelStyle}>Fecha *</label>
              <input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} style={inputStyle} />
            </div>
            <div style={{ flex: '2', minWidth: '200px' }}>
              <label style={labelStyle}>Descripción *</label>
              <input value={form.descripcion} onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Ej: Ensayo general" style={inputStyle} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => setMostrarForm(false)}
              style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={handleCrear} disabled={guardando || !form.fecha || !form.descripcion.trim()}
              style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {guardando ? 'Creando...' : 'Crear y tomar asistencia'}
            </button>
          </div>
        </div>
      )}

      {/* Lista de listas */}
      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '64px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && listas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#888780' }}>
          <p style={{ fontSize: '14px', margin: 0 }}>No hay listas de asistencia aún.</p>
        </div>
      )}

      {!cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {listas.map(lista => {
            const regs = lista.registros_asistencia || []
            const presentes = regs.filter(r => r.estado === 'presente').length
            const total = regs.length
            const fecha = new Date(lista.fecha + 'T12:00:00')
            return (
              <div key={lista.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ width: '48px', textAlign: 'center', background: '#E1F5EE', borderRadius: '10px', padding: '8px 4px', flexShrink: 0 }}>
                  <div style={{ fontSize: '18px', fontWeight: '600', color: '#04342C', lineHeight: 1 }}>{fecha.getDate()}</div>
                  <div style={{ fontSize: '10px', color: '#04342C', textTransform: 'uppercase' }}>
                    {fecha.toLocaleDateString('es-AR', { month: 'short' })}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{lista.descripcion}</div>
                  <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>
                    {total > 0 ? `${presentes}/${total} presentes` : 'Sin registros'}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => setListaActiva(lista)}
                    style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                    Tomar asistencia
                  </button>
                  <button onClick={() => setConfirmEliminar(lista)}
                    style={{ padding: '6px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal eliminar */}
      {confirmEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px', maxWidth: '360px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 10px' }}>Eliminar lista</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', margin: '0 0 24px' }}>
              ¿Eliminás la lista <strong>"{confirmEliminar.descripcion}"</strong>? Se borrarán todos los registros.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={() => handleEliminar(confirmEliminar.id)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: 'none', background: '#A32D2D', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal reset */}
      {confirmReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px', maxWidth: '380px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 10px' }}>Resetear historial</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: '1.6', margin: '0 0 8px' }}>
              ¿Estás seguro? Esto eliminará <strong>todas las listas y registros de asistencia</strong> del año.
            </p>
            <p style={{ fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', padding: '8px 10px', borderRadius: '8px', margin: '0 0 24px' }}>
              Esta acción no se puede deshacer.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmReset(false)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={handleReset} disabled={guardando} style={{ flex: 2, height: '40px', borderRadius: '8px', border: 'none', background: '#A32D2D', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
                {guardando ? 'Reseteando...' : 'Sí, resetear todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Componente para tomar asistencia ─────────────────────────────────────────
function TomarAsistencia({ lista, onVolver, onTituloActualizado }) {
  const { registros, setRegistros, cantantes, cargando, recargar } = useRegistrosLista(lista.id) // ← setRegistros
  const [guardando, setGuardando] = useState({})
  const [busqueda, setBusqueda] = useState('')
  const [vozFiltro, setVozFiltro] = useState('')
  const [editandoTitulo, setEditandoTitulo] = useState(false)
  const [nuevoTitulo, setNuevoTitulo] = useState(lista.descripcion)
  const [guardandoTitulo, setGuardandoTitulo] = useState(false)
  const [respuestas, setRespuestas] = useState(null)
  const [marcandoConfirmados, setMarcandoConfirmados] = useState(false)

  // Respuestas de "Confirmar asistencia" del ensayo del calendario de ese día.
  // Quien avisó que no venía (antes de que empiece) queda como justificado, salvo
  // que ya tenga otra marca en esta lista.
  useEffect(() => {
    if (cargando) return
    let cancelado = false
    ;(async () => {
      const r = await respuestasDelDia(lista.fecha)
      if (cancelado || !r) return
      setRespuestas(r)
      const activos = new Set(cantantes.map(c => c.id))
      const conMarca = new Set(registros.map(x => x.perfil_id))
      const justificar = [...r.avisaron].filter(id => activos.has(id) && !conMarca.has(id))
      if (justificar.length === 0) return
      const { ok } = await marcarVarios(lista.id, justificar, 'justificado')
      if (ok && !cancelado) {
        setRegistros(prev => [...prev, ...justificar.map(perfil_id => ({ lista_id: lista.id, perfil_id, estado: 'justificado' }))])
      }
    })()
    return () => { cancelado = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cargando, lista.id])

  const sinMarcaConfirmados = respuestas
    ? cantantes.filter(c => respuestas.confirmados.has(c.id) && !registros.some(r => r.perfil_id === c.id)).map(c => c.id)
    : []

  async function marcarConfirmados() {
    setMarcandoConfirmados(true)
    const ids = sinMarcaConfirmados
    const { ok } = await marcarVarios(lista.id, ids, 'presente')
    if (ok) {
      setRegistros(prev => [...prev, ...ids.map(perfil_id => ({ lista_id: lista.id, perfil_id, estado: 'presente' }))])
    }
    setMarcandoConfirmados(false)
  }

  function getEstado(perfilId) {
    const reg = registros.find(r => r.perfil_id === perfilId)
    return reg?.estado || null
  }

  async function handleMarcar(perfilId, estado) {
    setGuardando(g => ({ ...g, [perfilId]: true }))
    await marcarAsistencia(lista.id, perfilId, estado)
    // Actualización local — sin recargar, sin reset de scroll
    setRegistros(prev => {
      const existe = prev.find(r => r.perfil_id === perfilId)
      if (existe) {
        return prev.map(r => r.perfil_id === perfilId ? { ...r, estado } : r)
      } else {
        return [...prev, { lista_id: lista.id, perfil_id: perfilId, estado }]
      }
    })
    setGuardando(g => ({ ...g, [perfilId]: false }))
  }

  async function handleGuardarTitulo() {
    if (!nuevoTitulo.trim() || nuevoTitulo.trim() === lista.descripcion) {
      setEditandoTitulo(false)
      return
    }
    setGuardandoTitulo(true)
    await supabase.from('listas_asistencia').update({ descripcion: nuevoTitulo.trim() }).eq('id', lista.id)
    setGuardandoTitulo(false)
    setEditandoTitulo(false)
    onTituloActualizado(nuevoTitulo.trim())
  }

  const fecha = new Date(lista.fecha + 'T12:00:00')
  const VOCES = ['soprano', 'contralto', 'tenor', 'bajo']

  const filtrados = cantantes.filter(c => {
    const coincideBusqueda = !busqueda || c.nombre?.toLowerCase().includes(busqueda.toLowerCase())
    const coincideVoz = !vozFiltro || c.voz === vozFiltro
    return coincideBusqueda && coincideVoz
  })

  const presentes    = registros.filter(r => r.estado === 'presente').length
  const ausentes     = registros.filter(r => r.estado === 'ausente').length
  const justificados = registros.filter(r => r.estado === 'justificado').length
  const sinMarcar    = cantantes.filter(c => !registros.some(r => r.perfil_id === c.id)).length

  return (
    <div>
      <button onClick={onVolver}
        style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '16px', padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Volver
      </button>

      <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        {/* Título editable */}
        {editandoTitulo ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
            <input
              value={nuevoTitulo}
              onChange={e => setNuevoTitulo(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleGuardarTitulo(); if (e.key === 'Escape') setEditandoTitulo(false) }}
              autoFocus
              style={{ flex: 1, fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', color: '#1A1A18', border: '1px solid #0F6E56', borderRadius: '8px', padding: '4px 10px', outline: 'none' }}
            />
            <button onClick={handleGuardarTitulo} disabled={guardandoTitulo}
              style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer' }}>
              {guardandoTitulo ? '...' : 'Guardar'}
            </button>
            <button onClick={() => setEditandoTitulo(false)}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
              {nuevoTitulo}
            </h2>
            <button onClick={() => setEditandoTitulo(true)}
              title="Editar título"
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center', color: '#B4B2A9' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04c.39-.39.39-1.02 0-1.41l-2.34-2.34c-.39-.39-1.02-.39-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </button>
          </div>
        )}
        <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 12px' }}>
          {fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          {[
            { label: 'Presentes',    val: presentes,    bg: '#EAF3DE', color: '#27500A' },
            { label: 'Ausentes',     val: ausentes,     bg: '#FCEBEB', color: '#501313' },
            { label: 'Justificados', val: justificados, bg: '#E6F1FB', color: '#042C53' },
            ...(!cargando && sinMarcar > 0 ? [{ label: 'Sin marcar', val: sinMarcar, bg: '#F1EFE8', color: '#5F5E5A' }] : []),
          ].map(s => (
            <div key={s.label} style={{ background: s.bg, borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: '20px', fontWeight: '600', color: s.color }}>{s.val}</div>
              <div style={{ fontSize: '11px', color: s.color }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Respuestas previas del ensayo del calendario */}
      {respuestas && (
        <div style={{ background: '#F8F7F3', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '12px 14px', marginBottom: '14px' }}>
          <div style={{ fontSize: '13px', color: '#1A1A18' }}>
            <strong>Antes del ensayo:</strong>{' '}
            {respuestas.confirmados.size} {respuestas.confirmados.size === 1 ? 'confirmó' : 'confirmaron'} que venía{respuestas.confirmados.size === 1 ? '' : 'n'}
            {' · '}
            {respuestas.avisaron.size} {respuestas.avisaron.size === 1 ? 'avisó' : 'avisaron'} que no venía{respuestas.avisaron.size === 1 ? '' : 'n'}
          </div>
          {respuestas.avisaron.size > 0 && (
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px' }}>
              Quienes avisaron quedan como justificados. Si alguno vino igual, cambialo.
            </div>
          )}
          {sinMarcaConfirmados.length > 0 && (
            <button onClick={marcarConfirmados} disabled={marcandoConfirmados}
              style={{ marginTop: '10px', height: '36px', padding: '0 14px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {marcandoConfirmados ? 'Marcando...' : `Marcar presentes a los que confirmaron (${sinMarcaConfirmados.length})`}
            </button>
          )}
        </div>
      )}

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '180px' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}>
            <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cantante..."
            style={{ width: '100%', height: '34px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 10px 0 30px', fontSize: '12px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }} />
        </div>
        <button onClick={() => setVozFiltro('')} style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer', border: `1px solid ${vozFiltro === '' ? '#1D9E75' : '#D3D1C7'}`, background: vozFiltro === '' ? '#E1F5EE' : 'none', color: vozFiltro === '' ? '#04342C' : '#5F5E5A' }}>Todas</button>
        {VOCES.map(v => (
          <button key={v} onClick={() => setVozFiltro(v)} style={{ padding: '4px 10px', borderRadius: '16px', fontSize: '11px', cursor: 'pointer', textTransform: 'capitalize', border: `1px solid ${vozFiltro === v ? '#1D9E75' : '#D3D1C7'}`, background: vozFiltro === v ? '#E1F5EE' : 'none', color: vozFiltro === v ? '#04342C' : '#5F5E5A' }}>{v}</button>
        ))}
      </div>

      {cargando && <div style={{ textAlign: 'center', padding: '32px', color: '#888780' }}>Cargando cantantes...</div>}

      {!cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtrados.map(cantante => {
            const estadoActual = getEstado(cantante.id)
            const cargandoEste = guardando[cantante.id]
            return (
              <div key={cantante.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', opacity: cargandoEste ? 0.6 : 1 }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#E1F5EE', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: '600', color: '#0F6E56', flexShrink: 0 }}>
                  {cantante.nombre?.charAt(0)?.toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{cantante.nombre}</div>
                  <div style={{ fontSize: '11px', color: '#888780' }}>
                    <span style={{ textTransform: 'capitalize' }}>{cantante.voz || '—'}</span>
                    {respuestas?.confirmados.has(cantante.id) && <span style={{ color: '#27500A', fontWeight: '600' }}> · Confirmó</span>}
                    {respuestas?.avisaron.has(cantante.id) && <span style={{ color: '#042C53', fontWeight: '600' }}> · Avisó que no venía</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {Object.entries(ESTADO_STYLE).map(([valor, es]) => (
                    <button key={valor} onClick={() => handleMarcar(cantante.id, valor)} disabled={cargandoEste}
                      style={{
                        width: '36px', height: '36px', borderRadius: '8px', fontSize: '14px',
                        border: `1.5px solid ${estadoActual === valor ? es.color : '#D3D1C7'}`,
                        background: estadoActual === valor ? es.bg : '#FFFFFF',
                        cursor: cargandoEste ? 'not-allowed' : 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title={es.txt}>
                      {es.emoji}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }
const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }