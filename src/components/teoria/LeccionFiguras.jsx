import { useState } from 'react'
import { FiguraIcono, CompasRitmo } from '../FigurasRitmo'
import MapaObra from './MapaObra'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso } from './ui'
import { tocarPulsos, motivo, midiDe, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'

// Lección 4: "Figuras y silencios". Cuánto dura cada nota, los silencios, el puntillo y la ligadura.
// Todo se escucha con el pulso de fondo; la práctica con toques queda en Ritmo.

const NOTA = 67 // Sol4
const TEMPO = 72

// Figuras → eventos de piano (los silencios no suenan)
function eventosDe(figuras, midi = NOTA) {
  let t = 0
  const ev = []
  for (const f of figuras) {
    if (!f.silencio) ev.push({ t, midis: [f.midi ?? midi], dur: f.dur, vel: 0.7 })
    t += f.dur
  }
  return ev
}

function useTocarRitmo() {
  const { sonando, tocar, parar } = useReproduccion()
  const [pulso, setPulso] = useState(null)
  const sonar = (clave, figuras, pulsos, clic = true) => tocar(clave, (fin) => tocarPulsos({
    tempo: TEMPO, pulsos, acento: (i) => (i % 4 === 0 ? 'fuerte' : 'debil'), eventos: eventosDe(figuras), clic, resonancia: false,
    onPulso: setPulso, onFin: fin,
  }), () => setPulso(null))
  return { sonando, sonar, parar: () => { parar(); setPulso(null) }, pulso }
}

const FIGURAS = [
  { dur: 4, nombre: 'Redonda', dura: '4 pulsos' },
  { dur: 2, nombre: 'Blanca', dura: '2 pulsos' },
  { dur: 1, nombre: 'Negra', dura: '1 pulso' },
  { dur: 0.5, nombre: 'Corchea', dura: 'medio pulso' },
]

function Fila({ fig, silencio = false, r }) {
  const clave = `${silencio ? 's' : 'n'}${fig.dur}`
  const activa = r.sonando === clave
  // Las notas se repiten para llenar 4 pulsos; los silencios van entre dos negras para que se oiga el hueco
  const figuras = silencio
    ? [{ dur: 1 }, { dur: fig.dur, silencio: true }, { dur: 1 }]
    : Array.from({ length: 4 / fig.dur }, () => ({ dur: fig.dur }))
  const pulsos = silencio ? Math.ceil(2 + fig.dur) : 4
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', borderRadius: '12px', marginBottom: '6px',
      background: activa ? FONDO_TEORIA : '#FFFFFF', border: `1px solid ${activa ? COLOR_TEORIA : '#E8E6DF'}`,
    }}>
      <div style={{ width: '44px', display: 'flex', justifyContent: 'center' }}><FiguraIcono fig={{ dur: fig.dur, silencio }} alto={44} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{silencio ? `Silencio de ${fig.nombre.toLowerCase()}` : fig.nombre}</div>
        <div style={{ fontSize: '12px', color: '#888780' }}>{silencio ? `${fig.dura} sin cantar` : fig.dura}</div>
        <div style={{ height: '6px', borderRadius: '3px', marginTop: '4px', width: `${fig.dur * 25}%`, background: silencio ? '#D3D1C7' : COLOR_TEORIA }} />
      </div>
      <Boton activo={activa} onClick={() => (activa ? r.parar() : r.sonar(clave, figuras, pulsos))}>{activa ? '■' : '▶'}</Boton>
    </div>
  )
}

function Ejemplo({ figuras, pulsos, clave, r, texto = '▶ Escuchar con el pulso' }) {
  const compases = []
  let actual = []
  let suma = 0
  for (const f of figuras) {
    actual.push(f)
    suma += f.dur
    if (suma >= 4) { compases.push(actual); actual = []; suma = 0 }
  }
  if (actual.length) compases.push(actual)
  return (
    <>
      <Partitura>
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '4px' }}>
          {compases.map((c, i) => <CompasRitmo key={i} figuras={c} pulsos={4} alto={60} />)}
        </div>
      </Partitura>
      <Botonera>
        {r.sonando === clave ? <Boton onClick={r.parar}>■ Parar</Boton> : <Boton onClick={() => r.sonar(clave, figuras, pulsos)}>{texto}</Boton>}
      </Botonera>
    </>
  )
}

