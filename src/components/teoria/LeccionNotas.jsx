import { useState } from 'react'
import Pentagrama from '../Pentagrama'
import Teclado from './Teclado'
import { Caja, Boton, Partitura, Titulo, Botonera, Leccion, Repaso, VERDE_FONDO, ROJO_FONDO } from './ui'
import { COLOR_TEORIA, FONDO_TEORIA, vozSATB } from '../../lib/teoria'
import { pasoNatural, NOMBRES_NOTA } from '../../lib/notacion'
import * as Tone from 'tone'
import { getPianoSampler } from '../../lib/pianoSampler'

// Lección 6: "Las notas y el teclado". Los siete nombres, cómo ubicarse en el teclado (grupos de teclas negras),
// pasar del teclado al pentagrama y del pentagrama al teclado, y dónde queda tu voz.

async function sonar(midi, dur = 0.9) {
  await Tone.start()
  const { sampler, listo } = getPianoSampler()
  await listo
  sampler.triggerAttackRelease(Tone.Frequency(midi, 'midi').toNote(), dur)
}

function useDestello() {
  const [colores, setColores] = useState({})
  const destellar = (midi, color, ms = 450) => {
    setColores({ [midi]: color })
    setTimeout(() => setColores((c) => (c[midi] === color ? {} : c)), ms)
  }
  return [colores, destellar, setColores]
}

function PasoNombres() {
  const [colores, destellar] = useDestello()
  const [ultima, setUltima] = useState(null)
  return (
    <>
      <Titulo>Siete nombres</Titulo>
      <Caja>
        Las notas tienen solo <b>siete nombres</b>: <b>Do, Re, Mi, Fa, Sol, La, Si</b>. Después del Si vuelve a empezar
        con Do, pero más agudo. Cada vuelta completa es una <b>octava</b>.
      </Caja>
      <Teclado desde={60} hasta={83} nombres colores={colores} onTecla={(m) => { sonar(m); destellar(m, COLOR_TEORIA); setUltima(m) }} />
      <Caja tono="tip">
        Para ubicarte, mirá las teclas negras: van en <b>grupos de dos y de tres</b>. El <b>Do</b> está siempre justo a la
        <b> izquierda del grupo de dos</b>.
        {ultima != null && pasoNatural(ultima) == null && <><br />Tocaste una tecla negra: de esas hablamos en la lección de alteraciones.</>}
      </Caja>
    </>
  )
}

function PasoTeclaPentagrama() {
  const [m, setM] = useState(null)
  const paso = m != null ? pasoNatural(m) : null
  return (
    <>
      <Titulo>De la tecla al pentagrama</Titulo>
      <Caja>Tocá una tecla blanca y mirá dónde se escribe esa nota. Fijate que cada tecla más a la derecha sube un lugar en el pentagrama.</Caja>
      <Partitura>
        <Pentagrama clave="sol" columnas={paso != null ? [{ notas: [{ paso, figura: 'negra', estado: 'sel' }] }] : [{ notas: [], vacia: true }]}
          pasoMin={26} pasoMax={42} />
        <div style={{ textAlign: 'center', fontSize: '15px', fontWeight: 700, color: COLOR_TEORIA, minHeight: '22px' }}>
          {paso != null ? NOMBRES_NOTA[paso % 7] : m != null ? 'Tecla negra' : 'Tocá una tecla'}
        </div>
      </Partitura>
      <Teclado desde={60} hasta={84} colores={m != null ? { [m]: COLOR_TEORIA } : {}} onTecla={(x) => { sonar(x); setM(x) }} />
    </>
  )
}

