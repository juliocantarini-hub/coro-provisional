import { useState } from 'react'
import MapaObra from './MapaObra'
import { Caja, Boton, Partitura, Titulo, Botonera, useReproduccion, Leccion, Repaso, VERDE_FONDO, ROJO_FONDO } from './ui'
import { motivo, tocarRecorrido, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'

// Lección 2: "El mapa de la obra". La partitura no siempre se lee de corrido: repeticiones, casillas,
// D.C., D.S., coda, calderón, respiración y dinámicas. Cada signo se ve y se escucha con el recorrido.

const M = {
  a: 'C5:1 D5:1 E5:1 C5:1',
  b: 'E5:1 F5:1 G5:2',
  c: 'G5:1 F5:1 E5:1 D5:1',
  e: 'E5:1 D5:1 C5:1 D5:1',
  g: 'E5:1 D5:1 C5:2',
  f: 'C5:4',
}
const mapa = (lista) => lista.map(({ m, ...resto }) => ({ ...resto, notas: motivo(M[m]) }))

const REPETICION = {
  compases: mapa([{ m: 'a' }, { m: 'b', inicioRep: true }, { m: 'c', barra: 'rep' }, { m: 'f', barra: 'final' }]),
  orden: [0, 1, 2, 1, 2, 3],
}
const CASILLAS = {
  compases: mapa([{ m: 'a', inicioRep: true }, { m: 'b' }, { m: 'c', casilla: '1.', barra: 'rep' }, { m: 'f', casilla: '2.', barra: 'final' }]),
  orden: [0, 1, 2, 0, 1, 3],
}
const DC = {
  compases: mapa([{ m: 'a' }, { m: 'g', barra: 'doble', texto: 'Fine' }, { m: 'b' }, { m: 'c', barra: 'final', texto: 'D.C. al Fine' }]),
  orden: [0, 1, 2, 3, 0, 1],
}
const DS = {
  compases: mapa([{ m: 'a' }, { m: 'b', segno: true }, { m: 'c', alCoda: true }, { m: 'e', barra: 'doble', texto: 'D.S. al Coda' }, { m: 'f', coda: true, barra: 'final' }]),
  orden: [0, 1, 2, 3, 1, 2, 4],
}
const CALDERON = {
  compases: mapa([{ m: 'a', respira: true }, { m: 'g', calderon: true, barra: 'final' }]),
  orden: [0, 1],
}
const DINAMICA = {
  compases: mapa([{ m: 'a', dinamica: 'p' }, { m: 'b', regulador: 'cresc', largo: 2 }, { m: 'c' }, { m: 'f', dinamica: 'f', barra: 'final' }]),
  orden: [0, 1, 2, 3],
}

// Notas con volumen y calderón, listas para tocar
function paraTocar(compases, volumenes) {
  return compases.map((c, i) => c.notas.map((n, j) => ({
    ...n,
    calderon: c.calderon && j === c.notas.length - 1,
    vel: volumenes ? volumenes(i, j, c.notas.length) : undefined,
  })))
}

function Recorrido({ orden, k }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginBottom: '12px', fontSize: '14px' }}>
      <span style={{ color: '#5F5E5A', marginRight: '4px' }}>Se canta:</span>
      {orden.map((c, i) => (
        <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
          <span style={{
            minWidth: '24px', height: '24px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 700, fontSize: '12px', padding: '0 4px',
            background: k === i ? COLOR_TEORIA : FONDO_TEORIA, color: k === i ? '#FFFFFF' : COLOR_TEORIA,
          }}>{c + 1}</span>
          {i < orden.length - 1 && <span style={{ color: '#B4B2A9' }}>→</span>}
        </span>
      ))}
    </div>
  )
}

// Mapa + botón para escuchar el recorrido, con el compás que suena resaltado
function VerRecorrido({ ejemplo, volumenes, conOrden = true, texto = '▶ Escuchar el recorrido' }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [actual, setActual] = useState(null)
  const [k, setK] = useState(null)
  const iniciar = () => tocar('r', (fin) => tocarRecorrido({
    compases: paraTocar(ejemplo.compases, volumenes), orden: ejemplo.orden,
    respiraciones: ejemplo.compases.map((c, i) => (c.respira ? i : -1)),
    onCompas: (ci, pos) => { setActual(ci); setK(pos) }, onFin: fin,
  }), () => { setActual(null); setK(null) })
  return (
    <>
      <Partitura><MapaObra compases={ejemplo.compases} actual={actual} /></Partitura>
      {conOrden && <Recorrido orden={ejemplo.orden} k={k} />}
      <Botonera>
        {sonando ? <Boton onClick={() => { parar(); setActual(null); setK(null) }}>■ Parar</Boton> : <Boton onClick={iniciar}>{texto}</Boton>}
      </Botonera>
    </>
  )
}

