import { useState } from 'react'

// Aviso flotante que entra desde arriba, se queda unos segundos y se va solo.
// Con el mouse encima se pausa; también se puede cerrar con la ×.
export default function MensajeSorpresa({ mensaje, onCerrar }) {
  const [saliendo, setSaliendo] = useState(false)
  const [pausado, setPausado] = useState(false)

  if (!mensaje) return null

  const esMovil = window.innerWidth <= 768
  // Más tiempo para los textos largos: entre 7 y 12 segundos
  const duracion = Math.min(12000, Math.max(7000, mensaje.texto.length * 70))

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onAnimationEnd={e => { if (e.animationName === 'sorpresaSalida') onCerrar() }}
      style={{
        position: 'fixed',
        zIndex: 70,
        top: '14px',
        ...(esMovil ? { left: '64px', right: '16px' } : { right: '24px', width: '380px' }),
        background: '#E1F5EE',
        border: '1px solid #9FE1CB',
        borderRadius: '14px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.15)',
        padding: '14px 16px 17px',
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        overflow: 'hidden',
        animation: saliendo ? 'sorpresaSalida 0.35s ease-in forwards' : 'sorpresaEntrada 0.4s ease-out',
      }}
    >
      <style>{`
        @keyframes sorpresaEntrada { from { opacity: 0; transform: translateY(-16px) } to { opacity: 1; transform: none } }
        @keyframes sorpresaSalida  { from { opacity: 1; transform: none } to { opacity: 0; transform: translateY(-16px) } }
        @keyframes sorpresaBarra   { from { transform: scaleX(1) } to { transform: scaleX(0) } }
      `}</style>

      <div style={{ fontSize: '24px', lineHeight: 1, flexShrink: 0 }}>{mensaje.emoji}</div>
      <p style={{ flex: 1, margin: 0, fontFamily: 'Georgia, serif', fontSize: '15px', lineHeight: 1.5, color: '#04342C' }}>
        {mensaje.texto}
      </p>
      <button
        onClick={() => setSaliendo(true)}
        aria-label="Cerrar mensaje"
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', lineHeight: 1, color: '#0F6E56', padding: '4px 6px', flexShrink: 0 }}
      >
        ×
      </button>

      {/* Barra de tiempo: al terminar, el aviso se va solo */}
      <div
        onAnimationEnd={e => { if (e.animationName === 'sorpresaBarra') setSaliendo(true) }}
        style={{
          position: 'absolute', left: 0, bottom: 0, height: '3px', width: '100%',
          background: '#0F6E56', opacity: 0.45, transformOrigin: 'left',
          animation: `sorpresaBarra ${duracion}ms linear forwards`,
          animationPlayState: pausado ? 'paused' : 'running',
        }}
      />
    </div>
  )
}
