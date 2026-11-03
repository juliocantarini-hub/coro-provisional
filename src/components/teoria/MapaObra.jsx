import { GLIFOS, ESCALA_GLIFO } from '../../lib/glifosMusicales'

// Una línea de partitura (una sola voz, clave de sol) con los signos que arman el "mapa" de una obra:
// barras de repetición, casillas 1 y 2, Fine, D.C., D.S., segno, coda, calderón, respiración y dinámicas.
// Debajo de cada compás va su número en un circulito, para poder nombrarlo y tocarlo.
//
// compases: [{
//   notas: [{ paso, dur }],
//   inicioRep, barra: 'normal' | 'rep' | 'doble' | 'final', casilla: '1.' | '2.',
//   texto (arriba, al final del compás: 'Fine', 'D.C. al Fine'…), segno, alCoda (⊕ al final), coda (compás de coda, separado),
//   calderon (sobre la última nota), respira (coma al final), dinamica ('p', 'mf', 'f'…), regulador: 'cresc' | 'dim', largo (compases que abarca)
// }]

const K = ESCALA_GLIFO
const PULSO = 20
const ANCHO = 4 * PULSO + 34
const LUGAR_SIGNO = 10 // espacio extra antes de una nota con alteración
const ARRIBA = 52
const ABAJO = ARRIBA + 40
const BASE = 30 // Mi4, línea de abajo en clave de sol
const X0 = 50
const SEP_CODA = 34
const TINTA = '#1A1A18'
const LINEA = '#6E6C64'
const ANCHO_CABEZA = GLIFOS.negra.ancho * K
const H = 156
const yDe = (paso) => ABAJO - (paso - BASE) * 5

function Coda({ x, y }) {
  return (
    <g stroke={TINTA} strokeWidth={1.5} fill="none">
      <ellipse cx={x} cy={y} rx={5.5} ry={7} />
      <line x1={x} x2={x} y1={y - 11} y2={y + 11} />
      <line x1={x - 10} x2={x + 10} y1={y} y2={y} />
    </g>
  )
}

function Segno({ x, y }) {
  return (
    <g>
      <text x={x} y={y + 7} textAnchor="middle" fontSize={22} fontStyle="italic" fontFamily="Georgia, serif" fill={TINTA}>S</text>
      <line x1={x - 8} x2={x + 8} y1={y + 8} y2={y - 10} stroke={TINTA} strokeWidth={1.5} />
      <circle cx={x - 8} cy={y - 2} r={1.8} fill={TINTA} />
      <circle cx={x + 8} cy={y + 1} r={1.8} fill={TINTA} />
    </g>
  )
}

function Puntos({ x }) {
  return (
    <g fill={TINTA}>
      <circle cx={x} cy={ARRIBA + 15} r={2} />
      <circle cx={x} cy={ARRIBA + 25} r={2} />
    </g>
  )
}

