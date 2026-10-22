import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  NIVELES, EJERCICIOS_POR_NIVEL, EJERCICIOS_PARA_AVANZAR, APROBADO_PCT,
  armarEjercicio, corregir, estrellasPara, nivelPorId,
} from '../lib/ritmo'
import { crearMotorRitmo, precargarPiano } from '../lib/ritmoAudio'
import RitmoPartitura, { COLOR_ESTADO } from './RitmoPartitura'
import BotonVolver from './BotonVolver'

const VERDE = '#0F6E56'
const DORADO = '#E9A91B'

function Estrellas({ n, max = 3, size = 14 }) {
  return (
    <span aria-label={`${n} de ${max} estrellas`} style={{ whiteSpace: 'nowrap' }}>
      {Array.from({ length: max }, (_, i) => (
        <span key={i} style={{ fontSize: `${size}px`, color: i < n ? DORADO : '#D3D1C7' }}>★</span>
      ))}
    </span>
  )
}

const boton = (primario, extra = {}) => ({
  flex: '1 1 0', minWidth: 0, padding: '13px 10px', borderRadius: '12px', cursor: 'pointer',
  fontSize: '14px', fontWeight: 600,
  border: primario ? 'none' : `1px solid ${VERDE}`,
  background: primario ? VERDE : '#FFFFFF',
  color: primario ? '#FFFFFF' : VERDE,
  ...extra,
})

// Los tiempos del compás, para seguirlos mientras suena: se enciende el pulso que está sonando
function ContadorPulsos({ ej, pulso }) {
  const ppc = ej.pulsosPorCompas
  const enCurso = pulso >= 0
  const enCompas = enCurso ? pulso % ppc : -1
  const compas = enCurso ? Math.floor(pulso / ppc) + 1 : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px', marginTop: '2px' }}>
      <div style={{ fontSize: '10px', color: '#B4B2A9', minWidth: '70px', textAlign: 'right' }}>
        {compas ? `Compás ${compas} de ${ej.compases.length}` : ' '}
      </div>
      <div style={{ display: 'flex', gap: '6px' }}>
        {Array.from({ length: ppc }, (_, i) => {
          const activo = i === enCompas
          return (
            <div key={i} style={{
              width: '24px', height: '24px', borderRadius: '7px', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 600, transition: 'background 80ms, color 80ms',
              background: activo ? (i === 0 ? '#F0DDB0' : '#CDE7DC') : '#EFEDE4',
              color: activo ? (i === 0 ? '#8A6D1D' : VERDE) : '#CFCDC2',
            }}>{i + 1}</div>
          )
        })}
      </div>
      <div style={{ minWidth: '70px' }} />
    </div>
  )
}

// ─── Pantalla de un ejercicio ──────────────────────────────────────────────

