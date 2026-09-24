import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { crearEvento, actualizarEvento, publicarEvento } from '../../hooks/useEventos'
import { getCoroActual } from '../../lib/coro'

async function enviarNotificacionEvento(titulo) {
  try {
    const coro = await getCoroActual()
    if (!coro) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: { coro_id: coro.id, titulo: `Nuevo evento: ${titulo}`, cuerpo: 'Revisá la fecha y confirmá tu asistencia', url: '/calendario' }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

const TIPOS = ['ensayo', 'concierto', 'reunion', 'extra']

const VACIO = {
  titulo: '', tipo: 'ensayo',
  fecha_inicio: '', hora_inicio: '',
  fecha_fin: '',    hora_fin: '',
  lugar: '', direccion: '', notas: '',
}

export default function EventoForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esEdicion = !!id

  const [form, setForm]           = useState(VACIO)
  const [obrasDisponibles, setObrasDisponibles] = useState([])
  const [obrasSeleccionadas, setObrasSeleccionadas] = useState([])
  const [errores, setErrores]     = useState({})
  const [errorGlobal, setErrorGlobal] = useState('')
  const [cargando, setCargando]   = useState(esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [publicado, setPublicado] = useState(false)

  // Cargar obras publicadas para vincular
  useEffect(() => {
  async function cargarObras() {
    const coro = await getCoroActual()
    const { data } = await supabase
      .from('obras')
      .select('id, titulo, compositor')
      .eq('publicada', true)
      .eq('coro_id', coro.id)
      .order('titulo')
    setObrasDisponibles(data || [])
  }
  cargarObras()
}, [])

  // Cargar datos del evento si es edición
  useEffect(() => {
    if (!esEdicion) return
    supabase.from('eventos').select('*, eventos_obras(obra_id, orden)').eq('id', id).single()
      .then(({ data, error }) => {
        if (error || !data) { setErrorGlobal('No se pudo cargar el evento.'); return }
        const fi = data.fecha_inicio ? new Date(data.fecha_inicio) : null
        const ff = data.fecha_fin    ? new Date(data.fecha_fin)    : null
        setForm({
          titulo: data.titulo || '',
          tipo: data.tipo || 'ensayo',
          fecha_inicio: fi ? fi.toISOString().slice(0, 10) : '',
          hora_inicio:  fi ? fi.toTimeString().slice(0, 5) : '',
          fecha_fin: ff ? ff.toISOString().slice(0, 10) : '',
          hora_fin:  ff ? ff.toTimeString().slice(0, 5) : '',
          lugar: data.lugar || '',
          direccion: data.direccion || '',
          notas: data.notas || '',
        })
        setPublicado(data.publicado || false)
        const obraIds = (data.eventos_obras || [])
          .sort((a, b) => a.orden - b.orden)
          .map(eo => eo.obra_id)
        setObrasSeleccionadas(obraIds)
        setCargando(false)
      })
  }, [id, esEdicion])

  function set(campo) {
    return e => {
      setForm(f => ({ ...f, [campo]: e.target.value }))
      setErrores(er => ({ ...er, [campo]: undefined }))
    }
  }

  function toggleObra(obraId) {
    setObrasSeleccionadas(prev =>
      prev.includes(obraId) ? prev.filter(id => id !== obraId) : [...prev, obraId]
    )
  }

  function combinarFechaHora(fecha, hora) {
    if (!fecha) return null
    return new Date(`${fecha}T${hora || '00:00'}:00`).toISOString()
  }

  function validar() {
    const e = {}
    if (!form.titulo.trim()) e.titulo = 'El título es obligatorio.'
    if (!form.fecha_inicio)  e.fecha_inicio = 'La fecha de inicio es obligatoria.'
    return e
  }

  async function guardar(publicar = false) {
    setErrorGlobal('')
    const e = validar()
    if (Object.keys(e).length) { setErrores(e); return }
    setGuardando(true)

    const datos = {
      titulo: form.titulo.trim(),
      tipo: form.tipo,
      fecha_inicio: combinarFechaHora(form.fecha_inicio, form.hora_inicio),
      fecha_fin: form.fecha_fin ? combinarFechaHora(form.fecha_fin, form.hora_fin) : null,
      lugar: form.lugar.trim() || null,
      direccion: form.direccion.trim() || null,
      notas: form.notas.trim() || null,
    }
    if (publicar) datos.publicado = true

    const { ok, data, error } = esEdicion
      ? await actualizarEvento(id, datos, obrasSeleccionadas)
      : await crearEvento(datos, obrasSeleccionadas)

    if (!ok) { setErrorGlobal(error || 'No se pudo guardar.'); setGuardando(false); return }

    if (publicar && !esEdicion && data?.id) {
      await publicarEvento(data.id, true)
      await enviarNotificacionEvento(datos.titulo)
    }

    setGuardando(false)
    navigate('/admin/eventos')
  }

  if (cargando) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#888780' }}>Cargando evento...</div>
  }

  return (
    <div style={{ maxWidth: '640px' }}>
      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/admin/eventos')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
          Volver
        </button>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
          {esEdicion ? 'Editar evento' : 'Nuevo evento'}
        </h2>
        {esEdicion && (
          <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '10px', background: publicado ? '#EAF3DE' : '#F1EFE8', color: publicado ? '#27500A' : '#888780', fontWeight: '600' }}>
            {publicado ? 'Publicado' : 'Borrador'}
          </span>
        )}
      </div>

      {errorGlobal && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>
          {errorGlobal}
        </div>
      )}

      {/* ── Datos básicos ── */}
      <Seccion titulo="Información del evento">
        <Campo label="Título *" error={errores.titulo}>
          <input value={form.titulo} onChange={set('titulo')} placeholder="Ensayo general" style={inputStyle} autoFocus />
        </Campo>
        <Campo label="Tipo de evento">
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {TIPOS.map(t => (
              <button key={t} type="button" onClick={() => setForm(f => ({ ...f, tipo: t }))}
                style={{
                  padding: '6px 14px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer',
                  border: `1.5px solid ${form.tipo === t ? '#0F6E56' : '#D3D1C7'}`,
                  background: form.tipo === t ? '#E1F5EE' : '#FFFFFF',
                  color: form.tipo === t ? '#04342C' : '#5F5E5A',
                  fontWeight: form.tipo === t ? '500' : '400', textTransform: 'capitalize',
                }}>
                {t}
              </button>
            ))}
          </div>
        </Campo>
      </Seccion>

      {/* ── Fecha y hora ── */}
      <Seccion titulo="Fecha y hora">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Campo label="Fecha de inicio *" error={errores.fecha_inicio}>
            <input type="date" value={form.fecha_inicio} onChange={set('fecha_inicio')} style={inputStyle} />
          </Campo>
          <Campo label="Hora de inicio">
            <input type="time" value={form.hora_inicio} onChange={set('hora_inicio')} style={inputStyle} />
          </Campo>
          <Campo label="Fecha de fin">
            <input type="date" value={form.fecha_fin} onChange={set('fecha_fin')} min={form.fecha_inicio} style={inputStyle} />
          </Campo>
          <Campo label="Hora de fin">
            <input type="time" value={form.hora_fin} onChange={set('hora_fin')} style={inputStyle} />
          </Campo>
        </div>
      </Seccion>

      {/* ── Lugar ── */}
      <Seccion titulo="Lugar">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <Campo label="Nombre del lugar">
            <input value={form.lugar} onChange={set('lugar')} placeholder="Sala parroquial San José" style={inputStyle} />
          </Campo>
          <Campo label="Dirección">
            <input value={form.direccion} onChange={set('direccion')} placeholder="Calle Mayor, 12" style={inputStyle} />
          </Campo>
        </div>
      </Seccion>

      {/* ── Repertorio vinculado ── */}
      <Seccion titulo={`Repertorio del evento (${obrasSeleccionadas.length} seleccionadas)`}>
        {obrasDisponibles.length === 0 ? (
          <p style={{ fontSize: '13px', color: '#888780' }}>No hay obras publicadas aún.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
            {obrasDisponibles.map(obra => {
              const sel = obrasSeleccionadas.includes(obra.id)
              return (
                <label key={obra.id} style={{
                  display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer',
                  padding: '8px 10px', borderRadius: '8px',
                  background: sel ? '#E1F5EE' : '#F8F7F3',
                  border: `1px solid ${sel ? '#B4D8CE' : '#E8E6DF'}`,
                  transition: 'all 0.12s',
                }}>
                  <input type="checkbox" checked={sel} onChange={() => toggleObra(obra.id)}
                    style={{ width: '15px', height: '15px', accentColor: '#0F6E56', flexShrink: 0 }} />
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: sel ? '500' : '400', color: '#1A1A18' }}>{obra.titulo}</div>
                    <div style={{ fontSize: '11px', color: '#888780' }}>{obra.compositor}</div>
                  </div>
                </label>
              )
            })}
          </div>
        )}
      </Seccion>

      {/* ── Notas ── */}
      <Seccion titulo="Notas logísticas">
        <Campo label="Indicaciones para los cantantes">
          <textarea value={form.notas} onChange={set('notas')}
            placeholder='Ej: "Traer carpeta negra. Empezamos puntuales."'
            rows={3}
            style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }}
          />
        </Campo>
      </Seccion>

      {/* Botones */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
        <button onClick={() => guardar(false)} disabled={guardando}
          style={{ flex: 1, height: '42px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#1A1A18', fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer' }}>
          {guardando ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button onClick={() => guardar(true)} disabled={guardando}
          style={{ flex: 2, height: '42px', borderRadius: '8px', border: 'none', background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF', fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '500' }}>
          {guardando ? 'Guardando...' : publicado ? 'Guardar y publicar' : 'Publicar para cantantes'}
        </button>
      </div>
    </div>
  )
}

function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px', paddingBottom: '8px', borderBottom: '1px solid #E8E6DF' }}>
        {titulo}
      </h3>
      {children}
    </div>
  )
}

function Campo({ label, error, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>{label}</label>
      {children}
      {error && <p style={{ fontSize: '12px', color: '#A32D2D', margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}

const inputStyle = {
  width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px',
  padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF',
  outline: 'none', boxSizing: 'border-box',
}
