import { GLIFOS, GLIFOS_RITMO as R } from '../lib/glifosMusicales'

// Figuras de ritmo dibujadas con los mismos contornos que usa la partitura (Gonville), sobre una sola línea.
// Unidades: las de la fuente (1000 por em, y hacia abajo). La línea está en y = 0.

const NEGRO = '#1A1A18'
export const VERDE_OK = '#2F9E6F'
export const ROJO_MAL = '#D04A43'
const Y_MIN = -1400
const Y_MAX = 520
const LARGO_PLICA = 1300
const ANCHO_PLICA = 34

const esPuntillo = (dur) => dur === 3 || dur === 1.5 || dur === 0.75
const baseDe = (dur) => (esPuntillo(dur) ? dur / 1.5 : dur)

// Qué dibujar y cuánto ocupa
function medir({ dur, silencio }) {
  const base = baseDe(dur)
  const punto = esPuntillo(dur)
  if (silencio) {
    const g = base >= 4 ? R.restRedonda : base >= 2 ? R.restBlanca : base >= 1 ? R.restNegra : base >= 0.5 ? R.restCorchea : R.restSemi
    return { tipo: 'silencio', g, punto, w: g.x1 + (punto ? 230 : 0) }
  }
  const cab = base >= 4 ? GLIFOS.redonda : base >= 2 ? GLIFOS.blanca : GLIFOS.negra
  const banderas = base === 0.5 ? R.banderaCorchea : base === 0.25 ? R.banderaSemi : null
  const conPlica = base < 4
  const w = Math.max(cab.ancho + (punto ? 230 : 0), banderas ? cab.ancho + 300 : 0)
  return { tipo: 'nota', cab, banderas, conPlica, punto, w }
}

function dibujar(m, x, color, clave) {
  const e = []
  if (m.tipo === 'silencio') {
    e.push(<path key={`${clave}s`} d={m.g.d} fill={color} transform={`translate(${x} 0)`} />)
    if (m.punto) e.push(<circle key={`${clave}p`} cx={x + m.g.x1 + 110} cy={-170} r={52} fill={color} />)
    return e
  }
  e.push(<path key={`${clave}c`} d={m.cab.d} fill={color} transform={`translate(${x} 0)`} />)
  const xPlica = x + m.cab.ancho - ANCHO_PLICA / 2
  if (m.conPlica) e.push(<line key={`${clave}l`} x1={xPlica} y1={-60} x2={xPlica} y2={-LARGO_PLICA} stroke={color} strokeWidth={ANCHO_PLICA} />)
  if (m.banderas) e.push(<path key={`${clave}f`} d={m.banderas.d} fill={color} transform={`translate(${xPlica - ANCHO_PLICA / 2} ${-LARGO_PLICA})`} />)
  if (m.punto) e.push(<circle key={`${clave}p`} cx={x + m.cab.ancho + 110} cy={-170} r={52} fill={color} />)
  return e
}

const nombre = (f) => {
  const n = { 4: 'redonda', 3: 'blanca con puntillo', 2: 'blanca', 1.5: 'negra con puntillo', 1: 'negra', 0.75: 'corchea con puntillo', 0.5: 'corchea', 0.25: 'semicorchea' }[f.dur] || 'figura'
  return (f.silencio ? 'silencio de ' : '') + n
}

/** Una figura suelta (para los botones). "alto" en px. */
export function FiguraIcono({ fig, alto = 46, color = NEGRO }) {
  const m = medir(fig)
  const ancho = m.w + 240
  return (
    <svg role="img" aria-label={nombre(fig)} viewBox={`-120 ${Y_MIN} ${ancho} ${Y_MAX - Y_MIN}`} height={alto} width={(alto * ancho) / (Y_MAX - Y_MIN)} style={{ display: 'block' }}>
      <line x1={-120} y1={0} x2={ancho - 120} y2={0} stroke="#C9C6BB" strokeWidth={26} />
      {dibujar(m, 0, color, 'i')}
    </svg>
  )
}

const MARGEN = 260
const ancho = (f, m) => Math.max(m.w + 260, 430 + 760 * Math.sqrt(f.dur))

/**
 * Un compás escrito: figuras repartidas según su duración.
 * estados: arreglo de true/false por figura (verde / rojo) o null. onFigura(i): tocar una figura.
 */
export function CompasRitmo({ figuras, pulsos, estados = null, onFigura = null, vacio = 'Compás vacío', seleccionado = false }) {
  const ms = figuras.map(medir)
  let x = MARGEN
  const lugares = figuras.map((f, i) => { const l = { x, w: ancho(f, ms[i]) }; x += l.w; return l })
  const total = Math.max(x, pulsos * 1000 + MARGEN)
  const viewH = Y_MAX - Y_MIN
  return (
    <svg role="img" aria-label={figuras.length ? figuras.map(nombre).join(', ') : vacio} viewBox={`0 ${Y_MIN} ${total} ${viewH}`}
      style={{ display: 'block', width: '100%', height: 'auto', maxHeight: '120px', background: seleccionado ? '#F5F1FC' : 'transparent', borderRadius: '8px' }} preserveAspectRatio="xMinYMid meet">
      <line x1={0} y1={0} x2={total} y2={0} stroke="#B4B2A9" strokeWidth={26} />
      <line x1={14} y1={-420} x2={14} y2={420} stroke="#5F5E5A" strokeWidth={34} />
      <line x1={total - 14} y1={-420} x2={total - 14} y2={420} stroke="#5F5E5A" strokeWidth={34} />
      {!figuras.length && <text x={total / 2} y={90} textAnchor="middle" fontSize={300} fill="#B4B2A9" style={{ fontFamily: 'system-ui, sans-serif' }}>{vacio}</text>}
      {figuras.map((f, i) => {
        const color = estados ? (estados[i] ? VERDE_OK : ROJO_MAL) : NEGRO
        const l = lugares[i]
        return (
          <g key={i} style={onFigura ? { cursor: 'pointer' } : undefined} onClick={onFigura ? () => onFigura(i) : undefined}>
            {onFigura && <rect x={l.x - 20} y={Y_MIN} width={l.w} height={viewH} fill="transparent" />}
            {dibujar(ms[i], l.x + 40, color, `f${i}`)}
          </g>
        )
      })}
    </svg>
  )
}