// Ejercicio: tocar los compases en el orden en que se cantan
function OrdenarRecorrido({ ejemplo, consigna, onOk }) {
  const [hechos, setHechos] = useState([])
  const [error, setError] = useState(null)
  const listo = hechos.length === ejemplo.orden.length
  const tocarCompas = (i) => {
    if (listo) return
    if (i === ejemplo.orden[hechos.length]) {
      const nuevos = [...hechos, i]
      setHechos(nuevos)
      setError(null)
      if (nuevos.length === ejemplo.orden.length) onOk?.()
    } else {
      setError(i)
    }
  }
  const colores = {}
  if (hechos.length && !listo) colores[hechos[hechos.length - 1]] = VERDE_FONDO
  if (error != null) colores[error] = ROJO_FONDO
  return (
    <>
      <Caja><b>{consigna}</b><br />Tocá los compases en el orden en que se cantan, uno por uno.</Caja>
      {listo ? (
        <VerRecorrido ejemplo={ejemplo} />
      ) : (
        <>
          <Partitura><MapaObra compases={ejemplo.compases} colores={colores} onCompas={tocarCompas} /></Partitura>
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '4px', marginBottom: '12px', minHeight: '24px', fontSize: '14px' }}>
            <span style={{ color: '#5F5E5A', marginRight: '4px' }}>Tu recorrido:</span>
            {hechos.length === 0 && <span style={{ color: '#B4B2A9' }}>tocá el primer compás</span>}
            {hechos.map((c, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ minWidth: '24px', height: '24px', borderRadius: '12px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '12px', background: VERDE_FONDO, color: '#0B4A38' }}>{c + 1}</span>
                <span style={{ color: '#B4B2A9' }}>→</span>
              </span>
            ))}
          </div>
          {error != null && <Caja tono="mal">El compás {error + 1} no va ahora. Mirá los signos y probá otro.</Caja>}
          {hechos.length > 0 && <Botonera><Boton onClick={() => { setHechos([]); setError(null) }}>Empezar de nuevo</Boton></Botonera>}
        </>
      )}
      {listo && <Caja tono="ok">¡Perfecto! Ese es el recorrido.</Caja>}
    </>
  )
}

function Dinamicas() {
  const { sonando, tocar, parar } = useReproduccion()
  const ejemplo = { compases: mapa([{ m: 'g', barra: 'final' }]), orden: [0] }
  const sonar = (clave, vel) => tocar(clave, (fin) => tocarRecorrido({ compases: paraTocar(ejemplo.compases, () => vel), orden: [0], onFin: fin }))
  const opciones = [
    { clave: 'p', etiqueta: 'p', nombre: 'piano: suave', vel: 0.22 },
    { clave: 'mf', etiqueta: 'mf', nombre: 'mezzoforte: intermedio', vel: 0.55 },
    { clave: 'f', etiqueta: 'f', nombre: 'forte: fuerte', vel: 1 },
  ]
  return (
    <Botonera>
      {opciones.map((o) => (
        <Boton key={o.clave} activo={sonando === o.clave} onClick={() => (sonando === o.clave ? parar() : sonar(o.clave, o.vel))}>
          <span style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontWeight: 700, fontSize: '16px', marginRight: '6px' }}>{o.etiqueta}</span>
          {o.nombre}
        </Boton>
      ))}
    </Botonera>
  )
}

// Volúmenes del ejemplo de dinámicas: p, crescendo de dos compases y f
const volumenesDinamica = (i, j, n) => {
  if (i === 0) return 0.22
  if (i === 3) return 1
  const avance = ((i - 1) * n + j) / (2 * n - 1)
  return 0.25 + avance * 0.7
}

const PREGUNTAS = [
  {
    componente: ({ onOk }) => (
      <OrdenarRecorrido onOk={onOk} consigna="Barras de repetición"
        ejemplo={{ compases: mapa([{ m: 'a', inicioRep: true }, { m: 'g', barra: 'rep' }, { m: 'b' }, { m: 'f', barra: 'final' }]), orden: [0, 1, 0, 1, 2, 3] }} />
    ),
  },
  {
    componente: ({ onOk }) => (
      <OrdenarRecorrido onOk={onOk} consigna="Casillas 1 y 2"
        ejemplo={{ compases: mapa([{ m: 'a', inicioRep: true }, { m: 'b', casilla: '1.', barra: 'rep' }, { m: 'e', casilla: '2.' }, { m: 'f', barra: 'final' }]), orden: [0, 1, 0, 2, 3] }} />
    ),
  },
  {
    componente: ({ onOk }) => (
      <OrdenarRecorrido onOk={onOk} consigna="D.C. al Fine"
        ejemplo={{ compases: mapa([{ m: 'a' }, { m: 'g', barra: 'doble', texto: 'Fine' }, { m: 'b' }, { m: 'c', barra: 'final', texto: 'D.C. al Fine' }]), orden: [0, 1, 2, 3, 0, 1] }} />
    ),
  },
  {
    texto: 'Sobre una nota hay un calderón. ¿Qué hacés?',
    opciones: ['La canto más corta', 'La sostengo hasta que el director corta', 'Respiro antes de cantarla'],
    correcta: 1,
    explicacion: 'El calderón alarga la nota; cuánto, lo decide el director.',
  },
  {
    texto: 'Debajo del pentagrama dice "p". ¿Cómo cantás?',
    opciones: ['Suave', 'Fuerte', 'Más rápido'],
    correcta: 0,
    explicacion: 'p es piano: suave. f es forte: fuerte.',
  },
]

