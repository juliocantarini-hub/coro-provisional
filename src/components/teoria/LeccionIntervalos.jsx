import { useState } from 'react'
import Pentagrama from '../Pentagrama'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso } from './ui'
import { tocarNotas, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'
import { midiDePaso } from '../../lib/notacion'

// Lección 8: "Intervalos por oído". La distancia entre dos notas: pasos y saltos, los intervalos más comunes
// con una canción de referencia para recordarlos, y cómo suenan juntos en el coro (unísono, octava, terceras).

const DO = 28 // Do4 en "pasos" del pentagrama

// Dos notas en el pentagrama que se pueden escuchar seguidas o juntas
function Par({ a, b, etiqueta, juntas = false, transponer = 0 }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [activa, setActiva] = useState(-1)
  const notas = [{ midi: midiDePaso(a) + transponer, dur: 1.2 }, { midi: midiDePaso(b) + transponer, dur: 1.8 }]
  const iniciar = (modoJuntas) => tocar(modoJuntas ? 'j' : 's', (fin) => tocarNotas({
    notas: modoJuntas ? notas.map((n) => ({ ...n, dur: 2.5 })) : notas, juntas: modoJuntas, tempo: 70,
    onNota: (i) => setActiva(modoJuntas ? 9 : i), onFin: fin,
  }), () => setActiva(-1))
  const columnas = juntas
    ? [{ notas: [{ paso: a, figura: 'redonda', estado: activa === 9 ? 'sel' : 'normal' }, { paso: b, figura: 'redonda', estado: activa === 9 ? 'sel' : 'normal' }] }]
    : [{ notas: [{ paso: a, figura: 'negra' }] }, { notas: [{ paso: b, figura: 'negra' }] }]
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '10px', marginBottom: '10px' }}>
      {etiqueta && <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', marginBottom: '2px' }}>{etiqueta}</div>}
      <Pentagrama clave="sol" columnas={columnas} activa={juntas ? -1 : activa} pasoMin={26} pasoMax={38} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
        {sonando ? <Boton onClick={() => { parar(); setActiva(-1) }}>■ Parar</Boton> : (
          <>
            <Boton onClick={() => iniciar(false)}>▶ Una tras otra</Boton>
            {juntas && <Boton onClick={() => iniciar(true)}>▶ Juntas</Boton>}
          </>
        )}
      </div>
    </div>
  )
}

const INTERVALOS = [
  { n: 2, nombre: 'Segunda', ej: 'Do → Re', ref: 'Es un paso: la escala está hecha de segundas. «Cumpleaños feliz» va subiendo así al principio.' },
  { n: 3, nombre: 'Tercera', ej: 'Do → Mi', ref: 'El comienzo de «When the saints go marching in».' },
  { n: 4, nombre: 'Cuarta', ej: 'Do → Fa', ref: 'El comienzo de la «Marcha nupcial» de Wagner.' },
  { n: 5, nombre: 'Quinta', ej: 'Do → Sol', ref: 'El comienzo de «Estrellita, ¿dónde estás?».' },
  { n: 8, nombre: 'Octava', ej: 'Do → Do', ref: 'El gran salto del comienzo de «Over the rainbow».' },
]

function Intervalo({ it }) {
  const { sonando, tocar, parar } = useReproduccion()
  const b = DO + it.n - 1
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#FFFFFF', border: `1px solid ${sonando ? COLOR_TEORIA : '#E8E6DF'}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px' }}>
      <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: FONDO_TEORIA, color: COLOR_TEORIA, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.n}ª</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{it.nombre} <span style={{ fontWeight: 400, color: '#888780' }}>· {it.ej}</span></div>
        <div style={{ fontSize: '12px', color: '#5F5E5A', lineHeight: 1.4 }}>{it.ref}</div>
      </div>
      <Boton activo={!!sonando} onClick={() => (sonando ? parar() : tocar('i', (fin) => tocarNotas({ notas: [{ midi: midiDePaso(DO), dur: 1 }, { midi: midiDePaso(b), dur: 2 }], tempo: 76, onFin: fin })))}>{sonando ? '■' : '▶'}</Boton>
    </div>
  )
}