export default function MapaObra({ compases, actual = null, colores = {}, onCompas, descripcion = 'Partitura con signos de repetición' }) {
  // Posición de cada compás
  const xs = []
  let x = X0
  compases.forEach((c) => {
    if (c.coda) x += SEP_CODA
    xs.push(x)
    x += ANCHO
  })
  const W = x + 6

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}
      style={{ width: '100%', maxWidth: '600px', display: 'block', margin: '0 auto', userSelect: 'none' }}>
      {/* Fondos de compás */}
      {compases.map((c, i) => {
        const color = colores[i] || (actual === i ? '#F7E8F3' : null)
        return color && <rect key={`f${i}`} x={xs[i] - 3} y={6} width={ANCHO + 2} height={H - 10} rx={8} fill={color} />
      })}

      {/* Clave al principio */}
      <path d={GLIFOS.claveSol.d} fill={TINTA} transform={`translate(8 ${yDe(32)}) scale(${K})`} />

      {compases.map((c, i) => {
        const xm = xs[i]
        const xFin = xm + ANCHO
        const desde = i === 0 ? 0 : xm
        const off = 12 + (c.inicioRep ? 12 : 0)
        let pulso = 0
        let extra = 0
        const ultima = c.notas.length - 1
        return (
          <g key={i}>
            {/* Pentagrama (se corta antes de la coda) */}
            {[0, 1, 2, 3, 4].map((l) => (
              <line key={l} x1={desde} x2={xFin} y1={ARRIBA + l * 10} y2={ARRIBA + l * 10} stroke={LINEA} strokeWidth={0.8} />
            ))}
            {c.coda && <line x1={xm} x2={xm} y1={ARRIBA} y2={ABAJO} stroke={TINTA} strokeWidth={0.9} />}

            {/* Barra de inicio de repetición */}
            {c.inicioRep && (
              <g>
                <rect x={xm} y={ARRIBA} width={3.5} height={40} fill={TINTA} />
                <line x1={xm + 7} x2={xm + 7} y1={ARRIBA} y2={ABAJO} stroke={TINTA} strokeWidth={0.9} />
                <Puntos x={xm + 12} />
              </g>
            )}

            {/* Barra final del compás */}
            {(!c.barra || c.barra === 'normal') && <line x1={xFin} x2={xFin} y1={ARRIBA} y2={ABAJO} stroke={TINTA} strokeWidth={0.9} />}
            {c.barra === 'doble' && (
              <g stroke={TINTA} strokeWidth={0.9}>
                <line x1={xFin - 4} x2={xFin - 4} y1={ARRIBA} y2={ABAJO} />
                <line x1={xFin} x2={xFin} y1={ARRIBA} y2={ABAJO} />
              </g>
            )}
            {(c.barra === 'final' || c.barra === 'rep') && (
              <g>
                <line x1={xFin - 7} x2={xFin - 7} y1={ARRIBA} y2={ABAJO} stroke={TINTA} strokeWidth={0.9} />
                <rect x={xFin - 3.5} y={ARRIBA} width={3.5} height={40} fill={TINTA} />
                {c.barra === 'rep' && <Puntos x={xFin - 12} />}
              </g>
            )}

            {/* Casillas 1 y 2 */}
            {c.casilla && (
              <g>
                <path d={c.casilla === '1.'
                  ? `M${xm + 2} ${ARRIBA - 6} V${ARRIBA - 26} H${xFin - 6} V${ARRIBA - 6}`
                  : `M${xm + 2} ${ARRIBA - 6} V${ARRIBA - 26} H${xFin - 4}`}
                  stroke={TINTA} strokeWidth={1.2} fill="none" />
                <text x={xm + 7} y={ARRIBA - 12} fontSize={13} fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">{c.casilla}</text>
              </g>
            )}

            {/* Textos y símbolos de arriba */}
            {c.texto && (
              <text x={xFin - 2} y={ARRIBA - 10} textAnchor="end" fontSize={13} fontStyle="italic" fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">{c.texto}</text>
            )}
            {c.segno && <Segno x={xm + 12} y={ARRIBA - 20} />}
            {c.alCoda && <Coda x={xFin - 2} y={ARRIBA - 20} />}
            {c.coda && <Coda x={xm + 12} y={ARRIBA - 20} />}

            {/* Respiración */}
            {c.respira && (
              <text x={xFin - 9} y={ARRIBA - 2} fontSize={26} fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">,</text>
            )}

            {/* Notas */}
            {c.notas.map((n, j) => {
              const liga = c.liga && j === ultima && compases[i + 1]
              const figura = n.dur >= 4 ? 'redonda' : n.dur >= 2 ? 'blanca' : 'negra'
              if (n.signo) extra += LUGAR_SIGNO
              const xCab = figura === 'redonda' ? xm + (ANCHO - GLIFOS.redonda.ancho * K) / 2 + (c.inicioRep ? 6 : 0) : xm + off + pulso * PULSO + extra
              pulso += n.dur
              const y = yDe(n.paso)
              const arriba = n.paso < BASE + 4
              const adicionales = []
              for (let p = BASE - 2; p >= n.paso; p -= 2) adicionales.push(p)
              for (let p = BASE + 10; p <= n.paso; p += 2) adicionales.push(p)
              const anchoFig = figura === 'redonda' ? GLIFOS.redonda.ancho * K : ANCHO_CABEZA
              const xc = xCab + anchoFig / 2
              const yCal = Math.min(ARRIBA, arriba ? y - 34 : y) - 9
              return (
                <g key={j}>
                  {adicionales.map((p) => (
                    <line key={p} x1={xCab - 3.5} x2={xCab + anchoFig + 3.5} y1={yDe(p)} y2={yDe(p)} stroke={LINEA} strokeWidth={0.9} />
                  ))}
                  {figura !== 'redonda' && (
                    <line x1={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6} x2={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6}
                      y1={y} y2={arriba ? y - 34 : y + 34} stroke={TINTA} strokeWidth={1.1} />
                  )}
                  <path d={GLIFOS[figura].d} fill={TINTA} transform={`translate(${xCab} ${y}) scale(${K})`} />
                  {n.signo && (
                    <path d={GLIFOS[n.signo].d} fill={TINTA} transform={`translate(${xCab - GLIFOS[n.signo].ancho * K - 3} ${y}) scale(${K})`} />
                  )}
                  {liga && (() => {
                    // Ligadura hasta la primera nota del compás siguiente, del lado contrario a las plicas
                    const sig = compases[i + 1].notas[0]
                    const offSig = 12 + (compases[i + 1].inicioRep ? 12 : 0)
                    const xSig = sig.dur >= 4 ? xs[i + 1] + (ANCHO - GLIFOS.redonda.ancho * K) / 2 : xs[i + 1] + offSig
                    const x1 = xc + 3
                    const x2 = xSig + 2
                    const dy = arriba ? 9 : -9
                    const y0 = y + dy
                    return <path d={`M${x1} ${y0} Q${(x1 + x2) / 2} ${y0 + dy * 1.6} ${x2} ${y0} Q${(x1 + x2) / 2} ${y0 + dy * 1.2} ${x1} ${y0}`} fill={TINTA} stroke={TINTA} strokeWidth={0.6} />
                  })()}
                  {c.calderon && j === ultima && (
                    <g>
                      <path d={`M${xc - 8} ${yCal} A8 8 0 0 1 ${xc + 8} ${yCal}`} stroke={TINTA} strokeWidth={1.8} fill="none" />
                      <circle cx={xc} cy={yCal - 2.5} r={1.8} fill={TINTA} />
                    </g>
                  )}
                </g>
              )
            })}

            {/* Dinámicas */}
            {c.dinamica && (
              <text x={xm + off - 2} y={ABAJO + 28} fontSize={17} fontStyle="italic" fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">{c.dinamica}</text>
            )}
            {c.regulador && (() => {
              const x1 = xm + off - 2
              const x2 = xs[Math.min(i + (c.largo || 1) - 1, compases.length - 1)] + ANCHO - 10
              const yR = ABAJO + 22
              const [abierto, cerrado] = c.regulador === 'cresc' ? [x2, x1] : [x1, x2]
              return (
                <path d={`M${abierto} ${yR - 6} L${cerrado} ${yR} L${abierto} ${yR + 6}`} stroke={TINTA} strokeWidth={1.3} fill="none" />
              )
            })()}

            {/* Número de compás */}
            <circle cx={xm + ANCHO / 2} cy={H - 16} r={10} fill={actual === i ? '#8E3E7C' : '#F1EFE8'} />
            <text x={xm + ANCHO / 2} y={H - 16} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}
              fill={actual === i ? '#FFFFFF' : '#5F5E5A'} fontFamily="system-ui, sans-serif">{i + 1}</text>

            {onCompas && (
              <rect x={xm - 3} y={0} width={ANCHO + 2} height={H} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onCompas(i)} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
