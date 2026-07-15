import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import { crearAviso, actualizarAviso, publicarAviso, eliminarAviso, useAvisosAdmin, tiempoRelativo, TIPO_AVISO } from '../../hooks/useAvisos'
import { useEncuesta, useCrearEncuesta } from '../../hooks/useEncuestas'
import EncuestaWidget from '../../components/EncuestaWidget'

function useEsMovil() {
  return window.innerWidth <= 768
}

async function enviarNotificacionAviso(titulo, cuerpo) {
  try {
    const coro = await getCoroActual()
    if (!coro) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: { coro_id: coro.id, titulo: `Nuevo aviso: ${titulo}`, cuerpo: cuerpo || '' }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

export function AvisosAdmin() {
  const { avisos, cargando, error, recargar } = useAvisosAdmin()
  const [procesando, setProcesando] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [mostrarForm, setMostrarForm] = useState(false)
  const [editando, setEditando] = useState(null)
  const esMovil = useEsMovil()

  async function togglePublicar(aviso) {
    setProcesando(aviso.id)
    await publicarAviso(aviso.id, !aviso.publicado)
    if (!aviso.publicado) {
      await enviarNotificacionAviso(aviso.titulo, aviso.cuerpo)
    }
    await recargar()
    setProcesando(null)
  }

  async function handleEliminar(id) {
    setProcesando(id)
    await eliminarAviso(id)
    setConfirmEliminar(null)
    await recargar()
    setProcesando(null)
  }

  if (mostrarForm || editando) {
    return <AvisoForm
      aviso={editando}
      onGuardar={() => { setMostrarForm(false); setEditando(null); recargar() }}
      onCancelar={() => { setMostrarForm(false); setEditando(null) }}
    />
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Gestión de avisos
          </h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${avisos.length} aviso${avisos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setMostrarForm(true)}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo aviso
        </button>
      </div>

      {error && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>{error}</div>}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '64px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {/* MÓVIL: tarjetas */}
      {!cargando && esMovil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {avisos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>No hay avisos. Creá el primero.</div>
          )}
          {avisos.map(aviso => {
            const tc = TIPO_AVISO[aviso.tipo] || TIPO_AVISO.material
            const lecturas = aviso.avisos_leidos?.length || 0
            return (
              <div key={aviso.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px', opacity: procesando === aviso.id ? 0.5 : 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18', marginBottom: '3px' }}>{aviso.titulo}</div>
                    <span style={{ background: tc.bg, color: tc.color, fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', display: 'inline-block' }}>
                      {tc.label}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span style={{ fontSize: '11px', color: '#888780' }}>{lecturas} leídos</span>
                    <button onClick={() => togglePublicar(aviso)} disabled={!!procesando}
                      style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: aviso.publicado ? '#0F6E56' : '#D3D1C7', position: 'relative', transition: 'background 0.2s' }}>
                      <span style={{ position: 'absolute', top: '3px', left: aviso.publicado ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s' }} />
                    </button>
                    <span style={{ fontSize: '11px', color: aviso.publicado ? '#27500A' : '#888780' }}>
                      {aviso.publicado ? 'Publicado' : 'Borrador'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button onClick={() => setEditando(aviso)}
                      style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                      Editar
                    </button>
                    <button onClick={() => setConfirmEliminar(aviso)}
                      style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* DESKTOP: tabla */}
      {!cargando && !esMovil && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 110px', padding: '10px 16px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Aviso</span><span>Tipo</span><span>Lecturas</span>
            <span style={{ textAlign: 'center' }}>Publicado</span>
            <span style={{ textAlign: 'right' }}>Acciones</span>
          </div>
          {avisos.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>No hay avisos. Creá el primero.</div>
          )}
          {avisos.map((aviso, i) => {
            const tc = TIPO_AVISO[aviso.tipo] || TIPO_AVISO.material
            const lecturas = aviso.avisos_leidos?.length || 0
            return (
              <div key={aviso.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 80px 90px 110px', padding: '12px 16px', alignItems: 'center', borderBottom: i < avisos.length - 1 ? '1px solid #F1EFE8' : 'none', opacity: procesando === aviso.id ? 0.5 : 1 }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{aviso.titulo}</div>
                  <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>{tiempoRelativo(aviso.creado_en)}</div>
                </div>
                <span style={{ background: tc.bg, color: tc.color, fontSize: '10px', fontWeight: '600', padding: '2px 7px', borderRadius: '10px', display: 'inline-block' }}>{tc.label}</span>
                <span style={{ fontSize: '12px', color: '#888780' }}>{lecturas} leídos</span>
                <div style={{ textAlign: 'center' }}>
                  <button onClick={() => togglePublicar(aviso)} disabled={!!procesando}
                    style={{ width: '44px', height: '24px', borderRadius: '12px', border: 'none', cursor: 'pointer', background: aviso.publicado ? '#0F6E56' : '#D3D1C7', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '3px', left: aviso.publicado ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: '#FFFFFF', transition: 'left 0.2s' }} />
                  </button>
                </div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                  <button onClick={() => setEditando(aviso)}
                    style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                    Editar
                  </button>
                  <button onClick={() => setConfirmEliminar(aviso)}
                    style={{ padding: '5px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>
                    ✕
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {confirmEliminar && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '28px 24px', maxWidth: '360px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 10px' }}>Eliminar aviso</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: '1.6', margin: '0 0 24px' }}>
              ¿Eliminás <strong>"{confirmEliminar.titulo}"</strong>?
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmEliminar(null)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>Cancelar</button>
              <button onClick={() => handleEliminar(confirmEliminar.id)} style={{ flex: 1, height: '40px', borderRadius: '8px', border: 'none', background: '#A32D2D', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function AvisoForm({ aviso, onGuardar, onCancelar }) {
  const esEdicion = !!aviso
  const [obras, setObras] = useState([])
  const [eventos, setEventos] = useState([])
  const [coroId, setCoroId] = useState(null)
  const [form, setForm] = useState({
    titulo: aviso?.titulo || '',
    cuerpo: aviso?.cuerpo || '',
    tipo: aviso?.tipo || 'material',
    obra_id: aviso?.obra_id || '',
    evento_id: aviso?.evento_id || '',
  })
  const [errores, setErrores] = useState({})
  const [guardando, setGuardando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')

  // Encuesta: si el aviso ya tiene una, la traemos para mostrar resultados / cerrar
  const {
    encuesta: encuestaExistente, resultados, miVoto, votar,
    cargando: encCargando, recargar: recargarEncuesta
  } = useEncuesta(esEdicion ? aviso.id : null)
  const { crearEncuesta, cerrarEncuesta, reabrirEncuesta } = useCrearEncuesta()

  // Formulario de creación de encuesta (solo se usa si no hay una ya)
  const [agregarEncuesta, setAgregarEncuesta] = useState(false)
  const [encuestaPregunta, setEncuestaPregunta] = useState('')
  const [encuestaOpciones, setEncuestaOpciones] = useState(['', ''])
  const [encuestaMultiple, setEncuestaMultiple] = useState(false)

  const puedeAgregarEncuesta = !esEdicion || (!encCargando && !encuestaExistente)

  useEffect(() => {
    async function cargarOpciones() {
      const coro = await getCoroActual()
      if (!coro) return
      setCoroId(coro.id)
      supabase.from('obras').select('id, titulo').eq('coro_id', coro.id).eq('publicada', true).order('titulo')
        .then(({ data }) => setObras(data || []))
      supabase.from('eventos').select('id, titulo').eq('coro_id', coro.id).eq('publicado', true).order('fecha_inicio', { ascending: false })
        .then(({ data }) => setEventos(data || []))
    }
    cargarOpciones()
  }, [])

  function set(campo) { return e => setForm(f => ({ ...f, [campo]: e.target.value })) }

  function actualizarOpcion(i, valor) {
    setEncuestaOpciones(prev => prev.map((o, idx) => idx === i ? valor : o))
  }
  function agregarOpcion() {
    setEncuestaOpciones(prev => [...prev, ''])
  }
  function quitarOpcion(i) {
    setEncuestaOpciones(prev => prev.filter((_, idx) => idx !== i))
  }

  async function handleCerrarEncuesta() {
    await cerrarEncuesta(encuestaExistente.id)
    recargarEncuesta()
  }
  async function handleReabrirEncuesta() {
    await reabrirEncuesta(encuestaExistente.id)
    recargarEncuesta()
  }

  async function guardar(publicar) {
    setErrorGlobal('')
    if (!form.titulo.trim()) { setErrores({ titulo: 'El título es obligatorio.' }); return }

    let opcionesValidas = []
    if (agregarEncuesta) {
      if (!encuestaPregunta.trim()) { setErrorGlobal('La pregunta de la encuesta es obligatoria.'); return }
      opcionesValidas = encuestaOpciones.map(o => o.trim()).filter(Boolean)
      if (opcionesValidas.length < 2) { setErrorGlobal('La encuesta necesita al menos 2 opciones.'); return }
    }

    setGuardando(true)
    const datos = {
      titulo: form.titulo.trim(),
      cuerpo: form.cuerpo.trim() || null,
      tipo: form.tipo,
      obra_id: form.obra_id || null,
      evento_id: form.evento_id || null,
      publicado: publicar,
    }

    let ok, error, avisoGuardado
    if (esEdicion) {
      const res = await actualizarAviso(aviso.id, datos)
      ok = res.ok; error = res.error; avisoGuardado = res.data
    } else {
      const res = await crearAviso(datos)
      ok = res.ok; error = res.error; avisoGuardado = res.data
    }

    if (!ok) {
      setGuardando(false)
      setErrorGlobal(error)
      return
    }

    if (agregarEncuesta && avisoGuardado?.id && coroId) {
      try {
        await crearEncuesta({
          avisoId: avisoGuardado.id,
          coroId,
          pregunta: encuestaPregunta.trim(),
          permiteMultiple: encuestaMultiple,
          opciones: opcionesValidas,
        })
      } catch (err) {
        console.error('Error al crear la encuesta:', err)
        setGuardando(false)
        setErrorGlobal('El aviso se guardó, pero hubo un problema al crear la encuesta.')
        return
      }
    }

    if (ok && publicar && !esEdicion) {
      await enviarNotificacionAviso(datos.titulo, datos.cuerpo || '')
    }

    setGuardando(false)
    onGuardar()
  }

  return (
    <div style={{ maxWidth: '560px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={onCancelar} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Volver
        </button>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
          {esEdicion ? 'Editar aviso' : 'Nuevo aviso'}
        </h2>
      </div>

      {errorGlobal && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>{errorGlobal}</div>}

      <Campo label="Título *" error={errores.titulo}>
        <input value={form.titulo} onChange={set('titulo')} placeholder="Ej: Cambio de horario del ensayo" style={inputStyle} autoFocus />
      </Campo>

      <Campo label="Tipo de aviso">
        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
          {Object.entries(TIPO_AVISO).map(([valor, tc]) => (
            <button key={valor} type="button" onClick={() => setForm(f => ({ ...f, tipo: valor }))}
              style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '12px', cursor: 'pointer', border: `1.5px solid ${form.tipo === valor ? tc.dot : '#D3D1C7'}`, background: form.tipo === valor ? tc.bg : '#FFFFFF', color: form.tipo === valor ? tc.color : '#5F5E5A', fontWeight: form.tipo === valor ? '500' : '400' }}>
              {tc.label}
            </button>
          ))}
        </div>
      </Campo>

      <Campo label="Descripción (opcional)">
        <textarea value={form.cuerpo} onChange={set('cuerpo')} placeholder="Detalles del aviso..." rows={4}
          style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical', lineHeight: '1.6' }} />
      </Campo>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <Campo label="Obra relacionada (opcional)">
          <select value={form.obra_id} onChange={set('obra_id')} style={inputStyle}>
            <option value="">Ninguna</option>
            {obras.map(o => <option key={o.id} value={o.id}>{o.titulo}</option>)}
          </select>
        </Campo>
        <Campo label="Evento relacionado (opcional)">
          <select value={form.evento_id} onChange={set('evento_id')} style={inputStyle}>
            <option value="">Ninguno</option>
            {eventos.map(e => <option key={e.id} value={e.id}>{e.titulo}</option>)}
          </select>
        </Campo>
      </div>

      {/* Encuesta existente — resultados + cerrar/reabrir */}
      {esEdicion && encuestaExistente && (
        <div style={{ marginTop: '4px', marginBottom: '14px' }}>
          <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>
            Encuesta de este aviso
          </label>
          <EncuestaWidget
            encuesta={encuestaExistente}
            resultados={resultados}
            miVoto={miVoto}
            votar={votar}
            esAdmin
            onCerrar={handleCerrarEncuesta}
            onReabrir={handleReabrirEncuesta}
          />
        </div>
      )}

      {/* Agregar encuesta — solo si todavía no tiene una */}
      {puedeAgregarEncuesta && (
        <div style={{ marginTop: '4px', marginBottom: '14px', border: '1px solid #E8E6DF', borderRadius: '10px', padding: '14px' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>
            <input type="checkbox" checked={agregarEncuesta} onChange={e => setAgregarEncuesta(e.target.checked)} />
            Agregar una encuesta a este aviso
          </label>

          {agregarEncuesta && (
            <div style={{ marginTop: '12px' }}>
              <Campo label="Pregunta">
                <input value={encuestaPregunta} onChange={e => setEncuestaPregunta(e.target.value)}
                  placeholder="Ej: ¿Qué día prefieren para el ensayo extra?" style={inputStyle} />
              </Campo>

              <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>Opciones</label>
              {encuestaOpciones.map((op, i) => (
                <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                  <input value={op} onChange={e => actualizarOpcion(i, e.target.value)}
                    placeholder={`Opción ${i + 1}`} style={inputStyle} />
                  {encuestaOpciones.length > 2 && (
                    <button type="button" onClick={() => quitarOpcion(i)}
                      style={{ width: '38px', height: '38px', border: '1px solid #F0C5B4', borderRadius: '8px', background: 'none', color: '#A32D2D', cursor: 'pointer', flexShrink: 0 }}>
                      ×
                    </button>
                  )}
                </div>
              ))}
              {encuestaOpciones.length < 8 && (
                <button type="button" onClick={agregarOpcion}
                  style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', border: 'none', borderRadius: '6px', padding: '5px 10px', cursor: 'pointer', fontWeight: '500', marginBottom: '10px' }}>
                  + Agregar opción
                </button>
              )}

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px', color: '#5F5E5A', marginTop: '4px' }}>
                <input type="checkbox" checked={encuestaMultiple} onChange={e => setEncuestaMultiple(e.target.checked)} />
                Permitir elegir más de una opción
              </label>
            </div>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }}>
        <button onClick={() => guardar(false)} disabled={guardando}
          style={{ flex: 1, height: '42px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#1A1A18', fontSize: '14px', cursor: 'pointer' }}>
          Guardar borrador
        </button>
        <button onClick={() => guardar(true)} disabled={guardando}
          style={{ flex: 2, height: '42px', borderRadius: '8px', border: 'none', background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '14px', cursor: 'pointer', fontWeight: '500' }}>
          {guardando ? 'Guardando...' : esEdicion ? 'Guardar cambios' : 'Publicar ahora'}
        </button>
      </div>
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

const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }