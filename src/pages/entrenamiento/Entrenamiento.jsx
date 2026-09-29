import { useState } from 'react'
import { useAuth } from '../../hooks/useAuth'
import { useEjerciciosEntrenamiento, useEjerciciosHoy } from '../../hooks/useEntrenamiento'
import EjercicioPlayer from '../../components/EjercicioPlayer'
import PianoInteractivo, { BotonPiano } from '../../components/PianoInteractivo'
import { usePartituras, usePartitura } from '../../hooks/usePartituras'
import PartituraPlayer from '../../components/PartituraPlayer'

const CATEGORIAS = {
  respiracion:  { label: 'Respiración',  color: '#0F6E56', bg: '#E1F5EE' },
  resonancia:   { label: 'Resonancia',   color: '#378ADD', bg: '#E6F1FB' },
  vocalizacion: { label: 'Vocalización', color: '#C0392B', bg: '#FBE5E3' },
}

const ORDEN_CATEGORIAS = ['respiracion', 'resonancia', 'vocalizacion']

const PRACTICA = 'practica'

function formatoTiempoPartitura(seg) {
  if (!seg || !isFinite(seg)) return ''
  const m = Math.floor(seg / 60)
  const s = Math.round(seg % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

function PartituraCard({ resumen }) {
  const [abierta, setAbierta] = useState(false)
  const { partitura, cargando } = usePartitura(abierta ? resumen.id : null)

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
      <div onClick={() => setAbierta(v => !v)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{resumen.titulo}</div>
          <div style={{ fontSize: '12px', color: '#888780' }}>
            {resumen.compositor ? `${resumen.compositor} · ` : ''}{formatoTiempoPartitura(resumen.duracion_seg)}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9"
          style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}>
          <path d="M7 10l5 5 5-5z"/>
        </svg>
      </div>
      {abierta && (
        <div style={{ padding: '0 16px 16px' }}>
          {cargando && <div style={{ fontSize: '13px', color: '#888780' }}>Cargando...</div>}
          {partitura && <PartituraPlayer partitura={partitura} />}
        </div>
      )}
    </div>
  )
}

export default function Entrenamiento() {
  const { perfil } = useAuth()
  const { porCategoria, cargando, error, recargar } = useEjerciciosEntrenamiento()
  const { partituras, cargando: cargandoPartituras } = usePartituras()
  const { cantidad: ejerciciosHoy } = useEjerciciosHoy()
  const [categoriaActiva, setCategoriaActiva] = useState('respiracion')
  const [pianoAbierto, setPianoAbierto] = useState(false)

  const TABS = [
    ...ORDEN_CATEGORIAS.map(cat => ({ id: cat, label: CATEGORIAS[cat]?.label || cat, icono: null })),
    { id: PRACTICA, label: 'Practica tu voz', icono: '🎤' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Entrenamiento
          </h2>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            Ejercicios de técnica vocal y práctica de tu voz en las obras.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {ejerciciosHoy > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FBF3DF', border: '1px solid #E8DBAE', borderRadius: '20px', padding: '5px 12px' }}>
              <span style={{ fontSize: '16px' }}>⭐</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#8A6D1D' }}>
                Entrenaste con {ejerciciosHoy} {ejerciciosHoy === 1 ? 'ejercicio' : 'ejercicios'} hoy
              </span>
            </div>
          )}
          <BotonPiano abierto={pianoAbierto} onClick={() => setPianoAbierto(v => !v)} />
        </div>
      </div>

      <PianoInteractivo abierto={pianoAbierto} voz={perfil?.voz} />

      {/* Menú unificado: una sola fila con el mismo alto y tipografía para las
          4 pestañas (antes "Practica tu voz" quedaba suelta en una fila aparte,
          con otro estilo — ahora es una pestaña más del mismo grupo). */}
      <div style={{
        display: 'flex', gap: '4px', background: '#EAE7DD', borderRadius: '22px',
        padding: '4px', marginBottom: '16px', overflowX: 'auto',
      }}>
        {TABS.map(tab => {
          const activa = categoriaActiva === tab.id
          return (
            <button key={tab.id} onClick={() => setCategoriaActiva(tab.id)} style={{
              flex: '1 1 0', minWidth: 'fit-content', padding: '8px 12px', borderRadius: '18px',
              border: 'none', cursor: 'pointer', fontSize: '12px', whiteSpace: 'nowrap',
              fontWeight: activa ? '700' : '500',
              background: activa ? '#FFFFFF' : 'transparent',
              color: activa ? '#04342C' : '#5F5E5A',
              boxShadow: activa ? '0 1px 3px rgba(26,26,24,0.12)' : 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '5px',
            }}>
              {tab.icono && <span>{tab.icono}</span>}
              {tab.label}
            </button>
          )
        })}
      </div>

      {error && categoriaActiva !== PRACTICA && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontWeight: '500', fontSize: '12px' }}>Reintentar</button>
        </div>
      )}

      {categoriaActiva !== PRACTICA && cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '90px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {categoriaActiva !== PRACTICA && !cargando && !error && (
        (porCategoria[categoriaActiva] || []).length === 0 ? (
          <div style={{ fontSize: '13px', color: '#888780', padding: '30px 0', textAlign: 'center' }}>
            Todavía no hay ejercicios cargados en esta categoría.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {porCategoria[categoriaActiva].map(ej => (
              <EjercicioPlayer key={ej.id} ejercicio={ej} />
            ))}
          </div>
        )
      )}

      {categoriaActiva === PRACTICA && (
        cargandoPartituras ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1, 2].map(i => (
              <div key={i} style={{ height: '90px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
          </div>
        ) : partituras.length === 0 ? (
          <div style={{ fontSize: '13px', color: '#888780', padding: '30px 0', textAlign: 'center' }}>
            Todavía no hay obras cargadas para practicar por voz.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {partituras.map(p => (
              <PartituraCard key={p.id} resumen={p} />
            ))}
          </div>
        )
      )}
    </div>
  )
}
