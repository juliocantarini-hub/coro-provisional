import { useState, useEffect } from 'react'

// Botón "volver" del entrenamiento. En el celular flota arriba a la derecha, en la misma línea que el
// botón del menú (hamburguesa); en pantallas grandes (donde no hay hamburguesa) queda en línea,
// arriba del contenido. Mismo tamaño y forma que las pestañas (Respiración, Resonancia…), sin borde.

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
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '4px', padding: '8px 16px',
  borderRadius: '18px', border: 'none', background: '#E1F5EE', color: '#04342C',
  fontSize: '12px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 1px 3px rgba(26,26,24,0.12)',
}

export default function BotonVolver({ texto, onClick }) {
  const esMovil = useEsMovil()
  if (esMovil) {
    // Contenedor de la altura de la hamburguesa para que el botón quede centrado en su línea
    return (
      <div style={{
        position: 'fixed', zIndex: 60, right: '16px', height: '40px', display: 'flex', alignItems: 'center',
        top: 'calc(12px + env(safe-area-inset-top, 0px))',
      }}>
        <button onClick={onClick} style={base}>← {texto}</button>
      </div>
    )
  }
  return <button onClick={onClick} style={{ ...base, marginBottom: '12px' }}>← {texto}</button>
}
