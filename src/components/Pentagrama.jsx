import { GLIFOS, ESCALA_GLIFO } from '../lib/glifosMusicales'

// Pentagrama sencillo para ejercicios de oído: clave de sol o de fa, armadura, notas con figura
// (negra, blanca o redonda), alteraciones, acordes y notas que se pueden tocar o colorear.
//
// columnas: [{ notas: [{ paso, alter, figura, estado, color }], etiqueta, vacia }]
//   estado: 'normal' | 'sel' | 'correcta' | 'mala' | 'fantasma'
// armadura: { tipo: 'sostenido' | 'bemol', n } o null

const BASE = { sol: 30, fa: 18 } // paso de la línea de abajo (Mi4 en sol, Sol2 en fa)
const PASO_CLAVE = { sol: 32, fa: 24 } // línea donde "apoya" la clave: Sol4 / Fa3
const PASOS_ARMADURA = {
  sol: { sostenido: [38, 35], bemol: [34, 37] },
  fa: { sostenido: [24, 21], bemol: [20, 23] },
}
const TINTA = '#1A1A18'
const COLORES = { normal: TINTA, sel: '#0F6E56', correcta: '#2F9E6F', mala: '#D04A43', fantasma: '#B4B2A9' }

export default function Pentagrama({
  clave = 'sol', armadura = null, columnas, ls = 10, anchoCol, activa = -1, pasoVacio,
  pasoMin, pasoMax, onNota, onColumna, descripcion = 'Pentagrama', estilo,
}) {
  const k = ESCALA_GLIFO * (ls / 10)
  const mitad = ls / 2
  const base = BASE[clave]
  const anchoCabeza = GLIFOS.negra.ancho * k
  const aCol = anchoCol || ls * 5.2
  const nArm = armadura ? armadura.n : 0
  const pasoArm = ls * 0.95

  const xClave = ls * 0.5
  const xArm = xClave + GLIFOS[clave === 'sol' ? 'claveSol' : 'claveFa'].ancho * k + ls * 0.6
  const x0 = xArm + nArm * pasoArm + ls * 1.2
  const Wcols = x0 + columnas.length * aCol + ls * 0.4
  const W = Math.max(Wcols, ls * 26) // un mínimo de ancho para que pocas notas no se vean enormes
  const corrimiento = (W - Wcols) / 2 // las notas quedan centradas en el espacio que sobra

  // Alto: lo que pidan las notas (con la plica) y, como mínimo, el pentagrama con un poco de aire
  const mitadLinea = base + 4
  // La clave de sol asoma unos 2,5 pasos por arriba del pentagrama y casi 3 por abajo
  let hi = clave === 'sol' ? base + 11 : base + 9, lo = clave === 'sol' ? base - 3 : base - 1
  for (const c of columnas) {
    for (const n of c.notas || []) {
      const conPlica = n.figura !== 'redonda'
      const abajo = conPlica && n.paso >= mitadLinea
      lo = Math.min(lo, n.paso - (abajo ? 7 : 1))
      hi = Math.max(hi, n.paso + (conPlica && !abajo ? 7 : 1))
    }
    if (c.vacia && pasoVacio != null) { lo = Math.min(lo, pasoVacio - 1); hi = Math.max(hi, pasoVacio + 1) }
  }
  if (pasoMin != null) lo = Math.min(lo, pasoMin - 1)
  if (pasoMax != null) hi = Math.max(hi, pasoMax + 1)
  const hayEtiquetas = columnas.some((c) => c.etiqueta)
  const padArriba = ls * 0.3
  const yDe = (paso) => padArriba + (hi - paso) * mitad
  const altoEtiq = hayEtiquetas ? ls * 1.9 : 0
  const H = padArriba + (hi - lo) * mitad + ls * 0.3 + altoEtiq

  const lineas = [0, 2, 4, 6, 8].map((i) => base + i)

  const clicColumna = (e, c) => {
    if (!onColumna) return
    const r = e.currentTarget.ownerSVGElement.getBoundingClientRect()
    const y = ((e.clientY - r.top) / r.height) * H
    onColumna(c, Math.round(hi - (y - padArriba) / mitad))
  }

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={descripcion}
      style={{ width: '100%', maxWidth: `${W * 1.5}px`, display: 'block', margin: '0 auto', ...estilo }}>
      {lineas.map((p) => (
        <line key={p} x1={0} x2={W} y1={yDe(p)} y2={yDe(p)} stroke="#6E6C64" strokeWidth={ls * 0.08} />
      ))}
      <path d={GLIFOS[clave === 'sol' ? 'claveSol' : 'claveFa'].d} fill={TINTA}
        transform={`translate(${xClave} ${yDe(PASO_CLAVE[clave])}) scale(${k})`} />
      {armadura && PASOS_ARMADURA[clave][armadura.tipo].slice(0, armadura.n).map((p, i) => (
        <path key={i} d={GLIFOS[armadura.tipo].d} fill={TINTA}
          transform={`translate(${xArm + i * pasoArm} ${yDe(p)}) scale(${k})`} />
      ))}

      {columnas.map((c, ci) => {
        const cx = x0 + corrimiento + (ci + 0.5) * aCol
        const xCab = cx - anchoCabeza / 2
        const notas = (c.notas || []).slice().sort((a, b) => a.paso - b.paso)
        // Alteraciones: si dos quedan cerca, la segunda se corre a la izquierda
        let ultimoPaso = -99, nivelAlt = 0
        return (
          <g key={ci}>
            {ci === activa && <rect x={cx - aCol / 2 + 2} y={0} width={aCol - 4} height={H - altoEtiq} rx={ls * 0.6} fill="#E1F5EE" opacity="0.9" />}
            {onColumna && (
              <rect x={cx - aCol / 2} y={0} width={aCol} height={H} fill="transparent" style={{ cursor: 'pointer' }}
                onClick={(e) => clicColumna(e, ci)} />
            )}
            {c.vacia && pasoVacio != null && (
              <ellipse cx={cx} cy={yDe(pasoVacio)} rx={anchoCabeza * 0.62} ry={ls * 0.52} fill="none" stroke={c.seleccionada ? '#0F6E56' : '#B4B2A9'}
                strokeWidth={ls * 0.12} strokeDasharray={`${ls * 0.25} ${ls * 0.25}`} pointerEvents="none" />
            )}
            {notas.map((n, j) => {
              const y = yDe(n.paso)
              const color = n.color || COLORES[n.estado || 'normal']
              const figura = n.figura || 'negra'
              const conPlica = figura !== 'redonda'
              const plicaAbajo = n.paso >= mitadLinea
              const op = n.estado === 'fantasma' ? 0.7 : 1
              const ledgers = []
              for (let p = base - 2; p >= n.paso; p -= 2) ledgers.push(p)
              for (let p = base + 10; p <= n.paso; p += 2) ledgers.push(p)
              let alt = null
              if (n.alter) {
                nivelAlt = n.paso - ultimoPaso <= 5 ? nivelAlt + 1 : 0
                ultimoPaso = n.paso
                const g = n.alter > 0 ? GLIFOS.sostenido : GLIFOS.bemol
                alt = { d: g.d, x: xCab - (n.alter > 0 ? 7.2 : 6.2) * (ls / 10) - 1.2 * (ls / 10) - nivelAlt * 8.2 * (ls / 10) }
              }
              const resaltada = n.estado === 'sel'
              return (
                <g key={j} opacity={op}>
                  {resaltada && <circle cx={cx} cy={y} r={ls * 1.15} fill="#CDE7DC" />}
                  {ledgers.map((p) => (
                    <line key={p} x1={xCab - ls * 0.35} x2={xCab + anchoCabeza + ls * 0.35} y1={yDe(p)} y2={yDe(p)} stroke="#6E6C64" strokeWidth={ls * 0.09} />
                  ))}
                  {alt && <path d={alt.d} fill={color} transform={`translate(${alt.x} ${y}) scale(${k})`} />}
                  {conPlica && (
                    <line x1={plicaAbajo ? xCab + ls * 0.06 : xCab + anchoCabeza - ls * 0.06} x2={plicaAbajo ? xCab + ls * 0.06 : xCab + anchoCabeza - ls * 0.06}
                      y1={y} y2={plicaAbajo ? y + ls * 3.4 : y - ls * 3.4} stroke={color} strokeWidth={ls * 0.11} />
                  )}
                  <path d={GLIFOS[figura].d} fill={color} transform={`translate(${figura === 'redonda' ? cx - GLIFOS.redonda.ancho * k / 2 : xCab} ${y}) scale(${k})`} />
                  {onNota && (
                    <circle cx={cx} cy={y} r={ls * 1.7} fill="transparent" style={{ cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); onNota(ci, j, n) }} />
                  )}
                </g>
              )
            })}
            {c.etiqueta && (
              <text x={cx} y={H - ls * 0.45} textAnchor="middle" fontSize={ls * 1.1} fontWeight="600" fill="#5F5E5A" fontFamily="system-ui, sans-serif">{c.etiqueta}</text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
