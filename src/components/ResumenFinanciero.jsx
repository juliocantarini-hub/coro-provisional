import { useResumenFinancieroMes } from '../hooks/usePagos'

const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

function formatMonto(monto) {
  return '$' + Number(monto).toLocaleString('es-AR')
}

export default function ResumenFinanciero() {
  const { resumen, cargando } = useResumenFinancieroMes()

  if (cargando) {
    return <div style={{ background: '#FFFFFF', borderRadius: '14px', border: '1px solid #E8E6DF', marginBottom: '16px', height: '150px' }} />
  }

  const sinActivas = !resumen || resumen.activas.length === 0
  if (sinActivas) return null

  const nombreMes = MESES[new Date().getMonth()]
  const porcentaje = resumen.esperado > 0
    ? Math.min(100, Math.round((resumen.ingresado / resumen.esperado) * 100))
    : 0

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF', marginBottom: '16px' }}>
      <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 12px' }}>
        Resumen financiero — {nombreMes}
      </h3>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '8px' }}>
        <span style={{ fontSize: '22px', fontWeight: '600', color: '#0F6E56' }}>{formatMonto(resumen.ingresado)}</span>
        <span style={{ fontSize: '13px', color: '#888780' }}>de {formatMonto(resumen.esperado)}</span>
      </div>

      <div style={{ height: '8px', background: '#F1EFE8', borderRadius: '4px', overflow: 'hidden', marginBottom: '14px' }}>
        <div style={{ height: '100%', width: `${porcentaje}%`, background: '#1D9E75', borderRadius: '4px', transition: 'width 0.3s ease' }} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <MiniStat val={resumen.pagas} label="Pagas" color="#0F6E56" bg="#E1F5EE" />
        <MiniStat val={resumen.impagas} label="Impagas" color="#D85A30" bg="#FAECE7" />
        <MiniStat val={resumen.exentas} label="Exentas" color="#888780" bg="#F1EFE8" />
      </div>

      {resumen.falta > 0 && (
        <p style={{ fontSize: '12px', color: '#888780', margin: '12px 0 0' }}>
          Falta ingresar {formatMonto(resumen.falta)}.
        </p>
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
