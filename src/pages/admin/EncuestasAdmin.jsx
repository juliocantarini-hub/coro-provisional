import { useState } from 'react'
import { getCoroActual } from '../../lib/coro'
import { useEncuestasAdmin, useEncuestaPorId, useCrearEncuesta } from '../../hooks/useEncuestas'
import EncuestaWidget from '../../components/EncuestaWidget'

const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }

function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>{label}</label>
      {children}
    </div>
  )
}

function NuevaEncuestaForm({ onGuardar, onCancelar }) {
  const { crearEncuesta } = useCrearEncuesta()
  const [pregunta, setPregunta] = useState('')
  const [opciones, setOpciones] = useState(['', ''])
  const [multiple, setMultiple] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

  function actualizarOpcion(i, valor) {
    setOpciones(prev => prev.map((o, idx) => idx === i ? valor : o))
  }
  function agregarOpcion() {
    if (opciones.length < 8) setOpciones(prev => [...prev, ''])
  }
  function quitarOpcion(i) {
    setOpciones(prev => prev.filter((_, idx) => idx !== i))
  }

  async function guardar() {
    setError('')
    if (!pregunta.trim()) { setError('Falta la pregunta.'); return }
    const validas = opciones.filter(o => o.trim())
    if (validas.length < 2) { setError('Necesitás al menos 2 opciones.'); return }

    setGuardando(true)
    try {
      const coro = await getCoroActual()
      if (!coro) { setError('No se pudo identificar el coro.'); setGuardando(false); return }

      await crearEncuesta({
        avisoId: null,
        coroId: coro.id,
        pregunta: pregunta.trim(),
        permiteMultiple: multiple,
        opciones: validas,
      })
      setGuardando(false)
      onGuardar()
    } catch (err) {
      console.error(err)
      setError('Ocurrió un error al crear la encuesta.')
      setGuardando(false)
    }
  }

  return (
    <div style={{ maxWidth: '520px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Volver
        </button>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
          Nueva encuesta
        </h2>
      </div>

      {error && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>{error}</div>}

      <Campo label="Pregunta">
        <input value={pregunta} onChange={e => setPregunta(e.target.value)}
          placeholder="Ej: ¿Qué día prefieren para el ensayo extra?" style={inputStyle} autoFocus />
      </Campo>

      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>Opciones</label>
      {opciones.map((op, i) => (
        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
          <input value={op} onChange={e => actualizarOpcion(i, e.target.value)}
            placeholder={`Opción ${i + 1}`} style={inputStyle} />
          {opciones.length > 2 && (
            <button type="button" onClick={() => quitarOpcion(i)}
              style={{ width: '38px', height: '38px', border: '1px solid #F0C5B4', borderRadius: '8px', background: 'none', color: '#A32D2D', cursor: 'pointer', flexShrink: 0 }}>
              ×
            </button>
          )}
        </div>
      ))}
      {opciones.length < 8 && (
        <button type="button" onClick={agregarOpcion}
          style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontWeight: '500', marginBottom: '10px' }}>
          + Agregar opción
        </button>
      )}

      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#5F5E5A', marginTop: '4px', marginBottom: '20px' }}>
        <input type="checkbox" checked={multiple} onChange={e => setMultiple(e.target.checked)} />
        Permitir elegir más de una opción
      </label>

      <button onClick={guardar} disabled={guardando}
        style={{ width: '100%', height: '42px', borderRadius: '8px', border: 'none', background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
        {guardando ? 'Creando...' : 'Crear y publicar encuesta'}
      </button>
    </div>
  )
}

function DetalleVotos({ encuestaId }) {
  const { encuesta, detalleVotos } = useEncuestaPorId(encuestaId)
  const [detalle, setDetalle] = useState(null)

  async function cargarDetalle() {
    const d = await detalleVotos()
    setDetalle(d)
  }

  if (!encuesta) return null

  return (
    <div style={{ marginTop: '10px' }}>
      {!detalle ? (
        <button onClick={cargarDetalle}
          style={{ fontSize: '11px', color: '#0F6E56', background: '#E1F5EE', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '500' }}>
          Ver quién votó qué
        </button>
      ) : (
        <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {detalle.map(op => (
            <div key={op.id} style={{ fontSize: '12px' }}>
              <div style={{ fontWeight: '500', color: '#1A1A18', marginBottom: '2px' }}>{op.texto}</div>
              <div style={{ color: op.votantes.length ? '#5F5E5A' : '#B4B2A9' }}>
                {op.votantes.length ? op.votantes.join(', ') : 'Nadie votó esta opción todavía.'}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function EncuestaAdminItem({ encuestaId, onEliminada }) {
  const { encuesta, resultados, miVoto, votar, recargar } = useEncuestaPorId(encuestaId)
  const { cerrarEncuesta, reabrirEncuesta, eliminarEncuesta } = useCrearEncuesta()
  const [verDetalle, setVerDetalle] = useState(false)
  const [confirmEliminar, setConfirmEliminar] = useState(false)
  const [eliminando, setEliminando] = useState(false)

  if (!encuesta) return null

  async function handleCerrar() {
    await cerrarEncuesta(encuesta.id)
    recargar()
  }
  async function handleReabrir() {
    await reabrirEncuesta(encuesta.id)
    recargar()
  }
  async function handleEliminar() {
    setEliminando(true)
    await eliminarEncuesta(encuesta.id)
    setEliminando(false)
    onEliminada()
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
      <EncuestaWidget
        encuesta={encuesta}
        resultados={resultados}
        miVoto={miVoto}
        votar={votar}
        esAdmin
        onCerrar={handleCerrar}
        onReabrir={handleReabrir}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '8px' }}>
        <button onClick={() => setVerDetalle(v => !v)}
          style={{ fontSize: '11px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
          {verDetalle ? 'Ocultar detalle' : 'Mostrar detalle'}
        </button>

        {!confirmEliminar ? (
          <button onClick={() => setConfirmEliminar(true)}
            style={{ fontSize: '11px', color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>
            Eliminar encuesta
          </button>
        ) : (
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px' }}>
            <span style={{ color: '#5F5E5A' }}>¿Eliminar definitivamente?</span>
            <button onClick={handleEliminar} disabled={eliminando}
              style={{ color: '#FFFFFF', background: '#A32D2D', border: 'none', borderRadius: '5px', padding: '3px 9px', cursor: 'pointer', fontWeight: '500' }}>
              {eliminando ? 'Eliminando...' : 'Sí, eliminar'}
            </button>
            <button onClick={() => setConfirmEliminar(false)} disabled={eliminando}
              style={{ color: '#5F5E5A', background: 'none', border: '1px solid #D3D1C7', borderRadius: '5px', padding: '3px 9px', cursor: 'pointer' }}>
              Cancelar
            </button>
          </span>
        )}
      </div>
      {verDetalle && <DetalleVotos encuestaId={encuesta.id} />}
    </div>
  )
}

export default function EncuestasAdmin() {
  const { encuestas, cargando, recargar } = useEncuestasAdmin()
  const [mostrarForm, setMostrarForm] = useState(false)

  if (mostrarForm) {
    return <NuevaEncuestaForm
      onGuardar={() => { setMostrarForm(false); recargar() }}
      onCancelar={() => setMostrarForm(false)}
    />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Encuestas
          </h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${encuestas.length} encuesta${encuestas.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setMostrarForm(true)}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nueva encuesta
        </button>
      </div>

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map(i => <div key={i} style={{ height: '90px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && encuestas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>
          No hay encuestas todavía. Creá la primera.
        </div>
      )}

      {!cargando && encuestas.map(e => (
        <EncuestaAdminItem key={e.id} encuestaId={e.id} onEliminada={recargar} />
      ))}
    </div>
  )
}
