import { useState } from 'react'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso } from './ui'
import { tocarPulsos, acentoDe, COMPASES, musicaDe, COLOR_TEORIA, FONDO_TEORIA, BORDE_TEORIA } from '../../lib/teoria'

// Lección 3: "Pulso y compás". Sentir el pulso, agruparlo en compases (2, 3, 4 y 6/8)
// y entender cómo marca el director. La práctica con toques queda en Ritmo.

const COMPASES_MUSICA = 4

// Indicación de compás: los dos números, uno arriba del otro
function Indicacion({ clave, chico = false }) {
  const c = COMPASES[clave]
  const t = chico ? 18 : 30
  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', lineHeight: 0.95, fontFamily: 'Georgia, serif', fontWeight: 700, fontSize: `${t}px`, color: '#1A1A18' }}>
      <span>{c.arriba}</span><span>{c.abajo}</span>
    </div>
  )
}

// Los pulsos de un compás como círculos: el primero más grande; el que suena, iluminado
function Pulsos({ clave, activo }) {
  const c = COMPASES[clave]
  const acento = acentoDe(c)
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', minHeight: '64px' }}>
      {Array.from({ length: c.pulsos }, (_, i) => {
        const tipo = acento(i)
        const tam = tipo === 'fuerte' ? 46 : tipo === 'medio' ? 36 : 28
        const on = activo === i
        return (
          <div key={i} style={{ display: 'flex', alignItems: 'center', marginLeft: c.grupos && i > 0 && i % c.grupos === 0 ? '14px' : 0 }}>
            <div style={{
              width: `${tam}px`, height: `${tam}px`, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontWeight: 700, fontSize: tipo === 'fuerte' ? '16px' : '13px',
              background: on ? COLOR_TEORIA : FONDO_TEORIA, color: on ? '#FFFFFF' : COLOR_TEORIA,
              border: `2px solid ${on ? COLOR_TEORIA : BORDE_TEORIA}`,
              transform: on ? 'scale(1.15)' : 'scale(1)', transition: 'transform 0.08s, background 0.08s',
            }}>{i + 1}</div>
          </div>
        )
      })}
    </div>
  )
}

// Suena un compás (con clics, con música o ambos) y muestra los pulsos
function Escuchar({ clave, conMusica = false, textoClic = '▶ Escuchar el pulso', textoMusica = '▶ Con música' }) {
  const c = COMPASES[clave]
  const { sonando, tocar, parar } = useReproduccion()
  const [pulso, setPulso] = useState(null)
  const empezar = (modo) => tocar(modo, (fin) => tocarPulsos({
    tempo: c.tempo, pulsos: c.pulsos * COMPASES_MUSICA, acento: acentoDe(c),
    eventos: modo === 'musica' ? musicaDe(clave) : [],
    onPulso: (i) => setPulso(i % c.pulsos), onFin: fin,
  }), () => setPulso(null))
  return (
    <>
      <Partitura>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '4px 8px' }}>
          <Indicacion clave={clave} />
          <div style={{ flex: 1 }}><Pulsos clave={clave} activo={pulso} /></div>
        </div>
      </Partitura>
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setPulso(null) }}>■ Parar</Boton> : (
          <>
            <Boton onClick={() => empezar('clic')}>{textoClic}</Boton>
            {conMusica && <Boton onClick={() => empezar('musica')}>{textoMusica}</Boton>}
          </>
        )}
      </Botonera>
    </>
  )
}

