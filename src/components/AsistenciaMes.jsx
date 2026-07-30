import { useAsistenciaMesActual } from '../hooks/useAsistencia'

export default function AsistenciaMes() {
  const { resumen, cargando } = useAsistenciaMesActual()

  if (cargando) {
    return <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E8E6DF', marginBottom: '16px', height: '150px' }} />
  }

  const sinDatos = !resumen || resumen.cantidadEnsayos === 0
  const color = !resumen ? '#888780'
    : resumen.porcentaje >= 70 ? '#0F6E56'
    : resumen.porcentaje >= 40 ? '#D85A30'
    : '#888780'

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
        Asistencia del mes
      </h3>

      {sinDatos ? (
        <p style={{ fontSize: '13px', color: '#B4B2A9', margin: 0 }}>Todavía no se tomó asistencia este mes.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '28px', fontWeight: '600', color }}>{resumen.porcentaje}%</span>
            <span style={{ fontSize: '12px', color: '#888780' }}>
              promedio en {resumen.cantidadEnsayos} ensayo{resumen.cantidadEnsayos !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <MiniStat val={resumen.presentes} label="Presentes" color="#0F6E56" bg="#E1F5EE" />
            <MiniStat val={resumen.ausentes} label="Ausentes" color="#D85A30" bg="#FAECE7" />
            <MiniStat val={resumen.justificados} label="Justificados" color="#378ADD" bg="#E6F1FB" />
          </div>
        </>
      )}
    </div>
  )
}

function MiniStat({ val, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '10px', padding: '10px', textAlign: 'center' }}>
      <div style={{ fontSize: '18px', fontWeight: '600', color }}>{val}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.8 }}>{label}</div>
    </div>
  )
}