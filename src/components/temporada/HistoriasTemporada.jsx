import { useEffect, useMemo, useState, useCallback } from 'react'
import { armarHistorias, textoCompartir } from '../../lib/temporada'

// Fondo de cada pantalla (en orden), todos dentro de la paleta de CORUM
const FONDOS = {
  bienvenida:    'linear-gradient(160deg, #04342C 0%, #0F6E56 100%)',
  eventos:       'linear-gradient(160deg, #0A2F4F 0%, #378ADD 100%)',
  asistencia:    'linear-gradient(160deg, #0A4A3A 0%, #1D9E75 100%)',
  estudio:       'linear-gradient(160deg, #3B2470 0%, #7C3AED 100%)',
  entrenamiento: 'linear-gradient(160deg, #4A2A6B 0%, #9F7AEA 100%)',
  constancia:    'linear-gradient(160deg, #6B2412 0%, #D85A30 100%)',
  mensaje:       'linear-gradient(160deg, #3A2E12 0%, #B7862B 100%)',
  cierre:        'linear-gradient(160deg, #04342C 0%, #0F6E56 100%)',
}

// Reporte en formato historias: una pantalla por dato, se pasa tocando.
// incrustado = vista previa del director (marco de celular, sin pantalla completa).
export default function HistoriasTemporada({ reporte, onCerrar, incrustado = false, nombreCoro = import.meta.env.VITE_CORO_NOMBRE || '' }) {
  const historias = useMemo(() => armarHistorias(reporte, { nombreCoro }), [reporte, nombreCoro])
  const [i, setI] = useState(0)
  const [copiado, setCopiado] = useState(false)

  useEffect(() => { if (i > historias.length - 1) setI(historias.length - 1) }, [historias.length, i])

  const siguiente = useCallback(() => setI(x => Math.min(historias.length - 1, x + 1)), [historias.length])
  const anterior  = useCallback(() => setI(x => Math.max(0, x - 1)), [])

  useEffect(() => {
    if (incrustado) return
    function tecla(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); siguiente() }
      else if (e.key === 'ArrowLeft') anterior()
      else if (e.key === 'Escape') onCerrar?.()
    }
    window.addEventListener('keydown', tecla)
    const overflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', tecla); document.body.style.overflow = overflow }
  }, [incrustado, siguiente, anterior, onCerrar])

  const h = historias[i] || historias[0]
  if (!h) return null

  function tocar(e) {
    const r = e.currentTarget.getBoundingClientRect()
    if (e.clientX - r.left < r.width * 0.33) anterior()
    else siguiente()
  }

  function compartir() {
    const texto = textoCompartir(reporte, nombreCoro)
    window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, '_blank', 'noopener')
  }
  async function copiar() {
    try { await navigator.clipboard.writeText(textoCompartir(reporte, nombreCoro)); setCopiado(true); setTimeout(() => setCopiado(false), 2000) } catch { /* sin portapapeles */ }
  }

  const contenedor = incrustado
    ? { position: 'relative', width: '100%', maxWidth: '340px', aspectRatio: '9 / 16', margin: '0 auto', borderRadius: '24px', overflow: 'hidden', boxShadow: '0 8px 28px rgba(0,0,0,0.25)' }
    : { position: 'fixed', inset: 0, zIndex: 200 }

  return (
    <div style={{ ...contenedor, background: FONDOS[h.clave] || FONDOS.bienvenida, color: '#FFFFFF', transition: 'background 0.4s', userSelect: 'none' }}
      role="dialog" aria-label={`Tu temporada ${reporte?.temporada || ''}`}>
      <style>{`
        @keyframes historiaEntrada { from { opacity: 0; transform: translateY(14px) } to { opacity: 1; transform: none } }
      `}</style>

      {/* Barras de progreso */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: incrustado ? '12px 12px 0' : 'max(12px, env(safe-area-inset-top)) 14px 0', display: 'flex', gap: '4px', zIndex: 3 }}>
        {historias.map((_, k) => (
          <div key={k} style={{ flex: 1, height: '3px', borderRadius: '2px', background: k <= i ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.3)' }} />
        ))}
      </div>

      {/* Cerrar */}
      {onCerrar && (
        <button onClick={onCerrar} aria-label="Cerrar"
          style={{ position: 'absolute', top: incrustado ? '22px' : 'max(24px, calc(env(safe-area-inset-top) + 12px))', right: '12px', zIndex: 4, background: 'rgba(0,0,0,0.2)', border: 'none', color: '#FFFFFF', width: '36px', height: '36px', borderRadius: '50%', fontSize: '22px', lineHeight: 1, cursor: 'pointer' }}>
          ×
        </button>
      )}

      {/* Zona táctil: izquierda = atrás, resto = adelante */}
      <div onClick={tocar} style={{ position: 'absolute', inset: 0, cursor: 'pointer', zIndex: 1 }} />

      {/* Contenido */}
      <div key={h.clave} style={{
        position: 'absolute', inset: 0, zIndex: 2, pointerEvents: 'none',
        display: 'flex', flexDirection: 'column', justifyContent: 'center',
        padding: incrustado ? '48px 24px 40px' : '72px 28px 56px',
        maxWidth: '520px', margin: '0 auto',
        animation: 'historiaEntrada 0.45s ease-out',
      }}>
        <div style={{ fontSize: incrustado ? '38px' : '52px', lineHeight: 1, marginBottom: '14px' }}>{h.emoji}</div>
        <div style={{ fontSize: incrustado ? '13px' : '15px', textTransform: 'uppercase', letterSpacing: '1px', opacity: 0.8, marginBottom: '8px' }}>{h.titulo}</div>

        {h.grande && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: incrustado ? (h.clave === 'bienvenida' ? '40px' : '64px') : (h.clave === 'bienvenida' ? '54px' : '96px'), lineHeight: 1.05, marginBottom: '6px', wordBreak: 'break-word' }}>
            {h.grande}
          </div>
        )}

        {h.texto && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: h.sinRegistro ? (incrustado ? '20px' : '26px') : (incrustado ? '17px' : '22px'), lineHeight: 1.35, opacity: h.sinRegistro ? 0.85 : 1, fontStyle: h.sinRegistro ? 'italic' : 'normal' }}>
            {h.texto}
          </div>
        )}

        {h.mensaje && (
          <div style={{ fontFamily: 'Georgia, serif', fontSize: incrustado ? '17px' : '22px', lineHeight: 1.5, whiteSpace: 'pre-wrap', maxHeight: '55%', overflow: 'hidden' }}>
            “{h.mensaje}”
          </div>
        )}

        {h.lineas?.length > 0 && (
          <div style={{ marginTop: '18px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {h.lineas.map((l, k) => (
              <div key={k} style={{ fontSize: incrustado ? '13px' : '15px', lineHeight: 1.45, background: 'rgba(255,255,255,0.14)', borderRadius: '10px', padding: '8px 12px' }}>{l}</div>
            ))}
          </div>
        )}

        {h.clave === 'cierre' && (
          <>
            {h.resumen?.length > 0 && (
              <div style={{ marginTop: '18px', background: 'rgba(255,255,255,0.14)', borderRadius: '14px', padding: '14px 16px', display: 'grid', gap: '6px' }}>
                {h.resumen.map((r, k) => (
                  <div key={k} style={{ fontSize: incrustado ? '14px' : '16px' }}>{r.emoji} {r.texto}</div>
                ))}
              </div>
            )}
            {!incrustado && (
              <div style={{ marginTop: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap', pointerEvents: 'auto' }}>
                <button onClick={compartir}
                  style={{ background: '#FFFFFF', color: '#04342C', border: 'none', borderRadius: '10px', padding: '11px 16px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                  Compartir por WhatsApp
                </button>
                <button onClick={copiar}
                  style={{ background: 'rgba(255,255,255,0.18)', color: '#FFFFFF', border: '1px solid rgba(255,255,255,0.5)', borderRadius: '10px', padding: '11px 16px', fontSize: '14px', cursor: 'pointer' }}>
                  {copiado ? 'Copiado ✓' : 'Copiar texto'}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Pista para avanzar */}
      {i < historias.length - 1 && (
        <div style={{ position: 'absolute', bottom: incrustado ? '12px' : 'max(18px, env(safe-area-inset-bottom))', left: 0, right: 0, textAlign: 'center', fontSize: '12px', opacity: 0.65, zIndex: 2, pointerEvents: 'none' }}>
          Tocá para seguir →
        </div>
      )}
    </div>
  )
}