function PantallaEjercicio({ nivelId, numero, prog, onCerrar, onIr }) {
  const ej = useMemo(() => armarEjercicio(nivelId, numero), [nivelId, numero])
  const nivel = nivelPorId(nivelId)
  const motorRef = useRef(null)
  const ctlRef = useRef(null)
  const [fase, setFase] = useState('listo') // listo | escuchando | practica | resultado
  const [conteo, setConteo] = useState(null)
  const [activa, setActiva] = useState(-1)
  const [pulso, setPulso] = useState(-1)
  const [resultado, setResultado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [pulsado, setPulsado] = useState(false)
  const [sinAudio, setSinAudio] = useState(false)

  const turnoRef = useRef(0)
  const [cargandoPiano, setCargandoPiano] = useState(false)

  useEffect(() => { precargarPiano() }, [])
  useEffect(() => () => { turnoRef.current++; if (motorRef.current) motorRef.current.parar() }, [])

  const terminarIntento = (toques) => {
    const r = corregir(ej, toques)
    setResultado(r)
    setFase('resultado')
    if (toques.length === 0) { setAviso({ sinToques: true }); return }
    const antes = prog.estado
    const previo = prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)
    const despues = prog.registrar(nivelId, numero, r.pct)
    const siguienteNivel = nivelId < NIVELES.length ? nivelId + 1 : null
    setAviso({
      sinToques: false,
      record: !!previo && r.pct > (previo.mejor_pct || 0),
      primeraVez: !previo,
      nivelSuperado: !antes[nivelId - 1].superado && despues[nivelId - 1].superado,
      abre: siguienteNivel && !antes[nivelId].abierto && despues[nivelId].abierto ? siguienteNivel : null,
    })
  }

  const iniciar = async (practica) => {
    if (!motorRef.current) motorRef.current = crearMotorRitmo()
    const ok = await motorRef.current.asegurar()
    if (!ok) { setSinAudio(true); return }
    setSinAudio(false)
    setResultado(null); setAviso(null); setActiva(-1); setPulso(-1)
    const turno = ++turnoRef.current
    if (!practica) {
      // El ejemplo suena en piano; si todavía no bajó, se espera un momento (si no se puede, suena un tono simple)
      setFase('escuchando'); setConteo(null); setCargandoPiano(true)
      await motorRef.current.prepararPiano()
      setCargandoPiano(false)
      if (turno !== turnoRef.current) return
    }
    setConteo(0) // 0 = esperando el primer clic del conteo
    setFase(practica ? 'practica' : 'escuchando')
    ctlRef.current = motorRef.current.correr(ej, {
      tonos: !practica,
      onConteo: (n) => setConteo(n),
      onPulso: (b) => setPulso(b),
      onEntrada: (i) => { setConteo(null); setActiva(i) },
      onFin: () => {
        setActiva(-1); setConteo(null); setPulso(-1)
        if (practica) terminarIntento(ctlRef.current ? ctlRef.current.toques.slice() : [])
        else setFase('listo')
      },
    })
  }

  const detener = () => {
    turnoRef.current++
    setCargandoPiano(false)
    if (ctlRef.current) ctlRef.current.parar()
    setFase('listo'); setActiva(-1); setConteo(null); setPulso(-1)
  }

  const tocar = useCallback((marca) => {
    if (fase !== 'practica' || !ctlRef.current) return
    ctlRef.current.tomarToque(marca)
    setPulsado(true)
    setTimeout(() => setPulsado(false), 90)
  }, [fase])

  useEffect(() => {
    if (fase !== 'practica') return undefined
    const alTeclear = (e) => {
      if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tocar(e.timeStamp) }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [fase, tocar])

  const hayOtro = numero < EJERCICIOS_POR_NIVEL
  const proximo = (() => {
    if (!resultado?.aprobado) return null
    if (hayOtro) return { nivel: nivelId, numero: numero + 1, texto: 'Siguiente ejercicio →' }
    if (nivelId < NIVELES.length && prog.estado[nivelId]?.abierto) return { nivel: nivelId + 1, numero: 1, texto: `Nivel ${nivelId + 1} →` }
    return null
  })()

  const estado = (() => {
    if (fase === 'escuchando' && cargandoPiano) return 'Preparando el sonido de piano…'
    if (fase === 'escuchando') return conteo != null ? `Contá con el pulso… ${conteo || ''}` : '🔊 Escuchá el ejemplo y seguí la partitura'
    if (fase === 'practica') return conteo != null ? `Contá con el pulso y esperá… ${conteo || ''}` : '¡Ahora vos! Tocá el botón en cada nota'
    return null
  })()

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#F1EFE8', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
        borderBottom: '1px solid #E8E6DF', background: '#FFFFFF',
      }}>
        <button onClick={() => { if (ctlRef.current) ctlRef.current.parar(); onCerrar() }} title="Volver"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #D3D1C7', background: '#FFFFFF', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ej.titulo}</div>
          <div style={{ fontSize: '11px', color: '#888780' }}>Compás de {ej.pulsosPorCompas}/{ej.tipoPulso} · negra = {ej.tempo}</div>
        </div>
        <Estrellas n={estrellasPara(prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)?.mejor_pct)} />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 14px 8px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {estado && (
            <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: VERDE, minHeight: '20px' }}>{estado}</div>
          )}
          {conteo != null && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {Array.from({ length: ej.pulsosPorCompas }, (_, i) => (
                <div key={i} style={{
                  width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, fontSize: '15px',
                  background: i + 1 <= conteo ? VERDE : '#EAE7DD', color: i + 1 <= conteo ? '#FFFFFF' : '#888780',
                }}>{i + 1}</div>
              ))}
            </div>
          )}

          <RitmoPartitura ejercicio={ej} entradaActiva={activa} resultado={resultado} />
          {(fase === 'escuchando' || fase === 'practica') && <ContadorPulsos ej={ej} pulso={pulso} />}

          {fase === 'listo' && !resultado && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px', fontSize: '13px', color: '#5F5E5A', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 600, color: '#1A1A18', marginBottom: '4px' }}>{nivel.nombre}</div>
              <div style={{ marginBottom: '8px' }}>{nivel.descr}</div>
              <div>1. Tocá <b>Escuchar ejemplo</b> y mirá cómo se escribe.</div>
              <div>2. Tocá <b>Marcar el ritmo</b>: hay un compás de conteo y después tocás el botón grande justo en cada nota. En los silencios no toques.</div>
              <div style={{ marginTop: '8px', color: '#888780', fontSize: '12px' }}>Con auriculares se oye mejor el pulso. Para aprobar necesitás {APROBADO_PCT} %.</div>
            </div>
          )}

          {sinAudio && (
            <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#501313' }}>
              No pudimos activar el sonido. Revisá que el teléfono no esté en silencio y probá de nuevo.
            </div>
          )}

          {fase === 'resultado' && resultado && (
            <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {aviso?.sinToques ? (
                <div style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: 1.5 }}>
                  No detectamos ningún toque. Tocá el botón grande (o la barra espaciadora) en cada nota. Este intento no cuenta.
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '40px', fontWeight: 700, lineHeight: 1, color: resultado.aprobado ? VERDE : '#B5791B' }}>{resultado.pct} %</div>
                    <div style={{ textAlign: 'center' }}>
                      <Estrellas n={estrellasPara(resultado.pct)} size={22} />
                      <div style={{ fontSize: '14px', fontWeight: 600, color: resultado.aprobado ? VERDE : '#B5791B' }}>
                        {resultado.aprobado ? '¡Aprobado!' : `Casi: para aprobar necesitás ${APROBADO_PCT} %`}
                      </div>
                    </div>
                  </div>
                  {aviso?.record && <div style={{ textAlign: 'center', fontSize: '13px', color: '#8A6D1D', fontWeight: 600 }}>🏆 ¡Nuevo récord en este ejercicio!</div>}
                  {aviso?.nivelSuperado && (
                    <div style={{ textAlign: 'center', background: '#E1F5EE', border: '1px solid #9FD9C5', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#04342C' }}>
                      🎉 ¡Nivel «{nivel.nombre}» superado!{aviso.abre ? ` Se abrió «${nivelPorId(aviso.abre).nombre}».` : ''}
                    </div>
                  )}
                </>
              )}
              {!aviso?.sinToques && (
                <div style={{ fontSize: '13px', color: '#5F5E5A', textAlign: 'center' }}>
                  {resultado.notas.filter((n) => n.estado === 'ok').length} de {resultado.notas.length} entradas justas
                  {resultado.extras ? ` · ${resultado.extras} toque${resultado.extras === 1 ? '' : 's'} de más` : ''}
                </div>
              )}
              {resultado.mensajes.length > 0 && !aviso?.sinToques && (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#5F5E5A', lineHeight: 1.5 }}>
                  {resultado.mensajes.map((m, i) => <li key={i}>{m}</li>)}
                </ul>
              )}
              {!aviso?.sinToques && (
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '11px', color: '#888780' }}>
                  {[['ok', 'justa'], ['leve', 'casi'], ['fuera', 'fuera de tiempo'], ['falta', 'no la tocaste']].map(([k, t]) => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: COLOR_ESTADO[k] }} />{t}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid #E8E6DF', background: '#FFFFFF', padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {fase === 'listo' && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => iniciar(false)} style={boton(false)}>🔊 Escuchar ejemplo</button>
              <button onClick={() => iniciar(true)} style={boton(true)}>🥁 Marcar el ritmo</button>
            </div>
          )}
          {fase === 'escuchando' && (
            <button onClick={detener} style={{ ...boton(false), width: '100%' }}>⏹ Detener</button>
          )}
          {fase === 'practica' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
              <button
                onPointerDown={(e) => { e.preventDefault(); tocar(e.nativeEvent.timeStamp) }}
                onContextMenu={(e) => e.preventDefault()}
                style={{
                  width: '132px', height: '132px', borderRadius: '50%', border: 'none', cursor: 'pointer',
                  background: pulsado ? '#0A5441' : VERDE, color: '#FFFFFF', fontSize: '15px', fontWeight: 700,
                  boxShadow: pulsado ? 'inset 0 3px 8px rgba(0,0,0,0.3)' : '0 4px 12px rgba(15,110,86,0.35)',
                  transform: pulsado ? 'scale(0.96)' : 'scale(1)', transition: 'transform 60ms',
                  touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
                }}>
                TOCÁ ACÁ
              </button>
              <div style={{ fontSize: '11px', color: '#888780' }}>También podés usar la barra espaciadora</div>
              <button onClick={detener} style={{ background: 'none', border: 'none', color: '#888780', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
            </div>
          )}
          {fase === 'resultado' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {proximo && (
                <button onClick={() => onIr({ nivel: proximo.nivel, numero: proximo.numero })} style={{ ...boton(true), width: '100%' }}>{proximo.texto}</button>
              )}
              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={() => iniciar(true)} style={boton(!proximo)}>🔁 Intentar de nuevo</button>
                <button onClick={() => { setResultado(null); setAviso(null); setFase('listo') }} style={boton(false)}>🔊 Escuchar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Listas de niveles y ejercicios ────────────────────────────────────────

function FilaNivel({ nivel, info, anterior, onAbrir }) {
  const cerrado = !info.abierto
  return (
    <div onClick={() => { if (!cerrado) onAbrir() }}
      style={{
        background: '#FFFFFF', border: `1px solid ${info.superado ? '#9FD9C5' : '#E8E6DF'}`, borderRadius: '12px',
        padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '12px',
        cursor: cerrado ? 'default' : 'pointer', opacity: cerrado ? 0.6 : 1,
      }}>
      <div style={{
        width: '38px', height: '38px', borderRadius: '50%', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: cerrado ? '#EAE7DD' : info.superado ? VERDE : '#E1F5EE', color: info.superado ? '#FFFFFF' : VERDE,
        fontWeight: 700, fontSize: '15px',
      }}>
        {cerrado ? '🔒' : info.superado ? '✓' : nivel.id}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{nivel.id}. {nivel.nombre}</div>
        <div style={{ fontSize: '12px', color: '#888780', lineHeight: 1.4 }}>
          {cerrado ? `Aprobá ${EJERCICIOS_PARA_AVANZAR} ejercicios de «${anterior.nombre}» para abrirlo.` : nivel.descr}
        </div>
      </div>
      {!cerrado && (
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div style={{ fontSize: '12px', color: '#5F5E5A' }}>{Math.min(info.aprobados, EJERCICIOS_PARA_AVANZAR)}/{EJERCICIOS_PARA_AVANZAR} aprobados</div>
          <div style={{ fontSize: '12px', color: '#B5791B', fontWeight: 600 }}>★ {info.estrellas}/{info.estrellasMax}</div>
        </div>
      )}
    </div>
  )
}

function ListaEjercicios({ nivelId, prog, onVolver, onElegir }) {
  const nivel = nivelPorId(nivelId)
  const info = prog.estado[nivelId - 1]
  return (
    <div>
      <BotonVolver texto="Todos los niveles" onClick={onVolver} />
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontFamily: 'Georgia, serif', fontSize: '18px', color: '#1A1A18' }}>{nivel.id}. {nivel.nombre}</div>
        <div style={{ fontSize: '13px', color: '#888780' }}>{nivel.descr}</div>
        <div style={{ fontSize: '12px', color: '#5F5E5A', marginTop: '6px' }}>
          Aprobá {EJERCICIOS_PARA_AVANZAR} de {EJERCICIOS_POR_NIVEL} ejercicios con {APROBADO_PCT} % o más para abrir el nivel siguiente.
          {info.superado && ' ¡Ya lo superaste!'}
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {Array.from({ length: EJERCICIOS_POR_NIVEL }, (_, i) => i + 1).map((n) => {
          const fila = prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === n)
          const aprobado = (fila?.mejor_pct || 0) >= APROBADO_PCT
          return (
            <div key={n} onClick={() => onElegir(n)} style={{
              background: '#FFFFFF', border: `1px solid ${aprobado ? '#9FD9C5' : '#E8E6DF'}`, borderRadius: '12px',
              padding: '13px 14px', display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
            }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A18' }}>Ejercicio {n}</div>
                <div style={{ fontSize: '12px', color: '#888780' }}>
                  {fila ? `Mejor: ${fila.mejor_pct} % · ${fila.intentos} ${fila.intentos === 1 ? 'intento' : 'intentos'}` : 'Todavía no lo hiciste'}
                </div>
              </div>
              <Estrellas n={estrellasPara(fila?.mejor_pct)} size={17} />
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9" style={{ flexShrink: 0 }}><path d="M8 5v14l11-7z" /></svg>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function RitmoEntrenamiento({ prog, onSalir }) {
  const [nivelSel, setNivelSel] = useState(null)
  const [ejercicio, setEjercicio] = useState(null) // { nivel, numero }

  if (prog.cargando) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {[1, 2, 3].map((i) => <div key={i} style={{ height: '70px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
        <style>{'@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}'}</style>
      </div>
    )
  }

  return (
    <div>
      {nivelSel == null ? (
        <>
          <BotonVolver texto="Entrenamiento" onClick={onSalir} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', background: '#FBF3DF', border: '1px solid #E8DBAE', borderRadius: '12px', padding: '10px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', color: '#8A6D1D', lineHeight: 1.4 }}>
              Escuchá, mirá la partitura y marcá el ritmo. Aprobando 3 ejercicios se abre el nivel siguiente.
            </div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#8A6D1D', whiteSpace: 'nowrap' }}>★ {prog.estrellas}</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {NIVELES.map((n, i) => (
              <FilaNivel key={n.id} nivel={n} info={prog.estado[i]} anterior={NIVELES[i - 1]} onAbrir={() => setNivelSel(n.id)} />
            ))}
          </div>
          {prog.soloLocal && (
            <div style={{ marginTop: '12px', fontSize: '11px', color: '#888780', textAlign: 'center' }}>
              Tu progreso se está guardando en este dispositivo.
            </div>
          )}
        </>
      ) : (
        <ListaEjercicios nivelId={nivelSel} prog={prog} onVolver={() => setNivelSel(null)} onElegir={(n) => setEjercicio({ nivel: nivelSel, numero: n })} />
      )}

      {ejercicio && (
        <PantallaEjercicio
          key={`${ejercicio.nivel}-${ejercicio.numero}`}
          nivelId={ejercicio.nivel}
          numero={ejercicio.numero}
          prog={prog}
          onCerrar={() => setEjercicio(null)}
          onIr={(sig) => { setNivelSel(sig.nivel); setEjercicio(sig) }}
        />
      )}
    </div>
  )
}
