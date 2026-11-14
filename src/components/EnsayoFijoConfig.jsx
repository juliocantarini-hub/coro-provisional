import { useState } from 'react'
import {
  useEnsayoFijo, guardarEnsayoFijo, crearCambioEnsayo, eliminarCambioEnsayo, resetearEnsayoFijo,
  textoEnsayoFijo, textoPeriodo, textoCambio, DIAS_SEMANA, MESES,
} from '../hooks/useEnsayoFijo'

// Tarjeta en Gestión → Eventos para definir el ensayo de todas las semanas
// y programar cambios a futuro (otro horario o meses sin ensayo).
export default function EnsayoFijoConfig({ onGuardado }) {
  const { config, cambios, cargando, falta, faltanCambios, recargar } = useEnsayoFijo()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(null)
  const [nuevoCambio, setNuevoCambio] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [confirmarReset, setConfirmarReset] = useState(false)

  if (cargando || falta) return null

  function abrir() {
    setForm({
      activo: config ? config.activo : true,
      dia_semana: config ? config.dia_semana : 4,
      hora_inicio: (config?.hora_inicio || '20:00').slice(0, 5),
      hora_fin: (config?.hora_fin || '').slice(0, 5),
      lugar: config?.lugar || '',
      titulo: config?.titulo || 'Ensayo',
    })
    setError('')
    setNuevoCambio(null)
    setEditando(true)
  }

  async function guardar() {
    if (!form.hora_inicio) { setError('Falta la hora de inicio.'); return }
    setGuardando(true)
    const { ok, error: err } = await guardarEnsayoFijo(form)
    setGuardando(false)
    if (!ok) { setError(err || 'No se pudo guardar.'); return }
    setEditando(false)
    await recargar()
    if (onGuardado) onGuardado()
  }

  function abrirCambio() {
    const hoy = new Date()
    const mes = hoy.getMonth() === 11 ? 0 : hoy.getMonth() + 1
    const anio = hoy.getMonth() === 11 ? hoy.getFullYear() + 1 : hoy.getFullYear()
    setNuevoCambio({
      tipo: 'horario', desdeMes: mes, desdeAnio: anio, hastaMes: mes, hastaAnio: anio,
      dia_semana: config?.dia_semana ?? 4,
      hora_inicio: (config?.hora_inicio || '20:00').slice(0, 5),
      hora_fin: (config?.hora_fin || '').slice(0, 5),
      lugar: '',
    })
    setError('')
    setEditando(false)
  }

  async function guardarCambio() {
    setGuardando(true)
    const { ok, error: err } = await crearCambioEnsayo(nuevoCambio)
    setGuardando(false)
    if (!ok) { setError(err || 'No se pudo guardar el cambio.'); return }
    setNuevoCambio(null)
    await recargar()
  }

  async function borrarCambio(id) {
    await eliminarCambioEnsayo(id)
    await recargar()
  }

  async function resetear() {
    setGuardando(true)
    await resetearEnsayoFijo()
    setGuardando(false)
    setConfirmarReset(false)
    setEditando(false)
    setNuevoCambio(null)
    await recargar()
  }

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))
  const setC = (campo) => (e) => setNuevoCambio(f => ({ ...f, [campo]: e.target.value }))
  const anioActual = new Date().getFullYear()
  const ANIOS = [anioActual, anioActual + 1, anioActual + 2]

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderLeft: '4px solid #1D9E75', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
      <div style={titulo}>Ensayo semanal</div>

      {/* Resumen */}
      {!editando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '3px' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '14px', color: config?.activo ? '#1A1A18' : '#888780' }}>
              {!config ? 'Sin configurar' : config.activo ? textoEnsayoFijo(config) : `Pausado · ${textoEnsayoFijo(config)}`}
            </div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px', lineHeight: 1.5 }}>
              {config?.activo
                ? 'Cada ensayo se crea solo una semana antes. Si un día no hay ensayo (feriado), borrá ese evento.'
                : 'Definí el día y la hora, y cada semana el ensayo se crea solo en el calendario.'}
            </div>
          </div>
          <button onClick={abrir} style={botonSecundario}>{config ? 'Editar' : 'Configurar'}</button>
        </div>
      )}

      {/* Edición del horario habitual */}
      {editando && form && (
        <div style={{ marginTop: '10px' }}>
          <div style={grilla}>
            <Campo label="Día">
              <select value={form.dia_semana} onChange={set('dia_semana')} style={inputStyle}>
                {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </Campo>
            <Campo label="Empieza"><input type="time" value={form.hora_inicio} onChange={set('hora_inicio')} style={inputStyle} /></Campo>
            <Campo label="Termina (opcional)"><input type="time" value={form.hora_fin} onChange={set('hora_fin')} style={inputStyle} /></Campo>
            <Campo label="Lugar"><input value={form.lugar} onChange={set('lugar')} placeholder="Ej: Sede" style={inputStyle} /></Campo>
            <Campo label="Nombre en el calendario"><input value={form.titulo} onChange={set('titulo')} placeholder="Ensayo" style={inputStyle} /></Campo>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1A1A18', marginTop: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={set('activo')} />
            Crear el ensayo automáticamente cada semana
          </label>
          {error && <div style={errorStyle}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap' }}>
            <button onClick={() => setEditando(false)} style={botonCancelar}>Cancelar</button>
            <button onClick={guardar} disabled={guardando} style={botonPrimario}>{guardando ? 'Guardando...' : 'Guardar'}</button>
            {config && (
              <button onClick={() => setConfirmarReset(true)}
                style={{ ...botonCancelar, marginLeft: 'auto', color: '#A32D2D', borderColor: '#F0C5B4' }}>
                Borrar todo y empezar de cero
              </button>
            )}
          </div>
          <p style={nota}>Los cambios valen para los ensayos que se creen de ahora en adelante. Un ensayo que ya está en el calendario se cambia desde Editar.</p>
        </div>
      )}

      {/* Cambios programados */}
      {config && !faltanCambios && (
        <div style={{ borderTop: '1px solid #F1EFE8', marginTop: '14px', paddingTop: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <div style={{ ...titulo, color: '#5F5E5A', flex: 1 }}>Cambios programados</div>
            {!nuevoCambio && <button onClick={abrirCambio} style={botonSecundario}>+ Programar cambio</button>}
          </div>

          {cambios.length === 0 && !nuevoCambio && (
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '6px', lineHeight: 1.5 }}>
              Por ejemplo: otro horario en diciembre, o enero sin ensayos. Se aplican solos cuando llega la fecha.
            </div>
          )}

          {cambios.map(c => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid #F1EFE8' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: c.tipo === 'sin_ensayo' ? '#E24B4A' : '#378ADD', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A18' }}>{textoPeriodo(c)}</div>
                <div style={{ fontSize: '12px', color: '#5F5E5A' }}>{textoCambio(c, config)}</div>
              </div>
              <button onClick={() => borrarCambio(c.id)} aria-label="Borrar este cambio"
                style={{ padding: '4px 9px', fontSize: '12px', borderRadius: '6px', border: '1px solid #F0C5B4', background: 'none', cursor: 'pointer', color: '#A32D2D' }}>✕</button>
            </div>
          ))}

          {nuevoCambio && (
            <div style={{ background: '#F8F7F3', borderRadius: '10px', padding: '12px', marginTop: '10px' }}>
              <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                {[['horario', 'Otro horario'], ['sin_ensayo', 'Sin ensayos']].map(([v, l]) => (
                  <button key={v} onClick={() => setNuevoCambio(f => ({ ...f, tipo: v }))}
                    style={{ flex: 1, height: '36px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer', fontWeight: nuevoCambio.tipo === v ? '600' : '400', border: `1.5px solid ${nuevoCambio.tipo === v ? '#0F6E56' : '#D3D1C7'}`, background: nuevoCambio.tipo === v ? '#E1F5EE' : '#FFFFFF', color: nuevoCambio.tipo === v ? '#04342C' : '#5F5E5A' }}>
                    {l}
                  </button>
                ))}
              </div>
              <div style={grilla}>
                <Campo label="Desde">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select value={nuevoCambio.desdeMes} onChange={setC('desdeMes')} style={inputStyle}>{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                    <select value={nuevoCambio.desdeAnio} onChange={setC('desdeAnio')} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>{ANIOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                  </div>
                </Campo>
                <Campo label="Hasta (inclusive)">
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <select value={nuevoCambio.hastaMes} onChange={setC('hastaMes')} style={inputStyle}>{MESES.map((m, i) => <option key={i} value={i}>{m}</option>)}</select>
                    <select value={nuevoCambio.hastaAnio} onChange={setC('hastaAnio')} style={{ ...inputStyle, width: '90px', flexShrink: 0 }}>{ANIOS.map(a => <option key={a} value={a}>{a}</option>)}</select>
                  </div>
                </Campo>
              </div>
              {nuevoCambio.tipo === 'horario' && (
                <div style={{ ...grilla, marginTop: '12px' }}>
                  <Campo label="Día">
                    <select value={nuevoCambio.dia_semana} onChange={setC('dia_semana')} style={inputStyle}>
                      {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </Campo>
                  <Campo label="Empieza"><input type="time" value={nuevoCambio.hora_inicio} onChange={setC('hora_inicio')} style={inputStyle} /></Campo>
                  <Campo label="Termina (opcional)"><input type="time" value={nuevoCambio.hora_fin} onChange={setC('hora_fin')} style={inputStyle} /></Campo>
                  <Campo label="Lugar (si cambia)"><input value={nuevoCambio.lugar} onChange={setC('lugar')} placeholder={config?.lugar || 'Mismo lugar'} style={inputStyle} /></Campo>
                </div>
              )}
              {error && <div style={errorStyle}>{error}</div>}
              <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                <button onClick={() => { setNuevoCambio(null); setError('') }} style={botonCancelar}>Cancelar</button>
                <button onClick={guardarCambio} disabled={guardando} style={botonPrimario}>{guardando ? 'Guardando...' : 'Guardar cambio'}</button>
              </div>
              <p style={nota}>Si el cambio empieza en menos de una semana, el próximo ensayo ya puede estar creado: corregilo o borralo desde la lista.</p>
            </div>
          )}
        </div>
      )}

      {/* Confirmación de reseteo */}
      {confirmarReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '24px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '24px', maxWidth: '380px', width: '100%', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 10px' }}>Borrar el ensayo semanal</h3>
            <p style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: 1.6, margin: '0 0 20px' }}>
              Se borran el horario habitual y todos los cambios programados, y dejan de crearse ensayos automáticamente. Los ensayos que ya están en el calendario no se tocan.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setConfirmarReset(false)} style={{ ...botonCancelar, flex: 1 }}>Cancelar</button>
              <button onClick={resetear} disabled={guardando} style={{ ...botonPrimario, flex: 1, background: '#A32D2D' }}>{guardando ? 'Borrando...' : 'Borrar todo'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Campo({ label, children }) {
  return (
    <div>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  )
}

const titulo = { fontSize: '11px', fontWeight: '700', color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.5px' }
const grilla = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '12px' }
const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }
const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 10px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box', minWidth: 0 }
const botonSecundario = { padding: '7px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '600' }
const botonCancelar = { height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }
const botonPrimario = { height: '38px', padding: '0 20px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }
const errorStyle = { fontSize: '12px', color: '#A32D2D', marginTop: '10px' }
const nota = { fontSize: '12px', color: '#888780', margin: '10px 0 0', lineHeight: 1.5 }
