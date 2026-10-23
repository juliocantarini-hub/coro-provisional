import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import {
  NIVELES_DICTADO, EJERCICIOS_POR_NIVEL, APROBADO_PCT, estrellasPara, nivelDictado,
  armarDictado, corregir, corregirDictado, ejercicioDeRespuesta, duracionCompas, nombreFigura, transcribirToques,
} from '../lib/ritmoDictado'
import { crearMotorRitmo, precargarPiano } from '../lib/ritmoAudio'
import RitmoPartitura, { COLOR_ESTADO } from './RitmoPartitura'
import { CompasRitmo, FiguraIcono } from './FigurasRitmo'
import { VERDE, Estrellas, boton, ContadorPulsos } from './RitmoUI'
import { leerLatencia, aprenderDeIntento } from '../lib/ritmoLatencia'

const NUM_NIVELES = NIVELES_DICTADO.length
const EPS = 1e-6

// 1, 1.5, 0.5… escrito como se dice en música: "1½ tiempos"
function tiempos(n) {
  const entero = Math.floor(n + EPS)
  const resto = Math.round((n - entero) * 100) / 100
  const frac = { 0.25: '¼', 0.5: '½', 0.75: '¾' }[resto] || ''
  const txt = entero ? `${entero}${frac}` : frac || '0'
  return `${txt} ${n > 1 + EPS ? 'tiempos' : 'tiempo'}`
}

const tarjeta = { background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px' }

// ─── Pantalla de un dictado ───────────────────────────────────────────────

export default function PantallaDictadoRitmo({ nivelId, numero, prog, onCerrar, onIr }) {
  const nivel = nivelDictado(nivelId)
  const [semilla, setSemilla] = useState(0)
  const ej = useMemo(() => armarDictado(nivelId, numero), [nivelId, numero, semilla]) // eslint-disable-line react-hooks/exhaustive-deps
  const deOido = ej.modo === 'oido'
  const ejPartitura = useMemo(() => ({ ...ej, nivel: `d${nivelId}`, numero: `${numero}-${semilla}` }), [ej, nivelId, numero, semilla])

  const motorRef = useRef(null)
  const ctlRef = useRef(null)
  const turnoRef = useRef(0)
  const [fase, setFase] = useState('listo') // listo | escuchando | practica | resultado
  const [conteo, setConteo] = useState(null)
  const [pulso, setPulso] = useState(-1)
  const [escuchado, setEscuchado] = useState(false)
  const [cargandoPiano, setCargandoPiano] = useState(false)
  const [sinAudio, setSinAudio] = useState(false)
  const [pulsado, setPulsado] = useState(false)
  const [respuesta, setRespuesta] = useState(() => ej.compases.map(() => []))
  const [resultado, setResultado] = useState(null)
  const [aviso, setAviso] = useState(null)
  const [sonandoRespuesta, setSonandoRespuesta] = useState(false)
  const [escribiendo, setEscribiendo] = useState(false) // escribir tocando (tiempo libre)
  const [nMarcas, setNMarcas] = useState(0)
  const [conFiguras, setConFiguras] = useState(false)   // mostrar las figuras para escribir o corregir a mano
  const marcasRef = useRef([])
  const previaRef = useRef(null)

  useEffect(() => { precargarPiano() }, [])
  useEffect(() => () => { turnoRef.current++; if (motorRef.current) motorRef.current.parar() }, [])

  // Un ritmo nuevo: todo vuelve a empezar
  const reiniciar = useCallback(() => {
    turnoRef.current++
    if (ctlRef.current) ctlRef.current.parar()
    setFase('listo'); setConteo(null); setPulso(-1); setResultado(null); setAviso(null); setEscuchado(false); setSonandoRespuesta(false)
    setEscribiendo(false); setNMarcas(0); setConFiguras(false); marcasRef.current = []
  }, [])
  useEffect(() => { setRespuesta(ej.compases.map(() => [])); reiniciar() }, [ej, reiniciar])

  const registrarIntento = (pct) => {
    const antes = prog.estado
    const previo = prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)
    const despues = prog.registrar(nivelId, numero, pct)
    const siguiente = nivelId < NUM_NIVELES ? nivelId + 1 : null
    setAviso({
      sinToques: false,
      record: !!previo && pct > (previo.mejor_pct || 0),
      nivelSuperado: !antes[nivelId - 1].superado && despues[nivelId - 1].superado,
      abre: siguiente && !antes[nivelId].abierto && despues[nivelId].abierto ? siguiente : null,
    })
  }

  // Suena un ritmo con su conteo. tonos: true = se escucha; false = solo pulso (se registran los toques)
  const correr = async (ritmo, { tonos, alTerminar }) => {
    if (!motorRef.current) motorRef.current = crearMotorRitmo()
    const ok = await motorRef.current.asegurar()
    if (!ok) { setSinAudio(true); return false }
    setSinAudio(false)
    const turno = ++turnoRef.current
    if (tonos) {
      setCargandoPiano(true)
      await motorRef.current.prepararPiano()
      setCargandoPiano(false)
      if (turno !== turnoRef.current) return false
    }
    setConteo(0); setPulso(-1)
    ctlRef.current = motorRef.current.correr(ritmo, {
      tonos,
      onConteo: (n) => setConteo(n),
      onPulso: (b) => setPulso(b),
      onEntrada: () => setConteo(null),
      onFin: () => { setConteo(null); setPulso(-1); alTerminar(ctlRef.current ? ctlRef.current.toques.slice() : []) },
    })
    return true
  }

  const escuchar = async () => {
    if (fase === 'escuchando') return
    setSonandoRespuesta(false)
    setFase('escuchando')
    const ok = await correr(ej, { tonos: true, alTerminar: () => { setEscuchado(true); setFase(resultado ? 'resultado' : 'listo') } })
    if (!ok) setFase(resultado ? 'resultado' : 'listo')
  }

  const escucharRespuesta = async () => {
    const mia = ejercicioDeRespuesta(ej, respuesta)
    if (!mia) return
    setSonandoRespuesta(true)
    setFase('escuchando')
    const ok = await correr(mia, { tonos: true, alTerminar: () => { setSonandoRespuesta(false); setFase('listo') } })
    if (!ok) { setSonandoRespuesta(false); setFase('listo') }
  }

  const tocarElRitmo = async () => {
    setResultado(null); setAviso(null)
    setFase('practica')
    const ok = await correr(ej, {
      tonos: false,
      alTerminar: (toques) => {
        const usada = leerLatencia()
        const r = corregir(ej, toques, { latenciaMs: usada })
        aprenderDeIntento(r, usada)
        setResultado(r)
        setFase('resultado')
        if (toques.length === 0) { setAviso({ sinToques: true }); return }
        registrarIntento(r.pct)
      },
    })
    if (!ok) setFase('listo')
  }

  const detener = () => {
    turnoRef.current++
    setCargandoPiano(false); setSonandoRespuesta(false)
    if (ctlRef.current) ctlRef.current.parar()
    setConteo(null); setPulso(-1)
    setFase(resultado ? 'resultado' : 'listo')
  }

  const tocar = useCallback((marca) => {
    if (fase !== 'practica' || !ctlRef.current) return
    ctlRef.current.tomarToque(marca)
    setPulsado(true)
    setTimeout(() => setPulsado(false), 90)
  }, [fase])

  useEffect(() => {
    if (fase !== 'practica') return undefined
    const alTeclear = (e) => { if (e.code === 'Space' && !e.repeat) { e.preventDefault(); tocar(e.timeStamp) } }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [fase, tocar])

  // ── Armar el ritmo ──
  const enResultado = resultado != null
  const activo = respuesta.findIndex((c) => duracionCompas(c) < ej.pulsosPorCompas - EPS) // primer compás sin completar
  const restante = activo >= 0 ? ej.pulsosPorCompas - duracionCompas(respuesta[activo]) : 0
  const completo = activo < 0
  const hayAlgo = respuesta.some((c) => c.length)

  const agregar = (fig) => {
    if (enResultado || activo < 0 || fig.dur > restante + EPS) return
    setRespuesta((r) => r.map((c, i) => (i === activo ? [...c, fig] : c)))
  }
  const quitarDesde = (ci, fi) => { if (enResultado) return; setRespuesta((r) => r.map((c, i) => (i === ci ? c.slice(0, fi) : c))) }
  const borrarUltima = () => {
    if (enResultado) return
    setRespuesta((r) => {
      const ult = [...r.keys()].reverse().find((i) => r[i].length)
      return ult == null ? r : r.map((c, i) => (i === ult ? c.slice(0, -1) : c))
    })
  }
  // ── Escribir tocando: sin conteo ni metrónomo, a tu ritmo; cada toque se escribe en la partitura ──
  const empezarEscribir = async () => {
    if (!motorRef.current) motorRef.current = crearMotorRitmo()
    const ok = await motorRef.current.asegurar()
    if (!ok) { setSinAudio(true); return }
    setSinAudio(false)
    turnoRef.current++
    if (ctlRef.current) ctlRef.current.parar()
    setConteo(null); setPulso(-1)
    previaRef.current = respuesta
    marcasRef.current = []
    setNMarcas(0)
    setRespuesta(ej.compases.map(() => []))
    setEscribiendo(true)
  }
  const marcar = useCallback((silencio, marcaMs) => {
    if (!escribiendo) return
    marcasRef.current.push({ t: marcaMs / 1000, silencio })
    if (!silencio && motorRef.current) motorRef.current.toque()
    setNMarcas(marcasRef.current.length)
    const r = transcribirToques(marcasRef.current, { pulsosPorCompas: ej.pulsosPorCompas, nCompases: ej.compases.length, pulsoSeg: ej.pulsoSeg, paleta: ej.paleta })
    setRespuesta(r.compases)
    setPulsado(true)
    setTimeout(() => setPulsado(false), 90)
  }, [escribiendo, ej])
  const terminarEscribir = () => {
    setEscribiendo(false)
    if (!marcasRef.current.length) { setRespuesta(previaRef.current || ej.compases.map(() => [])); return }
    setConFiguras(true) // por si hay algo para corregir
  }
  const cancelarEscribir = () => {
    setEscribiendo(false)
    marcasRef.current = []; setNMarcas(0)
    setRespuesta(previaRef.current || ej.compases.map(() => []))
  }
  useEffect(() => {
    if (!escribiendo) return undefined
    const alTeclear = (e) => {
      if (e.repeat) return
      if (e.code === 'Space') { e.preventDefault(); marcar(false, e.timeStamp) }
      else if (e.code === 'KeyS') { e.preventDefault(); marcar(true, e.timeStamp) }
    }
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [escribiendo, marcar])

  const comprobar = () => {
    if (!completo) return
    if (ctlRef.current) ctlRef.current.parar()
    turnoRef.current++
    setConteo(null); setPulso(-1)
    const r = corregirDictado(ej, respuesta)
    setResultado(r)
    setFase('resultado')
    registrarIntento(r.pct)
  }

  const otroRitmo = () => setSemilla((x) => x + 1)
  const reintentar = () => { setResultado(null); setAviso(null); setFase('listo'); if (!deOido) setRespuesta(ej.compases.map(() => [])) }

  const hayOtro = numero < EJERCICIOS_POR_NIVEL
  const proximo = (() => {
    if (!resultado?.aprobado) return null
    if (hayOtro) return { nivel: nivelId, numero: numero + 1, texto: 'Siguiente ejercicio →' }
    if (nivelId < NUM_NIVELES && prog.estado[nivelId]?.abierto) return { nivel: nivelId + 1, numero: 1, texto: `Nivel ${nivelId + 1} →` }
    return null
  })()

  const estado = (() => {
    if (fase === 'escuchando' && cargandoPiano) return 'Preparando el sonido de piano…'
    if (fase === 'escuchando') return conteo != null ? `Contá con el pulso… ${conteo || ''}` : (sonandoRespuesta ? '🔊 Así suena lo que escribiste' : '🔊 Escuchá el ritmo')
    if (fase === 'practica') return conteo != null ? `Contá con el pulso y esperá… ${conteo || ''}` : '¡Ahora vos! Tocá el botón en cada sonido'
    return null
  })()

  const mejor = prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)?.mejor_pct
  const ocupado = fase === 'escuchando' || fase === 'practica'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#F1EFE8', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px', borderBottom: '1px solid #E8E6DF', background: '#FFFFFF',
      }}>
        <button onClick={() => { turnoRef.current++; if (ctlRef.current) ctlRef.current.parar(); onCerrar() }} title="Volver"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #D3D1C7', background: '#FFFFFF', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ej.titulo}</div>
          <div style={{ fontSize: '11px', color: '#888780' }}>{deOido ? 'Escuchá y tocá de oído' : 'Escuchá y escribí el ritmo'} · compás de {ej.pulsosPorCompas}/{ej.tipoPulso} · negra = {ej.tempo}</div>
        </div>
        <Estrellas n={estrellasPara(mejor)} />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 14px 8px' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {estado && <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 600, color: VERDE, minHeight: '20px' }}>{estado}</div>}
          {conteo != null && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
              {Array.from({ length: ej.pulsosPorCompas }, (_, i) => (
                <div key={i} style={{
                  width: '34px', height: '34px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '15px',
                  background: i + 1 <= conteo ? VERDE : '#EAE7DD', color: i + 1 <= conteo ? '#FFFFFF' : '#888780',
                }}>{i + 1}</div>
              ))}
            </div>
          )}
          {ocupado && <ContadorPulsos ej={ej} pulso={pulso} />}
          {ocupado && deOido && (
            <div style={{ ...tarjeta, textAlign: 'center', padding: '28px 16px', color: '#5F5E5A' }}>
              <div style={{ fontSize: '40px', lineHeight: 1 }}>{fase === 'escuchando' ? '🎧' : '🥁'}</div>
              <div style={{ marginTop: '8px', fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>
                {fase === 'escuchando' ? 'Escuchá con atención' : 'Tocá cada sonido, como lo oíste'}
              </div>
              <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px' }}>La partitura aparece al terminar.</div>
            </div>
          )}

          {/* Intro */}
          {fase === 'listo' && !resultado && deOido && (
            <div style={{ ...tarjeta, fontSize: '13px', color: '#5F5E5A', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 600, color: '#1A1A18', marginBottom: '4px' }}>{nivel.nombre}</div>
              <div style={{ marginBottom: '8px' }}>{nivel.descr}</div>
              {deOido ? (
                <>
                  <div>1. Tocá <b>Escuchar el ritmo</b>. No se ve la partitura: concentrate en el oído. Podés escucharlo las veces que quieras.</div>
                  <div>2. Tocá <b>Tocar el ritmo</b>: hay un compás de conteo y tocás el botón grande en cada sonido, como lo oíste. En los silencios no toques.</div>
                </>
              ) : (
                <>
                  <div>1. Tocá <b>Escuchar el ritmo</b> las veces que quieras.</div>
                  <div>2. Elegí las figuras en orden para completar cada compás. Tocá una figura escrita para borrarla.</div>
                  <div>3. Cuando estén todos completos, tocá <b>Comprobar</b>.</div>
                </>
              )}
              <div style={{ marginTop: '8px', color: '#888780', fontSize: '12px' }}>Con auriculares se oye mejor el pulso. Para aprobar necesitás {APROBADO_PCT} %.</div>
            </div>
          )}

          {sinAudio && (
            <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#501313' }}>
              No pudimos activar el sonido. Revisá que el teléfono no esté en silencio y probá de nuevo.
            </div>
          )}

          {/* Armar: lo que se va escribiendo */}
          {!deOido && (
            <>
              {!enResultado && (
                <div style={{ textAlign: 'center', fontSize: '13px', color: '#5F5E5A', lineHeight: 1.45, padding: '0 6px' }}>
                  {escribiendo
                    ? <>Tocá <b>SONIDO</b> cuando suena algo y <b>SILENCIO</b> cuando hay una pausa. Sin conteo: a tu ritmo.{nMarcas > 0 ? ` (${nMarcas} ${nMarcas === 1 ? 'marca' : 'marcas'})` : ''}</>
                    : !hayAlgo
                      ? <>Escuchá el ritmo y después <b>escribilo tocando</b>: un botón para cada sonido y otro para cada silencio.</>
                      : completo
                        ? <>Revisá tu ritmo. Podés escucharlo, tocar de nuevo o corregirlo con figuras.</>
                        : <>Falta completar el compás {activo + 1}. Tocá de nuevo o completalo con figuras.</>}
                </div>
              )}
              <div style={{ ...tarjeta, padding: '10px 12px 6px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#5F5E5A', marginBottom: '4px' }}>{enResultado ? 'Lo que escribiste' : 'Tu ritmo'}</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 12px', alignItems: 'flex-end' }}>
                  {respuesta.map((c, ci) => {
                    const falta = ej.pulsosPorCompas - duracionCompas(c)
                    const lleno = falta < EPS
                    return (
                      <div key={ci} style={{ flex: '0 1 auto', minWidth: 0, maxWidth: '100%', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', fontSize: '10px', color: '#888780', padding: '0 2px' }}>
                          <span>{ci + 1}</span>
                          {!enResultado && !lleno && c.length > 0 && <span style={{ color: '#B5791B', fontWeight: 600 }}>faltan {tiempos(falta)}</span>}
                        </div>
                        <CompasRitmo figuras={c} pulsos={ej.pulsosPorCompas} alto={84} seleccionado={!enResultado && !escribiendo && ci === activo && hayAlgo}
                          estados={enResultado ? resultado.porCompas[ci] : null}
                          onFigura={enResultado || escribiendo ? null : (fi) => quitarDesde(ci, fi)} vacio={`Compás ${ci + 1}`} />
                      </div>
                    )
                  })}
                </div>
                {!enResultado && !escribiendo && hayAlgo && <div style={{ fontSize: '10px', color: '#B4B2A9', textAlign: 'center' }}>Tocá una figura para borrarla</div>}
              </div>
            </>
          )}

          {/* Resultado */}
          {enResultado && (
            <>
              <div style={{ ...tarjeta, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {aviso?.sinToques ? (
                  <div style={{ fontSize: '14px', color: '#5F5E5A', lineHeight: 1.5 }}>
                    No detectamos ningún toque. Tocá el botón grande (o la barra espaciadora) en cada sonido. Este intento no cuenta.
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
                        🎉 ¡Nivel «{nivel.nombre}» superado!{aviso.abre ? ` Se abrió «${nivelDictado(aviso.abre).nombre}».` : ''}
                      </div>
                    )}
                    <div style={{ fontSize: '13px', color: '#5F5E5A', textAlign: 'center' }}>
                      {deOido
                        ? <>{resultado.notas.filter((n) => n.estado === 'ok').length} de {resultado.notas.length} sonidos justos{resultado.extras ? ` · ${resultado.extras} toque${resultado.extras === 1 ? '' : 's'} de más` : ''}</>
                        : <>{resultado.correctas} de {resultado.total} figuras bien puestas</>}
                    </div>
                    {resultado.mensajes.length > 0 && (
                      <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '13px', color: '#5F5E5A', lineHeight: 1.5 }}>
                        {resultado.mensajes.map((m, i) => <li key={i}>{m}</li>)}
                      </ul>
                    )}
                    {deOido && (
                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', flexWrap: 'wrap', fontSize: '11px', color: '#888780' }}>
                        {[['ok', 'justo'], ['leve', 'casi'], ['fuera', 'fuera de tiempo'], ['falta', 'no lo tocaste']].map(([k, t]) => (
                          <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: COLOR_ESTADO[k] }} />{t}
                          </span>
                        ))}
                      </div>
                    )}
                    {!deOido && (
                      <div style={{ fontSize: '11px', color: '#888780', textAlign: 'center' }}>
                        <span style={{ color: '#2F9E6F', fontWeight: 700 }}>Verde</span> = en su lugar · <span style={{ color: '#D04A43', fontWeight: 700 }}>rojo</span> = no coincide
                      </div>
                    )}
                  </>
                )}
              </div>
              <div style={{ fontSize: '12px', fontWeight: 600, color: '#5F5E5A', padding: '0 4px' }}>El ritmo era</div>
              <RitmoPartitura ejercicio={ejPartitura} resultado={deOido && !aviso?.sinToques ? resultado : null} />
            </>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid #E8E6DF', background: '#FFFFFF', padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: '720px', margin: '0 auto' }}>
          {fase === 'listo' && !enResultado && deOido && (
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={escuchar} style={boton(!escuchado)}>🔊 Escuchar el ritmo</button>
              <button onClick={tocarElRitmo} disabled={!escuchado} style={boton(escuchado, { opacity: escuchado ? 1 : 0.45 })}>🥁 Tocar el ritmo</button>
            </div>
          )}
          {fase === 'listo' && !enResultado && !deOido && !escribiendo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {conFiguras && (
                <div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
                    {ej.paleta.map((f) => {
                      const cabe = !completo && f.dur <= restante + EPS
                      return (
                        <button key={`${f.silencio ? 'r' : ''}${f.dur}`} onClick={() => agregar(f)} disabled={!cabe}
                          aria-label={nombreFigura(f)} title={nombreFigura(f)}
                          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '4px 8px 3px', borderRadius: '10px', cursor: cabe ? 'pointer' : 'default', border: '1px solid #D3D1C7', background: '#FFFFFF', opacity: cabe ? 1 : 0.35 }}>
                          <FiguraIcono fig={f} alto={36} />
                        </button>
                      )
                    })}
                    <button onClick={borrarUltima} disabled={!hayAlgo} aria-label="Borrar la última" title="Borrar la última"
                      style={{ padding: '4px 10px', borderRadius: '10px', border: '1px solid #D3D1C7', background: '#FFFFFF', fontSize: '16px', color: '#5F5E5A', cursor: hayAlgo ? 'pointer' : 'default', opacity: hayAlgo ? 1 : 0.35 }}>⌫</button>
                  </div>
                  <div style={{ fontSize: '10px', color: '#888780', textAlign: 'center', marginTop: '3px', lineHeight: 1.3 }}>
                    {ej.paleta.slice(0, 12).map((f) => nombreFigura(f)).join(' · ')}
                  </div>
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={escuchar} style={boton(!escuchado && !hayAlgo, { padding: '12px 6px', fontSize: '13px' })}>🔊 Escuchar el ritmo</button>
                <button onClick={empezarEscribir} style={boton(escuchado || hayAlgo, { padding: '12px 6px', fontSize: '13px' })}>🥁 {hayAlgo ? 'Tocar de nuevo' : 'Escribir tocando'}</button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={escucharRespuesta} disabled={!completo} style={boton(false, { padding: '12px 6px', fontSize: '13px', opacity: completo ? 1 : 0.4 })}>🔊 Mi respuesta</button>
                <button onClick={comprobar} disabled={!completo} style={boton(true, { padding: '12px 6px', fontSize: '13px', opacity: completo ? 1 : 0.4 })}>✓ Comprobar</button>
              </div>
              <button onClick={() => setConFiguras((v) => !v)}
                style={{ background: 'none', border: 'none', color: VERDE, fontSize: '12px', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
                {conFiguras ? 'Ocultar las figuras' : '✏️ Escribir o corregir con figuras'}
              </button>
            </div>
          )}
          {escribiendo && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'stretch' }}>
                <button
                  onPointerDown={(e) => { e.preventDefault(); marcar(false, e.nativeEvent.timeStamp) }}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    flex: '2 1 0', height: '84px', borderRadius: '18px', border: 'none', cursor: 'pointer', fontSize: '17px', fontWeight: 700,
                    background: pulsado ? '#0A5441' : VERDE, color: '#FFFFFF', transform: pulsado ? 'scale(0.98)' : 'scale(1)', transition: 'transform 60ms',
                    boxShadow: pulsado ? 'inset 0 3px 8px rgba(0,0,0,0.3)' : '0 4px 12px rgba(15,110,86,0.3)',
                    touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
                  }}>🥁 SONIDO</button>
                <button
                  onPointerDown={(e) => { e.preventDefault(); marcar(true, e.nativeEvent.timeStamp) }}
                  onContextMenu={(e) => e.preventDefault()}
                  style={{
                    flex: '1 1 0', height: '84px', borderRadius: '18px', cursor: 'pointer', fontSize: '15px', fontWeight: 700,
                    border: '2px solid #B4B2A9', background: '#FFFFFF', color: '#5F5E5A',
                    touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none', WebkitTapHighlightColor: 'transparent',
                  }}>⏸ SILENCIO</button>
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={cancelarEscribir} style={boton(false, { padding: '11px 6px', fontSize: '13px' })}>Cancelar</button>
                <button onClick={terminarEscribir} style={boton(true, { padding: '11px 6px', fontSize: '13px' })}>✓ Listo</button>
              </div>
              <div style={{ fontSize: '10px', color: '#888780', textAlign: 'center' }}>En la compu: barra espaciadora = sonido, tecla S = silencio</div>
            </div>
          )}
          {fase === 'escuchando' && <button onClick={detener} style={{ ...boton(false), width: '100%' }}>⏹ Detener</button>}
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
          {fase !== 'escuchando' && fase !== 'practica' && enResultado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {proximo && <button onClick={() => onIr({ nivel: proximo.nivel, numero: proximo.numero })} style={{ ...boton(true), width: '100%' }}>{proximo.texto}</button>}
              <div style={{ display: 'flex', gap: '10px' }}>
                {deOido && <button onClick={reintentar} style={boton(!proximo)}>🔁 Intentar de nuevo</button>}
                <button onClick={otroRitmo} style={boton(!proximo && !deOido)}>🎲 Otro ritmo</button>
                <button onClick={escuchar} style={boton(false)}>🔊 Escuchar</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
