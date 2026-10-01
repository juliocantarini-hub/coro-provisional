import { useState } from 'react'
import JSZip from 'jszip'
import { parsearMusicXML } from '../../lib/musicxml'
import {
  usePartiturasAdmin, crearPartitura, publicarPartitura, eliminarPartitura,
} from '../../hooks/usePartituras'

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

export default function PartiturasAdmin() {
  const { partituras, cargando, error, recargar } = usePartiturasAdmin()
  const [mostrarForm, setMostrarForm] = useState(false)
  const [procesando, setProcesando] = useState(null)
  const [confirmEliminar, setConfirmEliminar] = useState(null)

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

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Entrenamiento
          </h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${partituras.length} obra${partituras.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <button onClick={() => setMostrarForm(true)}
          style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg>
          Nueva partitura
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

      {mostrarForm && (
        <ModalNuevaPartitura
          onCerrar={() => setMostrarForm(false)}
          onGuardada={() => { setMostrarForm(false); recargar() }}
        />
      )}
    </div>
  )
}