export default function LeccionMapa({ onCompletar, siguiente, onSiguiente, onVolver }) {
  return (
    <Leccion pasos={[
      {
        render: () => (
          <>
            <Titulo>La partitura es un mapa</Titulo>
            <Caja>
              Una partitura no siempre se lee de corrido, de principio a fin. Hay signos que te dicen <b>que vuelvas atrás</b>,
              que <b>saltes</b> a otra parte o dónde <b>terminar</b>. Si los conocés, nunca te perdés.
            </Caja>
            <Caja>
              Empecemos por el más común: las <b>barras de repetición</b>. Fijate en los dos puntitos: miran hacia
              la música que se repite. Cuando llegás a la barra del final <b>:‖</b> volvés a la del principio <b>‖:</b> y cantás ese tramo otra vez.
            </Caja>
            <VerRecorrido ejemplo={REPETICION} />
            <Caja tono="tip">Si no hay barra de inicio, se vuelve al principio de la obra.</Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Casillas 1 y 2</Titulo>
            <Caja>
              A veces la repetición termina distinto cada vez. La primera vez cantás la <b>casilla 1</b> y volvés.
              La segunda vez <b>saltás la casilla 1</b> y cantás directamente la <b>casilla 2</b>.
            </Caja>
            <VerRecorrido ejemplo={CASILLAS} />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>D.C. al Fine</Titulo>
            <Caja>
              <b>D.C.</b> es "da capo": desde la cabeza, o sea, <b>volvé al principio</b>. "Al Fine" quiere decir que en esa
              vuelta terminás donde dice <b>Fine</b> (fin), aunque la música escrita siga después.
            </Caja>
            <VerRecorrido ejemplo={DC} />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>D.S. al Coda</Titulo>
            <Caja>
              <b>D.S.</b> es "dal segno": volvé al <b>signo</b> (la S cruzada), no al principio. Al llegar al
              círculo con una cruz (<b>coda</b>), saltás al final, donde aparece la misma marca.
            </Caja>
            <VerRecorrido ejemplo={DS} />
            <Caja tono="tip">
              En resumen: <b>D.C.</b> → al principio. <b>D.S.</b> → al signo. <b>Fine</b> → ahí termina. <b>Coda</b> → saltá al final.
            </Caja>
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Calderón y respiración</Titulo>
            <Caja>
              El <b>calderón</b> (un arquito con un punto) sobre una nota quiere decir <b>sostenela más</b>, hasta que el director corte.
              Mirá al director: él decide cuánto dura.
            </Caja>
            <Caja>
              La <b>coma</b> arriba del pentagrama marca dónde <b>respirar</b>. Para que la respiración no llegue tarde,
              la nota de antes se acorta un poquito.
            </Caja>
            <VerRecorrido ejemplo={CALDERON} conOrden={false} texto="▶ Escuchar" />
          </>
        ),
      },
      {
        render: () => (
          <>
            <Titulo>Fuerte y suave</Titulo>
            <Caja>
              Las letras debajo del pentagrama dicen <b>con cuánto volumen</b> cantar. Vienen del italiano: <b>p</b> (piano) es suave,
              <b> f</b> (forte) es fuerte y <b>mf</b> (mezzoforte) es intermedio. Hay más: <b>pp</b> es muy suave y <b>ff</b>, muy fuerte.
            </Caja>
            <Dinamicas />
            <Caja>
              El ángulo abierto hacia la derecha es un <b>crescendo</b>: ir subiendo el volumen poco a poco. Si se cierra, es un
              <b> decrescendo</b>: ir bajando. A veces aparecen escritos como <i>cresc.</i> y <i>dim.</i>
            </Caja>
            <VerRecorrido ejemplo={DINAMICA} volumenes={volumenesDinamica} conOrden={false} texto="▶ Escuchar del p al f" />
          </>
        ),
      },
      {
        render: () => (
          <Repaso preguntas={PREGUNTAS} onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver}
            textoFinal="Ya sabés seguir repeticiones, casillas, D.C., D.S. y coda, y reconocer calderones, respiraciones y dinámicas. Buscalos en las obras que estás estudiando." />
        ),
      },
    ]} />
  )
}
