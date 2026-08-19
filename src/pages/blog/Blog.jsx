import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { driveUrlImprimir } from '../../components/drive/DriveComponents'
import {
  useArticulos, useArticulo,
  CATEGORIAS, CATEGORIA_COLOR
} from '../../hooks/useBlog'

const IDIOMA_LABEL = {
  latin: 'Latín', italiano: 'Italiano', espanol: 'Español',
  aleman: 'Alemán', frances: 'Francés', ingles: 'Inglés',
  portugues: 'Portugués', otro: 'otro idioma',
}

export function Blog() {
  const navigate = useNavigate()
  const [busqueda, setBusqueda] = useState('')

  const { articulos, cargando, error, recargar } = useArticulos({
    busqueda: busqueda || undefined,
  })

  const destacados = articulos.filter(a => a.destacado)
  const resto      = articulos.filter(a => !a.destacado || busqueda)

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 4px' }}>
          Textos
        </h2>
        <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
          Textos, traducciones y fonética de las obras
        </p>
      </div>

      <div style={{ position: 'relative', marginBottom: '20px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9"
          style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input type="text" value={busqueda} onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar textos..."
          style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px 0 32px', fontSize: '13px', background: '#FFFFFF', color: '#1A1A18', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontWeight: '500', fontSize: '12px' }}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {[1,2,3].map(i => <div key={i} style={{ height: '100px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && articulos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '56px 24px', color: '#888780' }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="#D3D1C7" style={{ marginBottom: '14px' }}>
            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-5 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/>
          </svg>
          <p style={{ fontSize: '14px', margin: 0 }}>
            {busqueda ? 'No hay textos que coincidan.' : 'Aún no hay textos publicados.'}
          </p>
          {busqueda && (
            <button onClick={() => setBusqueda('')} style={{ marginTop: '8px', fontSize: '12px', color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
              Limpiar búsqueda
            </button>
          )}
        </div>
      )}

      {!cargando && !busqueda && destacados.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
            Destacado
          </div>
          {destacados.slice(0, 1).map(art => (
            <ArticuloDestacado key={art.id} articulo={art} onClick={() => navigate(`/blog/${art.id}`)} />
          ))}
        </div>
      )}

      {!cargando && resto.length > 0 && (
        <div>
          {(!busqueda && destacados.length > 0) && (
            <div style={{ fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px' }}>
              Últimas publicaciones
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {resto.map(art => (
              <ArticuloCard key={art.id} articulo={art} onClick={() => navigate(`/blog/${art.id}`)} />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function ArticuloDestacado({ articulo, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'linear-gradient(135deg, #0F6E56 0%, #1D9E75 100%)',
      borderRadius: '14px', padding: '22px', cursor: 'pointer',
      transition: 'transform 0.12s, box-shadow 0.12s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(15,110,86,0.25)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ display: 'flex', gap: '8px', marginBottom: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '10px', fontWeight: '600', color: 'rgba(255,255,255,0.7)', background: 'rgba(255,255,255,0.15)', padding: '2px 8px', borderRadius: '10px', textTransform: 'uppercase' }}>
          Destacado
        </span>
        {articulo.drive_pdf_id && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>📄 PDF disponible</span>
        )}
        {articulo.idioma && (
          <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)' }}>🎤 {IDIOMA_LABEL[articulo.idioma] || articulo.idioma}</span>
        )}
      </div>
      <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', color: '#FFFFFF', margin: '0 0 8px', lineHeight: '1.4' }}>
        {articulo.titulo}
      </h3>
      {articulo.resumen && (
        <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.75)', margin: '0 0 12px', lineHeight: '1.6' }}>
          {articulo.resumen.length > 120 ? articulo.resumen.slice(0, 120) + '...' : articulo.resumen}
        </p>
      )}
      <div style={{ fontSize: '12px', color: 'rgba(255,255,255,0.55)', display: 'flex', gap: '8px' }}>
        {articulo.perfiles?.nombre && <span>{articulo.perfiles.nombre}</span>}
        <span>·</span>
        <span>{new Date(articulo.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</span>
        <span style={{ marginLeft: 'auto', color: 'rgba(255,255,255,0.8)', fontWeight: '500' }}>Ver →</span>
      </div>
    </div>
  )
}

function ArticuloCard({ articulo, onClick }) {
  const cc = CATEGORIA_COLOR[articulo.categoria] || { bg: '#F1EFE8', color: '#5F5E5A' }

  return (
    <div onClick={onClick} style={{
      background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px',
      padding: '14px 16px', cursor: 'pointer',
      display: 'flex', gap: '14px', alignItems: 'center',
      transition: 'border-color 0.12s, box-shadow 0.12s',
    }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = '#B4D8CE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)' }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E6DF'; e.currentTarget.style.boxShadow = 'none' }}
    >
      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: cc.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {articulo.drive_pdf_id
          ? <span style={{ fontSize: '22px' }}>📄</span>
          : <CatIcon categoria={articulo.categoria} color={cc.color} />
        }
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18', marginBottom: '4px' }}>{articulo.titulo}</div>
        <div style={{ fontSize: '12px', color: '#888780', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {articulo.perfiles?.nombre && <span>{articulo.perfiles.nombre}</span>}
          <span>· {new Date(articulo.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}</span>
          {articulo.idioma && <span style={{ color: '#378ADD' }}>· 🎤 {IDIOMA_LABEL[articulo.idioma] || articulo.idioma}</span>}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#D3D1C7" style={{ flexShrink: 0 }}>
        <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
      </svg>
    </div>
  )
}

export function ArticuloDetalle() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { articulo, cargando, error } = useArticulo(id)
  const [pronunciacion, setPronunciacion] = useState(null)
  const [cargandoPron, setCargandoPron] = useState(false)
  const [errorPron, setErrorPron] = useState('')
  const [audioUrl, setAudioUrl] = useState(null)
  const [cargandoAudio, setCargandoAudio] = useState(false)
  const [velocidad, setVelocidad] = useState(1)

  async function generarPronunciacion() {
    if (!articulo.contenido) return
    setCargandoPron(true)
    setErrorPron('')
    setPronunciacion(null)
    try {
      const response = await fetch('/api/pronunciacion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contenido: articulo.contenido,
          idioma: IDIOMA_LABEL[articulo.idioma] || articulo.idioma
        })
      })
      const data = await response.json()
      setPronunciacion(data.texto || '')
    } catch (e) {
      setErrorPron('No se pudo generar la pronunciación. Intentá de nuevo.')
    }
    setCargandoPron(false)
  }

  async function generarAudio() {
    setCargandoAudio(true)
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: articulo.contenido })
      })
      const blob = await response.blob()
      const url = URL.createObjectURL(blob)
      setAudioUrl(url)
    } catch (e) {
      console.error('Error TTS:', e)
    }
    setCargandoAudio(false)
  }

  if (cargando) {
    return (
      <div>
        <div style={{ height: '20px', width: '100px', background: '#F1EFE8', borderRadius: '6px', marginBottom: '20px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <div style={{ height: '280px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
      </div>
    )
  }

  if (error || !articulo) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 24px' }}>
        <p style={{ color: '#A32D2D', marginBottom: '16px' }}>{error || 'Texto no encontrado.'}</p>
        <button onClick={() => navigate('/blog')} style={{ color: '#0F6E56', background: 'none', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
          ← Volver a Textos
        </button>
      </div>
    )
  }

  const tieneIA = articulo.contenido && articulo.idioma

  return (
    <div style={{ maxWidth: '780px' }}>
      <button onClick={() => navigate('/blog')} style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#888780', background: 'none', border: 'none', cursor: 'pointer', fontSize: '13px', marginBottom: '20px', padding: 0 }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>
        Volver a Textos
      </button>

      <div style={{ marginBottom: '20px' }}>
        <h1 style={{ fontFamily: 'Georgia, serif', fontSize: '26px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 8px', lineHeight: '1.35' }}>
          {articulo.titulo}
        </h1>
        <div style={{ fontSize: '13px', color: '#888780', display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
          {articulo.perfiles?.nombre && <span>Por {articulo.perfiles.nombre}</span>}
          <span>·</span>
          <span>{new Date(articulo.creado_en).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
          {articulo.idioma && (
            <span style={{ background: '#E6F1FB', color: '#042C53', fontSize: '11px', fontWeight: '600', padding: '2px 8px', borderRadius: '10px' }}>
              🎤 {IDIOMA_LABEL[articulo.idioma] || articulo.idioma}
            </span>
          )}
        </div>
      </div>

      {articulo.resumen && (
        <div style={{ background: '#F8F7F3', borderLeft: '3px solid #1D9E75', borderRadius: '0 10px 10px 0', padding: '14px 16px', marginBottom: '20px', fontSize: '15px', color: '#3D3D3A', lineHeight: '1.6', fontStyle: 'italic' }}>
          {articulo.resumen}
        </div>
      )}

      {tieneIA && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            Herramientas
          </div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: audioUrl ? '12px' : '0' }}>
            <button onClick={generarAudio} disabled={cargandoAudio}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: cargandoAudio ? 'not-allowed' : 'pointer', background: '#378ADD', color: '#FFFFFF', fontSize: '13px', fontWeight: '500', opacity: cargandoAudio ? 0.7 : 1 }}>
              {cargandoAudio ? '⏳ Generando...' : '🔊 Escuchar texto'}
            </button>
            <button onClick={generarPronunciacion} disabled={cargandoPron}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px', borderRadius: '8px', border: 'none', cursor: cargandoPron ? 'not-allowed' : 'pointer', background: pronunciacion ? '#E1F5EE' : '#0F6E56', color: pronunciacion ? '#04342C' : '#FFFFFF', fontSize: '13px', fontWeight: '500', opacity: cargandoPron ? 0.7 : 1 }}>
              {cargandoPron ? '⏳ Generando...' : pronunciacion ? '🎤 Regenerar pronunciación' : '🎤 Ver pronunciación'}
            </button>
          </div>

          {audioUrl && (
            <div style={{ marginTop: '12px' }}>
              <audio
                id="audio-texto"
                controls
                src={audioUrl}
                style={{ width: '100%', height: '36px', marginBottom: '8px' }}
                onLoadedMetadata={e => { e.target.playbackRate = velocidad }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '12px', color: '#888780' }}>Velocidad:</span>
                {[0.5, 0.75, 1, 1.25].map(v => (
                  <button key={v} onClick={() => {
                    setVelocidad(v)
                    const audio = document.getElementById('audio-texto')
                    if (audio) audio.playbackRate = v
                  }}
                    style={{
                      padding: '3px 10px', borderRadius: '20px', border: 'none', cursor: 'pointer', fontSize: '12px', fontWeight: '500',
                      background: velocidad === v ? '#378ADD' : '#F1EFE8',
                      color: velocidad === v ? '#FFFFFF' : '#5F5E5A',
                    }}>
                    {v === 1 ? 'Normal' : `${v}x`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {errorPron && (
            <div style={{ marginTop: '10px', fontSize: '13px', color: '#A32D2D' }}>{errorPron}</div>
          )}
        </div>
      )}

      {pronunciacion && (
        <div style={{ background: '#F8F7F3', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '14px' }}>
            🎤 Guía de pronunciación
          </div>
          <div style={{ fontSize: '14px', color: '#1A1A18', lineHeight: '2' }}>
            {pronunciacion.split('\n').map((linea, i) => {
              if (!linea.trim()) return <div key={i} style={{ height: '10px' }} />
              const esOriginal = linea.startsWith('O: ')
              const esFonetica = linea.startsWith('F: ')
              const esTraduccion = linea.startsWith('T: ')
              const texto = linea.replace(/^[OFT]: /, '')
              if (!esOriginal && !esFonetica && !esTraduccion) return null
              return (
                <div key={i} style={{
                  color: esOriginal ? '#1A1A18' : esFonetica ? '#0F6E56' : '#B4B2A9',
                  fontSize: esOriginal ? '15px' : esFonetica ? '13px' : '12px',
                  fontFamily: esOriginal ? 'Georgia, serif' : 'system-ui, sans-serif',
                  fontStyle: esTraduccion ? 'italic' : 'normal',
                  marginBottom: esOriginal ? '2px' : esFonetica ? '2px' : '0',
                }}>
                  {texto}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {articulo.drive_pdf_id && (
        <div style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid #E8E6DF' }}>
          <div style={{ display: 'flex', gap: '10px', padding: '10px 14px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF' }}>
            <a href={driveUrlImprimir(articulo.drive_pdf_id)} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: '12px', color: '#5F5E5A', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px', background: '#FFFFFF', padding: '5px 12px', borderRadius: '8px', border: '1px solid #E8E6DF' }}>
              🖨 Abrir para imprimir
            </a>
          </div>
          <iframe
            src={'https://drive.google.com/file/d/' + articulo.drive_pdf_id + '/preview'}
            width="100%"
            height="600px"
            allow="autoplay"
            style={{ border: 'none', display: 'block' }}
          />
        </div>
      )}
    </div>
  )
}

function CatIcon({ categoria, color }) {
  const paths = {
    tecnica:   "M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z",
    estudio:   "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 14.5v-9l6 4.5-6 4.5z",
    noticias:  "M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z",
    formacion: "M12 3L1 9l11 6 9-4.91V17h2V9L12 3zM5 13.18v4L12 21l7-3.82v-4L12 17l-7-3.82z",
    avisos:    "M12 22c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z",
  }
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill={color}>
      <path d={paths[categoria] || paths.noticias} />
    </svg>
  )
}