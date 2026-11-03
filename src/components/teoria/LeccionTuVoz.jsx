import { useState, useEffect, useRef } from 'react'
import SistemaCoral from './SistemaCoral'
import { frase, vozSATB, NOMBRE_VOZ_SATB, tocarFrase, tocarNota, COLOR_TEORIA, FONDO_TEORIA, BORDE_TEORIA } from '../../lib/teoria'

// Lección 1: "Tu voz en la partitura". Encontrar el propio renglón en una partitura SATB, seguirlo
// de un sistema al siguiente, ubicar los números de compás y escuchar la nota de entrada.

const FRASE = frase({
  S: ['E5:1 D5:1 C5:2', 'D5:1 E5:1 D5:2', 'C5:1 B4:1 A4:1 B4:1', 'C5:4'],
  A: ['G4:1 G4:1 G4:2', 'G4:1 G4:1 G4:2', 'E4:1 E4:1 F4:1 F4:1', 'E4:4'],
  T: ['C5:1 B4:1 C5:2', 'B4:1 C5:1 B4:2', 'A4:1 G4:1 C5:1 D5:1', 'C5:4'],
  B: ['C3:1 G2:1 C3:2', 'G2:1 C3:1 G2:2', 'A2:1 E3:1 F3:1 G2:1', 'C3:4'],
})

const VERDE_FONDO = '#DDF3E9'
const ROJO_FONDO = '#FBE5E3'

const PREGUNTAS = [
  {
    texto: 'De arriba hacia abajo, ¿en qué orden están las voces?',
    opciones: ['Soprano, Contralto, Tenor, Bajo', 'Bajo, Tenor, Contralto, Soprano', 'Soprano, Tenor, Contralto, Bajo'],
    correcta: 0,
    explicacion: 'De la más aguda a la más grave.',
  },
  {
    texto: 'Llegaste al final de un sistema. ¿Dónde seguís cantando?',
    opciones: ['En el renglón de abajo, dentro del mismo sistema', 'En mi mismo renglón, en el sistema siguiente', 'Vuelvo al principio de la página'],
    correcta: 1,
    explicacion: 'Tu renglón ocupa siempre el mismo lugar en cada sistema.',
  },
  {
    texto: 'El director dice "desde el compás 9" y el sistema empieza con el número 8. ¿Dónde empezás?',
    opciones: ['En el primer compás de ese sistema', 'En el segundo compás de ese sistema', 'En el sistema siguiente'],
    correcta: 1,
    explicacion: 'El primer compás es el 8, así que el siguiente es el 9.',
  },
  {
    texto: 'El 8 chiquito debajo de la clave de los tenores significa…',
    opciones: ['Que la obra tiene 8 compases', 'Que se canta una octava más grave de lo que está escrito', 'Que hay que cantar más fuerte'],
    correcta: 1,
    explicacion: 'Así los tenores leen en clave de sol, pero cantan en su registro real.',
  },
]

function Caja({ children, tono = 'neutro' }) {
  const estilos = {
    neutro: { background: '#FFFFFF', border: '1px solid #E8E6DF', color: '#1A1A18' },
    tip: { background: FONDO_TEORIA, border: `1px solid ${BORDE_TEORIA}`, color: '#5B2350' },
    ok: { background: VERDE_FONDO, border: '1px solid #9FD9C5', color: '#0B4A38' },
    mal: { background: ROJO_FONDO, border: '1px solid #F0B7B2', color: '#7A1F1A' },
  }
  return (
    <div style={{ ...estilos[tono], borderRadius: '12px', padding: '12px 14px', fontSize: '14px', lineHeight: 1.5, marginBottom: '12px' }}>
      {children}
    </div>
  )
}

function Boton({ children, onClick, principal = false, disabled = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
      border: principal ? 'none' : `1px solid ${BORDE_TEORIA}`,
      background: disabled ? '#E8E6DF' : principal ? COLOR_TEORIA : '#FFFFFF',
      color: disabled ? '#888780' : principal ? '#FFFFFF' : COLOR_TEORIA,
    }}>{children}</button>
  )
}

function Partitura({ children }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '12px 8px', marginBottom: '12px' }}>
      {children}
    </div>
  )
}

