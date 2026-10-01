import { useState } from 'react'
import JSZip from 'jszip'
import { parsearMusicXML, parsearPatronVocalizacion } from '../../lib/musicxml'
import {
  usePartiturasAdmin, crearPartitura, publicarPartitura, eliminarPartitura, actualizarPartitura,
} from '../../hooks/usePartituras'
import {
  useEjerciciosEntrenamientoAdmin, crearEjercicioEntrenamiento,
  activarEjercicioEntrenamiento, eliminarEjercicioEntrenamiento, actualizarEjercicioEntrenamiento,
} from '../../hooks/useEntrenamiento'

const ORDEN_CATEGORIAS = ['respiracion', 'resonancia', 'vocalizacion']
const CATEGORIA_LABEL = { respiracion: 'Respiración', resonancia: 'Resonancia', vocalizacion: 'Vocalización' }
const CATEGORIA_NOTA = { respiracion: 'Estos todavía se cargan directo en Supabase — no son ejercicios armados a partir de notas.' }

// Distintos tipos de patron_tone usan distinta clave para la nota de arranque
// (ver EjercicioPlayer.jsx). Detectamos cuál aplica para mostrar un solo campo.
const NOTA_KEYS = ['nota_inicial', 'nota', 'nota_base']

function detectarNotaKey(patronTone) {
  if (!patronTone) return null
  return NOTA_KEYS.find(k => typeof patronTone[k] === 'string') || null
}

