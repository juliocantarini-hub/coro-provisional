export default function EncuestaWidget({ encuesta, resultados, miVoto, votar, esAdmin = false, onCerrar, onReabrir, compacto = false }) {
  if (!encuesta) return null

  const cerrada = encuesta.estado === 'cerrada'
  const misVotos = miVoto ? miVoto() : []
  const datos = resultados()
  const clicable = !esAdmin && !cerrada

  async function handleClick(opcionId) {
    if (!clicable) return
    await votar(opcionId)
  }

  return (
    <div style={{
      background: '#F9F8F4',
      border: '1px solid #E8E6DF',
      borderRadius: '10px',
      padding: compacto ? '12px 14px' : '14px 16px',
      marginTop: compacto ? 0 : '12px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A18' }}>
          📊 {encuesta.pregunta}
        </div>
        {cerrada && (
          <span style={{ fontSize: '10px', color: '#888780', background: '#E8E6DF', padding: '2px 8px', borderRadius: '10px', flexShrink: 0 }}>
            Cerrada
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {datos.map(op => {
          const marcada = misVotos.includes(op.id)
          return (
            <div key={op.id}
              onClick={() => handleClick(op.id)}
              style={{
                position: 'relative',
                borderRadius: '8px',
                padding: '8px 10px',
                cursor: clicable ? 'pointer' : 'default',
                border: `1px solid ${marcada ? '#1D9E75' : '#E8E6DF'}`,
                background: '#FFFFFF',
                overflow: 'hidden',
              }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${op.porcentaje}%`,
                background: marcada ? '#E1F5EE' : '#F1EFE8',
                transition: 'width 0.3s ease',
                zIndex: 0,
              }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '12px', color: '#1A1A18', fontWeight: marcada ? '500' : '400' }}>
                  {marcada && '✓ '}{op.texto}
                </span>
                <span style={{ fontSize: '11px', color: '#888780', fontWeight: '600', flexShrink: 0 }}>
                  {op.porcentaje}% ({op.count})
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {encuesta.permite_multiple && clicable && (
        <p style={{ fontSize: '11px', color: '#B4B2A9', margin: '8px 0 0' }}>Podés elegir más de una opción.</p>
      )}

      {esAdmin && (
        <div style={{ marginTop: '10px' }}>
          {!cerrada ? (
            <button onClick={onCerrar}
              style={{ fontSize: '11px', color: '#A32D2D', background: '#FCEBEB', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '500' }}>
              Cerrar encuesta
            </button>
          ) : (
            <button onClick={onReabrir}
              style={{ fontSize: '11px', color: '#0F6E56', background: '#E1F5EE', border: 'none', borderRadius: '6px', padding: '4px 10px', cursor: 'pointer', fontWeight: '500' }}>
              Reabrir encuesta
            </button>
          )}
        </div>
      )}
    </div>
  )
}