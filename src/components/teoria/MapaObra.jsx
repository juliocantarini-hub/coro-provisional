import { GLIFOS, GLIFOS_RITMO, ESCALA_GLIFO } from '../../lib/glifosMusicales'

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

// Lugar que ocupa una nota: según su duración, y si lleva letra, lo que necesite la sílaba
const anchoLetra = (n) => (n?.letra ? n.letra.length * 6.6 : 0)
// (con la sílaba siguiente: la mitad de cada una, porque las sílabas van centradas debajo de su nota)
const espacioDe = (n, sig) => Math.max(n.dur * PULSO, 14, n.letra ? (anchoLetra(n) + anchoLetra(sig)) / 2 + 9 : 0) + ([3, 1.5, 0.75].includes(n.dur) ? 4 : 0)

// sinNumeros: sin el número de compás (para ejemplos sueltos). notaActiva: { compas, i } se pinta de color.
// Cada nota puede llevar letra (n.letra): se escribe debajo del pentagrama.
// armadura: [{ paso, signo: 'bemol' | 'sostenido' }] se dibuja después de la clave (solo el dibujo: el sonido lo dan las notas).
// marcadas: [{ compas, i }] notas con un círculo lila (por ejemplo, las dos de un intervalo).
export default function MapaObra({ compases, actual = null, colores = {}, onCompas, sinNumeros = false, notaActiva = null, marcadas = [], armadura = [], descripcion = 'Partitura con signos de repetición' }) {
  // Posición de cada compás
  // Ancho de cada compás: normalmente fijo, pero se agranda si las notas llevan letra y no entra
  const anchos = compases.map((c) => {
    let px = 12 + (c.inicioRep ? 12 : 0)
    c.notas.forEach((n, j) => {
      if (n.signo) px += LUGAR_SIGNO
      px += espacioDe(n, c.notas[j + 1])
    })
    return Math.max(ANCHO, px + 10)
  })
  const xs = []
  let x = X0 + armadura.length * 10
  compases.forEach((c, i) => {
    if (c.coda) x += SEP_CODA
    xs.push(x)
    x += anchos[i]
  })
  const W = x + 6

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}
      style={{ width: '100%', maxWidth: `${Math.min(600, Math.round(W * 1.4))}px`, display: 'block', margin: '0 auto', userSelect: 'none' }}>
      {/* Fondos de compás */}
      {compases.map((c, i) => {
        const color = colores[i] || (actual === i ? '#F7E8F3' : null)
        return color && <rect key={`f${i}`} x={xs[i] - 3} y={6} width={anchos[i] + 2} height={H - 10} rx={8} fill={color} />
      })}

      {/* Clave al principio */}
      <path d={GLIFOS.claveSol.d} fill={TINTA} transform={`translate(8 ${yDe(32)}) scale(${K})`} />
      {armadura.map((a, k) => (
        <path key={k} d={GLIFOS[a.signo].d} fill={TINTA} transform={`translate(${X0 - 14 + k * 10} ${yDe(a.paso)}) scale(${K})`} />
      ))}

      {compases.map((c, i) => {
        const xm = xs[i]
        const xFin = xm + anchos[i]
        const desde = i === 0 ? 0 : xm
        const off = 12 + (c.inicioRep ? 12 : 0)
        let px = 0
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
              const puntillo = [3, 1.5, 0.75].includes(n.dur)
              const base = puntillo ? n.dur / 1.5 : n.dur
              const figura = base >= 4 ? 'redonda' : base >= 2 ? 'blanca' : 'negra'
              const bandera = base === 0.5 ? GLIFOS_RITMO.banderaCorchea : base === 0.25 ? GLIFOS_RITMO.banderaSemi : null
              if (n.signo) extra += LUGAR_SIGNO
              const xCab = figura === 'redonda' && c.notas.length === 1 ? xm + (anchos[i] - GLIFOS.redonda.ancho * K) / 2 + (c.inicioRep ? 6 : 0) : xm + off + px + extra
              px += espacioDe(n, c.notas[j + 1])
              const activa = notaActiva && notaActiva.compas === i && notaActiva.i === j
              const marcada = marcadas.some((m) => m.compas === i && m.i === j)
              const tinta = activa ? '#8E3E7C' : TINTA
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
                  {marcada && <circle cx={xc} cy={y} r={11} fill="none" stroke="#8E3E7C" strokeWidth={1.6} />}
                  {activa && <circle cx={xc} cy={y} r={10} fill="#8E3E7C" opacity={0.18} />}
                  {figura !== 'redonda' && (
                    <line x1={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6} x2={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6}
                      y1={y} y2={arriba ? y - 34 : y + 34} stroke={tinta} strokeWidth={1.1} />
                  )}
                  {bandera && (
                    <path d={bandera.d} fill={tinta}
                      transform={`translate(${arriba ? xCab + ANCHO_CABEZA - 1.1 : xCab + 0.1} ${arriba ? y - 34 : y + 34}) scale(${K} ${arriba ? K : -K})`} />
                  )}
                  <path d={GLIFOS[figura].d} fill={tinta} transform={`translate(${xCab} ${y}) scale(${K})`} />
                  {puntillo && <circle cx={xCab + anchoFig + 4.5} cy={(n.paso - BASE) % 2 === 0 ? y - 2.5 : y} r={1.7} fill={tinta} />}
                  {n.letra && (
                    <text x={xc} y={ABAJO + 40} textAnchor="middle" fontSize={12.5} fill={activa ? '#8E3E7C' : '#1A1A18'} fontWeight={activa ? 700 : 400}
                      fontFamily="Georgia, serif">{n.letra}</text>
                  )}
                  {n.signo && (
                    <path d={GLIFOS[n.signo].d} fill={TINTA} transform={`translate(${xCab - GLIFOS[n.signo].ancho * K - 3} ${y}) scale(${K})`} />
                  )}
                  {liga && (() => {
                    // Ligadura hasta la primera nota del compás siguiente, del lado contrario a las plicas
                    const sig = compases[i + 1].notas[0]
                    const offSig = 12 + (compases[i + 1].inicioRep ? 12 : 0)
                    const xSig = sig.dur >= 4 ? xs[i + 1] + (anchos[i + 1] - GLIFOS.redonda.ancho * K) / 2 : xs[i + 1] + offSig
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
              const fin = Math.min(i + (c.largo || 1) - 1, compases.length - 1)
              const x2 = xs[fin] + anchos[fin] - 10
              const yR = ABAJO + 22
              const [abierto, cerrado] = c.regulador === 'cresc' ? [x2, x1] : [x1, x2]
              return (
                <path d={`M${abierto} ${yR - 6} L${cerrado} ${yR} L${abierto} ${yR + 6}`} stroke={TINTA} strokeWidth={1.3} fill="none" />
              )
            })()}

            {/* Número de compás */}
            {!sinNumeros && <>
            <circle cx={xm + anchos[i] / 2} cy={H - 16} r={10} fill={actual === i ? '#8E3E7C' : '#F1EFE8'} />
            <text x={xm + anchos[i] / 2} y={H - 16} textAnchor="middle" dominantBaseline="central" fontSize={12} fontWeight={700}
              fill={actual === i ? '#FFFFFF' : '#5F5E5A'} fontFamily="system-ui, sans-serif">{i + 1}</text>
            </>}

            {onCompas && (
              <rect x={xm - 3} y={0} width={anchos[i] + 2} height={H} fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onCompas(i)} />
            )}
          </g>
        )
      })}
    </svg>
  )
}
