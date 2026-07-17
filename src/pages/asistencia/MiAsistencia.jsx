import { useAuth } from '../../hooks/useAuth'
import { useHistorialAsistencia, calcularEstadisticas, calcularRacha } from '../../hooks/useAsistencia'

const ESTADO_STYLE = {
  presente:    { bg: '#EAF3DE', color: '#27500A', txt: 'Presente',    emoji: '✓' },
  ausente:     { bg: '#FCEBEB', color: '#501313', txt: 'Ausente',     emoji: '✕' },
  justificado: { bg: '#E6F1FB', color: '#042C53', txt: 'Justificado', emoji: '○' },
}

export default function MiAsistencia() {
  const { perfil } = useAuth()
  const { historial, cargando } = useHistorialAsistencia(perfil?.id)
  const estadisticas = calcularEstadisticas(historial)
  const racha = calcularRacha(historial)

  const totalPresentes = historial.filter(r => r.estado === 'presente').length
  const totalRegistros = historial.length
  const porcentajeGeneral = totalRegistros > 0
    ? Math.round((totalPresentes / totalRegistros) * 100)
    : 0

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 4px' }}>
          Mi asistencia
        </h2>
        <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
          Tu historial de asistencia en el coro
        </p>
      </div>

      {/* Resumen general */}
      {!cargando && totalRegistros > 0 && (
        <div style={{ background: 'linear-gradient(135deg, #0A4A3A 0%, #0F6E56 100%)', borderRadius: '14px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
          {/* Porcentaje grande */}
          <div style={{ textAlign: 'center', minWidth: '80px' }}>
            <div style={{ fontSize: '42px', fontWeight: '700', color: '#FFFFFF', lineHeight: 1 }}>
              {porcentajeGeneral}%
            </div>
            <div style={{ fontSize: '11px', color: 'rgba(159,225,203,0.8)', marginTop: '4px' }}>
              Asistencia general
            </div>
          </div>

          {racha >= 2 && (
            <div style={{ textAlign: 'center', minWidth: '70px', borderLeft: '1px solid rgba(255,255,255,0.15)', paddingLeft: '20px' }}>
              <div style={{ fontSize: '30px', lineHeight: 1 }}>
                🔥 <span style={{ fontSize: '30px', fontWeight: '700', color: '#FFFFFF' }}>{racha}</span>
              </div>
              <div style={{ fontSize: '11px', color: 'rgba(159,225,203,0.8)', marginTop: '4px' }}>
                {racha === 1 ? 'ensayo seguido' : 'ensayos seguidos'}
              </div>
            </div>
          )}
          {/* Stats */}
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
            {[
              { label: 'Presentes',    val: totalPresentes,                              color: '#9FE1CB' },
              { label: 'Ausentes',     val: historial.filter(r => r.estado === 'ausente').length,     color: '#F0C5B4' },
              { label: 'Justificados', val: historial.filter(r => r.estado === 'justificado').length, color: '#B8D4F0' },
              { label: 'Total',        val: totalRegistros,                              color: 'rgba(255,255,255,0.6)' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize: '22px', fontWeight: '600', color: s.color, lineHeight: 1 }}>{s.val}</div>
                <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)', marginTop: '2px' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Gráfico mes a mes */}
      {!cargando && estadisticas.length > 0 && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '14px', padding: '18px', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 16px' }}>
            Asistencia por mes
          </h3>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px', height: '120px', overflowX: 'auto', paddingBottom: '8px' }}>
            {estadisticas.map(mes => (
              <div key={mes.mes} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', minWidth: '44px', flex: '0 0 44px' }}>
                {/* Barra */}
                <div style={{ fontSize: '10px', fontWeight: '600', color: mes.porcentaje >= 75 ? '#27500A' : mes.porcentaje >= 50 ? '#D85A30' : '#501313' }}>
                  {mes.porcentaje}%
                </div>
                <div style={{
                  width: '100%', borderRadius: '6px 6px 0 0',
                  height: `${Math.max(mes.porcentaje, 4)}px`,
                  background: mes.porcentaje >= 75 ? '#1D9E75' : mes.porcentaje >= 50 ? '#D85A30' : '#E24B4A',
                  transition: 'height 0.3s ease',
                  maxHeight: '80px',
                  minHeight: '4px',
                }} />
                {/* Etiqueta */}
                <div style={{ fontSize: '10px', color: '#888780', textAlign: 'center', whiteSpace: 'nowrap' }}>
                  {mes.label}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
            {[
              { color: '#1D9E75', label: '≥75% Excelente' },
              { color: '#D85A30', label: '50-74% Regular' },
              { color: '#E24B4A', label: '<50% Bajo' },
            ].map(l => (
              <div key={l.label} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: l.color }} />
                <span style={{ fontSize: '11px', color: '#888780' }}>{l.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Historial */}
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '14px', padding: '18px' }}>
        <h3 style={{ fontSize: '12px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 14px' }}>
          Historial detallado
        </h3>

        {cargando && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {[1,2,3].map(i => <div key={i} style={{ height: '52px', background: '#F1EFE8', borderRadius: '8px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
            <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
          </div>
        )}

        {!cargando && historial.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px', color: '#888780' }}>
            <p style={{ fontSize: '14px', margin: 0 }}>Aún no hay registros de asistencia.</p>
          </div>
        )}

        {!cargando && historial.map(reg => {
          const es = ESTADO_STYLE[reg.estado] || ESTADO_STYLE.ausente
          const fecha = new Date(reg.listas_asistencia.fecha + 'T12:00:00')
          return (
            <div key={reg.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 0', borderBottom: '1px solid #F1EFE8' }}>
              <div style={{ width: '40px', textAlign: 'center', background: '#F8F7F3', borderRadius: '8px', padding: '4px', flexShrink: 0 }}>
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#1A1A18', lineHeight: 1 }}>{fecha.getDate()}</div>
                <div style={{ fontSize: '9px', color: '#888780', textTransform: 'uppercase' }}>
                  {fecha.toLocaleDateString('es-AR', { month: 'short' })}
                </div>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', color: '#1A1A18' }}>{reg.listas_asistencia.descripcion}</div>
                {reg.nota && <div style={{ fontSize: '11px', color: '#888780', marginTop: '2px' }}>{reg.nota}</div>}
              </div>
              <span style={{ fontSize: '12px', background: es.bg, color: es.color, padding: '4px 10px', borderRadius: '8px', fontWeight: '500', flexShrink: 0 }}>
                {es.emoji} {es.txt}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}