// Ejercicio: mostrar una nota y tocarla en el teclado
const RONDA = [36, 32, 39, 30, 34]
export function Ubicar({ pasos = RONDA, onOk, conAyuda = true }) {
  const [i, setI] = useState(0)
  const [nombres, setNombres] = useState(false)
  const [colores, destellar] = useDestello()
  const [msj, setMsj] = useState(null)
  const listo = i >= pasos.length
  const paso = pasos[Math.min(i, pasos.length - 1)]
  const tocar = (m) => {
    if (listo) return
    sonar(m)
    const p = pasoNatural(m)
    if (p === paso) {
      destellar(m, '#2F9E6F', 600)
      setMsj({ ok: true, t: `¡Sí! Es ${NOMBRES_NOTA[paso % 7]}.` })
      setTimeout(() => { setI((x) => { const n = x + 1; if (n >= pasos.length) onOk?.(); return n }); setMsj(null) }, 700)
    } else {
      destellar(m, '#D04A43', 600)
      const objetivo = (p ?? pasoNatural(m - 1))
      setMsj({ ok: false, t: objetivo < paso ? 'La nota que buscás es más aguda: más a la derecha.' : 'La nota que buscás es más grave: más a la izquierda.' })
    }
  }
  return (
    <>
      <Caja>
        <b>Tocá en el teclado la nota que ves.</b> {pasos.length > 1 && !listo && <span style={{ color: '#888780' }}>({i + 1} de {pasos.length})</span>}
      </Caja>
      <Partitura>
        <Pentagrama clave="sol" columnas={[{ notas: [{ paso, figura: 'negra', estado: listo ? 'correcta' : 'normal' }] }]} pasoMin={26} pasoMax={42} />
      </Partitura>
      <Teclado desde={60} hasta={84} nombres={nombres} colores={colores} onTecla={tocar} />
      {msj && <Caja tono={msj.ok ? 'ok' : 'mal'}>{msj.t}</Caja>}
      {listo && <Caja tono="ok">¡Muy bien!</Caja>}
      {conAyuda && !listo && (
        <Botonera><Boton activo={nombres} onClick={() => setNombres(!nombres)}>{nombres ? 'Ocultar nombres' : 'Mostrar nombres en las teclas'}</Boton></Botonera>
      )}
    </>
  )
}

const RANGOS = {
  S: [60, 79], A: [55, 74], T: [48, 67], B: [41, 62],
}
const RANGO_ESPECIAL = { Mezzo: [57, 77], 'Barítono': [45, 65] }

function PasoTuVoz({ voz }) {
  const info = vozSATB(voz)
  const rango = info ? RANGO_ESPECIAL[info.nombre] || RANGOS[info.principal] : null
  const [colores, destellar] = useDestello()
  const base = {}
  if (rango) for (let m = rango[0]; m <= rango[1]; m++) base[m] = '#CDE7DC'
  base[60] = base[60] ? '#9FD9C5' : FONDO_TEORIA
  return (
    <>
      <Titulo>El Do central y tu voz</Titulo>
      <Caja>
        El <b>Do central</b> es el que queda en el medio del piano. Es una buena referencia: casi todas las voces del coro lo pueden cantar.
        {rango
          ? <> En verde está, más o menos, el registro cómodo de tu voz ({info.nombre || ({ S: 'Soprano', A: 'Contralto', T: 'Tenor', B: 'Bajo' })[info.principal]}).</>
          : <> Si cargás tu cuerda en tu perfil, acá vas a ver resaltado el registro cómodo de tu voz.</>}
      </Caja>
      <Teclado desde={41} hasta={84} colores={{ ...base, ...colores }} onTecla={(m) => { sonar(m); destellar(m, COLOR_TEORIA) }} alto={90} />
      <Caja tono="tip">Es una guía aproximada: cada voz es distinta, y con la práctica el registro se amplía.</Caja>
    </>
  )
}

const PREGUNTAS = [
  { componente: ({ onOk }) => <Ubicar pasos={[33, 37, 31]} onOk={onOk} /> },
  { componente: ({ onOk }) => <Ubicar pasos={[35, 38, 29]} onOk={onOk} conAyuda={false} /> },
  {
    texto: '¿Qué nota viene después del Si?',
    opciones: ['La', 'Do', 'Re'],
    correcta: 1,
    explicacion: 'Después del Si vuelve a empezar el ciclo: Do, una octava más aguda.',
  },
  {
    texto: '¿Cómo encontrás un Do en el teclado?',
    opciones: ['Es la primera tecla de la izquierda', 'Es la tecla blanca a la izquierda del grupo de dos negras', 'Es la tecla negra del medio'],
    correcta: 1,
    explicacion: 'Las negras van en grupos de 2 y de 3; el Do está justo antes del grupo de 2.',
  },
]

export default function LeccionNotas({ voz, onCompletar, siguiente, onSiguiente, onVolver }) {
  return (
    <Leccion pasos={[
      { render: () => <PasoNombres /> },
      { render: () => <PasoTeclaPentagrama /> },
      {
        render: () => (
          <>
            <Titulo>Del pentagrama a la tecla</Titulo>
            <Caja tono="tip">Ahora al revés. Si te equivocás, te decimos si la nota que buscás está más a la derecha o más a la izquierda.</Caja>
            <Ubicar />
          </>
        ),
      },
      { render: () => <PasoTuVoz voz={voz} /> },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="Ya conocés los nombres de las notas, te ubicás en el teclado y podés buscar en el piano una nota que ves en la partitura. Usalo con «Buscá tu nota» para encontrar tus notas de entrada." />
        ),
      },
    ]} />
  )
}
