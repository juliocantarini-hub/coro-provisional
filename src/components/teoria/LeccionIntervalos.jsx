import { useState } from 'react'
import Pentagrama from '../Pentagrama'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso } from './ui'
import MapaObra from './MapaObra'
import { tocarNotas, motivo, midiDe, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'
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

// Ejemplos de canciones de dominio público (letra original), escritos en Do para que el intervalo empiece en Do.
const conLetra = (texto, letras) => motivo(texto).map((n, k) => ({ ...n, letra: letras[k] }))
const INTERVALOS = [
  {
    n: 2, nombre: 'Segunda', ej: 'Do → Re', ref: 'Es un paso. Como el comienzo de «Martinillo» (Frère Jacques).',
    ejemplo: [{ notas: conLetra('C5:1 D5:1 E5:1 C5:1', ['Frè-', 're', 'Jac-', 'ques']), barra: 'final' }],
    intervalo: [{ compas: 0, i: 0 }, { compas: 0, i: 1 }],
  },
  {
    n: 3, nombre: 'Tercera', ej: 'Do → Mi', ref: 'El comienzo de «When the saints go marching in».',
    ejemplo: [{ notas: conLetra('C5:1 E5:1 F5:1 G5:1', ['Oh', 'when', 'the', 'saints']), barra: 'final' }],
    intervalo: [{ compas: 0, i: 0 }, { compas: 0, i: 1 }],
  },
  {
    n: 4, nombre: 'Cuarta', ej: 'Do → Fa', ref: 'El comienzo de «Arroz con leche».',
    // En 3/4, empieza en anacrusa: (silencio de corchea) Do | Fa La | Fa Fa
    ejemplo: [
      { notas: conLetra('C4:0.5 F4:1 A4:1', ['A-', 'rroz', 'con']) },
      { notas: conLetra('F4:1 F4:0.5', ['le-', 'che']), barra: 'final' },
    ],
    intervalo: [{ compas: 0, i: 0 }, { compas: 0, i: 1 }],
  },
  {
    n: 5, nombre: 'Quinta', ej: 'Do → Sol', ref: 'El comienzo de «Estrellita, ¿dónde estás?» (Twinkle, twinkle).',
    ejemplo: [
      { notas: conLetra('C5:1 C5:1 G5:1 G5:1', ['Twin-', 'kle,', 'twin-', 'kle,']) },
      { notas: conLetra('A5:1 A5:1 G5:2', ['lit-', 'tle', 'star']), barra: 'final' },
    ],
    intervalo: [{ compas: 0, i: 1 }, { compas: 0, i: 2 }],
  },
  {
    n: 8, nombre: 'Octava', ej: 'Do → Do', ref: 'La misma nota, más aguda o más grave. En «The Ash Grove» (El fresno), canción tradicional galesa, salta una octava hacia abajo. También es la distancia entre mujeres y hombres cuando cantan juntos la misma melodía.',
    // Tal como en la partitura de Julio: en Fa (Si bemol en la armadura), «joy of my | heart; A-»: Sol Do Si♮ | Do (blanca) Do grave
    armadura: [{ paso: 34, signo: 'bemol' }],
    ejemplo: [
      { notas: conLetra('G4:1 C5:1 Bn4:1', ['joy', 'of', 'my']) },
      { notas: conLetra('C5:2 C4:1', ['heart;', 'A-']), barra: 'final' },
    ],
    intervalo: [{ compas: 1, i: 0 }, { compas: 1, i: 1 }],
  },
]

// Un intervalo: al tocar ▶ suena y se despliega el ejemplo con su letra, que se puede escuchar nota por nota
function Intervalo({ it }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [abierto, setAbierto] = useState(false)
  const [activa, setActiva] = useState(null) // { voz, compas, i }; voz 'todas' = en todos los renglones
  const b = DO + it.n - 1
  // Uno o varios renglones (la octava muestra mujeres y hombres)
  const voces = it.voces || (it.ejemplo ? [{ compases: it.ejemplo }] : null)
  const notaDe = (m) => voces[m.voz || 0].compases[m.compas].notas[m.i]
  // Con ejemplo, el intervalo suena a la altura en que está escrito y sus dos notas se iluminan al sonar
  const tocarIntervalo = () => {
    if (voces) setAbierto(true)
    const midis = voces ? it.intervalo.map((m) => midiDe(notaDe(m))) : [midiDePaso(DO), midiDePaso(b)]
    tocar('i', (fin) => tocarNotas({
      notas: [{ midi: midis[0], dur: 1 }, { midi: midis[1], dur: 2 }], tempo: 76,
      onNota: voces ? (k) => setActiva({ voz: 0, ...it.intervalo[k] }) : undefined, onFin: fin,
    }), () => setActiva(null))
  }
  // El ejemplo suena con todos los renglones juntos (tienen el mismo ritmo)
  const plano = voces ? voces[0].compases.flatMap((c, ci) => c.notas.map((n, k) => ({ ...n, ci, k }))) : []
  const tocarEjemplo = () => tocar('e', (fin) => tocarNotas({
    notas: plano.map((n) => ({ midis: voces.map((v) => midiDe(v.compases[n.ci].notas[n.k])), dur: n.dur })), tempo: 96,
    onNota: (k) => setActiva({ voz: 'todas', compas: plano[k].ci, i: plano[k].k }), onFin: fin,
  }), () => setActiva(null))
  return (
    <div style={{ background: '#FFFFFF', border: `1px solid ${sonando || abierto ? COLOR_TEORIA : '#E8E6DF'}`, borderRadius: '12px', padding: '10px 12px', marginBottom: '8px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, background: FONDO_TEORIA, color: COLOR_TEORIA, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{it.n}ª</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{it.nombre} <span style={{ fontWeight: 400, color: '#888780' }}>· {it.ej}</span></div>
          <div style={{ fontSize: '12px', color: '#5F5E5A', lineHeight: 1.4 }}>{it.ref}</div>
        </div>
        <Boton activo={sonando === 'i'} onClick={() => (sonando === 'i' ? (parar(), setActiva(null)) : tocarIntervalo())}>{sonando === 'i' ? '■' : '▶'}</Boton>
      </div>
      {abierto && voces && (
        <div style={{ marginTop: '10px' }}>
          {voces.map((v, vi) => (
            <div key={vi}>
              {v.nombre && <div style={{ fontSize: '12px', fontWeight: 700, color: '#5F5E5A', margin: '2px 0 -6px 4px' }}>{v.nombre}</div>}
              <MapaObra compases={v.compases} sinNumeros armadura={it.armadura} descripcion={`Ejemplo de ${it.nombre.toLowerCase()}`}
                notaActiva={activa && (activa.voz === 'todas' || (activa.voz || 0) === vi) ? activa : null}
                marcadas={it.intervalo.filter((m) => (m.voz || 0) === vi)} />
            </div>
          ))}
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px' }}>
            {sonando === 'e'
              ? <Boton onClick={() => { parar(); setActiva(null) }}>■ Parar</Boton>
              : <Boton onClick={tocarEjemplo}>▶ Escuchar el ejemplo</Boton>}
            <Boton onClick={() => { parar(); setActiva(null); setAbierto(false) }}>✕ Cerrar</Boton>
          </div>
        </div>
      )}
    </div>
  )
}

// Un acorde con tensión (cuarta suspendida) que se resuelve: Do-Fa-Do → Do-Mi-Do
function Resolucion() {
  const { sonando, tocar, parar } = useReproduccion()
  const [activa, setActiva] = useState(-1)
  const acordes = [[28, 31, 35], [28, 30, 35]]
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '10px', marginBottom: '10px' }}>
      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', marginBottom: '2px' }}>Tensión → reposo</div>
      <Pentagrama clave="sol" anchoCol={70} activa={activa} pasoMin={26} pasoMax={38}
        columnas={acordes.map((ac, i) => ({ notas: ac.map((p) => ({ paso: p, figura: 'redonda', color: p === 31 || (i === 1 && p === 30) ? COLOR_TEORIA : undefined })), etiqueta: i === 0 ? 'tensión' : 'reposo' }))} />
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '6px' }}>
        {sonando ? <Boton onClick={() => { parar(); setActiva(-1) }}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('r', (fin) => tocarNotas({
            notas: acordes.map((ac) => ({ midis: ac.map((p) => midiDePaso(p)), dur: 2.5 })), tempo: 70, onNota: setActiva, onFin: fin,
          }), () => setActiva(-1))}>▶ Escuchar</Boton>
        )}
      </div>
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
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={DO} b={DO + 1} juntas consigna="Suenan dos notas juntas. ¿Suenan estables o con tensión?" opciones={['Estables', 'Con tensión']} correcta={1}
      explicacion="Es una segunda: una disonancia." />,
  },
  {
    componente: ({ onOk }) => <ElegirOido onOk={onOk} a={DO} b={DO + 4} juntas consigna="Suenan dos notas juntas. ¿Suenan estables o con tensión?" opciones={['Estables', 'Con tensión']} correcta={0}
      explicacion="Es una quinta: una consonancia." />,
  },
  {
    texto: 'Tu nota forma una disonancia con la de otra voz. ¿Qué hacés?',
    opciones: ['La acerco a la nota de la otra voz', 'La sostengo firme: la tensión se resuelve sola', 'Dejo de cantar'],
    correcta: 1,
    explicacion: 'La disonancia es parte de la música; si la sostenés, se resuelve en el acorde siguiente.',
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
          <>
            <Titulo>Consonancias y disonancias</Titulo>
            <Caja>
              Algunos intervalos suenan <b>estables</b>, en reposo: son las <b>consonancias</b>, como la octava, la quinta y la tercera.
              Otros suenan <b>con tensión</b>, como si pidieran moverse: son las <b>disonancias</b>, como la segunda y la séptima.
              No están "mal": la música las usa para crear expectativa.
            </Caja>
            <Par a={DO} b={DO + 1} juntas etiqueta="Segunda: disonante" />
            <Par a={DO} b={DO + 6} juntas etiqueta="Séptima: disonante" />
            <Caja>
              Casi siempre, una disonancia <b>se resuelve</b>: una de las notas se mueve un paso y el acorde vuelve al reposo. Escuchá cómo
              la nota marcada baja y todo "se acomoda".
            </Caja>
            <Resolucion />
            <Caja tono="tip">
              <b>En el coro:</b> si tu nota forma una disonancia con otra voz, va a sonar "rara", y es normal. <b>Sostenela firme</b> y no te
              acerques a la nota del otro: la tensión se resuelve sola en el acorde siguiente.
            </Caja>
          </>
        ),
      },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="¡Terminaste la última lección! Ya reconocés pasos y saltos, los intervalos más comunes, cómo suenan juntos en el coro y la diferencia entre consonancias y disonancias. Podés volver a cualquier lección cuando quieras." />
        ),
      },
    ]} />
  )
}