function normalizarNota(valor) {
  const m = (valor || '').trim().match(/^([A-Ga-g])(#{1,2}|b{1,2})?(-?\d+)$/)
  if (!m) return null
  const [, letra, alteracion, octava] = m
  return `${letra.toUpperCase()}${alteracion || ''}${octava}`
}

function formatoTiempo(seg) {
  if (!seg || !isFinite(seg)) return '—'
  const m = Math.floor(seg / 60)
  const s = Math.round(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

// Un .mxl es un .xml comprimido en zip (formato "MusicXML comprimido").
// Buscamos el archivo real a partir de META-INF/container.xml, o si no,
// el primer .xml que no sea el propio container.
async function extraerXmlDeArchivo(file) {
  const buffer = await file.arrayBuffer()
  const esMxl = file.name.toLowerCase().endsWith('.mxl')

  if (!esMxl) {
    return new TextDecoder('utf-8').decode(buffer)
  }

  const zip = await JSZip.loadAsync(buffer)
  let rutaPrincipal = null

  const contenedor = zip.file('META-INF/container.xml')
  if (contenedor) {
    const textoContenedor = await contenedor.async('string')
    const m = textoContenedor.match(/full-path="([^"]+)"/)
    if (m) rutaPrincipal = m[1]
  }

  if (!rutaPrincipal || !zip.file(rutaPrincipal)) {
    rutaPrincipal = Object.keys(zip.files).find(
      nombre => nombre.toLowerCase().endsWith('.xml') && !nombre.startsWith('META-INF/')
    )
  }

  if (!rutaPrincipal) throw new Error('No encontramos el MusicXML dentro del .mxl.')

  return zip.file(rutaPrincipal).async('string')
}

function ModalNuevaPartitura({ onCerrar, onGuardada }) {
  const [titulo, setTitulo] = useState('')
  const [compositor, setCompositor] = useState('')
  const [archivo, setArchivo] = useState(null)
  const [previsualizacion, setPrevisualizacion] = useState(null)
  const [xmlTexto, setXmlTexto] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function handleArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setArchivo(file)
    setPrevisualizacion(null)
    setXmlTexto(null)
    setError('')
    if (!titulo) setTitulo(file.name.replace(/\.(mxl|xml|musicxml)$/i, ''))

    try {
      const texto = await extraerXmlDeArchivo(file)
      const partitura = parsearMusicXML(texto)
      setXmlTexto(texto)
      setPrevisualizacion(partitura)
    } catch (err) {
      setError(err.message || 'No pudimos leer ese archivo.')
    }
  }

  async function handleGuardar() {
    if (!titulo.trim() || !xmlTexto) return
    setProcesando(true)
    const resultado = await crearPartitura({
      titulo: titulo.trim(),
      compositor,
      musicxml: xmlTexto,
      duracionSeg: previsualizacion?.duracionTotal,
    })
    setProcesando(false)
    if (resultado.ok) onGuardada()
    else setError(resultado.error || 'No pudimos guardar la partitura.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>
          Nueva partitura para practicar
        </h3>

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Archivo MusicXML</label>
        <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleArchivo}
          style={{ width: '100%', fontSize: '13px', marginBottom: '14px' }} />

        {error && (
          <div style={{ fontSize: '13px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {previsualizacion && (
          <div style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            Se detectaron {previsualizacion.voces.length} voces ({previsualizacion.voces.map(v => v.nombre).join(', ')}) · duración {formatoTiempo(previsualizacion.duracionTotal)}
          </div>
        )}

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Título</label>
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Compositor (opcional)</label>
        <input type="text" value={compositor} onChange={e => setCompositor(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '20px', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCerrar}
            style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', cursor: 'pointer', fontSize: '13px' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!titulo.trim() || !xmlTexto || procesando}
            style={{
              flex: 2, height: '40px', borderRadius: '8px', border: 'none', cursor: (!titulo.trim() || !xmlTexto || procesando) ? 'not-allowed' : 'pointer',
              background: (!titulo.trim() || !xmlTexto) ? '#D3D1C7' : '#0F6E56', color: '#FFFFFF', fontSize: '13px', fontWeight: '500',
            }}>
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalNuevoEjercicio({ ejercicios, onCerrar, onGuardada }) {
  const [categoria, setCategoria] = useState('vocalizacion')
  const [nombre, setNombre] = useState('')
  const [instruccionTexto, setInstruccionTexto] = useState('')
  const [notaInicial, setNotaInicial] = useState('')
  const [tempoBpm, setTempoBpm] = useState('')
  const [repeticiones, setRepeticiones] = useState(1)
  const [transporteSemitonos, setTransporteSemitonos] = useState(0)
  const [patron, setPatron] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function handleArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPatron(null)
    setError('')
    if (!nombre) setNombre(file.name.replace(/\.(mxl|xml|musicxml)$/i, ''))

    try {
      const texto = await extraerXmlDeArchivo(file)
      const detectado = parsearPatronVocalizacion(texto)
      setPatron(detectado)
      setNotaInicial(detectado.notaInicial)
      if (detectado.tempoDetectado) setTempoBpm(String(detectado.tempoDetectado))
    } catch (err) {
      setError(err.message || 'No pudimos leer ese archivo.')
    }
  }

  async function handleGuardar() {
    if (!nombre.trim() || !patron) return
    setError('')

    const notaNormalizada = normalizarNota(notaInicial)
    if (!notaNormalizada) {
      setError('La nota inicial tiene que tener el formato de nota + octava, por ejemplo "C4" o "G#5".')
      return
    }

    setProcesando(true)

    const reps = Math.max(1, parseInt(repeticiones, 10) || 1)
    const transporte = parseInt(transporteSemitonos, 10) || 0
    const patronTone = {
      tipo: 'patron_ritmico',
      nota_inicial: notaNormalizada,
      notas_semitonos: patron.notasSemitonos,
      duraciones_16avos: patron.duraciones16avos,
      tempo_bpm: parseInt(tempoBpm, 10) || 80,
      transporte_por_ciclo: Array.from({ length: reps }, (_, i) => i * transporte),
    }

    const proximoOrden = ejercicios
      .filter(e => e.categoria === categoria)
      .reduce((max, e) => Math.max(max, e.orden || 0), -1) + 1

    const resultado = await crearEjercicioEntrenamiento({
      categoria,
      nombre: nombre.trim(),
      instruccionTexto,
      patronTone,
      orden: proximoOrden,
    })
    setProcesando(false)
    if (resultado.ok) onGuardada()
    else setError(resultado.error || 'No pudimos guardar el ejercicio.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>
          Nuevo ejercicio
        </h3>

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Categoría</label>
        <select value={categoria} onChange={e => setCategoria(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box', background: '#FFFFFF' }}>
          <option value="vocalizacion">Vocalización</option>
          <option value="resonancia">Resonancia</option>
        </select>
        <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '-10px 0 14px' }}>
          Respiración no está disponible acá todavía — esos ejercicios no se arman a partir de notas.
        </p>

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Archivo MusicXML (exportado de MuseScore)</label>
        <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleArchivo}
          style={{ width: '100%', fontSize: '13px', marginBottom: '14px' }} />

        {error && (
          <div style={{ fontSize: '13px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        {patron && (
          <div style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            Se detectaron {patron.cantidadNotas} notas, desde {patron.notaInicial}
            {patron.tempoDetectado ? ` · tempo detectado ${patron.tempoDetectado} bpm` : ' · no encontramos tempo en el archivo, usamos 80 bpm por defecto'}
          </div>
        )}

        {patron && (
          <>
            <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Nota inicial</label>
            <input type="text" value={notaInicial} onChange={e => setNotaInicial(e.target.value)} placeholder="C4"
              style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '0 0 14px' }}>
              Nota + octava. Ej: C4 si el patrón asciende desde el Do central, G5 si desciende desde ahí. Viene precargada con lo que detectamos en el archivo, pero la podés cambiar.
            </p>
          </>
        )}

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Nombre</label>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Instrucción para el cantante (opcional)</label>
        <textarea value={instruccionTexto} onChange={e => setInstruccionTexto(e.target.value)} rows={2}
          style={{ width: '100%', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Tempo (bpm)</label>
        <input type="number" value={tempoBpm} onChange={e => setTempoBpm(e.target.value)} placeholder="80"
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>
          Repetir transportando (dejá 1 repetición si ya escribiste todas las transposiciones en el MusicXML)
        </label>
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
          <div style={{ flex: 1 }}>
            <input type="number" min="1" value={repeticiones} onChange={e => setRepeticiones(e.target.value)}
              style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }} />
            <div style={{ fontSize: '11px', color: '#B4B2A9', marginTop: '3px' }}>Repeticiones</div>
          </div>
          <div style={{ flex: 1 }}>
            <input type="number" value={transporteSemitonos} onChange={e => setTransporteSemitonos(e.target.value)}
              style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', boxSizing: 'border-box' }} />
            <div style={{ fontSize: '11px', color: '#B4B2A9', marginTop: '3px' }}>Semitonos por repetición</div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCerrar}
            style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', cursor: 'pointer', fontSize: '13px' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!nombre.trim() || !patron || procesando}
            style={{
              flex: 2, height: '40px', borderRadius: '8px', border: 'none', cursor: (!nombre.trim() || !patron || procesando) ? 'not-allowed' : 'pointer',
              background: (!nombre.trim() || !patron) ? '#D3D1C7' : '#0F6E56', color: '#FFFFFF', fontSize: '13px', fontWeight: '500',
            }}>
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEditarPartitura({ partitura, onCerrar, onGuardada }) {
  const [titulo, setTitulo] = useState(partitura.titulo || '')
  const [compositor, setCompositor] = useState(partitura.compositor || '')
  const [previsualizacion, setPrevisualizacion] = useState(null)
  const [xmlTexto, setXmlTexto] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function handleArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPrevisualizacion(null)
    setXmlTexto(null)
    setError('')

    try {
      const texto = await extraerXmlDeArchivo(file)
      const datos = parsearMusicXML(texto)
      setXmlTexto(texto)
      setPrevisualizacion(datos)
    } catch (err) {
      setError(err.message || 'No pudimos leer ese archivo.')
    }
  }

  async function handleGuardar() {
    if (!titulo.trim()) return
    setProcesando(true)
    const resultado = await actualizarPartitura(partitura.id, {
      titulo: titulo.trim(),
      compositor,
      ...(xmlTexto ? { musicxml: xmlTexto, duracionSeg: previsualizacion?.duracionTotal } : {}),
    })
    setProcesando(false)
    if (resultado.ok) onGuardada()
    else setError(resultado.error || 'No pudimos guardar los cambios.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>
          Editar partitura
        </h3>

        {error && (
          <div style={{ fontSize: '13px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Título</label>
        <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Compositor (opcional)</label>
        <input type="text" value={compositor} onChange={e => setCompositor(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '20px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Reemplazar MusicXML (opcional)</label>
        <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleArchivo}
          style={{ width: '100%', fontSize: '13px', marginBottom: '6px' }} />
        <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '0 0 14px' }}>
          Solo si subís un archivo nuevo se reemplaza la partitura (todas las voces). Si no, se guardan los otros cambios tal cual.
        </p>

        {previsualizacion && (
          <div style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
            Se detectaron {previsualizacion.voces.length} voces ({previsualizacion.voces.map(v => v.nombre).join(', ')}) · duración {formatoTiempo(previsualizacion.duracionTotal)}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCerrar}
            style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', cursor: 'pointer', fontSize: '13px' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!titulo.trim() || procesando}
            style={{
              flex: 2, height: '40px', borderRadius: '8px', border: 'none', cursor: (!titulo.trim() || procesando) ? 'not-allowed' : 'pointer',
              background: !titulo.trim() ? '#D3D1C7' : '#0F6E56', color: '#FFFFFF', fontSize: '13px', fontWeight: '500',
            }}>
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function ModalEditarEjercicio({ ejercicio, onCerrar, onGuardada }) {
  const [nombre, setNombre] = useState(ejercicio.nombre || '')
  const [instruccionTexto, setInstruccionTexto] = useState(ejercicio.instruccion_texto || '')
  const notaKey = detectarNotaKey(ejercicio.patron_tone)
  const [notaInicial, setNotaInicial] = useState(notaKey ? ejercicio.patron_tone[notaKey] : '')
  const tieneTempo = !!ejercicio.patron_tone && typeof ejercicio.patron_tone.tempo_bpm === 'number'
  const [tempoBpm, setTempoBpm] = useState(tieneTempo ? String(ejercicio.patron_tone.tempo_bpm) : '')
  // Solo los ejercicios armados a partir de un MusicXML (vía "Nuevo ejercicio") tienen
  // esta forma de patrón, y por lo tanto se les puede reemplazar el archivo de origen.
  const puedeReemplazarXml = ejercicio.patron_tone?.tipo === 'patron_ritmico'
  const [patronDetectado, setPatronDetectado] = useState(null)
  const [procesando, setProcesando] = useState(false)
  const [error, setError] = useState('')

  async function handleArchivo(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setPatronDetectado(null)
    setError('')

    try {
      const texto = await extraerXmlDeArchivo(file)
      const detectado = parsearPatronVocalizacion(texto)
      setPatronDetectado(detectado)
      setNotaInicial(detectado.notaInicial)
      if (detectado.tempoDetectado) setTempoBpm(String(detectado.tempoDetectado))
    } catch (err) {
      setError(err.message || 'No pudimos leer ese archivo.')
    }
  }

  async function handleGuardar() {
    if (!nombre.trim()) return
    setError('')

    let patronTone = patronDetectado
      ? {
          tipo: 'patron_ritmico',
          nota_inicial: patronDetectado.notaInicial,
          notas_semitonos: patronDetectado.notasSemitonos,
          duraciones_16avos: patronDetectado.duraciones16avos,
          tempo_bpm: ejercicio.patron_tone?.tempo_bpm ?? 80,
          transporte_por_ciclo: ejercicio.patron_tone?.transporte_por_ciclo ?? [0],
        }
      : ejercicio.patron_tone

    if (notaKey) {
      const notaNormalizada = normalizarNota(notaInicial)
      if (!notaNormalizada) {
        setError('La nota inicial tiene que tener el formato de nota + octava, por ejemplo "C4" o "G#5".')
        return
      }
      patronTone = { ...patronTone, [notaKey]: notaNormalizada }
    }

    if (tieneTempo) {
      const tempo = parseInt(tempoBpm, 10)
      if (!tempo || tempo <= 0) {
        setError('El tempo tiene que ser un número mayor a 0.')
        return
      }
      patronTone = { ...patronTone, tempo_bpm: tempo }
    }

    setProcesando(true)
    const resultado = await actualizarEjercicioEntrenamiento(ejercicio.id, {
      nombre: nombre.trim(),
      instruccionTexto,
      patronTone,
    })
    setProcesando(false)
    if (resultado.ok) onGuardada()
    else setError(resultado.error || 'No pudimos guardar los cambios.')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: '16px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '24px', width: '100%', maxWidth: '460px', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 16px' }}>
          Editar ejercicio
        </h3>

        {error && (
          <div style={{ fontSize: '13px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '8px', padding: '8px 12px', marginBottom: '14px' }}>
            {error}
          </div>
        )}

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Nombre</label>
        <input type="text" value={nombre} onChange={e => setNombre(e.target.value)}
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box' }} />

        <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Instrucción para el cantante (opcional)</label>
        <textarea value={instruccionTexto} onChange={e => setInstruccionTexto(e.target.value)} rows={2}
          style={{ width: '100%', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', marginBottom: '14px', boxSizing: 'border-box', fontFamily: 'inherit', resize: 'vertical' }} />

        {puedeReemplazarXml && (
          <>
            <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Reemplazar MusicXML (opcional)</label>
            <input type="file" accept=".xml,.musicxml,.mxl" onChange={handleArchivo}
              style={{ width: '100%', fontSize: '13px', marginBottom: '6px' }} />
            <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '0 0 14px' }}>
              Solo si subís un archivo nuevo se reemplaza la melodía y el ritmo del ejercicio.
            </p>

            {patronDetectado && (
              <div style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '8px', padding: '10px 12px', marginBottom: '14px' }}>
                Se detectaron {patronDetectado.cantidadNotas} notas, desde {patronDetectado.notaInicial}
                {patronDetectado.tempoDetectado ? ` · tempo detectado ${patronDetectado.tempoDetectado} bpm` : ''}
              </div>
            )}
          </>
        )}

        {notaKey && (
          <>
            <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Nota inicial</label>
            <input type="text" value={notaInicial} onChange={e => setNotaInicial(e.target.value)} placeholder="C4"
              style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '6px', boxSizing: 'border-box' }} />
            <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '0 0 14px' }}>
              Nota + octava. Ej: C4 si el patrón asciende desde el Do central, G5 si desciende desde ahí.
            </p>
          </>
        )}

        {tieneTempo && (
          <>
            <label style={{ fontSize: '12px', color: '#5F5E5A', fontWeight: '500', display: 'block', marginBottom: '4px' }}>Tempo (bpm)</label>
            <input type="number" value={tempoBpm} onChange={e => setTempoBpm(e.target.value)}
              style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', marginBottom: '20px', boxSizing: 'border-box' }} />
          </>
        )}

        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={onCerrar}
            style={{ flex: 1, height: '40px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', cursor: 'pointer', fontSize: '13px' }}>
            Cancelar
          </button>
          <button onClick={handleGuardar} disabled={!nombre.trim() || procesando}
            style={{
              flex: 2, height: '40px', borderRadius: '8px', border: 'none', cursor: (!nombre.trim() || procesando) ? 'not-allowed' : 'pointer',
              background: !nombre.trim() ? '#D3D1C7' : '#0F6E56', color: '#FFFFFF', fontSize: '13px', fontWeight: '500',
            }}>
            {procesando ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function PartiturasAdmin() {
  const { partituras, cargando, error, recargar } = usePartiturasAdmin()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)
  const [editandoPartitura, setEditandoPartitura] = useState(null)

  const { ejercicios, cargando: cargandoEjercicios, error: errorEjercicios, recargar: recargarEjercicios } = useEjerciciosEntrenamientoAdmin()
  const categoriasExtra = [...new Set(ejercicios.map(e => e.categoria).filter(Boolean))]
    .filter(c => !ORDEN_CATEGORIAS.includes(c))
    .sort()
  const categoriasAMostrar = [...ORDEN_CATEGORIAS, ...categoriasExtra]
  const [mostrarFormEjercicio, setMostrarFormEjercicio] = useState(false)
  const [procesandoEjercicio, setProcesandoEjercicio] = useState(null)
  const [confirmEliminarEjercicio, setConfirmEliminarEjercicio] = useState(null)
  const [editandoEjercicio, setEditandoEjercicio] = useState(null)

  async function togglePublicar(p) {
    setProcesando(p.id)
    await publicarPartitura(p.id, !p.publicada)
    await recargar()
    setProcesando(null)
  }

  async function handleEliminar(id) {
    setProcesando(id)
    await eliminarPartitura(id)
    setConfirmEliminar(null)
    await recargar()
    setProcesando(null)
  }

  async function toggleActivoEjercicio(ej) {
    setProcesandoEjercicio(ej.id)
    await activarEjercicioEntrenamiento(ej.id, !ej.activo)
    await recargarEjercicios()
    setProcesandoEjercicio(null)
  }

  async function handleEliminarEjercicio(id) {
    setProcesandoEjercicio(id)
    await eliminarEjercicioEntrenamiento(id)
    setConfirmEliminarEjercicio(null)
    await recargarEjercicios()
    setProcesandoEjercicio(null)
  }

  return (
    <div>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 20px' }}>
        Entrenamiento
      </h2>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Práctica
          </h3>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${partituras.length} obra${partituras.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setMostrarForm(true)}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo MusicXML
        </button>
      </div>

      {error && <div style={{ color: '#A32D2D', fontSize: '13px', marginBottom: '16px' }}>{error}</div>}

      {cargando && <div style={{ color: '#888780', fontSize: '13px' }}>Cargando...</div>}

      {!cargando && partituras.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: '#888780', fontSize: '14px' }}>
          Todavía no cargaste ninguna partitura.
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {partituras.map(p => (
          <div key={p.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '180px' }}>
              <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{p.titulo}</div>
              <div style={{ fontSize: '12px', color: '#888780' }}>
                {p.compositor ? `${p.compositor} · ` : ''}{formatoTiempo(p.duracion_seg)}
              </div>
            </div>

            <button onClick={() => togglePublicar(p)} disabled={procesando === p.id}
              style={{
                fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '20px', padding: '5px 14px', cursor: 'pointer',
                background: p.publicada ? '#E1F5EE' : '#F1EFE8',
                color: p.publicada ? '#04342C' : '#5F5E5A',
              }}>
              {p.publicada ? '✓ Publicada' : 'Sin publicar'}
            </button>

            <button onClick={() => setEditandoPartitura(p)}
              style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
              Editar
            </button>

            {confirmEliminar === p.id ? (
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={() => handleEliminar(p.id)} disabled={procesando === p.id}
                  style={{ fontSize: '12px', color: '#FFFFFF', background: '#A32D2D', border: 'none', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  Confirmar
                </button>
                <button onClick={() => setConfirmEliminar(null)}
                  style={{ fontSize: '12px', color: '#5F5E5A', background: 'none', border: '1px solid #D3D1C7', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmEliminar(p.id)}
                style={{ fontSize: '12px', color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
                Eliminar
              </button>
            )}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '32px 0 14px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '16px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Ejercicios
          </h3>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargandoEjercicios ? 'Cargando...' : `${ejercicios.length} en total`}
          </p>
        </div>
        <button onClick={() => setMostrarFormEjercicio(true)}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nuevo ejercicio
        </button>
      </div>

      {errorEjercicios && <div style={{ color: '#A32D2D', fontSize: '13px', marginBottom: '16px' }}>{errorEjercicios}</div>}

      {cargandoEjercicios && <div style={{ color: '#888780', fontSize: '13px' }}>Cargando...</div>}

      {!cargandoEjercicios && categoriasAMostrar.map(categoria => {
        const items = ejercicios.filter(e => e.categoria === categoria)
        return (
          <div key={categoria} style={{ marginBottom: '24px' }}>
            <h4 style={{ fontFamily: 'Georgia, serif', fontSize: '14px', fontWeight: 'normal', color: '#5F5E5A', margin: '0 0 2px' }}>
              {CATEGORIA_LABEL[categoria] || categoria}
            </h4>
            <p style={{ fontSize: '11px', color: '#888780', margin: '0 0 10px' }}>
              {items.length} ejercicio{items.length !== 1 ? 's' : ''}
              {CATEGORIA_NOTA[categoria] ? ` · ${CATEGORIA_NOTA[categoria]}` : ''}
            </p>

            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: '24px', color: '#B4B2A9', fontSize: '13px', background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px' }}>
                Todavía no hay ejercicios acá.
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(ej => (
                <div key={ej.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{ej.nombre}</div>
                    {ej.instruccion_texto && (
                      <div style={{ fontSize: '12px', color: '#888780' }}>{ej.instruccion_texto}</div>
                    )}
                  </div>

                  <button onClick={() => toggleActivoEjercicio(ej)} disabled={procesandoEjercicio === ej.id}
                    style={{
                      fontSize: '12px', fontWeight: '500', border: 'none', borderRadius: '20px', padding: '5px 14px', cursor: 'pointer',
                      background: ej.activo ? '#E1F5EE' : '#F1EFE8',
                      color: ej.activo ? '#04342C' : '#5F5E5A',
                    }}>
                    {ej.activo ? '✓ Activo' : 'Desactivado'}
                  </button>

                  <button onClick={() => setEditandoEjercicio(ej)}
                    style={{ padding: '4px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
                    Editar
                  </button>

                  {confirmEliminarEjercicio === ej.id ? (
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button onClick={() => handleEliminarEjercicio(ej.id)} disabled={procesandoEjercicio === ej.id}
                        style={{ fontSize: '12px', color: '#FFFFFF', background: '#A32D2D', border: 'none', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                        Confirmar
                      </button>
                      <button onClick={() => setConfirmEliminarEjercicio(null)}
                        style={{ fontSize: '12px', color: '#5F5E5A', background: 'none', border: '1px solid #D3D1C7', padding: '5px 12px', borderRadius: '8px', cursor: 'pointer' }}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmEliminarEjercicio(ej.id)}
                      style={{ fontSize: '12px', color: '#A32D2D', background: 'none', border: 'none', cursor: 'pointer' }}>
                      Eliminar
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {mostrarForm && (
        <ModalNuevaPartitura
          onCerrar={() => setMostrarForm(false)}
          onGuardada={() => { setMostrarForm(false); recargar() }}
        />
      )}

      {mostrarFormEjercicio && (
        <ModalNuevoEjercicio
          ejercicios={ejercicios}
          onCerrar={() => setMostrarFormEjercicio(false)}
          onGuardada={() => { setMostrarFormEjercicio(false); recargarEjercicios() }}
        />
      )}

      {editandoPartitura && (
        <ModalEditarPartitura
          partitura={editandoPartitura}
          onCerrar={() => setEditandoPartitura(null)}
          onGuardada={() => { setEditandoPartitura(null); recargar() }}
        />
      )}

      {editandoEjercicio && (
        <ModalEditarEjercicio
          ejercicio={editandoEjercicio}
          onCerrar={() => setEditandoEjercicio(null)}
          onGuardada={() => { setEditandoEjercicio(null); recargarEjercicios() }}
        />
      )}
    </div>
  )
}
