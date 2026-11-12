// Piezas del reporte de temporada que aparecen en Inicio:
//  - AvisoTemporada: pantalla de bienvenida, una sola vez por reporte.
//  - TarjetaTemporada: tarjeta destacada arriba de todo, hasta la fecha que eligió el director.

export function AvisoTemporada({ reporte, onVer, onCerrar }) {
  if (!reporte) return null
  return (
    <div role="dialog" aria-label="Tu temporada está lista"
      style={{ position: 'fixed', inset: 0, zIndex: 150, background: 'rgba(4,52,44,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <style>{`@keyframes temporadaAviso { from { opacity: 0; transform: scale(0.94) } to { opacity: 1; transform: none } }`}</style>
      <div style={{
        width: '100%', maxWidth: '380px', borderRadius: '20px', padding: '30px 24px 22px', textAlign: 'center',
        background: 'linear-gradient(160deg, #04342C 0%, #0F6E56 100%)', color: '#FFFFFF',
        boxShadow: '0 12px 40px rgba(0,0,0,0.3)', animation: 'temporadaAviso 0.35s ease-out',
      }}>
        <div style={{ fontSize: '48px', lineHeight: 1, marginBottom: '12px' }}>🎶</div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 'normal', fontSize: '24px', margin: '0 0 8px' }}>
          Tu temporada {reporte.temporada} está lista
        </h2>
        <p style={{ fontSize: '14px', lineHeight: 1.5, color: 'rgba(225,245,238,0.85)', margin: '0 0 22px' }}>
          Preparamos un repaso de todo lo que cantaste este año.
        </p>
        <button onClick={onVer}
          style={{ width: '100%', background: '#FFFFFF', color: '#04342C', border: 'none', borderRadius: '12px', padding: '13px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', marginBottom: '8px' }}>
          Ver mi temporada
        </button>
        <button onClick={onCerrar}
          style={{ width: '100%', background: 'none', color: 'rgba(225,245,238,0.85)', border: 'none', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>
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
        width: '100%', textAlign: 'left', border: 'none', cursor: 'pointer', marginBottom: '16px',
        background: 'linear-gradient(120deg, #3B2470 0%, #7C3AED 100%)', color: '#FFFFFF',
        borderRadius: '16px', padding: '16px 18px', display: 'flex', alignItems: 'center', gap: '14px',
      }}>
      <div style={{ fontSize: '30px', lineHeight: 1 }}>🎶</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '17px' }}>Mi temporada {reporte.temporada}</div>
        <div style={{ fontSize: '12px', opacity: 0.85, marginTop: '2px' }}>
          {reporte.visto_en ? 'Volvé a ver tu resumen del año' : 'Tu resumen del año ya está listo'}
        </div>
      </div>
      <div style={{ fontSize: '13px', fontWeight: 600, background: 'rgba(255,255,255,0.2)', borderRadius: '8px', padding: '6px 10px', flexShrink: 0 }}>
        Ver →
      </div>
    </button>
  )
}
