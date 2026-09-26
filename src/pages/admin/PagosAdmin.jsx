import { useState } from 'react'
import { useColectas, useRegistrosColecta, crearColectas, eliminarColecta, marcarPago } from '../../hooks/usePagos'
import { getCoroActual } from '../../lib/coro'
import { supabase } from '../../lib/supabase'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const ESTADO_LABEL = { pagado: 'Pagó', pendiente: 'Pendiente', exento: 'Exento' }
const ESTADO_COLOR = { pagado: '#0F6E56', pendiente: '#D85A30', exento: '#3B5BA5' }
const ESTADO_BG    = { pagado: '#E1F5EE', pendiente: '#FAECE7', exento: '#E6EEF9' }

function formatMonto(monto) {
  return '$' + Number(monto).toLocaleString('es-AR', { maximumFractionDigits: 0 })
}

export default function PagosAdmin() {
  const { colectas, cargando, recargar } = useColectas()
  const [vista, setVista] = useState('lista')
  const [colectaActual, setColectaActual] = useState(null)
  const [filtro, setFiltro] = useState('todos')

  if (cargando) return <div style={{ padding: '40px', textAlign: 'center', color: '#888780' }}>Cargando...</div>

  if (vista === 'detalle' && colectaActual) {
    return <DetalleColecta
      colecta={colectaActual}
      onVolver={() => { setVista('lista'); setColectaActual(null) }}
      onEditado={(actualizada) => { setColectaActual(actualizada); recargar() }}
      onEliminado={() => { recargar(); setVista('lista'); setColectaActual(null) }}
    />
  }

  if (vista === 'nueva-cuota') {
    return <FormNuevaCuota onVolver={() => setVista('lista')} onGuardar={() => { recargar(); setVista('lista') }} />
  }

  if (vista === 'nueva-colecta') {
    return <FormNuevaColecta onVolver={() => setVista('lista')} onGuardar={() => { recargar(); setVista('lista') }} />
  }

  const colectasFiltradas = colectas.filter(c => filtro === 'todos' ? true : c.tipo === filtro)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h2 style={{ fontSize: '20px', fontWeight: '600', color: '#1A1A18', margin: 0 }}>Pagos</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={() => setVista('nueva-cuota')} style={btnStyle('#0F6E56')}>+ Cuotas</button>
          <button onClick={() => setVista('nueva-colecta')} style={btnStyle('#378ADD')}>+ Colecta</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[['todos','Todos'],['cuota','Cuotas'],['colecta','Colectas']].map(([val, label]) => (
          <button key={val} onClick={() => setFiltro(val)}
            style={{ padding: '5px 14px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
              background: filtro === val ? '#0A4A3A' : '#E8E6DF', color: filtro === val ? '#FFFFFF' : '#5F5E5A' }}>
            {label}
          </button>
        ))}
      </div>

      {colectasFiltradas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#B4B2A9' }}>No hay registros aún.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {colectasFiltradas.map(c => (
            <div key={c.id} onClick={() => { setColectaActual(c); setVista('detalle') }}
              style={{ background: '#FFFFFF', borderRadius: '12px', padding: '14px 16px', border: '1px solid #E8E6DF', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: c.tipo === 'cuota' ? '#E1F5EE' : '#E6F1FB', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <span style={{ fontSize: '16px' }}>{c.tipo === 'cuota' ? '📅' : '💰'}</span>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{c.nombre}</div>
                <div style={{ fontSize: '12px', color: '#888780' }}>
                  {c.tipo === 'cuota' ? `${MESES[(c.mes||1)-1]} ${c.anio}` : 'Colecta'}
                  {c.monto ? ` · ${formatMonto(c.monto)}` : ''}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="#B4B2A9"><path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z"/></svg>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function DetalleColecta({ colecta, onVolver, onEditado, onEliminado }) {
  const { cantantes, registros, setRegistros, cargando } = useRegistrosColecta(colecta.id)
  const [guardando, setGuardando] = useState({})
  const [editando, setEditando] = useState(false)
  const [nombre, setNombre] = useState(colecta.nombre)
  const [monto, setMonto] = useState(colecta.monto || '')
  const [mes, setMes] = useState(colecta.mes || '')
  const [anio, setAnio] = useState(colecta.anio || '')
  const [guardandoEdicion, setGuardandoEdicion] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  async function handleMarcar(perfilId, estado) {
    setGuardando(g => ({ ...g, [perfilId]: true }))
    await marcarPago(colecta.id, perfilId, estado, registros, setRegistros)
    setGuardando(g => ({ ...g, [perfilId]: false }))
  }

  function getEstado(perfilId) {
    return registros.find(r => r.perfil_id === perfilId)?.estado || 'pendiente'
  }

  async function handleGuardarEdicion() {
    setGuardandoEdicion(true)
    const updates = {
      nombre: colecta.tipo === 'cuota'
        ? `Cuota ${MESES[(Number(mes)||1)-1]} ${anio}`
        : nombre,
      monto: monto ? Number(monto) : null,
    }
    if (colecta.tipo === 'cuota') {
      updates.mes = Number(mes)
      updates.anio = Number(anio)
    }
    const { data, error } = await supabase
      .from('colectas')
      .update(updates)
      .eq('id', colecta.id)
      .select()
      .single()
    setGuardandoEdicion(false)
    if (!error && data) {
      setEditando(false)
      onEditado(data)
    }
  }

  async function handleEliminar() {
    if (!confirm(`¿Eliminar "${colecta.nombre}"? Se borrarán todos los registros de pago asociados.`)) return
    setEliminando(true)
    await eliminarColecta(colecta.id)
    onEliminado()
  }

  function handleImprimir() {
    const ventana = window.open('', '_blank')
    ventana.document.write(`
      <html><head><title>${colecta.nombre}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 32px; }
        h1 { font-size: 18px; margin-bottom: 4px; }
        p { font-size: 13px; color: #666; margin-bottom: 20px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { text-align: left; padding: 8px 12px; border-bottom: 2px solid #333; }
        td { padding: 8px 12px; border-bottom: 1px solid #eee; }
        .pagado { color: #0F6E56; font-weight: 600; }
        .pendiente { color: #D85A30; font-weight: 600; }
        .exento { color: #888; }
      </style></head><body>
      <h1>${colecta.nombre}</h1>
      <p>${colecta.monto ? `Monto: ${formatMonto(colecta.monto)} · ` : ''}${import.meta.env.VITE_CORO_NOMBRE || ''}</p>
      <table>
        <tr><th>Cantante</th><th>Voz</th><th>Estado</th></tr>
        ${cantantes.map(c => {
          const est = getEstado(c.id)
          return `<tr><td>${c.nombre}</td><td>${c.voz || '—'}</td><td class="${est}">${ESTADO_LABEL[est]}</td></tr>`
        }).join('')}
      </table>
      <p style="margin-top:20px; font-size:11px; color:#aaa;">Impreso el ${new Date().toLocaleDateString('es-AR')}</p>
      </body></html>
    `)
    ventana.document.close()
    ventana.print()
  }

  const pagados   = cantantes.filter(c => getEstado(c.id) === 'pagado').length
  const pendientes = cantantes.filter(c => getEstado(c.id) === 'pendiente').length
  const exentos   = cantantes.filter(c => getEstado(c.id) === 'exento').length

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F6E56', fontSize: '14px', fontWeight: '500', padding: 0 }}>
          ← Volver
        </button>
        <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1A18', margin: 0, flex: 1 }}>{colecta.nombre}</h2>
        <button onClick={() => setEditando(v => !v)} style={btnStyle('#888780')}>✏️ Editar</button>
        <button onClick={handleImprimir} style={btnStyle('#5F5E5A')}>🖨 Imprimir</button>
        <button onClick={handleEliminar} disabled={eliminando} style={btnStyle('#D85A30')}>🗑 Eliminar</button>
      </div>

      {/* Panel de edición */}
      {editando && (
        <div style={{ background: '#FFFFFF', borderRadius: '12px', padding: '18px', border: '1px solid #E8E6DF', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxWidth: '400px' }}>
            {colecta.tipo === 'colecta' && (
              <Campo label="Nombre">
                <input value={nombre} onChange={e => setNombre(e.target.value)} style={inputStyle} />
              </Campo>
            )}
            {colecta.tipo === 'cuota' && (
              <>
                <Campo label="Mes">
                  <select value={mes} onChange={e => setMes(e.target.value)} style={inputStyle}>
                    {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                  </select>
                </Campo>
                <Campo label="Año">
                  <input type="number" value={anio} onChange={e => setAnio(e.target.value)} style={inputStyle} />
                </Campo>
              </>
            )}
            <Campo label="Monto (sin puntos ni comas, ej: 55000)">
              <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 55000" style={inputStyle} />
            </Campo>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleGuardarEdicion} disabled={guardandoEdicion} style={btnStyle('#0F6E56')}>
                {guardandoEdicion ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditando(false)} style={btnStyle('#888780')}>Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* Resumen */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '20px' }}>
        <ResCard val={pagados}   label="Pagaron"    color="#0F6E56" bg="#E1F5EE" />
        <ResCard val={pendientes} label="Pendientes" color="#D85A30" bg="#FAECE7" />
        <ResCard val={exentos}   label="Exentos"    color="#3B5BA5" bg="#E6EEF9" />
      </div>

      {cargando ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#888780' }}>Cargando...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {cantantes.map(c => {
  const estado = getEstado(c.id)
  const nota = registros.find(r => r.perfil_id === c.id)?.nota || ''
  return (
    <div key={c.id} style={{ background: '#FFFFFF', borderRadius: '12px', padding: '12px 16px', border: '1px solid #E8E6DF' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{c.nombre}</div>
          <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize' }}>{c.voz || '—'}</div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {['pagado','pendiente','exento'].map(est => (
            <button key={est} onClick={() => !guardando[c.id] && handleMarcar(c.id, est)}
              style={{
                padding: '4px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '11px', fontWeight: '500',
                background: estado === est ? ESTADO_BG[est] : '#F1EFE8',
                color: estado === est ? ESTADO_COLOR[est] : '#B4B2A9',
                opacity: guardando[c.id] ? 0.5 : 1,
              }}>
              {ESTADO_LABEL[est]}
            </button>
          ))}
        </div>
      </div>
      <NotaCantante
        colectaId={colecta.id}
        perfilId={c.id}
        notaInicial={nota}
        registros={registros}
        setRegistros={setRegistros}
      />
    </div>
  )
})}
        </div>
      )}
    </div>
  )
}

