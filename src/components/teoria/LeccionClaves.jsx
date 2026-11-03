import { useState } from 'react'
import Pentagrama from '../Pentagrama'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso, VERDE_FONDO, ROJO_FONDO } from './ui'
import { tocarNotas } from '../../lib/teoria'
import { midiDePaso } from '../../lib/notacion'

// Lección 5: "Pentagrama y claves". Arriba es agudo y abajo es grave; líneas, espacios y líneas adicionales;
// clave de sol y de fa; y seguir el "dibujo" de una melodía sin necesidad de nombrar las notas.

const col = (pasos, extra = {}) => pasos.map((p) => ({ notas: [{ paso: p, figura: 'negra', ...extra }] }))

// Escucha una lista de pasos marcando en el pentagrama la nota que suena
function MelodiaVisible({ pasos, clave = 'sol', texto = '▶ Escuchar', tempo = 90, extras, transponer = 0 }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [activa, setActiva] = useState(-1)
  const iniciar = () => tocar('m', (fin) => tocarNotas({
    notas: pasos.map((p) => ({ midi: midiDePaso(p) + transponer, dur: 1 })), tempo, onNota: setActiva, onFin: fin,
  }), () => setActiva(-1))
  return (
    <>
      <Partitura><Pentagrama clave={clave} columnas={col(pasos)} activa={activa} ls={10} /></Partitura>
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setActiva(-1) }}>■ Parar</Boton> : <Boton onClick={iniciar}>{texto}</Boton>}
        {extras}
      </Botonera>
    </>
  )
}

function PasoAgudoGrave() {
  return (
    <>
      <Titulo>Arriba es agudo, abajo es grave</Titulo>
      <Caja>
        Las cinco líneas del <b>pentagrama</b> funcionan como una escalera: cuanto <b>más arriba</b> está la nota,
        <b> más aguda</b> suena; cuanto <b>más abajo</b>, <b>más grave</b>. Escuchá una escala que sube y baja.
      </Caja>
      <MelodiaVisible pasos={[28, 29, 30, 31, 32, 33, 34, 35, 34, 33, 32, 31, 30, 29, 28]} tempo={120} texto="▶ Escuchar la escala" />
      <Caja tono="tip">De izquierda a derecha es el tiempo; de abajo hacia arriba, la altura.</Caja>
    </>
  )
}

function PasoLineas() {
  const [ver, setVer] = useState('lineas')
  const lineas = [30, 32, 34, 36, 38]
  const espacios = [31, 33, 35, 37]
  const pasos = ver === 'lineas' ? lineas : ver === 'espacios' ? espacios : [28, 26, 40, 42]
  return (
    <>
      <Titulo>Líneas, espacios y rayitas extra</Titulo>
      <Caja>
        Cada nota se escribe <b>sobre una línea</b> (la línea la atraviesa por el medio) o <b>en un espacio</b> (entre dos líneas).
        Cuando una nota no entra en el pentagrama, se le agregan <b>líneas adicionales</b>: rayitas cortas solo para ella.
      </Caja>
      <Botonera>
        <Boton activo={ver === 'lineas'} onClick={() => setVer('lineas')}>En líneas</Boton>
        <Boton activo={ver === 'espacios'} onClick={() => setVer('espacios')}>En espacios</Boton>
        <Boton activo={ver === 'adicionales'} onClick={() => setVer('adicionales')}>Líneas adicionales</Boton>
      </Botonera>
      <MelodiaVisible key={ver} pasos={pasos} />
    </>
  )
}

function PasoClaves() {
  const { sonando, tocar, parar } = useReproduccion()
  return (
    <>
      <Titulo>Las claves</Titulo>
      <Caja>
        El signo del principio es la <b>clave</b>. Dice qué notas corresponden a cada línea, para que las voces agudas y las graves
        entren cómodas en el pentagrama.
      </Caja>
      <Caja>
        <b>Clave de sol</b> (la del caracol): la leen sopranos, contraltos y tenores.<br />
        <b>Clave de fa</b> (la de los dos puntitos): la leen los bajos.
      </Caja>
      <Caja>Mirá: es la <b>misma nota</b> (el Do del medio del piano), escrita en las dos claves. Cambia de lugar, pero suena igual.</Caja>
      <Partitura>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}><Pentagrama clave="sol" columnas={col([28])} pasoMin={24} pasoMax={40} /></div>
          <div style={{ flex: 1 }}><Pentagrama clave="fa" columnas={col([28])} pasoMin={12} pasoMax={28} /></div>
        </div>
      </Partitura>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('c', (fin) => tocarNotas({ notas: [{ midi: 60, dur: 2 }, { midi: 60, dur: 2 }], tempo: 80, onFin: fin }))}>▶ Escuchar las dos</Boton>
        )}
      </Botonera>
      <Caja tono="tip">
        Los tenores leen en clave de sol con un <b>8</b> abajo: cantan una octava más grave de lo escrito. Por eso un tenor y una soprano
        pueden leer "la misma nota" y sonar a distinta altura.
      </Caja>
    </>
  )
}

