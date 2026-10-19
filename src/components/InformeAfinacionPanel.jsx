import { useEffect, useMemo, useRef, useState } from 'react'
import { listarCompases, notasParaInforme, rangoEnSegundos, pulsosMetronomo } from '../lib/informeNotas'
import { iniciarGrabacion } from '../lib/grabadora'
import { tocarNotaDePartida, tocarPrimerCompas, iniciarGuiaPiano, contar, prepararPianoDeGuia } from '../lib/guiaInforme'
import { midiANombre } from '../lib/afinacion'
import { armarResumenParaCoaching, pedirCoaching } from '../lib/coaching'
import { armarDiagnostico, guardarInformeParaDirector } from '../lib/informeGuardado'
import { useAuth } from '../hooks/useAuth'

// Grabar un fragmento de la obra y recibir un informe de afinación y ritmo,
// comparando con la melodía de la propia voz del cantante (la partitura ya
// parseada). El audio vive solo en memoria y se descarta al terminar.

const COLOR = {
  verde: { fuerte: '#3FAE83', suave: '#C9EBDD', texto: '#04342C' },
  amarillo: { fuerte: '#E9BF45', suave: '#F5E7B8', texto: '#5A4300' },
  rojo: { fuerte: '#E8756B', suave: '#F6CFCB', texto: '#7A1F17' },
  neutro: { fuerte: '#B9B7AC', suave: '#EFEEE7', texto: '#5F5E5A' },
}
const MAX_SEG_FRAGMENTO = 90
const BANDA_VERDE_CENTS = 20 // igual que en informeAfinacion.js (no se importa de ahí para no cargar el motor en la pantalla principal)
const SEG_SUGERIDOS = 30
const COMPASES_SUGERIDOS = 8

// Los números de compás vienen como texto ("10", "5a"…): se comparan SIEMPRE por
// posición en la lista, nunca como texto ("10" < "2") ni como número.
function hastaSugerido(partitura, lista, desde) {
  const i0 = lista.indexOf(desde)
  if (i0 < 0) return desde
  let mejor = desde
  let contados = 0
  for (let i = i0; i < lista.length; i++) {
    if (contados >= COMPASES_SUGERIDOS) break
    const r = rangoEnSegundos(partitura, desde, lista[i])
    if (r && r.duracion <= SEG_SUGERIDOS) mejor = lista[i]
    else break
    contados++
  }
  return mejor
}

function analizarEnWorker(muestras, sampleRate, notas, opciones) {
  return new Promise((resolve, reject) => {
    let worker
    try {
      worker = new Worker(new URL('../lib/informeWorker.js', import.meta.url), { type: 'module' })
    } catch {
      worker = null
    }
    const enHiloPrincipal = async () => {
      const { analizarGrabacion } = await import('../lib/informeAfinacion')
      return analizarGrabacion(muestras, sampleRate, notas, opciones)
    }
    if (!worker) { enHiloPrincipal().then(resolve, reject); return }
    worker.onmessage = (e) => {
      worker.terminate()
      if (e.data.ok) resolve(e.data.informe)
      else reject(new Error(e.data.error))
    }
    worker.onerror = () => {
      worker.terminate()
      enHiloPrincipal().then(resolve, reject) // por si el navegador no soporta workers de módulo
    }
    worker.postMessage({ muestras, sampleRate, notas, opciones }) // se copia (unos MB): así el respaldo sin worker sigue teniendo el audio
  })
}

const boton = (primario) => ({
  padding: '10px 18px', borderRadius: '22px', fontSize: '14px', fontWeight: 600, cursor: 'pointer',
  border: primario ? 'none' : '1px solid #D3D1C7',
  background: primario ? '#1D7A5F' : '#FFFFFF',
  color: primario ? '#FFFFFF' : '#3D3D3A',
})

function Chip({ estado, children }) {
  const c = COLOR[estado] || COLOR.neutro
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: '10px', fontSize: '11px', fontWeight: 600,
      background: c.suave, color: c.texto, border: `1px solid ${c.fuerte}`,
    }}>{children}</span>
  )
}

