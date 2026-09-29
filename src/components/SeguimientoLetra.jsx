import { useEffect, useMemo, useRef } from 'react'

// Letra sincronizada estilo "karaoke": muestra el texto completo de la voz elegida
// y resalta la sílaba/palabra que se está cantando en cada instante, usando el mismo
// tiempo (tiempoActual * velocidad) que ya usamos para todo lo demás (afinación,
// cursor de partitura). No agrega ningún cálculo nuevo de tiempos: solo lee `letra`
// y `silabica` de los eventos que ya arma musicxml.js.
export default function SeguimientoLetra({ notas, tiempoActual, velocidad }) {
  const eventos = useMemo(() => (notas || []).filter(n => n.letra !== null), [notas])
  const contenedorRef = useRef(null)
  const actualRef = useRef(null)

  const posicionMusical = tiempoActual * velocidad
  let indiceActual = -1
  for (let i = 0; i < eventos.length; i++) {
    if (eventos[i].tiempo <= posicionMusical) indiceActual = i
    else break
  }

  useEffect(() => {
    if (actualRef.current?.scrollIntoView) {
      actualRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
    }
  }, [indiceActual])

  if (!eventos.length) return null

  return (
    <div
      ref={contenedorRef}
      style={{
        marginTop: '14px',
        padding: '12px 14px',
        background: '#F8F7F3',
        border: '1px solid #E8E6DF',
        borderRadius: '10px',
        fontSize: '15px',
        lineHeight: '1.7',
        maxHeight: '110px',
        overflowY: 'auto',
      }}>
      {eventos.map((e, i) => {
        // Espacio antes de esta sílaba, salvo que la anterior siga pegada (begin/middle).
        const anterior = eventos[i - 1]
        const pegadaALaAnterior = anterior && (anterior.silabica === 'begin' || anterior.silabica === 'middle')
        const esActual = i === indiceActual
        const yaCantada = i < indiceActual
        return (
          <span key={i} ref={esActual ? actualRef : null}>
            {pegadaALaAnterior ? '' : ' '}
            <span style={{
              color: esActual ? '#0F6E56' : yaCantada ? '#B4B2A9' : '#1A1A18',
              fontWeight: esActual ? '700' : '400',
              transition: 'color 0.15s ease',
            }}>
              {e.letra}
            </span>
          </span>
        )
      })}
    </div>
  )
}