function PasoDibujo() {
  return (
    <>
      <Titulo>El dibujo de la melodía</Titulo>
      <Caja>
        No hace falta saber el nombre de cada nota para que la partitura te ayude. Mirá su <b>dibujo</b>: si las notas suben,
        tu voz sube; si bajan, baja; si se quedan a la misma altura, repetís la nota. Y si hay un salto grande, preparalo.
      </Caja>
      <MelodiaVisible pasos={[32, 33, 34, 32, 37, 36, 34, 35]} texto="▶ Seguí el dibujo" tempo={84} />
      <MelodiaVisible pasos={[37, 37, 36, 35, 35, 34, 30, 32]} texto="▶ Otro ejemplo" tempo={84} />
    </>
  )
}

// Repaso: dos notas, ¿la segunda es más aguda, más grave o igual?
function AgudaOGrave({ a, b, onOk }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [elegida, setElegida] = useState(null)
  const correcta = b > a ? 'aguda' : b < a ? 'grave' : 'igual'
  const ok = elegida === correcta
  return (
    <>
      <Caja><b>Escuchá dos notas. La segunda, ¿es más aguda o más grave que la primera?</b></Caja>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('n', (fin) => tocarNotas({ notas: [{ midi: a, dur: 1 }, { midi: b, dur: 1.5 }], tempo: 70, onFin: fin }))}>▶ Escuchar</Boton>
        )}
      </Botonera>
      <Botonera>
        {[['aguda', '⬆ Más aguda'], ['grave', '⬇ Más grave'], ['igual', '= Igual']].map(([k, t]) => (
          <Boton key={k} activo={elegida === k} onClick={() => { if (ok) return; setElegida(k); if (k === correcta) onOk() }}>{t}</Boton>
        ))}
      </Botonera>
      {elegida != null && (ok ? <Caja tono="ok">¡Correcto!</Caja> : <Caja tono="mal">No es esa. Volvé a escuchar.</Caja>)}
    </>
  )
}

// Repaso: suena una melodía y hay que elegir cuál de los dos dibujos es
function CualDibujo({ opciones, correcta, onOk }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [elegida, setElegida] = useState(null)
  const ok = elegida === correcta
  return (
    <>
      <Caja><b>Escuchá la melodía. ¿Cuál de los dos dibujos es?</b></Caja>
      <Botonera>
        {sonando ? <Boton onClick={parar}>■ Parar</Boton> : (
          <Boton onClick={() => tocar('d', (fin) => tocarNotas({ notas: opciones[correcta].map((p) => ({ midi: midiDePaso(p), dur: 1 })), tempo: 88, onFin: fin }))}>▶ Escuchar</Boton>
        )}
      </Botonera>
      {opciones.map((pasos, k) => (
        <div key={k} onClick={() => { if (ok) return; setElegida(k); if (k === correcta) onOk() }} style={{
          padding: '8px', borderRadius: '12px', marginBottom: '8px', cursor: ok ? 'default' : 'pointer',
          border: `1px solid ${elegida === k ? (k === correcta ? '#9FD9C5' : '#F0B7B2') : '#E8E6DF'}`,
          background: elegida === k ? (k === correcta ? VERDE_FONDO : ROJO_FONDO) : '#FFFFFF',
        }}>
          <Pentagrama clave="sol" columnas={col(pasos)} />
        </div>
      ))}
      {elegida != null && (ok ? <Caja tono="ok">¡Correcto!</Caja> : <Caja tono="mal">No es ese. Escuchá si la melodía sube o baja.</Caja>)}
    </>
  )
}

const PREGUNTAS = [
  { componente: ({ onOk }) => <AgudaOGrave a={64} b={69} onOk={onOk} /> },
  { componente: ({ onOk }) => <AgudaOGrave a={72} b={67} onOk={onOk} /> },
  { componente: ({ onOk }) => <CualDibujo onOk={onOk} correcta={0} opciones={[[30, 31, 32, 34, 36, 34], [36, 35, 34, 32, 30, 32]]} /> },
  { componente: ({ onOk }) => <CualDibujo onOk={onOk} correcta={1} opciones={[[32, 32, 32, 36, 36, 36], [32, 36, 32, 36, 32, 36]]} /> },
  {
    texto: '¿En qué clave leen los bajos?',
    opciones: ['Clave de sol', 'Clave de fa', 'Clave de sol con un 8'],
    correcta: 1,
    explicacion: 'Sopranos, contraltos y tenores leen en clave de sol; los bajos, en clave de fa.',
  },
]

export default function LeccionClaves({ onCompletar, siguiente, onSiguiente, onVolver }) {
  return (
    <Leccion pasos={[
      { render: () => <PasoAgudoGrave /> },
      { render: () => <PasoLineas /> },
      { render: () => <PasoClaves /> },
      { render: () => <PasoDibujo /> },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="Ya sabés leer el pentagrama como una escalera de alturas, reconocer las claves de sol y de fa, y seguir el dibujo de una melodía." />
        ),
      },
    ]} />
  )
}