function ResCard({ val, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '10px', padding: '12px', textAlign: 'center' }}>
      <div style={{ fontSize: '24px', fontWeight: '600', color }}>{val}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.8 }}>{label}</div>
    </div>
  )
}

function FormNuevaCuota({ onVolver, onGuardar }) {
  const hoy = new Date()
  const [mesDesde, setMesDesde] = useState(hoy.getMonth() + 1)
  const [mesHasta, setMesHasta] = useState(hoy.getMonth() + 1)
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleGuardar() {
    if (mesHasta < mesDesde) { setError('El mes hasta debe ser igual o posterior al mes desde.'); return }
    setGuardando(true)
    const coro = await getCoroActual()
    if (!coro) { setError('No se pudo obtener el coro.'); setGuardando(false); return }

    const payload = []
    for (let m = mesDesde; m <= mesHasta; m++) {
      payload.push({
        coro_id: coro.id,
        tipo: 'cuota',
        nombre: `Cuota ${MESES[m-1]} ${anio}`,
        mes: m,
        anio,
        monto: monto ? Number(monto) : null,
      })
    }

    const { error: err } = await crearColectas(payload)
    if (err) { setError(err.message); setGuardando(false); return }
    onGuardar()
  }

  return (
    <div>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F6E56', fontSize: '14px', fontWeight: '500', padding: 0, marginBottom: '20px' }}>
        ← Volver
      </button>
      <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1A18', marginBottom: '24px' }}>Crear cuotas</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
        <Campo label="Año">
          <input type="number" value={anio} onChange={e => setAnio(Number(e.target.value))} style={inputStyle} />
        </Campo>
        <Campo label="Mes desde">
          <select value={mesDesde} onChange={e => setMesDesde(Number(e.target.value))} style={inputStyle}>
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Mes hasta">
          <select value={mesHasta} onChange={e => setMesHasta(Number(e.target.value))} style={inputStyle}>
            {MESES.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
          </select>
        </Campo>
        <Campo label="Monto (sin puntos ni comas, ej: 55000)">
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 55000" style={inputStyle} />
        </Campo>
        {error && <div style={{ color: '#D85A30', fontSize: '13px' }}>{error}</div>}
        <button onClick={handleGuardar} disabled={guardando} style={btnStyle('#0F6E56', true)}>
          {guardando ? 'Guardando...' : 'Crear cuotas'}
        </button>
      </div>
    </div>
  )
}

function FormNuevaColecta({ onVolver, onGuardar }) {
  const [nombre, setNombre] = useState('')
  const [monto, setMonto] = useState('')
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  async function handleGuardar() {
    if (!nombre.trim()) { setError('El nombre es obligatorio.'); return }
    setGuardando(true)
    const coro = await getCoroActual()
    if (!coro) { setError('No se pudo obtener el coro.'); setGuardando(false); return }

    const { error: err } = await crearColectas([{
      coro_id: coro.id,
      tipo: 'colecta',
      nombre: nombre.trim(),
      monto: monto ? Number(monto) : null,
    }])
    if (err) { setError(err.message); setGuardando(false); return }
    onGuardar()
  }

  return (
    <div>
      <button onClick={onVolver} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#0F6E56', fontSize: '14px', fontWeight: '500', padding: 0, marginBottom: '20px' }}>
        ← Volver
      </button>
      <h2 style={{ fontSize: '18px', fontWeight: '600', color: '#1A1A18', marginBottom: '24px' }}>Nueva colecta</h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '400px' }}>
        <Campo label="Nombre">
          <input type="text" value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej: Viaje de fin de año" style={inputStyle} />
        </Campo>
        <Campo label="Monto (sin puntos ni comas, ej: 55000)">
          <input type="number" value={monto} onChange={e => setMonto(e.target.value)} placeholder="Ej: 2000" style={inputStyle} />
        </Campo>
        {error && <div style={{ color: '#D85A30', fontSize: '13px' }}>{error}</div>}
        <button onClick={handleGuardar} disabled={guardando} style={btnStyle('#378ADD', true)}>
          {guardando ? 'Guardando...' : 'Crear colecta'}
        </button>
      </div>
    </div>
  )
}
function NotaCantante({ colectaId, perfilId, notaInicial, registros, setRegistros }) {
  const [nota, setNota] = useState(notaInicial)
  const [guardando, setGuardando] = useState(false)
  const [editando, setEditando] = useState(false)

  async function handleGuardar() {
    setGuardando(true)
    const existe = registros.find(r => r.perfil_id === perfilId)
    if (existe) {
      await supabase
        .from('colectas_registros')
        .update({ nota })
        .eq('colecta_id', colectaId)
        .eq('perfil_id', perfilId)
      setRegistros(prev => prev.map(r => r.perfil_id === perfilId ? { ...r, nota } : r))
    } else {
      const { data } = await supabase
        .from('colectas_registros')
        .insert({ colecta_id: colectaId, perfil_id: perfilId, estado: 'pendiente', nota })
        .select()
        .single()
      if (data) setRegistros(prev => [...prev, data])
    }
    setGuardando(false)
    setEditando(false)
  }

  if (!editando && !nota) {
    return (
      <button onClick={() => setEditando(true)}
        style={{ marginTop: '6px', fontSize: '11px', color: '#B4B2A9', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
        + Agregar nota
      </button>
    )
  }

  if (!editando && nota) {
    return (
      <div style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#888780', fontStyle: 'italic' }}>{nota}</span>
        <button onClick={() => setEditando(true)}
          style={{ fontSize: '11px', color: '#B4B2A9', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          ✏️
        </button>
      </div>
    )
  }

  return (
    <div style={{ marginTop: '8px', display: 'flex', gap: '6px', alignItems: 'center' }}>
      <input
        value={nota}
        onChange={e => setNota(e.target.value)}
        placeholder="Ej: Monto $44.000 (matrimonio)"
        style={{ flex: 1, padding: '5px 8px', borderRadius: '6px', border: '1px solid #D3D1C7', fontSize: '12px', color: '#1A1A18', outline: 'none' }}
      />
      <button onClick={handleGuardar} disabled={guardando}
        style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#0F6E56', color: '#FFFFFF', fontSize: '11px' }}>
        {guardando ? '...' : 'Ok'}
      </button>
      <button onClick={() => { setNota(notaInicial); setEditando(false) }}
        style={{ padding: '5px 10px', borderRadius: '6px', border: 'none', cursor: 'pointer', background: '#E8E6DF', color: '#5F5E5A', fontSize: '11px' }}>
        ✕
      </button>
    </div>
  )
}
function Campo({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '600', color: '#5F5E5A', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</label>
      {children}
    </div>
  )
}

const inputStyle = {
  width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #D3D1C7',
  background: '#FFFFFF', fontSize: '14px', color: '#1A1A18', outline: 'none',
}

function btnStyle(color, full = false) {
  return {
    padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: 'pointer',
    background: color, color: '#FFFFFF', fontSize: '13px', fontWeight: '500',
    width: full ? '100%' : 'auto',
  }
}