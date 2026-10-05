import { useEffect, useRef, useState } from 'react'

// Medidor visual de afinación: una barra horizontal de -50 a +50 centésimas de
// semitono dividida en 5 tramos (rojo – amarillo – verde – amarillo – rojo).
// En vez de una marca que se desliza, se ILUMINA el tramo donde está el
// cantante en este momento; los demás quedan apagados (colores pálidos).
// Los anchos de las bandas son configurables (bandaVerde/bandaAmarilla).
//
// Para que no sea tan nervioso (esto es puramente visual, no toca la detección
// del micrófono ni el piano):
//  - Suavizado exponencial del valor (ALFA): una lectura suelta no lo mueve de golpe.
//  - Histéresis (MARGEN_CENTS): una vez iluminado un tramo, el valor tiene que
//    pasarse del borde por unos centésimos para que se cambie al vecino; así no
//    parpadea entre dos colores cuando se canta justo sobre el límite.
//  - Retención (RETENCION_MS): si la lectura se corta un instante (cambio de
//    nota, respiración), el último tramo queda iluminado un ratito en vez de
//    apagarse y prenderse de nuevo.
const ALFA = 0.2
const MARGEN_CENTS = 4
const RETENCION_MS = 450

const APAGADO = ['#F6CFCB', '#F5E7B8', '#C9EBDD', '#F5E7B8', '#F6CFCB']
const ENCENDIDO = ['#E8756B', '#E9BF45', '#3FAE83', '#E9BF45', '#E8756B']

function segmentoDe(valor, limites) {
  // limites = [-Inf, -amarilla, -verde, verde, amarilla, +Inf]
  for (let i = 0; i < 5; i++) {
    if (valor >= limites[i] && valor < limites[i + 1]) return i
  }
  return 4
}

function segmentoConHisteresis(valor, previo, limites) {
  if (previo != null && valor >= limites[previo] - MARGEN_CENTS && valor < limites[previo + 1] + MARGEN_CENTS) {
    return previo
  }
  return segmentoDe(valor, limites)
}

export default function MedidorAfinacion({ cents, bandaVerde = 15, bandaAmarilla = 35 }) {
  const [segmentoActivo, setSegmentoActivo] = useState(null)
  const suavizado = useRef(null)
  const segmentoRef = useRef(null)
  const retencion = useRef(null)

  const limites = [-Infinity, -bandaAmarilla, -bandaVerde, bandaVerde, bandaAmarilla, Infinity]

  useEffect(() => {
    if (cents != null && isFinite(cents)) {
      clearTimeout(retencion.current)
      const v = Math.max(-50, Math.min(50, cents))
      suavizado.current = suavizado.current == null ? v : suavizado.current + ALFA * (v - suavizado.current)
      const nuevo = segmentoConHisteresis(suavizado.current, segmentoRef.current, limites)
      segmentoRef.current = nuevo
      setSegmentoActivo(nuevo)
    } else {
      clearTimeout(retencion.current)
      retencion.current = setTimeout(() => {
        suavizado.current = null
        segmentoRef.current = null
        setSegmentoActivo(null)
      }, RETENCION_MS)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cents, bandaVerde, bandaAmarilla])

  useEffect(() => () => clearTimeout(retencion.current), [])

  const hayLectura = segmentoActivo != null

  // Anchos relativos de cada banda (de -50 a +50), como proporción del total.
  const anchos = [
    50 - bandaAmarilla,
    bandaAmarilla - bandaVerde,
    bandaVerde * 2,
    bandaAmarilla - bandaVerde,
    50 - bandaAmarilla,
  ]

  return (
    <div style={{ width: '100%', opacity: hayLectura ? 1 : 0.6, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#B4B2A9', marginBottom: '3px', fontVariantNumeric: 'tabular-nums' }}>
        <span>-50</span>
        <span>0</span>
        <span>+50</span>
      </div>
      <div style={{ height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex', gap: '2px' }}>
        {anchos.map((ancho, i) => {
          const encendido = i === segmentoActivo
          return (
            <div
              key={i}
              style={{
                flex: `${ancho} 1 0`,
                background: encendido ? ENCENDIDO[i] : APAGADO[i],
                boxShadow: encendido ? `0 0 8px ${ENCENDIDO[i]}` : 'none',
                transition: 'background 0.15s ease-out, box-shadow 0.15s ease-out',
              }}
            />
          )
        })}
      </div>
    </div>
  )
}