// Reproducción con botón de parar; se detiene sola al salir de la pantalla
function useReproduccion() {
  const detener = useRef(null)
  const [sonando, setSonando] = useState(null)
  const parar = () => { detener.current?.(); detener.current = null; setSonando(null) }
  useEffect(() => () => detener.current?.(), [])
  const tocar = async (clave, opciones) => {
    parar()
    setSonando(clave)
    detener.current = await tocarFrase({ ...opciones, onFin: () => { opciones.onFin?.(); detener.current = null; setSonando(null) } })
  }
  return { sonando, tocar, parar }
}

export default function LeccionTuVoz({ voz, onCompletar, siguiente, onSiguiente, onVolver }) {
  const info = vozSATB(voz)
  const [paso, setPaso] = useState(0)
  const [elegida, setElegida] = useState(null) // renglón que el cantante reconoce como suyo
  const [intento, setIntento] = useState(null) // último renglón tocado en el paso 1
  const PASOS = 6
  // Al cambiar de paso, volver arriba (en el celular el paso nuevo quedaba a mitad de pantalla)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [paso])

  const siguientePermitido = paso !== 1 || elegida != null

  return (
    <div>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '14px' }}>
        {Array.from({ length: PASOS }, (_, i) => (
          <div key={i} style={{ flex: 1, height: '5px', borderRadius: '3px', background: i <= paso ? COLOR_TEORIA : '#E8E6DF' }} />
        ))}
      </div>

      {paso === 0 && <PasoSistema />}
      {paso === 1 && <PasoTuRenglon info={info} elegida={elegida} intento={intento} onTocar={(v) => {
        setIntento(v)
        if (!info || info.validas.includes(v)) setElegida(v)
      }} />}
      {paso === 2 && <PasoSeguir voz={elegida} />}
      {paso === 3 && <PasoCompases />}
      {paso === 4 && <PasoEntrada voz={elegida} />}
      {paso === 5 && <PasoPreguntas onTerminar={onCompletar} siguiente={siguiente} onSiguiente={onSiguiente} onVolver={onVolver} />}

      {paso < 5 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
          {paso > 0 ? <Boton onClick={() => setPaso(paso - 1)}>← Anterior</Boton> : <span />}
          <Boton principal disabled={!siguientePermitido} onClick={() => setPaso(paso + 1)}>
            {paso === 4 ? 'Repasar con preguntas →' : 'Siguiente →'}
          </Boton>
        </div>
      )}
    </div>
  )
}

function PasoSistema() {
  const { sonando, tocar, parar } = useReproduccion()
  return (
    <>
      <Titulo>Una partitura de coro</Titulo>
      <Caja>
        Cada voz tiene su propio renglón (se llama <b>pentagrama</b>). De arriba hacia abajo van de la más aguda
        a la más grave: <b>Soprano, Contralto, Tenor y Bajo</b>.
        <br />Los cuatro renglones unidos por la línea de la izquierda suenan al mismo tiempo: juntos forman un <b>sistema</b>.
      </Caja>
      <Partitura>
        <SistemaCoral frase={FRASE} desde={0} hasta={2} conCompas />
      </Partitura>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {sonando
          ? <Boton onClick={parar}>■ Parar</Boton>
          : <Boton onClick={() => tocar('todas', { frase: FRASE, voces: ['S', 'A', 'T', 'B'], desde: 0, hasta: 2 })}>▶ Escuchar las cuatro voces</Boton>}
      </div>
    </>
  )
}

