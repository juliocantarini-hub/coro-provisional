export default function MensajeSorpresa({ mensaje, onCerrar }) {
  if (!mensaje) return null

  return (
    <div
      role="status"
      style={{
        background: '#E1F5EE',
        border: '1px solid #9FE1CB',
        borderRadius: '14px',
        padding: '14px 16px',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        animation: 'sorpresaEntrada 0.4s ease-out',
      }}
    >
      <style>{`@keyframes sorpresaEntrada { from { opacity: 0; transform: translateY(-6px) } to { opacity: 1; transform: none } }`}</style>
      <div style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{mensaje.emoji}</div>
      <p style={{ flex: 1, margin: 0, fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: 1.5, color: '#04342C' }}>
        {mensaje.texto}
      </p>
      <button
        onClick={onCerrar}
        aria-label="Cerrar mensaje"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: '#0F6E56', padding: '4px 6px', flexShrink: 0 }}
      >
        ×
      </button>
    </div>
  )
}
