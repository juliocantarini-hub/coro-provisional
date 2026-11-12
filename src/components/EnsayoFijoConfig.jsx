import { useState } from 'react'
import { useEnsayoFijo, guardarEnsayoFijo, textoEnsayoFijo, DIAS_SEMANA } from '../hooks/useEnsayoFijo'

// Tarjeta en Gestión → Eventos para definir el ensayo de todas las semanas.
export default function EnsayoFijoConfig({ onGuardado }) {
  const { config, cargando, falta, recargar } = useEnsayoFijo()
  const [editando, setEditando] = useState(false)
  const [form, setForm] = useState(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')

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

  const set = (campo) => (e) => setForm(f => ({ ...f, [campo]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderLeft: '4px solid #1D9E75', borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
      {!editando && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ensayo semanal</div>
            <div style={{ fontSize: '14px', color: config?.activo ? '#1A1A18' : '#888780', marginTop: '3px' }}>
              {!config ? 'Sin configurar' : config.activo ? textoEnsayoFijo(config) : `Pausado · ${textoEnsayoFijo(config)}`}
            </div>
            <div style={{ fontSize: '12px', color: '#888780', marginTop: '3px', lineHeight: 1.5 }}>
              {config?.activo
                ? 'Cada ensayo se crea solo una semana antes. Si un día no hay ensayo (feriado), borrá ese evento.'
                : 'Definí el día y la hora, y cada semana el ensayo se crea solo en el calendario.'}
            </div>
          </div>
          <button onClick={abrir}
            style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '600' }}>
            {config ? 'Editar' : 'Configurar'}
          </button>
        </div>
      )}

      {editando && form && (
        <div>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '12px' }}>Ensayo semanal</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            <div>
              <label style={labelStyle}>Día</label>
              <select value={form.dia_semana} onChange={set('dia_semana')} style={inputStyle}>
                {DIAS_SEMANA.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Empieza</label>
              <input type="time" value={form.hora_inicio} onChange={set('hora_inicio')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Termina (opcional)</label>
              <input type="time" value={form.hora_fin} onChange={set('hora_fin')} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Lugar</label>
              <input value={form.lugar} onChange={set('lugar')} placeholder="Ej: Sede" style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}>Nombre en el calendario</label>
              <input value={form.titulo} onChange={set('titulo')} placeholder="Ensayo" style={inputStyle} />
            </div>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1A1A18', marginTop: '12px', cursor: 'pointer' }}>
            <input type="checkbox" checked={form.activo} onChange={set('activo')} />
            Crear el ensayo automáticamente cada semana
          </label>
          {error && <div style={{ fontSize: '12px', color: '#A32D2D', marginTop: '10px' }}>{error}</div>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '14px' }}>
            <button onClick={() => setEditando(false)}
              style={{ height: '38px', padding: '0 16px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', fontSize: '13px' }}>
              Cancelar
            </button>
            <button onClick={guardar} disabled={guardando}
              style={{ height: '38px', padding: '0 20px', borderRadius: '8px', border: 'none', background: '#0F6E56', color: '#FFFFFF', cursor: 'pointer', fontSize: '13px', fontWeight: '500' }}>
              {guardando ? 'Guardando...' : 'Guardar'}
            </button>
          </div>
          <p style={{ fontSize: '12px', color: '#888780', margin: '10px 0 0', lineHeight: 1.5 }}>
            Los cambios valen para los ensayos que se creen de ahora en adelante. Un ensayo que ya está en el calendario se cambia desde Editar.
          </p>
        </div>
      )}
    </div>
  )
}

const labelStyle = { display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }
const inputStyle = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 10px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }
