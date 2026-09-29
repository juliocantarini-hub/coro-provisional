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
          backend: 'svg',
          drawPartNames: true,
          // El título/compositor de la obra ya se muestra arriba, en la tarjeta de
          // la práctica — repetirlo adentro de la partitura (viene del MusicXML
          // como "credits") solo agrega ruido y, en mobile, aparece cortado.
          drawTitle: false,
          drawSubtitle: false,
          drawComposer: false,
          drawLyricist: false,
          drawCredits: false,
        })
        await osmd.load(musicxml)
        if (cancelado) return
        // El zoom se pone DESPUÉS de load() — load() llama internamente a
        // reset(), que reinicia el zoom a 1. Ponerlo antes (como estaba) hacía
        // que el valor quedara pisado y nunca se viera el cambio.
        // Zoom más chico en pantallas angostas: con el mismo zoom, OSMD calcula
        // cuántos compases entran por línea en base al ancho del contenedor, así
        // que en mobile (contenedor angosto) un zoom igual de chico que en
        // desktop termina amontonando muchos compases en una línea, quedando
        // desproporcionado. Con un zoom mayor en mobile entran menos compases
        // por línea y se ve más prolijo — pero 0.75 quedó más grande de lo que
        // Julio quería, así que se bajó a 0.6 (sigue por encima del 0.5 de
        // desktop para no volver a amontonar compases).
        osmd.zoom = window.innerWidth <= 768 ? 0.6 : 0.5
        osmd.render()
        osmd.cursor.show()
        osmdRef.current = osmd
        osmdModRef.current = mod
        pulsoActualRef.current = -1
        aplicarVozYVisibilidad(osmd, vozNombre)
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

  // Recolorear y mostrar solo la voz propia cuando cambia la voz destacada.
  useEffect(() => {
    if (estado === 'lista' && osmdRef.current) {
      aplicarVozYVisibilidad(osmdRef.current, vozNombre)
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
      {/* Sin alto ni scroll propios: el único contenedor que scrollea es el
          panel de práctica (PartituraPlayer) que envuelve este componente.
          Tener dos contenedores con scroll independiente hacía que el
          seguimiento automático del cursor (scrollIntoView) fuera errático. */}
      <div
        ref={containerRef}
        style={{
          display: estado === 'lista' ? 'block' : 'none',
          background: '#FFFFFF',
          border: '1px solid #E8E6DF',
          borderRadius: '10px',
          padding: '10px',
        }}
      />
    </div>
  )
}

// Colorea las notas de la voz propia y oculta el resto de los pentagramas
// (en vez de solo pintarlos distinto) para que el cantante lea únicamente
// su línea — la partitura completa con todas las voces ya está disponible
// en Repertorio, así que acá no hace falta mostrarla de nuevo.
function aplicarVozYVisibilidad(osmd, vozNombre) {
  try {
    const instrumento = vozNombre && osmd.sheet.Instruments.find(i => i.Name === vozNombre)

    osmd.sheet.Instruments.forEach(inst => {
      inst.Visible = instrumento ? inst.Id === instrumento.Id : true
    })

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
    osmd.updateGraphic()
    osmd.render()
    osmd.cursor.show()
  } catch (e) {
    // Si algo falla al colorear/ocultar, seguimos mostrando la partitura completa sin resaltar la voz.
  }
}

function moverCursor(osmd, mod, tickInicio, divisions) {
  try {
    const { MusicPartManagerIterator, Fraction } = mod
    const fraccion = new Fraction(tickInicio, divisions * 4)
    const iteradorDirecto = new MusicPartManagerIterator(osmd.sheet, fraccion)
    osmd.cursor.iterator = iteradorDirecto
    osmd.cursor.update()
    scrollCursorIntoView(osmd.cursor.cursorElement)
  } catch (e) {
    // Si falla el posicionamiento directo, dejamos el cursor donde estaba.
  }
}

// El scrollIntoView() nativo del navegador scrollea TODOS los contenedores con
// scroll por los que pasa, incluida la página entera — en mobile eso hacía que
// el título "Entrenamiento" de arriba de todo quedara tapado por la barra de
// estado del teléfono cada vez que el cursor avanzaba. Acá scrolleamos a mano,
// solo el contenedor con scroll propio más cercano (el panel de práctica), sin
// tocar el scroll de la página.
function scrollCursorIntoView(cursorEl) {
  if (!cursorEl) return
  let contenedor = cursorEl.parentElement
  while (contenedor && contenedor !== document.body) {
    const estilo = window.getComputedStyle(contenedor)
    if (estilo.overflowY === 'auto' || estilo.overflowY === 'scroll') break
    contenedor = contenedor.parentElement
  }
  if (!contenedor || contenedor === document.body) return

  const cursorRect = cursorEl.getBoundingClientRect()
  const contRect = contenedor.getBoundingClientRect()
  const margen = 40
  if (cursorRect.top < contRect.top + margen) {
    contenedor.scrollTop -= (contRect.top + margen - cursorRect.top)
  } else if (cursorRect.bottom > contRect.bottom - margen) {
    contenedor.scrollTop += (cursorRect.bottom - (contRect.bottom - margen))
  }
}