function PasoTuRenglon({ info, elegida, intento, onTocar }) {
  const resaltes = {}
  if (intento) resaltes[intento] = (!info || info.validas.includes(intento)) ? VERDE_FONDO : ROJO_FONDO
  let mensaje = null
  if (intento) {
    if (!info) {
      mensaje = <Caja tono="ok">Elegiste el renglón de <b>{NOMBRE_VOZ_SATB[intento]}</b>. Vamos a usar ese en el resto de la lección.</Caja>
    } else if (info.validas.includes(intento)) {
      mensaje = (
        <Caja tono="ok">
          ¡Ese es! Tu renglón es el de <b>{NOMBRE_VOZ_SATB[intento]}</b>, y va a estar siempre en el mismo lugar dentro de cada sistema.
          {info.nombre && <><br />Como {info.nombre.toLowerCase()}, según la obra vas a cantar en la línea de {NOMBRE_VOZ_SATB[info.validas[0]]} o de {NOMBRE_VOZ_SATB[info.validas[1]]}. Tu director te dice cuál.</>}
        </Caja>
      )
    } else {
      mensaje = <Caja tono="mal">Ese es el renglón de {NOMBRE_VOZ_SATB[intento]}. El tuyo está en otro lugar: probá de nuevo.</Caja>
    }
  }
  return (
    <>
      <Titulo>¿Cuál es tu renglón?</Titulo>
      <Caja>
        {info
          ? <>Tocá en la partitura el renglón que cantás vos.</>
          : <>Tocá en la partitura el renglón de tu voz. (Si en tu perfil cargás tu cuerda, la app te lo va a poder confirmar).</>}
      </Caja>
      <Partitura>
        <SistemaCoral frase={FRASE} desde={0} hasta={2} conCompas resaltes={resaltes} onPentagrama={onTocar}
          descripcion="Partitura coral: tocá tu renglón" />
      </Partitura>
      {mensaje}
      {elegida && (
        <>
          <Caja tono="tip">
            <b>¿Viste el 8 chiquito debajo de la clave del Tenor?</b> Quiere decir que se canta una octava más grave de lo que
            está escrito. Así los tenores leen en la misma clave que las sopranos, pero cantan en su registro.
          </Caja>
          <Caja tono="tip">
            <b>¿Y si en tu partitura dos voces comparten un renglón?</b> Pasa seguido: Soprano y Contralto en uno, Tenor y
            Bajo en otro. Las notas con el palito (la <b>plica</b>) hacia arriba son de la voz más aguda, y las de plica hacia
            abajo, de la más grave.
          </Caja>
        </>
      )}
    </>
  )
}

function PasoSeguir({ voz }) {
  const { sonando, tocar, parar } = useReproduccion()
  const [sistema, setSistema] = useState(0)
  const [activa, setActiva] = useState(null)
  const opciones = (voces) => ({
    frase: FRASE, voces, guia: voz, desde: 0, hasta: 4,
    onNota: (n) => { setActiva(n); setSistema(n.compas >= 2 ? 1 : 0) },
    onFin: () => setActiva(null),
  })
  const detener = () => { parar(); setActiva(null) }
  return (
    <>
      <Titulo>Seguí tu renglón</Titulo>
      <Caja>
        La música se lee de izquierda a derecha. Cuando termina un sistema, pasás al de abajo y buscás tu renglón
        <b> en el mismo lugar</b>. Escuchá y seguí la nota que se va marcando.
      </Caja>
      <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
        {[0, 1].map((s) => (
          <button key={s} onClick={() => setSistema(s)} style={{
            padding: '5px 12px', borderRadius: '14px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${sistema === s ? COLOR_TEORIA : '#E8E6DF'}`,
            background: sistema === s ? FONDO_TEORIA : '#FFFFFF', color: sistema === s ? COLOR_TEORIA : '#5F5E5A', fontWeight: 600,
          }}>Sistema {s + 1}</button>
        ))}
      </div>
      <Partitura>
        <SistemaCoral frase={FRASE} desde={sistema * 2} hasta={sistema * 2 + 2} conCompas={sistema === 0} final={sistema === 1}
          resaltes={{ [voz]: FONDO_TEORIA }} notaActiva={activa} />
      </Partitura>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        {sonando ? <Boton onClick={detener}>■ Parar</Boton> : (
          <>
            <Boton onClick={() => tocar('mia', opciones([voz]))}>▶ Mi voz sola</Boton>
            <Boton onClick={() => tocar('todas', opciones(['S', 'A', 'T', 'B']))}>▶ Con las otras voces</Boton>
          </>
        )}
      </div>
      <Caja tono="tip">Con las otras voces es más difícil: probá no perder tu renglón aunque escuches a los demás.</Caja>
    </>
  )
}

function PasoCompases() {
  const objetivos = [4, 2]
  const [n, setN] = useState(0)
  const [respuesta, setRespuesta] = useState(null) // { compas, ok }
  const terminado = n >= objetivos.length
  const tocar = (m) => {
    if (terminado) return
    const ok = m + 1 === objetivos[n]
    setRespuesta({ compas: m, ok })
    if (ok) setTimeout(() => { setN((x) => x + 1); setRespuesta(null) }, 1100)
  }
  const sistemaProps = (s) => ({
    frase: FRASE, desde: s * 2, hasta: s * 2 + 2, conCompas: s === 0, final: s === 1, onCompas: tocar,
    compasResaltado: respuesta?.compas, colorCompas: respuesta?.ok ? VERDE_FONDO : ROJO_FONDO,
  })
  return (
    <>
      <Titulo>Los números de compás</Titulo>
      <Caja>
        Las rayitas verticales dividen la música en <b>compases</b>. El número de arriba, al principio de cada sistema,
        dice qué compás es el primero. Para encontrar otro, contás desde ahí.
      </Caja>
      <Caja tono={terminado ? 'ok' : 'tip'}>
        {terminado
          ? <>¡Muy bien! Así encontrás el lugar cuando el director dice "desde el compás…".</>
          : <><b>Tocá el compás {objetivos[n]}.</b>{respuesta && !respuesta.ok && <> Ese es el compás {respuesta.compas + 1}. Probá de nuevo.</>}</>}
      </Caja>
      <Partitura><SistemaCoral {...sistemaProps(0)} /></Partitura>
      <Partitura><SistemaCoral {...sistemaProps(1)} /></Partitura>
    </>
  )
}

