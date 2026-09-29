import { useEffect, useRef, useState } from 'react'

// Partitura visual con cursor sincronizado a la reproducción, usando OpenSheetMusicDisplay
// (OSMD) para dibujar el pentagrama real a partir del mismo MusicXML que ya usamos para
// generar el audio. La librería se carga de forma perezosa (import dinámico) para no
// sumar peso a la carga inicial de la página: solo se descarga cuando el cantante abre
// la vista de partitura.
//
// Importante: el cursor NO usa el iterador musical propio de OSMD para avanzar (ese
// iterador sigue la "forma" real de la pieza, incluidas repeticiones/da-capo, y
// nuestro reproductor de audio no las reproduce). En cambio, cada vez que cambia el
// pulso (tiempo del compás) actual — calculado con nuestro propio arreglo `tiempos`,
// el mismo que usa el audio —, construimos un iterador nuevo posicionado directamente
// en ese pulso y se lo asignamos al cursor — así el cursor visual queda siempre
// alineado con lo que se escucha, pulso a pulso (no solo compás a compás), sin
// importar si la partitura tiene repeticiones escritas.

export default function PartituraVisual({ musicxml, tiempos, divisions, vozNombre, tiempoActual, velocidad, reproduciendo }) {
  const containerRef = useRef(null)
  const osmdRef = useRef(null)
  const osmdModRef = useRef(null)
  const pulsoActualRef = useRef(-1)
  const [estado, setEstado] = useState('cargando') // 'cargando' | 'lista' | 'error'

  // Carga y primer renderizado de la partitura.
  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setEstado('cargando')
      try {
        const modRaw = await import('opensheetmusicdisplay')
        const mod = modRaw.default || modRaw
        const { OpenSheetMusicDisplay } = mod
        if (cancelado || !containerRef.current) return

        containerRef.current.innerHTML = ''
        const osmd = new OpenSheetMusicDisplay(containerRef.current, {
          autoResize: false,
          drawTitle: false,
          backend: 'svg',
          drawPartNames: true,
        })
        await osmd.load(musicxml)
        if (cancelado) return
        osmd.render()
        osmd.cursor.show()
        osmdRef.current = osmd
        osmdModRef.current = mod
        pulsoActualRef.current = -1
        colorearVoz(osmd, vozNombre)
        setEstado('lista')
      } catch (e) {
        if (!cancelado) setEstado('error')
      }
    }

    cargar()
    return () => {
      cancelado = true
      osmdRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [musicxml])

  // Recolorear cuando cambia la voz que se quiere destacar.
  useEffect(() => {
    if (estado === 'lista' && osmdRef.current) {
      colorearVoz(osmdRef.current, vozNombre)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vozNombre, estado])

  // Mover el cursor al pulso (tiempo del compás) que corresponde al instante
  // actual de reproducción — no solo al principio del compás.
  useEffect(() => {
    const osmd = osmdRef.current
    if (estado !== 'lista' || !osmd || !tiempos.length) return

    const posicionMusical = tiempoActual * velocidad
    let indice = 0
    for (let i = 0; i < tiempos.length; i++) {
      if (tiempos[i].tiempo <= posicionMusical) indice = i
      else break
    }

    if (indice === pulsoActualRef.current) return
    pulsoActualRef.current = indice

    moverCursor(osmd, osmdModRef.current, tiempos[indice].tickInicio, divisions)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tiempoActual, velocidad, estado])

  return (
    <div style={{ marginTop: '14px' }}>
      {estado === 'error' && (
        <div style={{ fontSize: '12px', color: '#A32D2D', padding: '8px 0' }}>
          No pudimos mostrar la partitura visual. El audio y la afinación siguen funcionando normalmente.
        </div>
      )}
      {estado === 'cargando' && (
        <div style={{ fontSize: '12px', color: '#888780', padding: '8px 0' }}>Cargando partitura...</div>
      )}
      <div
        ref={containerRef}
        style={{
          display: estado === 'lista' ? 'block' : 'none',
          maxHeight: '420px',
          overflowY: 'auto',
          background: '#FFFFFF',
          border: '1px solid #E8E6DF',
          borderRadius: '10px',
          padding: '10px',
        }}
      />
    </div>
  )
}

function colorearVoz(osmd, vozNombre) {
  try {
    const instrumento = vozNombre && osmd.sheet.Instruments.find(i => i.Name === vozNombre)
    const cursor = osmd.cursor
    cursor.reset()
    const iterator = cursor.Iterator
    while (!iterator.EndReached) {
      for (const ve of iterator.CurrentVoiceEntries) {
        for (const note of ve.Notes) {
          const esDestacada = instrumento && note.ParentStaff?.ParentInstrument?.Id === instrumento.Id
          note.NoteheadColor = esDestacada ? '#0F6E56' : '#1A1A18'
        }
      }
      iterator.moveToNext()
    }
    cursor.reset()
    osmd.render()
    osmd.cursor.show()
  } catch (e) {
    // Si algo falla al colorear, seguimos mostrando la partitura sin resaltar la voz.
  }
}

function moverCursor(osmd, mod, tickInicio, divisions) {
  try {
    const { MusicPartManagerIterator, Fraction } = mod
    const fraccion = new Fraction(tickInicio, divisions * 4)
    const iteradorDirecto = new MusicPartManagerIterator(osmd.sheet, fraccion)
    osmd.cursor.iterator = iteradorDirecto
    osmd.cursor.update()
    if (osmd.cursor.cursorElement?.scrollIntoView) {
      osmd.cursor.cursorElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  } catch (e) {
    // Si falla el posicionamiento directo, dejamos el cursor donde estaba.
  }
}
