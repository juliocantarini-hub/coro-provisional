import { useState, useEffect, useRef } from 'react'
import { COLOR_TEORIA, FONDO_TEORIA, BORDE_TEORIA } from '../../lib/teoria'

// Piezas comunes de las lecciones de "Entendé la partitura".

export const VERDE_FONDO = '#DDF3E9'
export const ROJO_FONDO = '#FBE5E3'

export function Caja({ children, tono = 'neutro' }) {
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

export function Boton({ children, onClick, principal = false, disabled = false, activo = false }) {
  return (
    <button onClick={onClick} disabled={disabled} style={{
      padding: '10px 16px', borderRadius: '20px', fontSize: '13px', fontWeight: 600, cursor: disabled ? 'default' : 'pointer',
      border: principal ? 'none' : `1px solid ${BORDE_TEORIA}`,
      background: disabled ? '#E8E6DF' : principal ? COLOR_TEORIA : activo ? FONDO_TEORIA : '#FFFFFF',
      color: disabled ? '#888780' : principal ? '#FFFFFF' : COLOR_TEORIA,
    }}>{children}</button>
  )
}

export function Partitura({ children }) {
  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '12px 8px', marginBottom: '12px' }}>
      {children}
    </div>
  )
}

export function Titulo({ children }) {
  return <div style={{ fontFamily: 'Georgia, serif', fontSize: '19px', color: '#1A1A18', marginBottom: '10px' }}>{children}</div>
}

export function Botonera({ children }) {
  return <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>{children}</div>
}

// Reproducción con botón de parar; se detiene sola al salir de la pantalla.
// tocar(clave, iniciar, alTerminar): iniciar(fin) debe devolver (una promesa de) la función para detener.
// Solo suena un ejemplo a la vez: al empezar uno se corta el que estaba sonando en otro lado.
let pararElAnterior = null

export function useReproduccion() {
  const detener = useRef(null)
  const [sonando, setSonando] = useState(null)
  const parar = () => { detener.current?.(); detener.current = null; setSonando(null) }
  useEffect(() => () => detener.current?.(), [])
  const tocar = async (clave, iniciar, alTerminar) => {
    if (pararElAnterior && pararElAnterior !== parar) pararElAnterior()
    pararElAnterior = parar
    parar()
    setSonando(clave)
    detener.current = await iniciar(() => { alTerminar?.(); detener.current = null; setSonando(null) })
  }
  return { sonando, tocar, parar }
}

// Esqueleto de una lección: barra de pasos, el paso actual y "Anterior / Siguiente".
// pasos: [{ render: () => JSX, puedeSeguir?: bool }]. El último paso es el repaso (sin botones de abajo).
export function Leccion({ pasos }) {
  const [paso, setPaso] = useState(0)
  useEffect(() => { window.scrollTo({ top: 0, behavior: 'smooth' }) }, [paso])
  const ultimo = pasos.length - 1
  const actual = pasos[paso]
  return (
    <div>
      <div style={{ display: 'flex', gap: '5px', marginBottom: '14px' }}>
        {pasos.map((_, i) => (
          <div key={i} style={{ flex: 1, height: '5px', borderRadius: '3px', background: i <= paso ? COLOR_TEORIA : '#E8E6DF' }} />
        ))}
      </div>
      <div key={paso}>{actual.render()}</div>
      {paso < ultimo && (
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', marginTop: '6px' }}>
          {paso > 0 ? <Boton onClick={() => setPaso(paso - 1)}>← Anterior</Boton> : <span />}
          <Boton principal disabled={actual.puedeSeguir === false} onClick={() => setPaso(paso + 1)}>
            {paso === ultimo - 1 ? 'Repasar →' : 'Siguiente →'}
          </Boton>
        </div>
      )}
    </div>
  )
}

// Repaso final. preguntas: de opción múltiple { texto, opciones, correcta, explicacion }
// o especiales { titulo, componente: ({ onOk }) => JSX }.
export function Repaso({ preguntas, textoFinal, onTerminar, siguiente, onSiguiente, onVolver, accionExtra }) {
  const [i, setI] = useState(0)
  const [elegida, setElegida] = useState(null)
  const [okEspecial, setOkEspecial] = useState(false)
  const [fin, setFin] = useState(false)
  if (fin) {
    return (
      <>
        <Titulo>¡Lección completada! 🎉</Titulo>
        <Caja tono="ok">{textoFinal}</Caja>
        {accionExtra && <Botonera><Boton onClick={accionExtra.onClick}>{accionExtra.texto}</Boton></Botonera>}
        {siguiente && !siguiente.disponible && (
          <Caja tono="tip">La próxima lección, <b>{siguiente.titulo}</b>, llega pronto.</Caja>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
          <Boton onClick={onVolver}>← Ver las lecciones</Boton>
          {siguiente?.disponible && <Boton principal onClick={onSiguiente}>Siguiente lección: {siguiente.titulo} →</Boton>}
        </div>
      </>
    )
  }
  const p = preguntas[i]
  const ok = p.componente ? okEspecial : elegida === p.correcta
  const avanzar = () => {
    if (i + 1 < preguntas.length) { setI(i + 1); setElegida(null); setOkEspecial(false) } else { setFin(true); onTerminar?.() }
  }
  return (
    <>
      <Titulo>Repaso · {i + 1} de {preguntas.length}</Titulo>
      {p.componente ? (
        <div key={i}>{p.componente({ onOk: () => setOkEspecial(true) })}</div>
      ) : (
        <>
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
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Boton principal disabled={!ok} onClick={avanzar}>{i + 1 < preguntas.length ? 'Siguiente →' : 'Terminar'}</Boton>
      </div>
    </>
  )
}
