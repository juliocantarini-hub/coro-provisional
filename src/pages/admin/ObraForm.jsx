import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import { crearObra, actualizarObra, publicarObra, guardarAudiosObra } from '../../hooks/useObras'
import { driveUrlPDF, driveUrlAudio } from '../../components/drive/DriveComponents'

async function enviarNotificacionObra(titulo) {
  try {
    const coro = await getCoroActual()
    if (!coro) return
    await supabase.functions.invoke('enviar-notificaciones', {
      body: { coro_id: coro.id, titulo: `Nueva obra: ${titulo}`, cuerpo: 'Ya está disponible en el repertorio', url: '/repertorio' }
    })
  } catch (err) {
    console.error('Error al enviar notificación:', err)
  }
}

const ESTADOS = ['estudio', 'activo', 'concierto', 'archivado']

const VOCES_BASE = ['soprano', 'mezzo', 'contralto', 'tenor', 'baritono', 'bajo']

const VOCES_LABELS = {
  general:   'Audio general',
  soprano:   'Soprano',
  contralto: 'Contralto',
  tenor:     'Tenor',
  mezzo:     'Mezzo',
  baritono:  'Barítono',
  bajo:      'Bajo',
}

const FORM_VACIO = {
  titulo: '', compositor: '', estado: 'estudio', descripcion: '', notas_director: '',
  drive_partitura_id: '',
}

const AUDIOS_INICIALES = [
  { _key: 'general-1',   voz: 'general',   parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'soprano-1',   voz: 'soprano',   parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'mezzo-1',     voz: 'mezzo',     parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'contralto-1', voz: 'contralto', parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'tenor-1',     voz: 'tenor',     parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'baritono-1',  voz: 'baritono',  parte: 1, drive_id: '', etiqueta: '' },
  { _key: 'bajo-1',      voz: 'bajo',      parte: 1, drive_id: '', etiqueta: '' },
]

function extraerDriveId(input) {
  if (!input) return ''
  input = input.trim()
  if (/^[\w-]{25,}$/.test(input)) return input
  const m1 = input.match(/\/d\/([\w-]+)/)
  if (m1) return m1[1]
  const m2 = input.match(/[?&]id=([\w-]+)/)
  if (m2) return m2[1]
  return input
}

function parteLabel(voz, parte, totalPartes) {
  if (voz === 'general') return VOCES_LABELS.general
  const label = VOCES_LABELS[voz] || voz
  return totalPartes > 1 ? `${label} ${parte}` : label
}

