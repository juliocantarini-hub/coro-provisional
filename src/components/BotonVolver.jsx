import { useState, useEffect } from 'react'

// Botón "volver" del entrenamiento. En el celular flota arriba, en la misma línea que el botón
// del menú (hamburguesa), justo a su derecha; en pantallas grandes (donde no hay hamburguesa)
// queda en línea, arriba del contenido. Mismo verde y bordes redondeados que el resto de la app.

function useEsMovil() {
  const [esMovil, setEsMovil] = useState(window.innerWidth <= 768)
  useEffect(() => {
    const fn = () => setEsMovil(window.innerWidth <= 768)
    window.addEventListener('resize', fn)
    return () => window.removeEventListener('resize', fn)
  }, [])
  return esMovil
}

const base = {
  display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 16px 8px 12px',
  borderRadius: '20px', border: '1px solid #0F6E56', background: '#E1F5EE', color: '#04342C',
  fontSize: '13px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 2px rgba(26,26,24,0.08)',
}

export default function BotonVolver({ texto, onClick }) {
  const esMovil = useEsMovil()
  if (esMovil) {
    return (
      <button onClick={onClick}
        style={{
          ...base, position: 'fixed', zIndex: 60, left: '60px', height: '40px', boxSizing: 'border-box',
          top: 'calc(12px + env(safe-area-inset-top, 0px))', boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
        }}>
        ← {texto}
      </button>
    )
  }
  return <button onClick={onClick} style={{ ...base, marginBottom: '12px' }}>← {texto}</button>
}