function PasoEntrada({ voz }) {
  const primera = FRASE[voz][0][0]
  return (
    <>
      <Titulo>Tu nota de entrada</Titulo>
      <Caja>
        Antes de empezar, buscá tu <b>primera nota</b> y escuchala. Tenerla en el oído (o tararearla bajito) te ayuda
        a entrar afinado desde el principio.
      </Caja>
      <Partitura>
        <SistemaCoral frase={FRASE} desde={0} hasta={2} conCompas resaltes={{ [voz]: FONDO_TEORIA }}
          notaActiva={{ voz, compas: 0, i: 0 }} />
      </Partitura>
      <div style={{ marginBottom: '12px' }}>
        <Boton onClick={() => tocarNota(primera.paso, voz)}>🔊 Escuchar mi primera nota</Boton>
      </div>
      <Caja tono="tip">
        En casa la podés buscar con <b>"Buscá tu nota"</b>, arriba en Entrenamiento. En el ensayo, si no la tenés, pedila:
        es lo más normal del mundo.
      </Caja>
    </>
  )
}

function PasoPreguntas({ onTerminar, siguiente, onSiguiente, onVolver }) {
  const [i, setI] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [fin, setFin] = useState(false)
  if (fin) {
    return (
      <>
        <Titulo>¡Lección completada! 🎉</Titulo>
        <Caja tono="ok">
          Ya sabés encontrar tu renglón, seguirlo de un sistema al otro, ubicar un compás y buscar tu nota de entrada.
          Probalo en la próxima obra que estudies.
        </Caja>
        {siguiente && !siguiente.disponible && (
          <Caja tono="tip">La próxima lección, <b>{siguiente.titulo}</b>, llega pronto.</Caja>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <Boton onClick={onVolver}>← Ver las lecciones</Boton>
          {siguiente?.disponible && (
            <Boton principal onClick={onSiguiente}>Siguiente lección: {siguiente.titulo} →</Boton>
          )}
        </div>
      </>
    )
  }
  const p = PREGUNTAS[i]
  const ok = elegida === p.correcta
  return (
    <>
      <Titulo>Repaso · {i + 1} de {PREGUNTAS.length}</Titulo>
      <Caja><b>{p.texto}</b></Caja>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
        {p.opciones.map((o, k) => {
          const marcada = elegida === k
          return (
            <button key={k} onClick={() => !ok && setElegida(k)} style={{
              textAlign: 'left', padding: '12px 14px', borderRadius: '12px', fontSize: '14px', cursor: ok ? 'default' : 'pointer',
              border: `1px solid ${marcada ? (k === p.correcta ? '#9FD9C5' : '#F0B7B2') : '#E8E6DF'}`,
              background: marcada ? (k === p.correcta ? VERDE_FONDO : ROJO_FONDO) : '#FFFFFF', color: '#1A1A18',
            }}>{o}</button>
          )
        })}
      </div>
      {elegida != null && (ok
        ? <Caja tono="ok">¡Correcto! {p.explicacion}</Caja>
        : <Caja tono="mal">No es esa. Probá otra vez.</Caja>)}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Boton principal disabled={!ok} onClick={() => {
          if (i + 1 < PREGUNTAS.length) { setI(i + 1); setElegida(null) } else { setFin(true); onTerminar?.() }
        }}>{i + 1 < PREGUNTAS.length ? 'Siguiente →' : 'Terminar'}</Boton>
      </div>
    </>
  )
}

function Titulo({ children }) {
  return <div style={{ fontFamily: 'Georgia, serif', fontSize: '19px', color: '#1A1A18', marginBottom: '10px' }}>{children}</div>
}