function textoCents(c) {
  if (c == null) return ''
  const abs = Math.abs(c)
  if (abs <= BANDA_VERDE_CENTS) return 'afinada'
  return `${abs} cents ${c > 0 ? 'alta' : 'baja'}`
}

function textoRitmo(r) {
  if (!r) return null
  if (r.estado === 'ok') return 'en tiempo'
  const seg = (Math.abs(r.errorMs) / 1000).toFixed(2).replace('.', ',')
  return `${r.direccion === 'tarde' ? 'tarde' : 'antes de tiempo'} (${seg} s)`
}

export default function InformeAfinacionPanel({ partitura, voz, titulo, onCerrar }) {
  const { perfil } = useAuth()
  const lista = useMemo(() => listarCompases(partitura), [partitura])
  const [desde, setDesde] = useState(lista[0])
  const [hasta, setHasta] = useState(() => (lista.length ? hastaSugerido(partitura, lista, lista[0]) : undefined))
  const [etapa, setEtapa] = useState('config') // config | nota | conteo | grabando | analizando | informe | error
  const [conteo, setConteo] = useState(0)
  const [segundos, setSegundos] = useState(0)
  const [nivel, setNivel] = useState(0)
  const [informe, setInforme] = useState(null)
  const [error, setError] = useState('')
  const [compasAbierto, setCompasAbierto] = useState(null)
  const [coaching, setCoaching] = useState({ estado: 'idle', texto: '', mensaje: '' }) // idle | cargando | listo | error
  const [faseGuia, setFaseGuia] = useState('nota') // durante la etapa 'nota': 'nota' (nota de partida) | 'compas' (primer compás en piano)
  const [conGuia, setConGuia] = useState(false) // opcional: escuchar la propia parte en piano mientras se canta (solo con auriculares)
  const [ancla, setAncla] = useState(false) // true: ya se eligió el compás inicial y falta el final

  // Letra (o notas, si no hay letra) de cada compás, para ubicarse al elegir
  const letrasPorCompas = useMemo(() => {
    const out = {}
    const medidas = partitura?.medidas || []
    const notasVoz = voz?.notas || []
    medidas.forEach((m, i) => {
      const fin = medidas[i + 1] ? medidas[i + 1].tiempo : Infinity
      const dentro = notasVoz.filter((n) => n.nota && n.tiempo >= m.tiempo - 1e-6 && n.tiempo < fin - 1e-6)
      const letras = dentro.map((n) => n.letra).filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
      out[m.numero] = letras || dentro.map((n) => n.nota).join(' ')
    })
    return out
  }, [partitura, voz])

  const grabadoraRef = useRef(null)
  const guiaRef = useRef(null) // guía de piano que suena durante la grabación
  const conGuiaRef = useRef(false) // esta toma se hizo con guía sonando
  const cancelado = useRef(false)
  const marcaRef = useRef({ inicioMs: 0, yaMs: 0 })
  const notasRef = useRef([])
  const diagRef = useRef(null) // datos de entrada del último análisis (para el diagnóstico oculto)
  const tapsTitulo = useRef({ n: 0, t: 0 })
  const [diagVisible, setDiagVisible] = useState(false)
  const [diagEstado, setDiagEstado] = useState('') // '' | 'copiado' | 'manual'
  const [diagTexto, setDiagTexto] = useState('')

  const { notas, rango } = useMemo(
    () => (voz && desde != null && hasta != null ? notasParaInforme(partitura, voz.id, desde, hasta) : { notas: [], rango: null }),
    [partitura, voz, desde, hasta],
  )
  const muyLargo = rango && rango.duracion > MAX_SEG_FRAGMENTO
  const idxDesde = lista.indexOf(desde)
  const idxHasta = lista.indexOf(hasta)

  useEffect(() => {
    prepararPianoDeGuia() // baja las muestras de piano mientras elegís el fragmento
    return () => {
      cancelado.current = true
      guiaRef.current?.detener()
      grabadoraRef.current?.cancelar()
    }
  }, [])

  // Cronómetro y nivel mientras se graba
  useEffect(() => {
    if (etapa !== 'grabando' && etapa !== 'conteo' && etapa !== 'nota') return
    const id = setInterval(() => {
      const g = grabadoraRef.current
      if (!g) return
      setNivel(Math.min(1, g.nivel() * 12))
      if (etapa === 'grabando') {
        const t = (performance.now() - marcaRef.current.yaMs) / 1000
        setSegundos(Math.max(0, t))
        const limite = Math.min(150, (rango?.duracion || 60) * 1.6 + 12)
        if (t > limite) terminar()
      }
    }, 100)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etapa, rango])

  // Primer toque: compás donde empezás. Segundo toque: compás donde terminás.
  function tocarCompas(n) {
    if (!ancla || lista.indexOf(n) < lista.indexOf(desde)) {
      setDesde(n)
      setHasta(n)
      setAncla(true)
    } else {
      setHasta(n)
      setAncla(false)
    }
  }

  async function empezar() {
    setError('')
    cancelado.current = false
    notasRef.current = notas
    try {
      setFaseGuia('compas')
      setEtapa('nota')
      const g = await iniciarGrabacion() // pide el permiso del micrófono ya mismo
      grabadoraRef.current = g
      marcaRef.current.inicioMs = performance.now()
      // Referencia: el primer compás elegido en piano (la melodía de tu voz, con su ritmo).
      // Solo si el piano no está disponible se toca la nota de partida suelta como respaldo.
      const compasInicial = notas[0].compas
      const delCompas = notas.filter((n) => n.compas === compasInicial)
      const siguiente = notas.find((n) => n.compas !== compasInicial)
      const ultima = delCompas[delCompas.length - 1]
      const durCompas = siguiente ? siguiente.inicio : (rango?.duracion ?? ultima.inicio + ultima.duracion)
      setFaseGuia('compas')
      const sono = await tocarPrimerCompas(delCompas, durCompas)
      if (cancelado.current) return
      if (!sono) {
        setFaseGuia('nota')
        await tocarNotaDePartida(notas[0].midi)
        if (cancelado.current) return
      }
      setEtapa('conteo')
      // Conteo: UN compás entero de clics (un clic por pulso del compás), al pulso del tempo elegido
      // Conteo de un compás entero (un clic por tiempo del compás), al tempo de la obra
      const pm = pulsosMetronomo(partitura, desde, hasta)
      const clicsConteo = Math.max(2, Math.min(8, pm.clicsPrimerCompas || 4))
      const pulso = Math.max(0.35, Math.min(2.5, pm.pulsoSeg != null ? pm.pulsoSeg : notas[0].pulsoSeg))
      await contar(pulso, (n) => !cancelado.current && setConteo(n), clicsConteo)
      if (cancelado.current) return
      marcaRef.current.yaMs = performance.now()
      setSegundos(0)
      setEtapa('grabando')
      conGuiaRef.current = false
      if (conGuia) {
        guiaRef.current = iniciarGuiaPiano(notasRef.current)
        conGuiaRef.current = !!guiaRef.current
      }
    } catch (e) {
      guiaRef.current?.detener()
      grabadoraRef.current?.cancelar()
      grabadoraRef.current = null
      setError(
        e?.name === 'NotAllowedError'
          ? 'No pudimos usar el micrófono. Revisá el permiso del navegador y volvé a intentar.'
          : e?.message || 'No pudimos iniciar la grabación.',
      )
      setEtapa('error')
    }
  }

  async function terminar() {
    const g = grabadoraRef.current
    if (!g) return
    grabadoraRef.current = null
    const yaSeg = Math.max(0, (marcaRef.current.yaMs - marcaRef.current.inicioMs) / 1000)
    const descartar = Math.max(0, yaSeg - 0.15)
    guiaRef.current?.detener()
    guiaRef.current = null
    const { muestras, sampleRate } = g.detener()
    setEtapa('analizando')
    try {
      const opcionesAnalisis = { descartarAntesDeSeg: descartar, inicioCantoSeg: yaSeg }
      diagRef.current = { sampleRate, opciones: opcionesAnalisis, notas: notasRef.current, conGuia: conGuiaRef.current }
      const inf = await analizarEnWorker(muestras, sampleRate, notasRef.current, opcionesAnalisis)
      if (cancelado.current) return
      if (inf.error) {
        setError(inf.mensaje || 'No pudimos analizar la grabación.')
        setEtapa('error')
        return
      }
      if (conGuiaRef.current) {
        // Que quede dicho (para el cantante, la IA y el director): con la guía sonando la afinación no refleja cómo se canta de memoria
        inf.mensajes = [...(inf.mensajes || []), 'Esta toma se hizo con la guía de piano sonando, así que es normal que la afinación salga mejor. Probá también sin guía para ver cómo la cantás de memoria.']
      }
      setInforme(inf)
      guardarInformeParaDirector({ perfil, titulo, vozNombre: voz?.nombre, desde, hasta, informe: inf, entrada: diagRef.current }) // resumen en números para el director (sin audio)
      setCompasAbierto(null)
      setEtapa('informe')
    } catch (e) {
      setError('Ocurrió un error al analizar la grabación. Probá de nuevo.')
      setEtapa('error')
    }
  }

  // Toca 3 veces el título para habilitar el botón de diagnóstico (copia números, nunca audio)
  function tocarTitulo() {
    const ahora = Date.now()
    const t = tapsTitulo.current
    t.n = ahora - t.t < 1500 ? t.n + 1 : 1
    t.t = ahora
    if (t.n >= 3) { t.n = 0; setDiagVisible(true) }
  }

  async function copiarDiagnostico() {
    if (!informe || !diagRef.current) return
    const payload = armarDiagnostico({ titulo, vozNombre: voz?.nombre, desde, hasta, informe, entrada: diagRef.current })
    const texto = JSON.stringify(payload)
    setDiagTexto(texto)
    try {
      await navigator.clipboard.writeText(texto)
      setDiagEstado('copiado')
    } catch {
      setDiagEstado('manual') // el navegador no dejó copiar: se muestra el texto para copiarlo a mano
    }
  }

  function cerrar() {
    cancelado.current = true
    guiaRef.current?.detener()
    guiaRef.current = null
    grabadoraRef.current?.cancelar()
    grabadoraRef.current = null
    onCerrar()
  }

  async function pedirConsejos() {
    if (!informe || coaching.estado === 'cargando') return
    setCoaching({ estado: 'cargando', texto: '', mensaje: '' })
    try {
      const resumen = armarResumenParaCoaching(informe, { titulo, vozNombre: voz?.nombre, desde, hasta, pulsoSeg: notas[0]?.pulsoSeg })
      const texto = await pedirCoaching(resumen)
      if (!cancelado.current) setCoaching({ estado: 'listo', texto, mensaje: '' })
    } catch (e) {
      if (!cancelado.current) setCoaching({ estado: 'error', texto: '', mensaje: e.message || 'No pudimos generar los consejos ahora.' })
    }
  }

  function repetir() {
    setCoaching({ estado: 'idle', texto: '', mensaje: '' })
    setInforme(null)
    setEtapa('config')
  }

  // ─── Pantallas ──────────────────────────────────────────────────────────
  let cuerpo = null

  if (etapa === 'config') {
    cuerpo = (
      <>
        <p style={{ fontSize: '13px', color: '#5F5E5A', lineHeight: 1.5, margin: '0 0 14px' }}>
          Elegí el fragmento que vas a cantar. Primero escuchás el primer compás en piano, después
          un compás de clics, y cantás desde el compás elegido. Al terminar te mostramos dónde corregir
          afinación y ritmo. <strong>Usá auriculares</strong> para que los clics no se cuelen en la grabación.
        </p>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#1A1A18', marginBottom: '6px' }}>
          {ancla ? 'Ahora tocá el compás donde terminás' : 'Tocá el compás donde empezás y después el compás donde terminás'}
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', marginBottom: '10px' }}>
          {lista.map((n, idx) => {
            const dentro = idx >= idxDesde && idx <= idxHasta
            const extremo = idx === idxDesde || idx === idxHasta
            return (
              <button key={`${idx}-${n}`} onClick={() => tocarCompas(n)} title={letrasPorCompas[n] || ''}
                style={{
                  minWidth: '38px', height: '34px', padding: '0 6px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: extremo ? 700 : 500,
                  border: extremo ? '2px solid #1D7A5F' : '1px solid #D3D1C7',
                  background: extremo ? '#1D7A5F' : dentro ? '#C9EBDD' : '#FFFFFF',
                  color: extremo ? '#FFFFFF' : '#3D3D3A',
                }}>
                {n}
              </button>
            )
          })}
        </div>
        {desde != null && hasta != null && (
          <div style={{ fontSize: '12px', color: '#3D3D3A', background: '#F7F6F1', borderRadius: '8px', padding: '8px 10px', marginBottom: '10px', lineHeight: 1.5 }}>
            <div><strong>Empezás en el compás {desde}:</strong> {letrasPorCompas[desde] ? `“${letrasPorCompas[desde]}”` : '—'}</div>
            <div><strong>Terminás en el compás {hasta}:</strong> {letrasPorCompas[hasta] ? `“${letrasPorCompas[hasta]}”` : '—'}</div>
          </div>
        )}
        <div style={{ fontSize: '12px', color: muyLargo ? '#A32D2D' : '#8A8878', marginBottom: '16px' }}>
          {rango
            ? `${notas.length} notas · aprox. ${Math.round(rango.duracion)} s al tempo escrito${muyLargo ? ` — elegí un tramo de hasta ${MAX_SEG_FRAGMENTO} s` : ''}`
            : 'Elegí un rango válido.'}
          {notas.length > 0 && <> · primera nota: <strong>{midiANombre(notas[0].midi)}</strong></>}
        </div>
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', fontSize: '12px', color: '#3D3D3A', margin: '0 0 12px', cursor: 'pointer', lineHeight: 1.45 }}>
          <input type="checkbox" checked={conGuia} onChange={(e) => setConGuia(e.target.checked)} style={{ marginTop: '2px' }} />
          <span>
            <strong>Escuchar mi parte en piano mientras canto</strong> — solo con auriculares. Ayuda a no perderte,
            pero la afinación sale mejor que de memoria; el informe lo aclara.
          </span>
        </label>
        <button style={{ ...boton(true), opacity: notas.length && !muyLargo ? 1 : 0.5 }} disabled={!notas.length || muyLargo} onClick={empezar}>
          🎤 Empezar
        </button>
        <p style={{ fontSize: '11px', color: '#8A8878', margin: '14px 0 0' }}>
          Tu grabación no se guarda: se analiza en tu dispositivo y se descarta al terminar.
        </p>
      </>
    )
  } else if (etapa === 'nota' || etapa === 'conteo' || etapa === 'grabando') {
    const nombre = notas[0] ? midiANombre(notas[0].midi) : ''
    cuerpo = (
      <div style={{ textAlign: 'center', padding: '10px 0' }}>
        <div style={{ fontSize: '13px', color: '#5F5E5A', marginBottom: '8px' }}>
          Compases {desde} a {hasta}
        </div>
        {etapa === 'nota' && (
          <>
            <div style={{ fontSize: '40px', fontWeight: 700, color: '#1D7A5F' }}>{faseGuia === 'compas' ? `Compás ${desde}` : nombre}</div>
            <div style={{ fontSize: '14px', color: '#3D3D3A' }}>
              {faseGuia === 'compas' ? 'Escuchá cómo va el primer compás (en piano)…' : 'Esta es tu nota de partida. Escuchala…'}
            </div>
          </>
        )}
        {etapa === 'conteo' && (
          <>
            <div style={{ fontSize: '56px', fontWeight: 700, color: '#1D7A5F', lineHeight: 1 }}>{conteo || '·'}</div>
            <div style={{ fontSize: '14px', color: '#3D3D3A' }}>Preparate: entrás en el compás {desde}</div>
          </>
        )}
        {etapa === 'grabando' && (
          <>
            <div style={{ fontSize: '14px', color: '#A32D2D', fontWeight: 600 }}>● Grabando… {Math.floor(segundos)} s</div>
            <div style={{ fontSize: '13px', color: '#5F5E5A', margin: '6px 0 14px' }}>Cantá hasta el final del compás {hasta}.</div>
          </>
        )}
        <div style={{ height: '8px', borderRadius: '4px', background: '#EFEEE7', margin: '12px auto', maxWidth: '260px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${Math.round(nivel * 100)}%`, background: '#3FAE83', transition: 'width 0.1s' }} />
        </div>
        {etapa === 'grabando'
          ? <button style={boton(true)} onClick={terminar}>⏹ Terminé</button>
          : <button style={boton(false)} onClick={() => { cancelado.current = true; guiaRef.current?.detener(); guiaRef.current = null; grabadoraRef.current?.cancelar(); grabadoraRef.current = null; setEtapa('config') }}>Cancelar</button>}
      </div>
    )
  } else if (etapa === 'analizando') {
    cuerpo = <div style={{ textAlign: 'center', padding: '30px 0', color: '#5F5E5A', fontSize: '14px' }}>Analizando tu grabación…</div>
  } else if (etapa === 'error') {
    cuerpo = (
      <>
        <p style={{ fontSize: '14px', color: '#A32D2D' }}>{error}</p>
        <button style={boton(true)} onClick={repetir}>Volver</button>
      </>
    )
  } else if (etapa === 'informe' && informe) {
    const r = informe.resumen
    const rit = r.ritmo
    const estadoAf = r.pctVerde >= 60 ? 'verde' : r.pctVerde >= 30 ? 'amarillo' : 'rojo'
    const estadoRi = rit?.pctOk == null ? 'neutro' : rit.pctOk >= 70 ? 'verde' : rit.pctOk >= 45 ? 'amarillo' : 'rojo'
    const dudosa = r.alineacionDudosa
    const diag = r.diagnostico
    const notasDe = (compas) => informe.notas.filter((n) => n.compas === compas)
    const tile = (estado, titulo2, valor, sub) => (
      <div style={{ flex: 1, minWidth: '130px', background: COLOR[estado].suave, border: `1px solid ${COLOR[estado].fuerte}`, borderRadius: '12px', padding: '12px 14px' }}>
        <div style={{ fontSize: '12px', color: COLOR[estado].texto }}>{titulo2}</div>
        <div style={{ fontSize: '26px', fontWeight: 700, color: COLOR[estado].texto }}>{valor}</div>
        <div style={{ fontSize: '11px', color: COLOR[estado].texto }}>{sub}</div>
      </div>
    )
    cuerpo = (
      <>
        {dudosa && (
          <div style={{ background: COLOR.amarillo.suave, border: `1px solid ${COLOR.amarillo.fuerte}`, borderRadius: '10px', padding: '10px 12px', fontSize: '13px', color: COLOR.amarillo.texto, marginBottom: '12px', lineHeight: 1.5 }}>
            <strong>No pudimos seguir tu grabación con la partitura</strong>, así que no te mostramos puntajes (serían engañosos).
            {diag && <> Se grabaron {diag.segundosGrabados} s y se oyó voz durante {diag.segundosConVoz} s.</>}
            {' '}Probá de nuevo cantando todo el fragmento elegido, sin cortar, a un volumen cómodo y cerca del micrófono; si es largo, elegí menos compases.
          </div>
        )}
        {!dudosa && (
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '14px' }}>
            {tile(estadoAf, 'Afinación', `${r.pctVerde}%`, Math.abs(r.offsetGlobalCents) >= 25 ? 'entre tus notas, bien afinado' : 'del tiempo bien afinado')}
            {tile(estadoRi, 'Ritmo', rit?.pctOk == null ? '–' : `${rit.pctOk}%`, rit?.concluyente === false ? 'no concluyente en este fragmento' : 'de las entradas en tiempo')}
          </div>
        )}

        {!dudosa && informe.notas.filter((n) => n.estado === 'verde').length > 0 && (
          <div style={{ fontSize: '13px', color: '#27500A', background: '#EAF3DE', borderRadius: '8px', padding: '8px 10px', margin: '0 0 10px' }}>
            ✓ <strong>{informe.notas.filter((n) => n.estado === 'verde').length} de {r.notasDetectadas} notas</strong> bien afinadas.
          </div>
        )}
        {!dudosa && <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A18', margin: '4px 0 6px' }}>Para pulir</div>}
        {!dudosa && <ul style={{ margin: '0 0 14px', paddingLeft: '18px', fontSize: '13px', color: '#3D3D3A', lineHeight: 1.5 }}>
          {informe.mensajes.slice(0, 4).map((m, i) => <li key={i} style={{ marginBottom: '4px' }}>{m}</li>)}
        </ul>}

        {!dudosa && (
          <div style={{ background: '#F4F1FA', border: '1px solid #D9D0EE', borderRadius: '12px', padding: '12px 14px', marginBottom: '12px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#2E2457', marginBottom: '4px' }}>Consejos de práctica</div>
            {coaching.estado === 'idle' && (
              <>
                <div style={{ fontSize: '12px', color: '#4A4270', lineHeight: 1.5, marginBottom: '8px' }}>
                  Una IA lee los números de tu informe y te sugiere qué trabajar primero. Solo se envía el resumen en números; tu audio nunca sale del dispositivo.
                </div>
                <button style={boton(false)} onClick={pedirConsejos}>✨ Pedir consejos</button>
              </>
            )}
            {coaching.estado === 'cargando' && <div style={{ fontSize: '13px', color: '#4A4270' }}>Preparando tus consejos…</div>}
            {coaching.estado === 'listo' && (
              <>
                <div style={{ fontSize: '13px', color: '#2E2457', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{coaching.texto}</div>
                <div style={{ fontSize: '11px', color: '#7A7396', marginTop: '8px' }}>Generado por IA a partir de tu informe; puede equivocarse. Tomalo como una guía.</div>
              </>
            )}
            {coaching.estado === 'error' && (
              <>
                <div style={{ fontSize: '12px', color: '#A32D2D', marginBottom: '8px' }}>{coaching.mensaje}</div>
                <button style={boton(false)} onClick={pedirConsejos}>Reintentar</button>
              </>
            )}
          </div>
        )}

        {!dudosa && <div style={{ fontSize: '13px', fontWeight: 700, color: '#1A1A18', margin: '4px 0 6px' }}>Por compás <span style={{ fontWeight: 400, color: '#8A8878' }}>(arriba afinación, abajo ritmo — tocá uno para ver el detalle)</span></div>}
        {!dudosa && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
          {informe.compases.map((c) => {
            const abierto = compasAbierto === c.compas
            return (
              <button key={c.compas} onClick={() => setCompasAbierto(abierto ? null : c.compas)}
                style={{
                  width: '46px', padding: '4px 0 6px', borderRadius: '10px', cursor: 'pointer', textAlign: 'center',
                  background: '#FFFFFF', border: abierto ? '2px solid #1A1A18' : '1px solid #D3D1C7',
                }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#3D3D3A' }}>{c.compas}</div>
                <div style={{ height: '8px', margin: '3px 5px 2px', borderRadius: '4px', background: COLOR[c.estado].fuerte }} />
                <div style={{ height: '8px', margin: '0 5px', borderRadius: '4px', background: COLOR[c.estadoRitmo || 'neutro'].fuerte }} />
              </button>
            )
          })}
        </div>}

        {!dudosa && compasAbierto != null && (
          <div style={{ background: '#F7F6F1', border: '1px solid #E8E6DF', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
            <div style={{ fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Compás {compasAbierto}</div>
            {notasDe(compasAbierto).map((n) => (
              <div key={n.indice} style={{ display: 'flex', gap: '8px', alignItems: 'baseline', fontSize: '12px', padding: '3px 0', borderTop: '1px solid #ECEAE2' }}>
                <strong style={{ width: '34px' }}>{n.nombre}</strong>
                {n.estado === 'no_detectada' ? (
                  <Chip estado="neutro">no la encontré</Chip>
                ) : n.estado === 'no_separable' ? (
                  <Chip estado="neutro">nota repetida (se mide junto a la anterior)</Chip>
                ) : (
                  <>
                    <Chip estado={n.estado === 'nota_distinta' ? 'rojo' : n.estado}>
                      {n.estado === 'nota_distinta' ? 'nota distinta' : textoCents(n.desviacionRelativaCents ?? n.desviacionCents)}
                    </Chip>
                    {n.ritmo && <Chip estado={n.ritmo.estado === 'ok' ? 'verde' : n.ritmo.estado === 'leve' ? 'amarillo' : 'rojo'}>{textoRitmo(n.ritmo)}</Chip>}
                    {n.duracionEstado && n.duracionEstado !== 'ok' && <Chip estado="amarillo">{n.duracionEstado === 'corta' ? 'la cortaste' : 'la alargaste'}</Chip>}
                    {n.pocaEvidencia && <Chip estado="neutro">pocos datos</Chip>}
                    {n.vibratoAmplio && <Chip estado="amarillo">vibrato amplio (±{n.vibratoCents})</Chip>}
                  </>
                )}
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '8px' }}>
          <button style={boton(true)} onClick={repetir}>🎤 Grabar de nuevo</button>
          <button style={boton(false)} onClick={cerrar}>Cerrar</button>
        </div>
        {diagVisible && (
          <div style={{ marginTop: '12px', padding: '10px 12px', border: '1px dashed #B9B7AC', borderRadius: '10px', background: '#FAFAF6' }}>
            <div style={{ fontSize: '12px', color: '#5F5E5A', marginBottom: '6px' }}>
              Diagnóstico: copia números de la toma (altura por tiempo y resultados). <strong>No incluye tu audio.</strong>
            </div>
            <button style={boton(false)} onClick={copiarDiagnostico}>📋 Copiar datos de diagnóstico</button>
            {diagEstado === 'copiado' && <span style={{ fontSize: '12px', color: '#1D7A5F', marginLeft: '10px' }}>¡Copiado! Pegalo en el chat.</span>}
            {diagEstado === 'manual' && (
              <textarea readOnly value={diagTexto} onFocus={(e) => e.target.select()} style={{ width: '100%', height: '90px', marginTop: '8px', fontSize: '11px' }} />
            )}
          </div>
        )}
        {!dudosa && (
          <details style={{ margin: '12px 0 0', fontSize: '12px', color: '#3D3D3A', background: '#F7F6F1', borderRadius: '8px', padding: '8px 10px' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600 }}>¿Qué son los “cents”?</summary>
            <div style={{ marginTop: '6px', lineHeight: 1.55 }}>
              Los <strong>cents</strong> (centésimas de semitono) son la unidad con la que se mide qué tan desafinada está una nota.
              Un semitono (la distancia entre dos teclas vecinas del piano, por ejemplo de Do a Do#) tiene 100 cents.
              Por ejemplo, <strong>“25 cents bajo”</strong> es que cantaste un cuarto de semitono por debajo de lo escrito, y
              <strong> “50 cents alta”</strong> es medio semitono por encima.
              <div style={{ marginTop: '6px' }}>
                Hasta unos <strong>15 cents</strong> se considera afinada (verde); entre 15 y 35 se nota un poco (amarillo); más de 35 ya suena
                desafinada (rojo). La <em>afinación general</em> es cuánto estuvo más alto o más bajo todo el fragmento (por ejemplo, si arrancaste desde una nota de partida corrida), y el
                <em> vibrato</em> es cuánto oscila la nota hacia arriba y hacia abajo mientras la sostenés.
              </div>
            </div>
          </details>
        )}
        <p style={{ fontSize: '11px', color: '#8A8878', margin: '12px 0 0' }}>
          Es una medición aproximada hecha con el micrófono de tu dispositivo. Tu grabación se descartó al terminar el análisis.
        </p>
      </>
    )
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(26,26,24,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '12px' }}>
      <div style={{ background: '#FFFFFF', borderRadius: '16px', width: '100%', maxWidth: '560px', maxHeight: '92vh', overflowY: 'auto', padding: '18px 18px 20px', boxShadow: '0 10px 40px rgba(0,0,0,0.3)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
          <div>
            <div onClick={tocarTitulo} style={{ fontSize: '16px', fontWeight: 700, color: '#1A1A18' }}>Grabarme y ver informe</div>
            <div style={{ fontSize: '12px', color: '#8A8878' }}>{[titulo, voz?.nombre].filter(Boolean).join(' · ')}</div>
          </div>
          <button onClick={cerrar} aria-label="Cerrar" style={{ border: 'none', background: 'transparent', fontSize: '22px', cursor: 'pointer', color: '#5F5E5A', lineHeight: 1 }}>×</button>
        </div>
        {cuerpo}
      </div>
    </div>
  )
}
