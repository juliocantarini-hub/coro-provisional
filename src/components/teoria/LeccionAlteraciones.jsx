import { useState } from 'react'
import Pentagrama from '../Pentagrama'
import MapaObra from './MapaObra'
import Teclado from './Teclado'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso } from './ui'
import { tocarNotas, tocarRecorrido, motivo, midiDe, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'
import { midiDePaso } from '../../lib/notacion'

// Lección 7: "Alteraciones". Sostenido, bemol y becuadro: qué cambian, que valen todo el compás, y la armadura.
// Sin teoría de tonalidades: reconocer los signos y saber que la nota cambia.

// Compara dos versiones de la misma nota (natural, sostenido, bemol o becuadro): pentagrama + teclado + sonido.
// notas: [{ alter, becuadro, etiqueta, boton }] (dos)
const NEGRAS = [1, 3, 6, 8, 10]
function Comparar({ paso, notas }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [cual, setCual] = useState(null) // índice de la que suena, o 'ambas'
  const midis = notas.map((n) => midiDePaso(paso, n.alter || 0))
  let desde = Math.min(...midis) - 5
  if (NEGRAS.includes(desde % 12)) desde -= 1
  let hasta = Math.max(...midis) + 6
  if (NEGRAS.includes(hasta % 12)) hasta += 1
  const sonar = (k) => { setCual(k); tocar(`n${k}`, (fin) => tocarNotas({ notas: [{ midi: midis[k], dur: 2 }], tempo: 80, onFin: fin })) }
  const colores = typeof cual === 'number' ? { [midis[cual]]: COLOR_TEORIA } : {}
  return (
    <>
      <Partitura>
        <Pentagrama clave="sol" anchoCol={80} columnas={notas.map((n, k) => ({
          notas: [{ paso, alter: n.alter, becuadro: n.becuadro, figura: 'blanca', estado: cual === k ? 'sel' : 'normal' }], etiqueta: n.etiqueta,
        }))} />
      </Partitura>
      <Teclado desde={desde} hasta={hasta} colores={colores} alto={80} />
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setCual(null) }}>■ Parar</Boton> : (
          <>
            {notas.map((n, k) => <Boton key={k} onClick={() => sonar(k)}>▶ {n.boton}</Boton>)}
            <Boton onClick={() => { setCual('ambas'); tocar('ambas', (fin) => tocarNotas({ notas: midis.map((m) => ({ midi: m, dur: 1.5 })), tempo: 80, onNota: setCual, onFin: fin }), () => setCual(null)) }}>▶ Las dos seguidas</Boton>
          </>
        )}
      </Botonera>
    </>
  )
}

// Un mapa de compases que se escucha con el compás resaltado
function Compases({ compases }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [actual, setActual] = useState(null)
  return (
    <>
      <Partitura><MapaObra compases={compases} actual={actual} /></Partitura>
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setActual(null) }}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('c', (fin) => tocarRecorrido({
            compases: compases.map((c) => c.notas), orden: compases.map((_, i) => i), tempo: 84, onCompas: setActual, onFin: fin,
          }), () => setActual(null))}>▶ Escuchar</Boton>
        )}
      </Botonera>
    </>
  )
}

const TODO_EL_COMPAS = [
  { notas: motivo('G5:1 F#5:1 E5:1 F5:1') },
  { notas: motivo('G5:1 F5:1 E5:2'), barra: 'final' },
]
const BECUADRO = [
  { notas: motivo('E5:1 F#5:1 G5:1 F#5:1') },
  { notas: motivo('E5:1 Fn5:1 E5:2'), barra: 'final' },
]

function Armadura() {
  const { sonando, tocar, parar } = useReproduccion()
  const [con, setCon] = useState(true)
  const [activa, setActiva] = useState(-1)
  const pasos = [32, 33, 34, 35, 36, 37, 38, 39]
  const notas = pasos.map((p) => ({ midi: midiDePaso(p, con && p % 7 === 3 ? 1 : 0), dur: 1 }))
  return (
    <>
      <Botonera>
        <Boton activo={con} onClick={() => { parar(); setCon(true); setActiva(-1) }}>Con armadura</Boton>
        <Boton activo={!con} onClick={() => { parar(); setCon(false); setActiva(-1) }}>Sin armadura</Boton>
      </Botonera>
      <Partitura>
        <Pentagrama clave="sol" armadura={con ? { tipo: 'sostenido', n: 1 } : null}
          columnas={pasos.map((p, i) => ({ notas: [{ paso: p, figura: 'negra', estado: p % 7 === 3 && con ? (activa === i ? 'sel' : 'correcta') : activa === i ? 'sel' : 'normal' }] }))} activa={activa} />
      </Partitura>
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setActiva(-1) }}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('a', (fin) => tocarNotas({ notas, tempo: 110, onNota: setActiva, onFin: fin }), () => setActiva(-1))}>▶ Escuchar</Boton>
        )}
      </Botonera>
    </>
  )
}

