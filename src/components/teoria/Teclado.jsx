import { NOMBRES_NOTA } from '../../lib/notacion'
import { COLOR_TEORIA } from '../../lib/teoria'

// Teclado chico para las lecciones: de "desde" a "hasta" (MIDI, empezando y terminando en tecla blanca).
// colores: { midi: color } para resaltar teclas; onTecla(midi) al tocar; nombres: mostrar Do, Re, Mi… en las blancas.
const BLANCAS = [0, 2, 4, 5, 7, 9, 11]
const NEGRA_DESPUES = { 0: 1, 2: 3, 5: 6, 7: 8, 9: 10 }

export default function Teclado({ desde = 60, hasta = 83, colores = {}, onTecla, nombres = false, alto = 110 }) {
  const blancas = []
  for (let m = desde; m <= hasta; m++) if (BLANCAS.includes(m % 12)) blancas.push(m)
  return (
    <div style={{ display: 'flex', width: '100%', height: `${alto}px`, position: 'relative', userSelect: 'none', marginBottom: '12px' }}>
      {blancas.map((m) => {
        const negra = NEGRA_DESPUES[m % 12] != null && m + 1 <= hasta ? m + 1 : null
        const nombre = NOMBRES_NOTA[BLANCAS.indexOf(m % 12)]
        return (
          <div key={m} onClick={() => onTecla?.(m)} style={{
            flex: '1 1 0', minWidth: 0, height: '100%', position: 'relative', boxSizing: 'border-box',
            border: '1px solid #B4B2A9', borderRadius: '0 0 5px 5px', background: colores[m] || '#FFFFFF',
            cursor: onTecla ? 'pointer' : 'default', transition: 'background 0.1s',
          }}>
            {(nombres || m % 12 === 0) && (
              <div style={{ position: 'absolute', bottom: '5px', left: 0, right: 0, textAlign: 'center', fontSize: '10px', fontWeight: 700, color: m === 60 ? COLOR_TEORIA : '#888780' }}>
                {nombres ? nombre : m === 60 ? 'Do' : ''}
              </div>
            )}
            {negra && (
              <div onClick={(e) => { e.stopPropagation(); onTecla?.(negra) }} style={{
                position: 'absolute', right: '-30%', top: 0, width: '60%', height: '60%', zIndex: 2,
                background: colores[negra] || '#1A1A18', borderRadius: '0 0 3px 3px', cursor: onTecla ? 'pointer' : 'default',
                border: colores[negra] ? '1px solid #1A1A18' : 'none', boxSizing: 'border-box',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}