// Dibujo de cómo marca el director, con un punto que salta de pulso en pulso
const MARCAS = {
  2: [[100, 132], [128, 46]],
  3: [[100, 132], [160, 88], [100, 34]],
  4: [[100, 132], [42, 90], [158, 90], [100, 34]],
}
// Trazos del gesto: el último pulso cae recto al 1, que rebota hacia el siguiente
const TRAZOS = {
  2: 'M128 46 Q92 62 100 132 M100 132 Q136 116 128 46',
  3: 'M100 34 L100 132 M100 132 Q142 128 160 88 M160 88 Q152 36 100 34',
  4: 'M100 34 L100 132 M100 132 Q76 98 42 90 M42 90 Q100 124 158 90 M158 90 Q150 40 100 34',
}
function Marcacion({ n, activo }) {
  const pts = MARCAS[n]
  const camino = TRAZOS[n]
  const pos = activo != null ? pts[activo % n] : null
  return (
    <svg viewBox="0 0 200 160" style={{ width: '100%', maxWidth: '240px', display: 'block', margin: '0 auto' }} role="img" aria-label={`Marcación en ${n}`}>
      <path d={camino} stroke={BORDE_TEORIA} strokeWidth={3} fill="none" strokeDasharray="5 5" />
      {pts.map(([x, y], i) => (
        <g key={i}>
          <circle cx={x} cy={y} r={13} fill="#FFFFFF" stroke={COLOR_TEORIA} strokeWidth={2} />
          <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill={COLOR_TEORIA} fontFamily="system-ui, sans-serif">{i + 1}</text>
        </g>
      ))}
      {pos && (
        <g style={{ transform: `translate(${pos[0]}px, ${pos[1]}px)`, transition: 'transform 0.18s ease-out' }}>
          <circle r={13} fill={COLOR_TEORIA} />
          <text textAnchor="middle" dominantBaseline="central" fontSize={13} fontWeight={700} fill="#FFFFFF" fontFamily="system-ui, sans-serif">{(activo % n) + 1}</text>
        </g>
      )}
    </svg>
  )
}

function Director() {
  const [n, setN] = useState(4)
  const [pulso, setPulso] = useState(null)
  const { sonando, tocar, parar } = useReproduccion()
  const clave = { 2: '2/4', 3: '3/4', 4: '4/4' }[n]
  const c = COMPASES[clave]
  const empezar = () => tocar('d', (fin) => tocarPulsos({
    tempo: c.tempo * 0.8, pulsos: n * 4, acento: acentoDe(c), onPulso: setPulso, onFin: fin,
  }), () => setPulso(null))
  return (
    <>
      <Botonera>
        {[2, 3, 4].map((x) => (
          <Boton key={x} activo={n === x} onClick={() => { parar(); setPulso(null); setN(x) }}>En {x}</Boton>
        ))}
      </Botonera>
      <Partitura><Marcacion n={n} activo={pulso} /></Partitura>
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setPulso(null) }}>■ Parar</Boton> : <Boton onClick={empezar}>▶ Ver la marcación</Boton>}
      </Botonera>
    </>
  )
}

// Repaso: escuchar una música sin ver nada y decir si va en 3 o en 4
function EscucharYElegir({ clave, onOk }) {
  const c = COMPASES[clave]
  const { sonando, tocar, parar } = useReproduccion()
  const [elegida, setElegida] = useState(null)
  const correcta = c.pulsos
  const ok = elegida === correcta
  const empezar = () => tocar('m', (fin) => tocarPulsos({
    tempo: c.tempo, pulsos: c.pulsos * COMPASES_MUSICA, acento: acentoDe(c), eventos: musicaDe(clave), clic: false, onFin: fin,
  }))
  return (
    <>
      <Caja><b>Escuchá esta música. ¿Va en 3 o en 4?</b><br />Buscá el pulso fuerte y contá cuántos hay hasta el siguiente.</Caja>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : <Boton onClick={empezar}>▶ Escuchar</Boton>}
      </Botonera>
      <Botonera>
        {[3, 4].map((x) => (
          <Boton key={x} activo={elegida === x} onClick={() => { if (ok) return; setElegida(x); if (x === correcta) onOk() }}>En {x}</Boton>
        ))}
      </Botonera>
      {elegida != null && (ok
        ? <Caja tono="ok">¡Correcto! Va en {correcta}: {correcta === 3 ? 'UN-dos-tres, como un vals' : 'UN-dos-tres-cuatro, como una marcha'}.</Caja>
        : <Caja tono="mal">No es esa. Volvé a escuchar y contá desde cada pulso fuerte.</Caja>)}
    </>
  )
}