function PasoFiguras() {
  const r = useTocarRitmo()
  return (
    <>
      <Titulo>Notas largas y cortas</Titulo>
      <Caja>
        La forma de la nota dice <b>cuánto dura</b>, contando pulsos. Cuanto más "rellena" y con más "colita", más corta.
        Tocá ▶ para escucharlas con el pulso de fondo.
      </Caja>
      {FIGURAS.map((f) => <Fila key={f.dur} fig={f} r={r} />)}
      <Caja tono="tip">Cada figura vale el doble de la siguiente: 1 redonda = 2 blancas = 4 negras = 8 corcheas.</Caja>
    </>
  )
}

function PasoSilencios() {
  const r = useTocarRitmo()
  return (
    <>
      <Titulo>Los silencios</Titulo>
      <Caja>
        Un <b>silencio</b> es un momento sin cantar. Cada figura tiene su silencio, que dura lo mismo que ella.
      </Caja>
      {FIGURAS.map((f) => <Fila key={f.dur} fig={f} silencio r={r} />)}
      <Caja>En la partitura se ven así, mezclados con las notas:</Caja>
      <Ejemplo r={r} clave="ej" pulsos={8}
        figuras={[{ dur: 1 }, { dur: 1 }, { dur: 1, silencio: true }, { dur: 1 }, { dur: 2 }, { dur: 2, silencio: true }]} />
      <Caja tono="tip">En el silencio <b>no se deja de contar</b>: el pulso sigue. Muchas veces es el momento justo para respirar.</Caja>
    </>
  )
}

function PasoPuntillo() {
  const r = useTocarRitmo()
  return (
    <>
      <Titulo>El puntillo</Titulo>
      <Caja>
        Un <b>puntito</b> al lado de la nota le <b>suma la mitad</b> de lo que dura. Una blanca dura 2; con puntillo, 2 + 1 = <b>3 pulsos</b>.
      </Caja>
      <Ejemplo r={r} clave="p1" pulsos={8} figuras={[{ dur: 3 }, { dur: 1 }, { dur: 3 }, { dur: 1 }]} />
      <Caja>Una negra con puntillo dura un pulso y medio, y casi siempre va seguida de una corchea:</Caja>
      <Ejemplo r={r} clave="p2" pulsos={8} figuras={[{ dur: 1.5 }, { dur: 0.5 }, { dur: 2 }, { dur: 1.5 }, { dur: 0.5 }, { dur: 2 }]} />
    </>
  )
}

const LIGA = mapaLiga()
function mapaLiga() {
  return [
    { notas: motivo('C5:2 E5:2'), liga: true },
    { notas: motivo('E5:2 D5:2'), barra: 'final' },
  ]
}

function PasoLigadura() {
  const { sonando, tocar, parar } = useReproduccion()
  const ligadas = [{ m: LIGA[0].notas[0], d: 2 }, { m: LIGA[0].notas[1], d: 4 }, { m: LIGA[1].notas[1], d: 2 }]
  const sueltas = [...LIGA[0].notas, ...LIGA[1].notas].map((n) => ({ m: n, d: n.dur }))
  const sonar = (clave, lista) => tocar(clave, (fin) => {
    let t = 0
    const eventos = lista.map(({ m, d }) => { const e = { t, midis: [midiDe(m)], dur: d, vel: 0.7 }; t += d; return e })
    return tocarPulsos({ tempo: TEMPO, pulsos: 8, acento: (i) => (i % 4 === 0 ? 'fuerte' : 'debil'), eventos, onFin: fin, resonancia: false })
  })
  return (
    <>
      <Titulo>La ligadura</Titulo>
      <Caja>
        Una <b>ligadura</b> es una curva que une <b>dos notas iguales</b>. No se canta dos veces: se canta <b>una sola nota</b>,
        que dura lo que las dos juntas. Sirve, por ejemplo, para que una nota pase de un compás al siguiente.
      </Caja>
      <Partitura><MapaObra compases={LIGA} /></Partitura>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : (
          <>
            <Boton onClick={() => sonar('l', ligadas)}>▶ Con la ligadura</Boton>
            <Boton onClick={() => sonar('s', sueltas)}>▶ Si no estuviera</Boton>
          </>
        )}
      </Botonera>
      <Caja tono="tip">
        Si la curva une notas <b>distintas</b>, es una <b>ligadura de expresión</b>: quiere decir que cantes esas notas unidas, sin cortar el sonido entre una y otra.
      </Caja>
    </>
  )
}

