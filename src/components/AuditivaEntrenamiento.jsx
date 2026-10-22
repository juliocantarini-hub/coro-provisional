import { useState, useEffect, useMemo, useRef } from 'react'
import {
  NIVELES, EJERCICIOS_POR_NIVEL, EJERCICIOS_PARA_AVANZAR, APROBADO_PCT, ACORDES, INTERVALOS,
  NOMBRES_GRADO, COLORES_GRADO, armarEjercicio, corregirRespuesta, puntajeEco, porcentajeEjercicio,
  estrellasPara, nivelPorId, midiDeGrado,
} from '../lib/auditiva'
import { tocarNotas, detener as detenerAudio, precargarPiano } from '../lib/auditivaAudio'
import { iniciarGrabacion } from '../lib/grabadora'
import { analizarGrabacion } from '../lib/informeAfinacion'
import BotonVolver from './BotonVolver'

const VERDE = '#0F6E56'
const DORADO = '#E9A91B'
const ROJO = '#C2453F'
const ICONO = { direccion: '↕️', eco: '🎤', intervalo: '🎼', acorde: '🎹', dictado: '✍️' }

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

const tarjeta = { background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px 16px' }

// ─── Dibujo de la melodía: un punto por nota, más alto = más agudo ─────────

const COLOR_ECO = { verde: '#3FAE83', amarillo: '#E9BF45', rojo: '#E24B4A', nota_distinta: '#B4B2A9', no_detectada: '#B4B2A9' }

function Contorno({ notas, estados }) {
  const W = 300, H = 96, PX = 28, PY = 16
  const midis = notas.map((n) => n.midi)
  const lo = Math.min(...midis), hi = Math.max(...midis)
  const x = (i) => (notas.length === 1 ? W / 2 : PX + (i * (W - 2 * PX)) / (notas.length - 1))
  const y = (m) => (hi === lo ? H / 2 : H - PY - ((m - lo) / (hi - lo)) * (H - 2 * PY))
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', maxWidth: '360px', display: 'block', margin: '0 auto' }} role="img" aria-label="Dibujo de la melodía">
      <polyline fill="none" stroke="#D3D1C7" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"
        points={notas.map((n, i) => `${x(i)},${y(n.midi)}`).join(' ')} />
      {notas.map((n, i) => {
        const est = estados?.[i]
        return (
          <g key={i}>
            <circle cx={x(i)} cy={y(n.midi)} r="13" fill={est ? (COLOR_ECO[est] || '#B4B2A9') : '#CDE7DC'} stroke={est ? 'none' : VERDE} strokeWidth="1.5" />
            <text x={x(i)} y={y(n.midi) + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill={est ? '#FFFFFF' : VERDE}>{i + 1}</text>
          </g>
        )
      })}
    </svg>
  )
}

// Botón grande de respuesta; después de responder se pinta la correcta en verde y la elegida equivocada en rojo
function BotonRespuesta({ children, sub, onClick, estado = 'normal', deshabilitado }) {
  const colores = {
    normal: { bg: '#FFFFFF', bd: VERDE, fg: VERDE },
    correcta: { bg: '#E1F5EE', bd: VERDE, fg: '#04342C' },
    mala: { bg: '#FCEBEB', bd: ROJO, fg: '#501313' },
    apagada: { bg: '#F6F4EC', bd: '#E1DFD6', fg: '#A8A69C' },
  }[estado]
  return (
    <button onClick={onClick} disabled={deshabilitado}
      style={{
        width: '100%', padding: '14px 12px', borderRadius: '14px', cursor: deshabilitado ? 'default' : 'pointer',
        border: `2px solid ${colores.bd}`, background: colores.bg, color: colores.fg,
        fontSize: '17px', fontWeight: 700, lineHeight: 1.25, textAlign: 'center',
      }}>
      {children}
      {sub && <div style={{ fontSize: '12px', fontWeight: 500, marginTop: '3px', opacity: 0.85 }}>{sub}</div>}
    </button>
  )
}

const estadoDeBoton = (valor, correcto, elegido, revelado) => {
  if (!revelado) return 'normal'
  if (valor === correcto) return 'correcta'
  if (valor === elegido) return 'mala'
  return 'apagada'
}

const leerAyuda = () => { try { return localStorage.getItem('auditiva_ayuda') !== '0' } catch { return true } }
const guardarAyuda = (v) => { try { localStorage.setItem('auditiva_ayuda', v ? '1' : '0') } catch { /* sin almacenamiento */ } }

const mensajeMic = (e) => {
  const nombre = e?.name || ''
  if (nombre === 'NotAllowedError' || nombre === 'SecurityError') return 'Para este ejercicio necesitamos el micrófono. Permitilo en el navegador y probá de nuevo.'
  if (nombre === 'NotFoundError') return 'No encontramos un micrófono en este dispositivo.'
  return e?.message || 'No pudimos usar el micrófono.'
}

const INTRO = {
  direccion: ['Vas a escuchar dos notas.', 'Decidí si la segunda suena más aguda (sube) o más grave (baja). Podés escucharlas las veces que quieras.'],
  eco: ['Escuchás una frase en el piano y la cantás con «la».', 'Cantala a la altura que te quede cómoda: no importa si es más grave o más aguda que el piano. Lo que se mira es el dibujo de la melodía: cuánto sube y cuánto baja. Buscá un lugar tranquilo.'],
  intervalo: ['Vas a escuchar dos notas.', 'Fijate qué tan grande es el salto entre una y otra. Cada tamaño se parece al comienzo de una canción conocida: usá esas pistas.'],
  acorde: ['Vas a escuchar tres notas sonando juntas.', 'Decidí qué sensación te dan: ¿alegre, triste o tensa?'],
  dictado: ['Escuchás primero la escala (los escalones) y después una melodía.', 'Armala tocando los botones de colores, en el orden en que suenan las notas. Podés tocar cada botón para oír su nota.'],
}

// ─── Pantalla de un ejercicio ──────────────────────────────────────────────

function PantallaEjercicio({ nivelId, numero, prog, voz, onCerrar, onIr }) {
  const [intento, setIntento] = useState(0)
  const ej = useMemo(() => armarEjercicio(nivelId, numero, { voz }), [nivelId, numero, voz, intento]) // eslint-disable-line react-hooks/exhaustive-deps
  const nivel = nivelPorId(nivelId)
  const tipo = ej.tipo
  const total = ej.preguntas.length

  const [fase, setFase] = useState('inicio') // inicio | pregunta | resultado
  const [idx, setIdx] = useState(0)
  const [resultados, setResultados] = useState([])
  const [respuesta, setRespuesta] = useState(null)
  const [dirSel, setDirSel] = useState('sube')
  const [ingreso, setIngreso] = useState([])
  const [revelado, setRevelado] = useState(false)
  const [sonando, setSonando] = useState(false)
  const [sinAudio, setSinAudio] = useState(false)
  const [ayuda, setAyuda] = useState(leerAyuda)
  const [estadoEco, setEstadoEco] = useState('listo') // listo | grabando | analizando | hecho
  const [informeEco, setInformeEco] = useState(null)
  const [errEco, setErrEco] = useState(null)
  const [nivelMic, setNivelMic] = useState(0)
  const [segGrab, setSegGrab] = useState(0)
  const [aviso, setAviso] = useState(null)
  const [pctFinal, setPctFinal] = useState(0)

  const turnoRef = useRef(0)
  const grabRef = useRef(null)
  const pregunta = ej.preguntas[idx]
  const pRef = useRef(pregunta)
  pRef.current = pregunta
  const idxRef = useRef(idx)
  idxRef.current = idx

  useEffect(() => { precargarPiano() }, [])
  useEffect(() => () => {
    turnoRef.current++
    detenerAudio()
    if (grabRef.current) { clearInterval(grabRef.current.timer); try { grabRef.current.g.cancelar() } catch { /* ya cerrada */ } grabRef.current = null }
  }, [])

  // Al llegar a cada pregunta suena sola (y se puede repetir con el botón)
  useEffect(() => {
    if (fase === 'pregunta') escuchar(false)
  }, [fase, idx]) // eslint-disable-line react-hooks/exhaustive-deps

  function escuchar(soloMelodia) {
    const p = pRef.current
    if (!p) return
    let notas = p.notas
    if (p.tipo === 'dictado' && !soloMelodia) {
      const desfase = p.escala.length * 0.45 + 0.7
      notas = [...p.escala, ...p.notas.map((n) => ({ ...n, inicio: n.inicio + desfase }))]
    }
    const turno = ++turnoRef.current
    setSonando(true); setSinAudio(false)
    tocarNotas(notas)
      .then(() => { if (turno === turnoRef.current) setSonando(false) })
      .catch(() => { if (turno === turnoRef.current) { setSonando(false); setSinAudio(true) } })
  }

  const tocarEscala = () => {
    const turno = ++turnoRef.current
    setSonando(true)
    tocarNotas(pRef.current.escala).then(() => { if (turno === turnoRef.current) setSonando(false) }).catch(() => { setSonando(false); setSinAudio(true) })
  }

  const tocarGrado = (g) => {
    ++turnoRef.current
    setSonando(false)
    tocarNotas([{ midi: midiDeGrado(pRef.current.raiz, g), inicio: 0, duracion: 0.55 }], { cola: 0.1 }).catch(() => setSinAudio(true))
  }

  const guardarResultado = (i, r) => setResultados((prev) => { const c = prev.slice(); c[i] = r; return c })

  const limpiarPregunta = () => {
    setRespuesta(null); setDirSel('sube'); setIngreso([]); setRevelado(false)
    setEstadoEco('listo'); setInformeEco(null); setErrEco(null); setSegGrab(0); setNivelMic(0)
  }

  const empezar = () => {
    setResultados([]); setIdx(0); limpiarPregunta(); setAviso(null)
    setFase('pregunta')
  }

  const responder = (r) => {
    if (revelado) return
    guardarResultado(idx, corregirRespuesta(pregunta, r))
    setRespuesta(r); setRevelado(true)
  }

  const comprobar = () => {
    if (revelado || ingreso.length < pregunta.grados.length) return
    guardarResultado(idx, corregirRespuesta(pregunta, ingreso))
    setRevelado(true)
  }

  const terminar = (resFinal) => {
    const pct = porcentajeEjercicio(resFinal)
    setPctFinal(pct)
    const antes = prog.estado
    const previo = prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)
    const despues = prog.registrar(nivelId, numero, pct)
    const siguienteNivel = nivelId < NIVELES.length ? nivelId + 1 : null
    setAviso({
      record: !!previo && pct > (previo.mejor_pct || 0),
      nivelSuperado: !antes[nivelId - 1].superado && despues[nivelId - 1].superado,
      abre: siguienteNivel && !antes[nivelId].abierto && despues[nivelId].abierto ? siguienteNivel : null,
    })
    setFase('resultado')
  }

  const siguiente = () => {
    detenerAudio(); ++turnoRef.current; setSonando(false)
    // Un eco salteado cuenta como cero
    const res = ej.preguntas.map((p, i) => resultados[i] || { puntos: 0, total: p.tipo === 'dictado' ? p.grados.length : p.tipo === 'eco' ? p.notas.length : 1 })
    if (idx + 1 < total) {
      setResultados(res); limpiarPregunta(); setIdx(idx + 1)
    } else {
      terminar(res)
    }
  }

  // ─── Cantar (eco) ───
  const empezarCanto = async () => {
    detenerAudio(); ++turnoRef.current; setSonando(false)
    setErrEco(null); setInformeEco(null)
    let g
    try { g = await iniciarGrabacion() } catch (e) { setErrEco(mensajeMic(e)); return }
    setEstadoEco('grabando'); setSegGrab(0); setNivelMic(0)
    let ruido = 0, nRuido = 0, conVoz = 0, ultimaVoz = 0
    const timer = setInterval(() => {
      const t = g.segundos(), lv = g.nivel()
      setSegGrab(t); setNivelMic(lv)
      if (t < 0.5) { ruido += lv; nRuido++; return }
      const umbral = Math.min(0.05, Math.max(0.015, 3 * (ruido / Math.max(1, nRuido))))
      if (lv > umbral) { conVoz += 0.1; ultimaVoz = t }
      if ((conVoz >= 0.6 && t - ultimaVoz >= 1.6) || t >= 15) terminarCanto()
    }, 100)
    grabRef.current = { g, timer }
  }

  function terminarCanto() {
    const r = grabRef.current
    if (!r) return
    grabRef.current = null
    clearInterval(r.timer)
    const { muestras, sampleRate } = r.g.detener()
    setEstadoEco('analizando')
    const i = idxRef.current
    const p = pRef.current
    setTimeout(() => {
      try {
        const inf = analizarGrabacion(muestras, sampleRate, p.notas.map((n) => ({ ...n })), {})
        const pu = inf.error ? null : puntajeEco(inf)
        if (!pu || !pu.total) {
          setErrEco('No te escuchamos bien. Acercate un poco al micrófono, cantá con «la» y probá de nuevo.')
          setEstadoEco('listo')
          return
        }
        setInformeEco({ ...pu, pct: Math.round((100 * pu.puntos) / pu.total) })
        // Si lo intentás de nuevo, se guarda el mejor intento
        setResultados((prev) => {
          const c = prev.slice()
          const actual = c[i]
          if (!actual || pu.puntos / pu.total > actual.puntos / actual.total) c[i] = { puntos: pu.puntos, total: pu.total }
          return c
        })
        setEstadoEco('hecho')
      } catch {
        setErrEco('No pudimos analizar la grabación. Probá de nuevo.')
        setEstadoEco('listo')
      }
    }, 60)
  }

  const cancelarCanto = () => {
    const r = grabRef.current
    if (r) { clearInterval(r.timer); try { r.g.cancelar() } catch { /* ya cerrada */ } grabRef.current = null }
    setEstadoEco('listo')
  }

  const cerrar = () => {
    detenerAudio(); cancelarCanto(); onCerrar()
  }

  const ultima = idx + 1 >= total
  const hayOtro = numero < EJERCICIOS_POR_NIVEL
  const aprobado = pctFinal >= APROBADO_PCT
  const proximo = (() => {
    if (fase !== 'resultado' || !aprobado) return null
    if (hayOtro) return { nivel: nivelId, numero: numero + 1, texto: 'Siguiente ejercicio →' }
    if (nivelId < NIVELES.length && prog.estado[nivelId]?.abierto) return { nivel: nivelId + 1, numero: 1, texto: `Nivel ${nivelId + 1} →` }
    return null
  })()

  // ─── Cuerpo según el tipo de pregunta ───
  const cuerpoPregunta = () => {
    const p = pregunta
    if (p.tipo === 'direccion') {
      return (
        <>
          <div style={{ textAlign: 'center', fontSize: '15px', color: '#1A1A18', fontWeight: 600 }}>La segunda nota, ¿es más aguda o más grave?</div>
          <BotonRespuesta onClick={() => responder('sube')} deshabilitado={revelado} estado={estadoDeBoton('sube', p.correcta, respuesta, revelado)} sub="más aguda">⬆ Sube</BotonRespuesta>
          <BotonRespuesta onClick={() => responder('baja')} deshabilitado={revelado} estado={estadoDeBoton('baja', p.correcta, respuesta, revelado)} sub="más grave">⬇ Baja</BotonRespuesta>
          {revelado && <Veredicto bien={respuesta === p.correcta} texto={`Era: ${p.correcta === 'sube' ? 'sube' : 'baja'}.`} />}
        </>
      )
    }
    if (p.tipo === 'acorde') {
      const info = { mayor: ['😊', 'suena luminoso'], menor: ['😢', 'suena melancólico'], tenso: ['😬', 'suena inquieto, pide seguir'] }
      return (
        <>
          <div style={{ textAlign: 'center', fontSize: '15px', color: '#1A1A18', fontWeight: 600 }}>¿Qué sensación te da?</div>
          {p.tipos.map((t) => (
            <BotonRespuesta key={t} onClick={() => responder(t)} deshabilitado={revelado} estado={estadoDeBoton(t, p.correcta, respuesta, revelado)} sub={info[t][1]}>
              {info[t][0]} {ACORDES[t].etiqueta}
            </BotonRespuesta>
          ))}
          {revelado && <Veredicto bien={respuesta === p.correcta} texto={`Era: ${ACORDES[p.correcta].etiqueta.toLowerCase()}.`} />}
        </>
      )
    }
    if (p.tipo === 'intervalo') {
      const lista = INTERVALOS.filter((i) => p.pool.includes(i.id))
      const correcto = INTERVALOS.find((i) => i.id === p.correcta.id)
      const elegido = respuesta?.id
      const dirOk = !p.conDireccion || respuesta?.baja === p.correcta.baja
      return (
        <>
          <div style={{ textAlign: 'center', fontSize: '15px', color: '#1A1A18', fontWeight: 600 }}>
            {p.conDireccion ? '¿Sube o baja? ¿Qué tan grande es el salto?' : 'Las notas suben. ¿Qué tan grande es el salto?'}
          </div>
          {p.conDireccion && (
            <div style={{ display: 'flex', gap: '8px' }}>
              {[['sube', '⬆ Sube'], ['baja', '⬇ Baja']].map(([v, t]) => {
                const marcado = revelado ? (v === (p.correcta.baja ? 'baja' : 'sube')) : dirSel === v
                return (
                  <button key={v} disabled={revelado} onClick={() => setDirSel(v)}
                    style={{ ...boton(marcado), padding: '11px 8px', fontSize: '15px', opacity: revelado && !marcado ? 0.5 : 1 }}>{t}</button>
                )
              })}
            </div>
          )}
          {lista.map((it) => (
            <BotonRespuesta key={it.id} deshabilitado={revelado}
              onClick={() => responder({ id: it.id, baja: p.conDireccion ? dirSel === 'baja' : false })}
              estado={revelado ? (it.id === p.correcta.id ? 'correcta' : it.id === elegido ? 'mala' : 'apagada') : 'normal'}
              sub={ayuda ? `como el comienzo de «${it.pista}»` : null}>
              {it.etiqueta} · {it.corto}
            </BotonRespuesta>
          ))}
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', justifyContent: 'center', fontSize: '12px', color: '#5F5E5A', cursor: 'pointer' }}>
            <input type="checkbox" checked={ayuda} onChange={(e) => { setAyuda(e.target.checked); guardarAyuda(e.target.checked) }} />
            Mostrar la canción de ayuda
          </label>
          {revelado && (
            <Veredicto bien={elegido === p.correcta.id && dirOk}
              texto={`Era un ${correcto.corto} (${correcto.etiqueta})${p.conDireccion ? (p.correcta.baja ? ' que baja' : ' que sube') : ''}. Se parece a «${correcto.pista}».`} />
          )}
        </>
      )
    }
    if (p.tipo === 'dictado') {
      const grados = Array.from({ length: p.max }, (_, g) => g).reverse() // el más agudo arriba
      const chip = (g, extra = {}) => (
        <div style={{
          width: '40px', height: '40px', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: g == null ? '#F1EFE8' : COLORES_GRADO[g % 8], color: '#FFFFFF', fontWeight: 700, fontSize: '16px',
          border: g == null ? '2px dashed #D3D1C7' : '2px solid transparent', ...extra,
        }}>{g == null ? '' : g + 1}</div>
      )
      return (
        <>
          <div style={{ textAlign: 'center', fontSize: '15px', color: '#1A1A18', fontWeight: 600 }}>Armá la melodía, nota por nota</div>
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
            {p.grados.map((gc, i) => {
              const mio = ingreso[i]
              if (!revelado) return <div key={i}>{chip(mio ?? null)}</div>
              const bien = mio === gc
              return (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                  {chip(mio ?? null, { outline: `3px solid ${bien ? '#3FAE83' : '#E24B4A'}`, outlineOffset: '1px' })}
                  {!bien && <div style={{ fontSize: '10px', color: '#888780' }}>era</div>}
                  {!bien && chip(gc, { width: '30px', height: '30px', fontSize: '13px' })}
                </div>
              )
            })}
          </div>
          {!revelado && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', margin: '4px auto 0', width: '100%', maxWidth: '320px' }}>
              {grados.map((g) => (
                <button key={g} onClick={() => { tocarGrado(g); setIngreso((v) => (v.length < p.grados.length ? [...v, g] : v)) }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', borderRadius: '12px', border: 'none', cursor: 'pointer',
                    background: COLORES_GRADO[g % 8], color: '#FFFFFF', fontSize: '15px', fontWeight: 700, marginLeft: `${g * 4}px`,
                  }}>
                  <span style={{ width: '22px', textAlign: 'center' }}>{g + 1}</span>
                  <span style={{ fontWeight: 600, opacity: 0.95 }}>{NOMBRES_GRADO[g]}</span>
                </button>
              ))}
            </div>
          )}
          {!revelado && (
            <div style={{ textAlign: 'center' }}>
              <button onClick={() => setIngreso((v) => v.slice(0, -1))} disabled={!ingreso.length}
                style={{ background: 'none', border: 'none', color: ingreso.length ? VERDE : '#B4B2A9', fontSize: '13px', cursor: 'pointer', textDecoration: 'underline' }}>
                Borrar la última
              </button>
            </div>
          )}
          {revelado && (
            <Veredicto bien={ingreso.every((g, i) => g === p.grados[i])}
              texto={ingreso.every((g, i) => g === p.grados[i]) ? '¡Melodía perfecta!' : `Acertaste ${resultados[idx]?.puntos ?? 0} de ${p.grados.length} notas.`} />
          )}
        </>
      )
    }
    // eco
    return (
      <>
        <div style={{ textAlign: 'center', fontSize: '15px', color: '#1A1A18', fontWeight: 600 }}>
          {estadoEco === 'hecho' ? 'Así te salió' : 'Escuchá la frase y cantala con «la»'}
        </div>
        <div style={{ ...tarjeta, padding: '10px 8px' }}>
          <Contorno notas={p.notas} estados={informeEco ? informeEco.notas.map((n) => n.estado) : null} />
        </div>
        {estadoEco === 'listo' && !errEco && (
          <div style={{ textAlign: 'center', fontSize: '12px', color: '#888780', lineHeight: 1.5 }}>
            Cantala a la altura que te quede cómoda. Importa cuánto sube y baja, no si es más grave o más aguda que el piano.
          </div>
        )}
        {estadoEco === 'grabando' && (
          <div style={{ ...tarjeta, textAlign: 'center' }}>
            <div style={{ fontSize: '14px', fontWeight: 700, color: ROJO }}>● Te estamos escuchando… cantá ahora</div>
            <div style={{ height: '10px', borderRadius: '5px', background: '#EFEDE4', margin: '10px auto 4px', maxWidth: '240px', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(100, nivelMic * 900)}%`, height: '100%', background: VERDE, transition: 'width 90ms' }} />
            </div>
            <div style={{ fontSize: '11px', color: '#888780' }}>{segGrab.toFixed(1)} s · se detiene solo cuando terminás</div>
          </div>
        )}
        {estadoEco === 'analizando' && <div style={{ textAlign: 'center', fontSize: '14px', color: VERDE, fontWeight: 600 }}>Analizando…</div>}
        {errEco && (
          <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#501313' }}>{errEco}</div>
        )}
        {estadoEco === 'hecho' && informeEco && <ResumenEco informe={informeEco} />}
      </>
    )
  }

  // ─── Pie con los botones de acción ───
  const pie = () => {
    if (fase === 'inicio') {
      return <button onClick={empezar} style={{ ...boton(true), width: '100%', fontSize: '16px' }}>Empezar</button>
    }
    if (fase === 'resultado') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {proximo && <button onClick={() => onIr({ nivel: proximo.nivel, numero: proximo.numero })} style={{ ...boton(true), width: '100%' }}>{proximo.texto}</button>}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setIntento((n) => n + 1); setFase('inicio') }} style={boton(!proximo)}>🔁 Intentar de nuevo</button>
            <button onClick={cerrar} style={boton(false)}>Volver a la lista</button>
          </div>
        </div>
      )
    }
    const siguienteTexto = ultima ? 'Ver resultado' : 'Siguiente →'
    const botonEscuchar = (txt, fn, primario = false) => (
      <button onClick={fn} style={boton(primario)}>{sonando ? '🔊 Sonando…' : txt}</button>
    )
    if (tipo === 'eco') {
      if (estadoEco === 'grabando') {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
            <button onClick={terminarCanto} style={{ ...boton(true), width: '100%' }}>✔ Listo</button>
            <button onClick={cancelarCanto} style={{ background: 'none', border: 'none', color: '#888780', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>Cancelar</button>
          </div>
        )
      }
      if (estadoEco === 'analizando') return <button disabled style={{ ...boton(false), width: '100%', opacity: 0.6 }}>Analizando…</button>
      if (estadoEco === 'hecho') {
        return (
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => { setEstadoEco('listo'); setInformeEco(null); escuchar(false) }} style={boton(false)}>🔁 Probar de nuevo</button>
            <button onClick={siguiente} style={boton(true)}>{siguienteTexto}</button>
          </div>
        )
      }
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: '10px', width: '100%' }}>
            {botonEscuchar('🔊 Escuchar', () => escuchar(false))}
            <button onClick={empezarCanto} style={boton(true)}>🎤 Cantar</button>
          </div>
          <button onClick={siguiente} style={{ background: 'none', border: 'none', color: '#888780', fontSize: '12px', cursor: 'pointer', textDecoration: 'underline' }}>
            Saltear esta frase (cuenta como cero)
          </button>
        </div>
      )
    }
    if (revelado) {
      return (
        <div style={{ display: 'flex', gap: '10px' }}>
          {botonEscuchar('🔊 Otra vez', () => escuchar(true))}
          <button onClick={siguiente} style={boton(true)}>{siguienteTexto}</button>
        </div>
      )
    }
    if (tipo === 'dictado') {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', gap: '10px' }}>
            {botonEscuchar('🔊 Melodía', () => escuchar(true))}
            <button onClick={tocarEscala} style={boton(false)}>🎼 Escala</button>
          </div>
          <button onClick={comprobar} disabled={ingreso.length < pregunta.grados.length}
            style={{ ...boton(true), width: '100%', opacity: ingreso.length < pregunta.grados.length ? 0.45 : 1 }}>Comprobar</button>
        </div>
      )
    }
    return <div style={{ display: 'flex' }}>{botonEscuchar('🔊 Escuchar de nuevo', () => escuchar(false))}</div>
  }

  const miEstrellas = estrellasPara(prog.filas.find((f) => f.nivel === nivelId && f.ejercicio === numero)?.mejor_pct)

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200, background: '#F1EFE8', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0,
        padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
        borderBottom: '1px solid #E8E6DF', background: '#FFFFFF',
      }}>
        <button onClick={cerrar} title="Volver"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', border: '1px solid #D3D1C7', background: '#FFFFFF', cursor: 'pointer' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5F5E5A" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7" /></svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ej.titulo}</div>
          <div style={{ fontSize: '11px', color: '#888780' }}>
            {fase === 'pregunta' ? `Pregunta ${idx + 1} de ${total}` : `${total} ${tipo === 'eco' ? 'frases' : 'preguntas'}`}
          </div>
        </div>
        <Estrellas n={miEstrellas} />
      </div>

      <div style={{ flex: '1 1 auto', minHeight: 0, overflowY: 'auto', padding: '14px 14px 8px' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {fase === 'pregunta' && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
              {ej.preguntas.map((_, i) => {
                const r = resultados[i]
                const hecho = i < idx || (i === idx && (revelado || estadoEco === 'hecho'))
                const f = r && r.total ? r.puntos / r.total : 0
                return (
                  <div key={i} style={{
                    width: '12px', height: '12px', borderRadius: '50%',
                    background: hecho ? (f >= 0.8 ? '#3FAE83' : f >= 0.4 ? '#E9BF45' : '#E24B4A') : i === idx ? '#CDE7DC' : '#E1DFD6',
                    border: i === idx ? `2px solid ${VERDE}` : '2px solid transparent', boxSizing: 'border-box',
                  }} />
                )
              })}
            </div>
          )}

          {sinAudio && (
            <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: '#501313' }}>
              No pudimos activar el sonido. Revisá que el teléfono no esté en silencio y probá de nuevo.
            </div>
          )}

          {fase === 'inicio' && (
            <div style={{ ...tarjeta, fontSize: '13px', color: '#5F5E5A', lineHeight: 1.55 }}>
              <div style={{ fontWeight: 600, color: '#1A1A18', marginBottom: '4px' }}>{ICONO[tipo]} {nivel.nombre}</div>
              <div style={{ marginBottom: '8px' }}>{nivel.descr}</div>
              <div style={{ fontWeight: 600, color: '#1A1A18' }}>{INTRO[tipo][0]}</div>
              <div>{INTRO[tipo][1]}</div>
              <div style={{ marginTop: '8px', color: '#888780', fontSize: '12px' }}>
                Con auriculares se oye mejor. Equivocarse no pasa nada: se aprende escuchando. Para aprobar necesitás {APROBADO_PCT} %.
              </div>
            </div>
          )}

          {fase === 'pregunta' && cuerpoPregunta()}

          {fase === 'resultado' && (
            <div style={{ ...tarjeta, padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '14px', flexWrap: 'wrap' }}>
                <div style={{ fontSize: '40px', fontWeight: 700, lineHeight: 1, color: aprobado ? VERDE : '#B5791B' }}>{pctFinal} %</div>
                <div style={{ textAlign: 'center' }}>
                  <Estrellas n={estrellasPara(pctFinal)} size={22} />
                  <div style={{ fontSize: '14px', fontWeight: 600, color: aprobado ? VERDE : '#B5791B' }}>
                    {aprobado ? '¡Aprobado!' : `Casi: para aprobar necesitás ${APROBADO_PCT} %`}
                  </div>
                </div>
              </div>
              {aviso?.record && <div style={{ textAlign: 'center', fontSize: '13px', color: '#8A6D1D', fontWeight: 600 }}>🏆 ¡Nuevo récord en este ejercicio!</div>}
              {aviso?.nivelSuperado && (
                <div style={{ textAlign: 'center', background: '#E1F5EE', border: '1px solid #9FD9C5', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', fontWeight: 600, color: '#04342C' }}>
                  🎉 ¡Nivel «{nivel.nombre}» superado!{aviso.abre ? ` Se abrió «${nivelPorId(aviso.abre).nombre}».` : ''}
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', flexWrap: 'wrap' }}>
                {ej.preguntas.map((_, i) => {
                  const r = resultados[i]
                  const f = r && r.total ? r.puntos / r.total : 0
                  return (
                    <div key={i} style={{
                      minWidth: '34px', padding: '5px 8px', borderRadius: '10px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#FFFFFF',
                      background: f >= 0.8 ? '#3FAE83' : f >= 0.4 ? '#E9BF45' : '#E24B4A',
                    }}>{f >= 0.8 ? '✓' : f >= 0.4 ? '≈' : '✗'}</div>
                  )
                })}
              </div>
              <div style={{ textAlign: 'center', fontSize: '12px', color: '#888780' }}>
                {aprobado ? 'Seguí así: el oído se entrena con práctica.' : 'Probá de nuevo: cada vez las preguntas son distintas.'}
              </div>
            </div>
          )}
        </div>
      </div>

      <div style={{ flexShrink: 0, borderTop: '1px solid #E8E6DF', background: '#FFFFFF', padding: '12px 14px calc(12px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>{pie()}</div>
      </div>
    </div>
  )
}

function Veredicto({ bien, texto }) {
  return (
    <div style={{
      textAlign: 'center', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', lineHeight: 1.45,
      background: bien ? '#E1F5EE' : '#FBF3DF', border: `1px solid ${bien ? '#9FD9C5' : '#E8DBAE'}`, color: bien ? '#04342C' : '#7A5F17',
    }}>
      <b>{bien ? '¡Bien! ' : 'Casi. '}</b>{texto}
    </div>
  )
}

const TEXTO_ECO = {
  verde: 'justa', amarillo: 'casi', rojo: 'desafinada', nota_distinta: 'sonó otra nota', no_detectada: 'no se oyó',
}

function ResumenEco({ informe }) {
  const { notas, pct } = informe
  return (
    <div style={{ ...tarjeta, display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ textAlign: 'center', fontSize: '26px', fontWeight: 700, color: pct >= APROBADO_PCT ? VERDE : '#B5791B' }}>{pct} %</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', justifyContent: 'center' }}>
        {notas.map((n, i) => {
          const d = n.desviacion
          const lado = (n.estado === 'amarillo' || n.estado === 'rojo') && d != null ? (d > 0 ? ' · un poco alta' : ' · un poco baja') : ''
          return (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#5F5E5A', background: '#F6F4EC', borderRadius: '10px', padding: '4px 8px' }}>
              <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: COLOR_ECO[n.estado] || '#B4B2A9' }} />
              {i + 1}ª: {TEXTO_ECO[n.estado] || n.estado}{lado}
            </span>
          )
        })}
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
        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{ICONO[nivel.tipo]} {nivel.id}. {nivel.nombre}</div>
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

export default function AuditivaEntrenamiento({ prog, onSalir, voz }) {
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
              Entrená el oído sin necesidad de saber música. Aprobando 3 ejercicios se abre el nivel siguiente.
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
          voz={voz}
          onCerrar={() => setEjercicio(null)}
          onIr={(sig) => { setNivelSel(sig.nivel); setEjercicio(sig) }}
        />
      )}
    </div>
  )
}
