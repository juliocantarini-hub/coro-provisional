import { useEffect, useRef, useState } from 'react'
import { musicXmlDe } from '../lib/ritmo'

// Partitura de un ejercicio de ritmo (OSMD). Marca con el cursor la figura que va sonando y,
// al terminar, pinta cada nota según cómo se tocó.

export const COLOR_ESTADO = { ok: '#3FAE83', leve: '#E9BF45', fuera: '#E8756B', falta: '#B4B2A9' }
const NEGRO = '#000000'

// Pone el cursor en la entrada nº "objetivo" (-1 = oculto)
function irAEntrada(osmd, posRef, objetivo) {
  const cur = osmd.cursor
  if (objetivo < 0) {
    try { cur.hide() } catch { /* aún sin cursor */ }
    posRef.current = -1
    return
  }
  cur.show()
  if (posRef.current < 0 || objetivo < posRef.current) { cur.reset(); posRef.current = 0 }
  while (posRef.current < objetivo && !cur.Iterator.EndReached) { cur.next(); posRef.current++ }
}

// Colorea las notas según el resultado (null = todas negras) y vuelve a dibujar
function pintar(osmd, resultado) {
  const cur = osmd.cursor
  cur.reset()
  const it = cur.Iterator
  let k = 0
  while (!it.EndReached) {
    for (const ve of it.CurrentVoiceEntries) {
      for (const note of ve.Notes) {
        if (note.isRest()) continue
        const color = resultado ? (COLOR_ESTADO[resultado.notas[k]?.estado] || NEGRO) : NEGRO
        note.NoteheadColor = color
        note.StemColorXml = color
        k++
      }
    }
    it.moveToNext()
  }
  cur.reset()
  osmd.updateGraphic()
  osmd.render()
}

const zoomPara = (ancho) => (ancho < 520 ? 0.85 : 0.95)

export default function RitmoPartitura({ ejercicio, entradaActiva = -1, resultado = null }) {
  const contRef = useRef(null)
  const osmdRef = useRef(null)
  const posRef = useRef(-1)
  const coloreadoRef = useRef(false)
  const resultadoRef = useRef(resultado)
  const activaRef = useRef(entradaActiva)
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'lista' | 'error'
  resultadoRef.current = resultado
  activaRef.current = entradaActiva

  // Carga y primer dibujo
  useEffect(() => {
    let cancelado = false
    setEstado('cargando')
    coloreadoRef.current = false
    ;(async () => {
      try {
        const modRaw = await import('opensheetmusicdisplay')
        const { OpenSheetMusicDisplay } = modRaw.default || modRaw
        if (cancelado || !contRef.current) return
        contRef.current.innerHTML = ''
        const osmd = new OpenSheetMusicDisplay(contRef.current, {
          autoResize: false, backend: 'svg', autoBeam: true, followCursor: false,
          drawTitle: false, drawSubtitle: false, drawComposer: false, drawLyricist: false,
          drawPartNames: false, drawCredits: false, drawMeasureNumbers: false,
        })
        await osmd.load(musicXmlDe(ejercicio))
        if (cancelado) return
        osmd.zoom = zoomPara(contRef.current.clientWidth || window.innerWidth)
        osmd.render()
        osmdRef.current = osmd
        posRef.current = -1
        irAEntrada(osmd, posRef, activaRef.current)
        setEstado('lista')
      } catch (e) {
        console.warn('Ritmo: no se pudo dibujar la partitura:', e?.message || e)
        if (!cancelado) setEstado('error')
      }
    })()
    return () => { cancelado = true; osmdRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ejercicio.nivel, ejercicio.numero])

  // Cursor
  useEffect(() => {
    const o = osmdRef.current
    if (!o || estado !== 'lista') return
    try { irAEntrada(o, posRef, entradaActiva) } catch { /* el cursor es solo un adorno */ }
  }, [entradaActiva, estado])

  // Colores del resultado
  useEffect(() => {
    const o = osmdRef.current
    if (!o || estado !== 'lista') return
    if (!resultado && !coloreadoRef.current) return
    coloreadoRef.current = !!resultado
    try {
      pintar(o, resultado)
      posRef.current = -1
      irAEntrada(o, posRef, activaRef.current)
    } catch (e) { console.warn('Ritmo: no se pudieron colorear las notas:', e?.message || e) }
  }, [resultado, estado])

  // Cambio de ancho (girar el teléfono, cambiar el tamaño de la ventana)
  useEffect(() => {
    const el = contRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    let ancho = el.clientWidth
    let t = null
    const ro = new ResizeObserver(() => {
      const w = el.clientWidth
      if (Math.abs(w - ancho) < 8) return
      ancho = w
      clearTimeout(t)
      t = setTimeout(() => {
        const o = osmdRef.current
        if (!o) return
        try {
          o.zoom = zoomPara(w)
          o.updateGraphic()
          o.render()
          posRef.current = -1
          irAEntrada(o, posRef, activaRef.current)
        } catch { /* se queda como estaba */ }
      }, 200)
    })
    ro.observe(el)
    return () => { ro.disconnect(); clearTimeout(t) }
  }, [])

  return (
    <div style={{ position: 'relative', background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '8px 6px', minHeight: '110px' }}>
      <div ref={contRef} style={{ position: 'relative', width: '100%' }} />
      {estado === 'cargando' && (
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', color: '#888780' }}>
          Cargando partitura…
        </div>
      )}
      {estado === 'error' && (
        <div style={{ padding: '24px 12px', textAlign: 'center', fontSize: '13px', color: '#A32D2D' }}>
          No se pudo mostrar la partitura. Igual podés escuchar el ejemplo y marcar el ritmo.
        </div>
      )}
    </div>
  )
}
