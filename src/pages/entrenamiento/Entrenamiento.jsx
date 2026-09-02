import { useState } from 'react'
import { useEjerciciosEntrenamiento, useEjerciciosHoy } from '../../hooks/useEntrenamiento'
import EjercicioPlayer from '../../components/EjercicioPlayer'
import PianoInteractivo, { BotonPiano } from '../../components/PianoInteractivo'

const CATEGORIAS = {
  respiracion:  { label: 'Respiración',  color: '#0F6E56', bg: '#E1F5EE' },
  resonancia:   { label: 'Resonancia',   color: '#378ADD', bg: '#E6F1FB' },
  agilidad:     { label: 'Agilidad',     color: '#D85A30', bg: '#FBEAE3' },
  rango:        { label: 'Rango',        color: '#8B5CF6', bg: '#F1EAFB' },
  afinacion:    { label: 'Afinación',    color: '#B8860B', bg: '#FBF3DF' },
  vocalizacion: { label: 'Vocalización', color: '#C0392B', bg: '#FBE5E3' },
}

const ORDEN_CATEGORIAS = ['respiracion', 'resonancia', 'agilidad', 'rango', 'afinacion', 'vocalizacion']

export default function Entrenamiento() {
  const { porCategoria, cargando, error, recargar } = useEjerciciosEntrenamiento()
  const { cantidad: ejerciciosHoy } = useEjerciciosHoy()
  const [categoriaActiva, setCategoriaActiva] = useState('')
  const [pianoAbierto, setPianoAbierto] = useState(false)

  const categoriasConDatos = ORDEN_CATEGORIAS.filter(cat => porCategoria[cat]?.length > 0)
  const categoriasAMostrar = categoriaActiva ? [categoriaActiva] : categoriasConDatos

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Entrenamiento
          </h2>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            Ejercicios de técnica vocal para practicar a tu ritmo
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {ejerciciosHoy > 0 && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#FBF3DF', border: '1px solid #E8DBAE', borderRadius: '20px', padding: '5px 12px' }}>
              <span style={{ fontSize: '16px' }}>🔥</span>
              <span style={{ fontSize: '13px', fontWeight: '600', color: '#8A6D1D' }}>
                Entrenaste con {ejerciciosHoy} {ejerciciosHoy === 1 ? 'ejercicio' : 'ejercicios'} hoy
              </span>
            </div>
          )}
          <BotonPiano abierto={pianoAbierto} onClick={() => setPianoAbierto(v => !v)} />
        </div>
      </div>

      <PianoInteractivo abierto={pianoAbierto} />

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        <button onClick={() => setCategoriaActiva('')} style={{
          padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
          border: `1px solid ${categoriaActiva === '' ? '#1D9E75' : '#D3D1C7'}`,
          background: categoriaActiva === '' ? '#E1F5EE' : 'none',
          color: categoriaActiva === '' ? '#04342C' : '#5F5E5A',
          fontWeight: categoriaActiva === '' ? '500' : '400',
        }}>
          Todas
        </button>
        {categoriasConDatos.map(cat => (
          <button key={cat} onClick={() => setCategoriaActiva(cat)} style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${categoriaActiva === cat ? '#1D9E75' : '#D3D1C7'}`,
            background: categoriaActiva === cat ? '#E1F5EE' : 'none',
            color: categoriaActiva === cat ? '#04342C' : '#5F5E5A',
            fontWeight: categoriaActiva === cat ? '500' : '400',
          }}>
            {CATEGORIAS[cat]?.label || cat}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontWeight: '500', fontSize: '12px' }}>Reintentar</button>
        </div>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: '90px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && !error && categoriasAMostrar.map(cat => (
        <div key={cat} style={{ marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{
              fontSize: '10px', fontWeight: '700',
              color: CATEGORIAS[cat]?.color || '#5F5E5A',
              background: CATEGORIAS[cat]?.bg || '#F1EFE8',
              padding: '2px 8px', borderRadius: '10px',
              textTransform: 'uppercase', letterSpacing: '0.3px',
            }}>
              {CATEGORIAS[cat]?.label || cat}
            </span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {(porCategoria[cat] || []).map(ej => (
              <EjercicioPlayer key={ej.id} ejercicio={ej} />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}