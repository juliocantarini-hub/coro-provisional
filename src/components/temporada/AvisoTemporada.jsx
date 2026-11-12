// Piezas del reporte de temporada que aparecen en Inicio:
//  - AvisoTemporada: aviso "Tu temporada está lista", una sola vez por reporte.
//  - TarjetaTemporada: tarjeta arriba de todo, hasta la fecha que eligió el director.

export function AvisoTemporada({ reporte, onVer, onCerrar }) {
  if (!reporte) return null
  return (
    <div role="dialog" aria-label="Tu temporada está lista"
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(26,26,24,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '360px', background: '#FFFFFF', borderRadius: '16px', padding: '26px 22px 18px', textAlign: 'center', boxShadow: '0 12px 32px rgba(0,0,0,0.18)' }}>
        <div style={{ fontSize: '11px', fontWeight: 600, color: '#0F6E56', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Temporada {reporte.temporada}
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 'normal', fontSize: '22px', color: '#1A1A18', margin: '6px 0 8px' }}>
          Tu resumen del año está listo
        </h2>
        <p style={{ fontSize: '13px', lineHeight: 1.5, color: '#888780', margin: '0 0 20px' }}>
          Mirá todo lo que cantaste y estudiaste esta temporada.
        </p>
        <button onClick={onVer}
          style={{ width: '100%', background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '10px', padding: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginBottom: '6px' }}>
          Ver mi temporada
        </button>
        <button onClick={onCerrar}
          style={{ width: '100%', background: 'none', color: '#888780', border: 'none', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
          Más tarde
        </button>
      </div>
    </div>
  )
}

export function TarjetaTemporada({ reporte, onVer }) {
  if (!reporte) return null
  return (
    <button onClick={onVer}
      style={{
        width: '100%', textAlign: 'left', cursor: 'pointer', marginBottom: '16px',
        background: '#FFFFFF', border: '1px solid #E8E6DF', borderLeft: '3px solid #0F6E56',
        borderRadius: '14px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '14px',
      }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '16px', color: '#1A1A18' }}>Mi temporada {reporte.temporada}</div>
        <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>
          {reporte.visto_en ? 'Tu resumen del año' : 'Tu resumen del año ya está listo'}
        </div>
      </div>
      <span style={{ fontSize: '13px', fontWeight: 500, color: '#0F6E56', flexShrink: 0 }}>Ver →</span>
    </button>
  )
}
