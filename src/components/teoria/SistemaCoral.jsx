import { GLIFOS, ESCALA_GLIFO } from '../../lib/glifosMusicales'
import { COLOR_TEORIA } from '../../lib/teoria'

// Un sistema de partitura coral SATB: cuatro pentagramas unidos, con claves, compás 4/4 (opcional),
// barras de compás y número de compás al principio. Se pueden resaltar renglones, compases y la nota
// que está sonando, y tocar un renglón o un compás.
//
// frase: { S: [compás][nota{paso,dur}], A, T, B } — los tenores se escriben en clave de sol con un 8.

export const VOCES_SATB = ['S', 'A', 'T', 'B']
const ETIQUETA = { S: 'Sop.', A: 'Cont.', T: 'Ten.', B: 'Bajo' }
const CLAVE = { S: 'sol', A: 'sol', T: 'sol', B: 'fa' }
const BASE = { sol: 30, fa: 18 } // paso de la línea de abajo
const PASO_CLAVE = { sol: 32, fa: 24 }

const K = ESCALA_GLIFO
const MITAD = 5 // medio espacio (con 10 entre líneas)
const X_SIS = 40 // línea que une los pentagramas
const ARRIBA = 26 // lugar para el número de compás
const SEP = 72 // distancia entre pentagramas
const PULSO = 21
const ANCHO_COMPAS = 4 * PULSO + 10
const TINTA = '#1A1A18'
const LINEA = '#6E6C64'
const ANCHO_CABEZA = GLIFOS.negra.ancho * K