const PREGUNTAS = [
  { componente: ({ onOk }) => <EscucharYElegir clave="3/4" onOk={onOk} /> },
  { componente: ({ onOk }) => <EscucharYElegir clave="4/4" onOk={onOk} /> },
  {
    texto: 'En un compás de 3/4, ¿qué indica el número de arriba?',
    opciones: ['Que hay 3 pulsos en cada compás', 'Que la obra tiene 3 partes', 'Que se canta a 3 voces'],
    correcta: 0,
    explicacion: 'El número de arriba dice cuántos pulsos entran en cada compás.',
  },
  {
    texto: 'Una obra en 6/8 va rápido. ¿Cómo la suele marcar el director?',
    opciones: ['En 6', 'En 2', 'En 3'],
    correcta: 1,
    explicacion: 'Marca los dos pulsos grandes; cada uno se divide en tres.',
  },
]

export default function LeccionPulso({ onCompletar, siguiente, onSiguiente, onVolver, onIrRitmo }) {
  return (
    <Leccion pasos={[
      {
        render: () => (
          <>
            <Titulo>El pulso</Titulo>
            <Caja>
              El <b>pulso</b> es el latido de la música: un golpe parejo que sigue aunque la melodía cambie. Es lo que marcás con el
              pie sin darte cuenta. Escuchá la música y seguí el clic.
            </Caja>
            <Escuchar clave="4/4" conMusica textoClic="▶ Solo el pulso" textoMusica="▶ Música con pulso" />
            <Caja tono="tip">Cantar en grupo es, antes que nada, compartir el mismo pulso.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>El compás</Titulo>
            <Caja>
              Los pulsos se agrupan: uno <b>fuerte</b> y después otros más débiles. Cada grupo es un <b>compás</b>.
              Al principio de la partitura lo indican dos números: el de <b>arriba</b> dice <b>cuántos pulsos</b> tiene cada compás.
            </Caja>
            <Titulo><span style={{ fontSize: '16px' }}>En 4: una marcha</span></Titulo>
            <Escuchar clave="4/4" conMusica />
            <Titulo><span style={{ fontSize: '16px' }}>En 3: un vals</span></Titulo>
            <Escuchar clave="3/4" conMusica />
            <Titulo><span style={{ fontSize: '16px' }}>En 2: una polca</span></Titulo>
            <Escuchar clave="2/4" conMusica />
            <Caja tono="tip">El número de abajo dice qué figura vale un pulso. No hace falta que lo recuerdes: con el de arriba alcanza.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>El 6/8</Titulo>
            <Caja>
              El <b>6/8</b> confunde porque tiene 6, pero se siente en <b>2 pulsos grandes</b>, cada uno dividido en tres:
              <b> UN</b>-dos-tres-<b>DOS</b>-dos-tres. Tiene un balanceo, como una canción de cuna o una barcarola.
            </Caja>
            <Escuchar clave="6/8" conMusica />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Cómo marca el director</Titulo>
            <Caja>
              El director dibuja el compás con la mano. El pulso <b>1 siempre va hacia abajo</b> y el último, hacia arriba.
              Si sabés en cuánto va la obra, podés seguir su mano y saber en qué pulso está.
            </Caja>
            <Director />
            <Caja tono="tip">Cuando el director dice "lo marco en 2" o "va en 1", está eligiendo cuántos gestos hace por compás, no cambiando la música.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            accionExtra={onIrRitmo ? { texto: '🥁 Practicalo en Ritmo →', onClick: onIrRitmo } : null}
            textoFinal="Ya sabés qué es el pulso, cómo se agrupa en compases de 2, 3, 4 y 6/8, y cómo lo marca el director. Para practicar marcando el ritmo vos, andá a Ritmo." />
        ),
      },
    ]} />
  )
}
