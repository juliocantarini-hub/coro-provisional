import { useResumenEstudio } from '../hooks/useObras'

export default function ResumenEstudio() {
  const { resumen, cargando } = useResumenEstudio()

  if (cargando) {
    return <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E8E6DF', marginBottom: '16px', height: '150px' }} />
  }

  const sinObras = !resumen || resumen.totalObras === 0

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
        Repertorio
      </h3>

      {sinObras ? (
        <p style={{ fontSize: '13px', color: '#B4B2A9', margin: 0 }}>Todavía no hay obras publicadas.</p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '14px' }}>
            <span style={{ fontSize: '28px', fontWeight: '600', color: '#0F6E56' }}>{resumen.dominadas}</span>
            <span style={{ fontSize: '12px', color: '#888780' }}>
              de {resumen.totalObras} obra{resumen.totalObras !== 1 ? 's' : ''} dominada{resumen.dominadas !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            <MiniStat val={resumen.dominadas} label="Dominadas" color="#0F6E56" bg="#E1F5EE" />
            <MiniStat val={resumen.enEstudio} label="En estudio" color="#D85A30" bg="#FAECE7" />
            <MiniStat val={resumen.sinIniciar} label="Sin iniciar" color="#888780" bg="#F1EFE8" />
          </div>
          <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '12px 0 0' }}>
            Dominada = más de la mitad del coro la marcó como estudiada.
          </p>
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