export default function SistemaCoral({
  frase, desde, hasta, numero = desde + 1, conCompas = false, final = false,
  resaltes = {}, // { S: color } fondo de renglón
  compasResaltado = null, colorCompas = '#F7E8F3',
  notaActiva = null, // { voz, compas, i }
  onPentagrama, onCompas, descripcion = 'Partitura coral',
}) {
  const xClave = X_SIS + 8
  const xMetrica = xClave + 30
  const x0 = xMetrica + (conCompas ? 20 : 0) + 4
  const n = hasta - desde
  const W = x0 + n * ANCHO_COMPAS + 4
  const top = (i) => ARRIBA + i * SEP
  const fondo = (i) => top(i) + 40
  const H = fondo(3) + 26
  const yDe = (paso, i) => fondo(i) - (paso - BASE[CLAVE[VOCES_SATB[i]]]) * MITAD
  const xFin = x0 + n * ANCHO_COMPAS
  const xCompas = (mi) => x0 + mi * ANCHO_COMPAS

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}
      style={{ width: '100%', maxWidth: '560px', display: 'block', margin: '0 auto', userSelect: 'none' }}>
      {/* Fondos: renglones y compás resaltados */}
      {VOCES_SATB.map((v, i) => resaltes[v] && (
        <rect key={v} x={0} y={top(i) - 13} width={W} height={66} rx={8} fill={resaltes[v]} />
      ))}
      {compasResaltado != null && compasResaltado >= desde && compasResaltado < hasta && (
        <rect x={xCompas(compasResaltado - desde) - (compasResaltado === desde ? 8 : 2)} y={top(0) - 12}
          width={ANCHO_COMPAS + (compasResaltado === desde ? 6 : 0)} height={fondo(3) - top(0) + 24} rx={6} fill={colorCompas} />
      )}

      {/* Número de compás */}
      <text x={X_SIS - 2} y={ARRIBA - 11} fontSize={12} fontStyle="italic" fontWeight={600} fill="#5F5E5A" fontFamily="Georgia, serif">{numero}</text>

      {/* Llave del sistema */}
      <rect x={X_SIS - 6} y={top(0) - 3} width={3.2} height={fondo(3) - top(0) + 6} fill={TINTA} />
      <path d={`M${X_SIS - 6} ${top(0) - 3} q7 -2 9 -8`} stroke={TINTA} strokeWidth={1.6} fill="none" />
      <path d={`M${X_SIS - 6} ${fondo(3) + 3} q7 2 9 8`} stroke={TINTA} strokeWidth={1.6} fill="none" />
      <line x1={X_SIS} x2={X_SIS} y1={top(0)} y2={fondo(3)} stroke={LINEA} strokeWidth={1} />

      {VOCES_SATB.map((v, i) => {
        const clave = CLAVE[v]
        return (
          <g key={v}>
            <text x={2} y={top(i) + 24} fontSize={10.5} fontWeight={resaltes[v] ? 700 : 500} fill="#5F5E5A" fontFamily="system-ui, sans-serif">{ETIQUETA[v]}</text>
            {[0, 1, 2, 3, 4].map((l) => (
              <line key={l} x1={X_SIS} x2={xFin} y1={top(i) + l * 10} y2={top(i) + l * 10} stroke={LINEA} strokeWidth={0.8} />
            ))}
            <path d={GLIFOS[clave === 'sol' ? 'claveSol' : 'claveFa'].d} fill={TINTA}
              transform={`translate(${xClave} ${yDe(PASO_CLAVE[clave], i)}) scale(${K})`} />
            {v === 'T' && (
              <text x={xClave + 8} y={fondo(i) + 23} fontSize={9.5} fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">8</text>
            )}
            {conCompas && [10, 30].map((dy) => (
              <text key={dy} x={xMetrica + 2} y={top(i) + dy} dominantBaseline="central" fontSize={21} fontWeight={700} fill={TINTA} fontFamily="Georgia, serif">4</text>
            ))}
            {/* Barras de compás */}
            {Array.from({ length: n }, (_, mi) => {
              const x = xCompas(mi + 1) - 2
              if (final && mi === n - 1) {
                return (
                  <g key={mi}>
                    <line x1={x - 4} x2={x - 4} y1={top(i)} y2={fondo(i)} stroke={TINTA} strokeWidth={0.9} />
                    <rect x={x - 1.5} y={top(i)} width={3.5} height={40} fill={TINTA} />
                  </g>
                )
              }
              return <line key={mi} x1={x} x2={x} y1={top(i)} y2={fondo(i)} stroke={TINTA} strokeWidth={0.9} />
            })}
            {/* Notas */}
            {Array.from({ length: n }, (_, mi) => {
              const m = desde + mi
              let pulso = 0
              return (frase[v][m] || []).map((nota, j) => {
                const xCab = xCompas(mi) + 6 + pulso * PULSO
                pulso += nota.dur
                const y = yDe(nota.paso, i)
                const base = BASE[clave]
                const activa = notaActiva && notaActiva.voz === v && notaActiva.compas === m && notaActiva.i === j
                const color = activa ? COLOR_TEORIA : TINTA
                const figura = nota.dur >= 4 ? 'redonda' : nota.dur >= 2 ? 'blanca' : 'negra'
                const arriba = nota.paso < base + 4
                const adicionales = []
                for (let p = base - 2; p >= nota.paso; p -= 2) adicionales.push(p)
                for (let p = base + 10; p <= nota.paso; p += 2) adicionales.push(p)
                return (
                  <g key={`${mi}-${j}`}>
                    {activa && <circle cx={xCab + ANCHO_CABEZA / 2} cy={y} r={10} fill={COLOR_TEORIA} opacity={0.18} />}
                    {adicionales.map((p) => (
                      <line key={p} x1={xCab - 3.5} x2={xCab + ANCHO_CABEZA + 3.5} y1={yDe(p, i)} y2={yDe(p, i)} stroke={LINEA} strokeWidth={0.9} />
                    ))}
                    {figura !== 'redonda' && (
                      <line x1={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6} x2={arriba ? xCab + ANCHO_CABEZA - 0.6 : xCab + 0.6}
                        y1={y} y2={arriba ? y - 34 : y + 34} stroke={color} strokeWidth={1.1} />
                    )}
                    <path d={GLIFOS[figura].d} fill={color} transform={`translate(${xCab} ${y}) scale(${K})`} />
                  </g>
                )
              })
            })}
          </g>
        )
      })}

      {/* Zonas para tocar */}
      {onPentagrama && VOCES_SATB.map((v, i) => (
        <rect key={v} x={0} y={top(i) - 13} width={W} height={66} fill="transparent" style={{ cursor: 'pointer' }}
          onClick={() => onPentagrama(v)} />
      ))}
      {onCompas && Array.from({ length: n }, (_, mi) => (
        <rect key={mi} x={xCompas(mi) - (mi === 0 ? 8 : 2)} y={0} width={ANCHO_COMPAS + (mi === 0 ? 6 : 0)} height={H}
          fill="transparent" style={{ cursor: 'pointer' }} onClick={() => onCompas(desde + mi)} />
      ))}
    </svg>
  )
}
