import { useState, useEffect } from 'react'

// Botón "volver" del entrenamiento. En el celular flota arriba a la derecha, en la misma línea que el
// botón del menú (hamburguesa); en pantallas grandes (donde no hay hamburguesa) queda en línea,
// arriba a la derecha, en la línea del título. Mismo tamaño y forma que las pestañas (Respiración, Resonancia…), sin borde.

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
    // En el celular la parte de arriba es la barra fija (menú, coro, avisos):
    // el botón va al principio de la página, alineado a la derecha.
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' }}>
        <button onClick={onClick} style={base}>← {texto}</button>
      </div>
    )
  }
  // En pantallas grandes: arriba a la derecha de la página, en la línea del título
  // (la página de Entrenamiento tiene position: relative)
  return <button onClick={onClick} style={{ ...base, position: 'absolute', top: 0, right: 0, zIndex: 5 }}>← {texto}</button>
}