// Repaso: suena un ritmo y hay que elegir cuál de los dos es
function CualSono({ opciones, correcta, onOk }) {
  const r = useTocarRitmo()
  const [elegida, setElegida] = useState(null)
  const ok = elegida === correcta
  return (
    <>
      <Caja><b>Escuchá el ritmo. ¿Cuál de los dos sonó?</b></Caja>
      <Botonera>
        {r.sonando ? <Boton onClick={r.parar}>■ Parar</Boton> : <Boton onClick={() => r.sonar('q', opciones[correcta], 4)}>▶ Escuchar</Boton>}
      </Botonera>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {opciones.map((figs, k) => (
          <div key={k} onClick={() => { if (ok) return; setElegida(k); if (k === correcta) onOk() }} style={{
            padding: '10px', borderRadius: '12px', cursor: ok ? 'default' : 'pointer', display: 'flex', justifyContent: 'center',
            border: `1px solid ${elegida === k ? (k === correcta ? '#9FD9C5' : '#F0B7B2') : '#E8E6DF'}`,
            background: elegida === k ? (k === correcta ? '#DDF3E9' : '#FBE5E3') : '#FFFFFF',
          }}>
            <CompasRitmo figuras={figs} pulsos={4} alto={60} />
          </div>
        ))}
      </div>
      {elegida != null && (ok ? <Caja tono="ok">¡Correcto!</Caja> : <Caja tono="mal">No es ese. Escuchalo de nuevo y fijate dónde están las notas largas.</Caja>)}
    </>
  )
}

const PREGUNTAS = [
  {
    componente: ({ onOk }) => (
      <CualSono onOk={onOk} correcta={1} opciones={[
        [{ dur: 1 }, { dur: 1 }, { dur: 2 }],
        [{ dur: 2 }, { dur: 1 }, { dur: 1 }],
      ]} />
    ),
  },
  {
    componente: ({ onOk }) => (
      <CualSono onOk={onOk} correcta={0} opciones={[
        [{ dur: 1 }, { dur: 1, silencio: true }, { dur: 1 }, { dur: 1 }],
        [{ dur: 1 }, { dur: 1 }, { dur: 1 }, { dur: 1, silencio: true }],
      ]} />
    ),
  },
  {
    texto: 'Ves un silencio de blanca en tu renglón. ¿Qué hacés?',
    opciones: ['No canto durante dos pulsos, pero sigo contando', 'Canto una nota larga', 'Espero a que el director me avise'],
    correcta: 0,
    explicacion: 'El silencio dura lo mismo que su figura, y el pulso sigue.',
  },
  {
    texto: 'Una blanca con puntillo, ¿cuántos pulsos dura?',
    opciones: ['2', '3', '4'],
    correcta: 1,
    explicacion: 'La blanca dura 2 y el puntillo le suma la mitad: 2 + 1 = 3.',
  },
  {
    texto: 'Una ligadura une dos notas iguales. ¿Cómo las cantás?',
    opciones: ['Dos veces, separadas', 'Como una sola nota larga', 'La segunda más fuerte'],
    correcta: 1,
    explicacion: 'Se canta una sola vez y dura lo que las dos juntas.',
  },
]

export default function LeccionFiguras({ onCompletar, siguiente, onSiguiente, onVolver, onIrRitmo }) {
  return (
    <Leccion pasos={[
      { render: () => <PasoFiguras /> },
      { render: () => <PasoSilencios /> },
      { render: () => <PasoPuntillo /> },
      { render: () => <PasoLigadura /> },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            accionExtra={onIrRitmo ? { texto: '🥁 Practicalo en Ritmo →', onClick: onIrRitmo } : null}
            textoFinal="Ya reconocés cuánto dura cada figura y cada silencio, y qué hacen el puntillo y la ligadura. Para practicar leyendo y marcando ritmos, andá a Ritmo." />
        ),
      },
    ]} />
  )
}