// Repaso: ¿qué hace este signo?
function QueHace({ alter, onOk }) {
  const [elegida, setElegida] = useState(null)
  const correcta = alter > 0 ? 'sube' : 'baja'
  const ok = elegida === correcta
  return (
    <>
      <Caja><b>¿Qué le hace este signo a la nota?</b></Caja>
      <Partitura><Pentagrama clave="sol" columnas={[{ notas: [{ paso: alter > 0 ? 31 : 34, alter, figura: 'blanca' }] }]} /></Partitura>
      <Botonera>
        {[['sube', '⬆ La sube'], ['baja', '⬇ La baja'], ['nada', 'No cambia nada']].map(([k, t]) => (
          <Boton key={k} activo={elegida === k} onClick={() => { if (ok) return; setElegida(k); if (k === correcta) onOk() }}>{t}</Boton>
        ))}
      </Botonera>
      {elegida != null && (ok
        ? <Caja tono="ok">¡Correcto! Es un {alter > 0 ? 'sostenido: sube medio tono' : 'bemol: baja medio tono'}.</Caja>
        : <Caja tono="mal">No es esa. Mirá bien la forma del signo.</Caja>)}
    </>
  )
}

const PREGUNTAS = [
  { componente: ({ onOk }) => <QueHace alter={1} onOk={onOk} /> },
  { componente: ({ onOk }) => <QueHace alter={-1} onOk={onOk} /> },
  {
    texto: 'En un compás aparece un Fa con sostenido. Más adelante, en el mismo compás, hay otro Fa sin signo. ¿Cómo lo cantás?',
    opciones: ['Natural, porque no tiene signo', 'Sostenido, porque la alteración vale todo el compás', 'Más fuerte'],
    correcta: 1,
    explicacion: 'La alteración sigue valiendo hasta la barra de compás, salvo que aparezca un becuadro.',
  },
  {
    texto: '¿Qué es la armadura?',
    opciones: ['Las alteraciones del principio, que valen para toda la obra', 'La última nota de la obra', 'Un signo que indica repetir'],
    correcta: 0,
    explicacion: 'Van junto a la clave en cada renglón y afectan a esas notas en todas las octavas.',
  },
]

export default function LeccionAlteraciones({ onCompletar, siguiente, onSiguiente, onVolver }) {
  return (
    <Leccion pasos={[
      {
        render: () => (
          <>
            <Titulo>El sostenido</Titulo>
            <Caja>
              Las <b>alteraciones</b> son signos que van <b>a la izquierda</b> de una nota y la cambian un poquito.
              El <b>sostenido</b> (♯, como un numeral) la <b>sube medio tono</b>: en el teclado, la tecla más cercana hacia la derecha.
            </Caja>
            <Comparar paso={31} notas={[{ etiqueta: 'natural', boton: 'Natural' }, { alter: 1, etiqueta: 'sostenido', boton: 'Con sostenido' }]} />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>El bemol y el becuadro</Titulo>
            <Caja>
              El <b>bemol</b> (♭, como una "b") <b>baja medio tono</b> la nota: la tecla más cercana hacia la izquierda.
            </Caja>
            <Comparar paso={34} notas={[{ etiqueta: 'natural', boton: 'Natural' }, { alter: -1, etiqueta: 'bemol', boton: 'Con bemol' }]} />
            <Caja>
              El <b>becuadro</b> (♮) <b>anula</b> una alteración anterior: la nota vuelve a ser natural.
            </Caja>
            <Comparar paso={31} notas={[{ alter: 1, etiqueta: 'sostenido', boton: 'Con sostenido' }, { becuadro: true, etiqueta: 'natural', boton: 'Con becuadro' }]} />
            <Caja tono="tip">El primer Fa tiene sostenido; el segundo tiene becuadro, así que <b>vuelve a ser natural</b>. Escuchá cómo baja.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Valen todo el compás</Titulo>
            <Caja>
              Una alteración <b>sigue valiendo hasta la barra de compás</b>. Si después, en el mismo compás, vuelve a aparecer esa nota
              sin signo, se canta igual de alterada. En el compás siguiente se vuelve a la normalidad.
            </Caja>
            <Caja tono="tip">En el compás 1, el último Fa no tiene signo, pero <b>suena sostenido</b>. En el compás 2 ya es natural.</Caja>
            <Compases compases={TODO_EL_COMPAS} />
            <Caja>Para anular la alteración dentro del mismo compás se usa el <b>becuadro</b>:</Caja>
            <Compases compases={BECUADRO} />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>La armadura</Titulo>
            <Caja>
              Cuando las alteraciones aparecen <b>al principio de cada renglón</b>, junto a la clave, se llaman <b>armadura</b>.
              Valen para <b>toda la obra</b> y en todas las octavas. Acá hay un sostenido en la línea de Fa: <b>todos los Fa</b> son sostenidos.
            </Caja>
            <Armadura />
            <Caja tono="tip">
              No hace falta memorizar las armaduras. Alcanza con mirar en qué líneas o espacios están, y recordar que esas notas cambian.
            </Caja>
          </>
        ),
      },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="Ya reconocés el sostenido, el bemol y el becuadro, sabés que valen todo el compás y qué es la armadura." />
        ),
      },
    ]} />
  )
}