export default function ObraForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const esEdicion = !!id

  const [form, setForm] = useState(FORM_VACIO)
  const [audios, setAudios] = useState(AUDIOS_INICIALES)
  const [errores, setErrores] = useState({})
  const [cargando, setCargando] = useState(esEdicion)
  const [guardando, setGuardando] = useState(false)
  const [errorGlobal, setErrorGlobal] = useState('')
  const [publicada, setPublicada] = useState(false)

  useEffect(() => {
  if (!esEdicion) return
  async function cargar() {
    const { data, error } = await supabase
      .from('obras')
      .select('*')
      .eq('id', id)
      .single()

    if (error || !data) { setErrorGlobal('No se pudo cargar la obra.'); setCargando(false); return }

    setForm({
      titulo:             data.titulo || '',
      compositor:         data.compositor || '',
      estado:             data.estado || 'estudio',
      descripcion:        data.descripcion || '',
      notas_director:     data.notas_director || '',
      drive_partitura_id: data.drive_partitura_id || '',
    })
    setPublicada(data.publicada || false)

    const { data: audiosData, error: errorAudios } = await supabase
      .from('obras_audios')
      .select('id, voz, parte, drive_id, etiqueta')
      .eq('obra_id', id)

    if (errorAudios) {
      console.warn('Audios no disponibles:', errorAudios.message)
    } else if (audiosData?.length) {
      const ordenVoz = { general: 0, soprano: 1, mezzo: 2, contralto: 3, tenor: 4, baritono: 5, bajo: 6 }
      const cargados = [...audiosData]
        .sort((a, b) => {
          const diff = (ordenVoz[a.voz] ?? 99) - (ordenVoz[b.voz] ?? 99)
          return diff !== 0 ? diff : a.parte - b.parte
        })
        .map(a => ({
          _key:     `${a.voz}-${a.parte}`,
          voz:      a.voz,
          parte:    a.parte,
          drive_id: a.drive_id || '',
          etiqueta: a.etiqueta || '',
        }))
      setAudios(cargados)
    }
    setCargando(false)
  }
  cargar()
}, [id, esEdicion])

  // ── Form handlers ──
  function setField(campo) {
    return e => {
      const raw = e.target.value
      const valor = campo === 'drive_partitura_id' ? extraerDriveId(raw) : raw
      setForm(f => ({ ...f, [campo]: valor }))
      setErrores(er => ({ ...er, [campo]: undefined }))
    }
  }

  // ── Audio handlers ──
  function setAudioField(key, campo, rawValor) {
    setAudios(prev => prev.map(a =>
      a._key === key
        ? { ...a, [campo]: campo === 'drive_id' ? extraerDriveId(rawValor) : rawValor }
        : a
    ))
  }

  function agregarParte(voz) {
    const partesDeEstaVoz = audios.filter(a => a.voz === voz)
    const maxParte = Math.max(...partesDeEstaVoz.map(a => a.parte))
    const nuevaParte = maxParte + 1
    const nuevaKey = `${voz}-${nuevaParte}`
    // Insertar después de la última parte de esta voz
    const idx = audios.findLastIndex(a => a.voz === voz)
    const nuevos = [...audios]
    nuevos.splice(idx + 1, 0, { _key: nuevaKey, voz, parte: nuevaParte, drive_id: '', etiqueta: '' })
    setAudios(nuevos)
  }

  function eliminarAudio(key) {
    setAudios(prev => {
      const restantes = prev.filter(a => a._key !== key)
      // Renumerar partes de esa voz
      const voz = prev.find(a => a._key === key)?.voz
      let parte = 1
      return restantes.map(a => {
        if (a.voz === voz) {
          const nueva = { ...a, parte, _key: `${voz}-${parte}` }
          parte++
          return nueva
        }
        return a
      })
    })
  }

  function previsualizarDrive(fileId, tipo) {
    if (!fileId) return
    const url = tipo === 'pdf' ? driveUrlPDF(fileId) : driveUrlAudio(fileId)
    window.open(url, '_blank', 'noopener')
  }

  function validar() {
    const e = {}
    if (!form.titulo.trim()) e.titulo = 'El título es obligatorio.'
    return e
  }

  async function guardar(publicar = false) {
    setErrorGlobal('')
    const e = validar()
    if (Object.keys(e).length) { setErrores(e); return }
    setGuardando(true)

    const datos = {
      titulo:             form.titulo.trim(),
      compositor:         form.compositor.trim(),
      estado:             form.estado,
      descripcion:        form.descripcion.trim() || null,
      notas_director:     form.notas_director.trim() || null,
      drive_partitura_id: form.drive_partitura_id || null,
    }

    if (publicar) datos.publicada = true

    const { ok, data, error } = esEdicion
      ? await actualizarObra(id, datos)
      : await crearObra(datos)

    if (!ok) { setErrorGlobal(error || 'No se pudo guardar.'); setGuardando(false); return }

    const obraId = esEdicion ? id : data?.id
    if (obraId) {
      const { ok: okAudios, error: errAudios } = await guardarAudiosObra(obraId, audios)
      if (!okAudios) { setErrorGlobal(errAudios || 'Error al guardar audios.'); setGuardando(false); return }
    }

   if (publicar && !esEdicion && data?.id) {
  await publicarObra(data.id, true)
  await enviarNotificacionObra(datos.titulo)
    }

    setGuardando(false)
    navigate('/admin/obras')
  }

  if (cargando) {
    return <div style={{ padding: '40px', textAlign: 'center', color: '#888780' }}>Cargando obra...</div>
  }

  // Para saber cuántas partes tiene cada voz (para mostrar etiqueta numerada)
  const conteoPorVoz = audios.reduce((acc, a) => {
    acc[a.voz] = (acc[a.voz] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ maxWidth: '680px', width: '100%', boxSizing: 'border-box' }}>

      {/* Cabecera */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
        <button onClick={() => navigate('/admin/obras')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888780', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Volver
        </button>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>
          {esEdicion ? 'Editar obra' : 'Nueva obra'}
        </h2>
        {esEdicion && (
          <span style={{
            fontSize: '11px', padding: '2px 8px', borderRadius: '10px',
            background: publicada ? '#EAF3DE' : '#F1EFE8',
            color: publicada ? '#27500A' : '#888780', fontWeight: '600',
          }}>
            {publicada ? 'Publicada' : 'Borrador'}
          </span>
        )}
      </div>

      {errorGlobal && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px' }}>
          {errorGlobal}
        </div>
      )}

      {/* ── Información de la obra ── */}
      <Seccion titulo="Información de la obra">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Campo label="Título *" error={errores.titulo}>
            <input value={form.titulo} onChange={setField('titulo')} placeholder="Ave Verum Corpus" style={inputStyle} />
          </Campo>
          <Campo label="Compositor / Arreglista">
            <input value={form.compositor} onChange={setField('compositor')} placeholder="Mozart" style={inputStyle} />
          </Campo>
        </div>
        <Campo label="Estado">
          <select value={form.estado} onChange={setField('estado')} style={inputStyle}>
            {ESTADOS.map(e => (
              <option key={e} value={e}>
                {e === 'estudio' ? 'En estudio' : e === 'activo' ? 'Repertorio activo' : e === 'concierto' ? 'Próximo ensayo' : 'Archivado'}
              </option>
            ))}
          </select>
        </Campo>
        <Campo label="Descripción breve">
          <textarea value={form.descripcion} onChange={setField('descripcion')}
            placeholder="Breve descripción de la obra (opcional)" rows={2}
            style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
        </Campo>
      </Seccion>

      {/* ── Partitura ── */}
      <Seccion titulo="Partitura">
        <div style={{
          background: '#E6F1FB', border: '1px solid #B8D4F0', borderRadius: '8px',
          padding: '10px 14px', marginBottom: '14px', fontSize: '12px', color: '#042C53', lineHeight: '1.6',
        }}>
          <strong>Cómo agregar archivos:</strong> Abrí el archivo en Google Drive, copiá la URL y pegala. La app extrae el ID automáticamente. Asegurate de que esté compartido como <em>"Cualquiera con el enlace puede ver"</em>.
        </div>
        <Campo label="📄 Partitura PDF">
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={form.drive_partitura_id} onChange={setField('drive_partitura_id')}
              placeholder="Pegá el link o ID de Drive"
              style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }} />
            {form.drive_partitura_id && (
              <button type="button" onClick={() => previsualizarDrive(form.drive_partitura_id, 'pdf')}
                style={btnVerStyle}>Ver ↗</button>
            )}
          </div>
          {form.drive_partitura_id && (
            <p style={{ fontSize: '11px', color: '#888780', margin: '4px 0 0' }}>
              ID: <code style={{ background: '#F1EFE8', padding: '1px 5px', borderRadius: '3px' }}>{form.drive_partitura_id}</code>
            </p>
          )}
        </Campo>
      </Seccion>

      {/* ── Audios ── */}
      <Seccion titulo="Audios">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {audios.map(audio => {
            const totalPartes = conteoPorVoz[audio.voz] || 1
            const label = parteLabel(audio.voz, audio.parte, totalPartes)
            const puedeEliminar = audio.voz !== 'general' && totalPartes > 1

            return (
              <div key={audio._key} style={{
                background: '#F8F7F3', border: '1px solid #E8E6DF',
                borderRadius: '10px', padding: '12px 14px',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A' }}>
                    🎵 {label}
                  </span>
                  {puedeEliminar && (
                    <button type="button" onClick={() => eliminarAudio(audio._key)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#A32D2D', fontSize: '18px', lineHeight: 1, padding: '0 2px' }}>
                      ×
                    </button>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    value={audio.drive_id}
                    onChange={e => setAudioField(audio._key, 'drive_id', e.target.value)}
                    placeholder="Pegá el link o ID de Drive"
                    style={{ ...inputStyle, flex: 1, fontFamily: 'monospace', fontSize: '12px' }}
                  />
                  {audio.drive_id && (
                    <button type="button" onClick={() => previsualizarDrive(audio.drive_id, 'audio')}
                      style={btnVerStyle}>Ver ↗</button>
                  )}
                </div>
                {audio.drive_id && (
                  <p style={{ fontSize: '11px', color: '#888780', margin: '4px 0 0' }}>
                    ID: <code style={{ background: '#F1EFE8', padding: '1px 5px', borderRadius: '3px' }}>{audio.drive_id}</code>
                  </p>
                )}
              </div>
            )
          })}
        </div>

        {/* Botones agregar parte */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
          {VOCES_BASE.map(voz => (
            <button key={voz} type="button" onClick={() => agregarParte(voz)}
              style={{
                padding: '5px 12px', borderRadius: '20px', fontSize: '12px',
                border: '1px dashed #1D9E75', background: 'none',
                color: '#0F6E56', cursor: 'pointer', fontWeight: '500',
              }}>
              + {VOCES_LABELS[voz]}
            </button>
          ))}
        </div>
      </Seccion>

      {/* ── Notas del director ── */}
      <Seccion titulo="Notas del director">
        <Campo label="Notas para los cantantes">
          <textarea value={form.notas_director} onChange={setField('notas_director')}
            placeholder='Ej: "Atención a la entrada del compás 12. Sopranos sostener el mi con apoyo."'
            rows={4}
            style={{ ...inputStyle, height: 'auto', padding: '10px 12px', resize: 'vertical' }} />
        </Campo>
      </Seccion>

      {/* ── Botones ── */}
      <div style={{ display: 'flex', gap: '10px', paddingTop: '8px' }}>
        <button onClick={() => guardar(false)} disabled={guardando}
          style={{
            flex: 1, height: '42px', borderRadius: '8px', border: '1px solid #D3D1C7',
            background: '#FFFFFF', color: '#1A1A18', fontSize: '14px',
            cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '400',
          }}>
          {guardando ? 'Guardando...' : 'Guardar borrador'}
        </button>
        <button onClick={() => guardar(true)} disabled={guardando}
          style={{
            flex: 2, height: '42px', borderRadius: '8px', border: 'none',
            background: guardando ? '#9FE1CB' : '#0F6E56', color: '#FFFFFF',
            fontSize: '14px', cursor: guardando ? 'not-allowed' : 'pointer', fontWeight: '500',
          }}>
          {guardando ? 'Guardando...' : publicada ? 'Guardar y publicar' : 'Publicar para cantantes'}
        </button>
      </div>
    </div>
  )
}

// ── Componentes internos ──────────────────────────────────────────────────────
function Seccion({ titulo, children }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h3 style={{
        fontSize: '12px', fontWeight: '600', color: '#5F5E5A',
        textTransform: 'uppercase', letterSpacing: '0.5px',
        margin: '0 0 12px', paddingBottom: '8px', borderBottom: '1px solid #E8E6DF',
      }}>
        {titulo}
      </h3>
      {children}
    </div>
  )
}

function Campo({ label, error, children }) {
  return (
    <div style={{ marginBottom: '12px' }}>
      <label style={{ display: 'block', fontSize: '12px', fontWeight: '500', color: '#5F5E5A', marginBottom: '5px' }}>
        {label}
      </label>
      {children}
      {error && <p style={{ fontSize: '12px', color: '#A32D2D', margin: '4px 0 0' }}>{error}</p>}
    </div>
  )
}

const inputStyle = {
  width: '100%', height: '38px',
  border: '1px solid #D3D1C7', borderRadius: '8px',
  padding: '0 12px', fontSize: '13px',
  color: '#1A1A18', background: '#FFFFFF',
  outline: 'none', boxSizing: 'border-box',
}

const btnVerStyle = {
  padding: '0 12px', borderRadius: '8px', border: '1px solid #D3D1C7',
  background: '#FFFFFF', cursor: 'pointer', fontSize: '12px',
  color: '#0F6E56', fontWeight: '500', whiteSpace: 'nowrap', height: '38px',
}