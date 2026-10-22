// Piezas visuales que comparten las pantallas de Ritmo (marcar el ritmo y dictados rítmicos)

export const VERDE = '#0F6E56'
export const DORADO = '#E9A91B'

export function Estrellas({ n, max = 3, size = 14 }) {
  return (
    <span aria-label={`${n} de ${max} estrellas`} style={{ whiteSpace: 'nowrap' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: `${size}px`, color: i < n ? DORADO : '#D3D1C7' }}>★</span>
      ))}
    </span>
  )
}

export const boton = (primario, extra = {}) => ({
  flex: '1 1 0', minWidth: 0, padding: '13px 10px', borderRadius: '12px', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600,
  border: primario ? 'none' : `1px solid ${VERDE}`,
  background: primario ? VERDE : '#FFFFFF',
  color: primario ? '#FFFFFF' : VERDE,
  ...extra,
})

// Los tiempos del compás, para seguirlos mientras suena: se enciende el pulso que está sonando
export function ContadorPulsos({ ej, pulso }) {
  const ppc = ej.pulsosPorCompas
  const enCurso = pulso >= 0
  const enCompas = enCurso ? pulso % ppc : -1
  const compas = enCurso ? Math.floor(pulso / ppc) + 1 : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '2px' }}>
      <div style={{ fontSize: '10px', color: '#B4B2A9', minWidth: '70px', textAlign: 'right' }}>
        {compas ? `Compás ${compas} de ${ej.compases.length}` : ' '}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {Array.from({ length: ppc }, (_, i) => {
          const activo = i === enCompas
          return (
            <div key={i} style={{
              width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600, transition: 'background 80ms, color 80ms',
              background: activo ? (i === 0 ? '#F0DDB0' : '#CDE7DC') : '#EFEDE4',
              color: activo ? (i === 0 ? '#8A6D1D' : VERDE) : '#CFCDC2',
            }}>{i + 1}</div>
          )
        })}
      </div>
      <div style={{ minWidth: '70px' }} />
    </div>
  )
}