// Repaso: escuchar dos notas y elegir
function ElegirOido({ a, b, juntas = false, consigna, opciones, correcta, explicacion, onOk }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [elegida, setElegida] = useState(null)
  const ok = elegida === correcta
  const notas = [{ midi: midiDePaso(a), dur: juntas ? 2.5 : 1.2 }, { midi: midiDePaso(b), dur: juntas ? 2.5 : 1.8 }]
  return (
    <>
      <Caja><b>{consigna}</b></Caja>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : <Boton onClick={() => tocar('e', (fin) => tocarNotas({ notas, juntas, tempo: 70, onFin: fin }))}>▶ Escuchar</Boton>}
      </Botonera>
      <Botonera>
        {opciones.map((o, k) => (
          <Boton key={k} activo={elegida === k} onClick={() => { if (ok) return; setElegida(k); if (k === correcta) onOk() }}>{o}</Boton>
        ))}
      </Botonera>
      {elegida != null && (ok ? <Caja tono="ok">¡Correcto! {explicacion}</Caja> : <Caja tono="mal">No es esa. Escuchá otra vez.</Caja>)}
    </>
  )
}

const PREGUNTAS = [
  {
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={30} b={31} consigna="¿Es un paso o un salto?" opciones={['Un paso', 'Un salto']} correcta={0}
      explicacion="Las notas están pegadas: es una segunda." />,
  },
  {
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={DO} b={DO + 4} consigna="¿Es una quinta o una octava?" opciones={['Quinta', 'Octava']} correcta={0}
      explicacion="Como el comienzo de «Estrellita»." />,
  },
  {
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={DO} b={DO + 7} consigna="¿Es una tercera o una octava?" opciones={['Tercera', 'Octava']} correcta={1}
      explicacion="La misma nota, más aguda." />,
  },
  {
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={DO} b={DO + 2} juntas consigna="Suenan dos notas juntas. ¿Es un unísono o una tercera?" opciones={['Unísono', 'Tercera']} correcta={1}
      explicacion="Son dos notas distintas que suenan bien juntas: una tercera." />,
  },
  {
    texto: 'Sopranos y tenores cantan la misma melodía, pero los tenores suenan más graves. ¿A qué distancia están?',
    opciones: ['Una tercera', 'Una quinta', 'Una octava'],
    correcta: 2,
    explicacion: 'Es la misma melodía una octava más abajo: por eso los tenores leen en clave de sol con un 8.',
  },
]

export default function LeccionIntervalos({ onCompletar, siguiente, onSiguiente, onVolver }) {
  return (
    <Leccion pasos={[
      {
        render: () => (
          <>
            <Titulo>Pasos y saltos</Titulo>
            <Caja>
              Un <b>intervalo</b> es la distancia entre dos notas. Si la nota siguiente está pegada (de línea a espacio), es un
              <b> paso</b>. Si hay lugares vacíos en el medio, es un <b>salto</b>. Y si es la misma nota, es un <b>unísono</b>.
            </Caja>
            <Par a={DO} b={DO} etiqueta="Unísono: la misma nota" />
            <Par a={DO} b={DO + 1} etiqueta="Paso" />
            <Par a={DO} b={DO + 4} etiqueta="Salto" />
            <Caja tono="tip">Los pasos se cantan casi sin pensar; los saltos hay que prepararlos: escuchá la nota de llegada en tu cabeza antes de cantarla.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Los intervalos tienen nombre</Titulo>
            <Caja>
              Se cuentan las notas que abarcan, <b>incluyendo las dos puntas</b>: de Do a Mi hay tres (Do, Re, Mi), así que es una <b>tercera</b>.
              Para recordar cómo suena cada uno, asocialo con el comienzo de una canción conocida.
            </Caja>
            {INTERVALOS.map((it) => <Intervalo key={it.n} it={it} />)}
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>En el coro: juntas</Titulo>
            <Caja>
              En el coro los intervalos también suenan <b>al mismo tiempo</b>, entre las voces. Cuando dos voces cantan la misma nota es un
              <b> unísono</b>. Cuando hombres y mujeres cantan "la misma" melodía, en realidad están a una <b>octava</b>. Y las
              <b> terceras</b> y <b>quintas</b> son las que forman los acordes.
            </Caja>
            <Par a={DO} b={DO + 7} juntas etiqueta="Octava" />
            <Par a={DO} b={DO + 2} juntas etiqueta="Tercera" />
            <Par a={DO} b={DO + 4} juntas etiqueta="Quinta" />
            <Caja tono="tip">Cuando un intervalo está bien afinado, las dos notas se "funden" y casi parecen una sola. Esa es la sensación de empastar.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="¡Terminaste la última lección! Ya reconocés pasos y saltos, los intervalos más comunes y cómo suenan juntos en el coro. Podés volver a cualquier lección cuando quieras." />
        ),
      },
    ]} />
  )
}
