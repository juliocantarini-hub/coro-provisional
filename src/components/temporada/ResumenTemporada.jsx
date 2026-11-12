import {
  estadoSecciones, nombreMes, fechaCorta, primerNombre, plural, capitalizar,
  PCT_MINIMO_ASISTENCIA, PCT_MINIMO_DEDICACION, RACHA_MINIMA_DIAS, RACHA_MINIMA_ENSAYOS, SIN_REGISTRO,
} from '../../lib/temporada'

// ─────────────────────────────────────────────────────────────────────────────
// Reporte de fin de temporada del cantante: una tarjeta sobria con números,
// un gráfico mes a mes y los detalles. Es lo mismo que ve el director en la
// vista previa (compacto = true achica tipografías y márgenes).
//
// Reglas (ver src/lib/temporada.js): todo en positivo, "Sin registro" cuando
// no hay datos, nunca un 0 ni porcentajes bajos, y respeta las secciones que
// el director ocultó.
// ─────────────────────────────────────────────────────────────────────────────

// Tonos tenues de la app (los mismos de las tarjetas de Inicio y el panel)
const TONOS = {
  verde:   { fg: '#0F6E56', bg: '#E1F5EE' },
  azul:    { fg: '#378ADD', bg: '#E6F1FB' },
  violeta: { fg: '#7C3AED', bg: '#F3EFF8' },
  naranja: { fg: '#D85A30', bg: '#FAECE7' },
}

const C = {
  verde: '#0F6E56', verdeMedio: '#1D9E75', verdeClaro: '#E1F5EE', verdeOscuro: '#04342C',
  texto: '#1A1A18', gris: '#5F5E5A', grisClaro: '#888780', linea: '#E8E6DF', fondoSuave: '#F1EFE8',
}

export default function ResumenTemporada({ reporte, compacto = false, nombreCoro = import.meta.env.VITE_CORO_NOMBRE || '' }) {
  const d = reporte?.datos || {}
  const ocultas = new Set(reporte?.ocultas || [])
  const est = estadoSecciones(d)
  const ver = clave => !ocultas.has(clave)
  const nombre = primerNombre(d.nombre)
  const ev = d.eventos || {}
  const as = d.asistencia || {}
  const es = d.estudio || {}
  const en = d.entrenamiento || {}
  const co = d.constancia || {}

  // ── Números principales ──
  const tono = (t, n) => ({ ...n, tono: TONOS[t] })
  const numeros = []
  if (ver('eventos')) {
    numeros.push(tono('azul', est.eventos === 'ok'
      ? { valor: ev.conciertos > 0 ? ev.conciertos : (ev.ensayos || 0) + (ev.otros || 0), label: ev.conciertos > 0 ? (ev.conciertos === 1 ? 'Concierto' : 'Conciertos') : 'Encuentros del coro' }
      : { label: 'Conciertos', sinRegistro: true }))
  }
  if (ver('asistencia')) {
    numeros.push(tono('verde', est.asistencia === 'ok'
      ? { valor: as.presentes, label: as.presentes === 1 ? 'Ensayo presente' : 'Ensayos presentes', sub: as.pct >= PCT_MINIMO_ASISTENCIA ? `${as.pct}% de ${as.listas}` : null }
      : { label: 'Asistencia', sinRegistro: true }))
  }
  if (ver('estudio')) {
    numeros.push(tono('violeta', est.estudio === 'ok'
      ? { valor: es.obras_abiertas, label: es.obras_abiertas === 1 ? 'Obra estudiada' : 'Obras estudiadas', sub: `de ${es.obras_temporada} del repertorio` }
      : { label: 'Obras estudiadas', sinRegistro: true }))
  }
  if (ver('constancia')) {
    numeros.push(tono('naranja', est.constancia === 'ok'
      ? { valor: co.dias_activos, label: co.dias_activos === 1 ? 'Día de práctica' : 'Días de práctica' }
      : { label: 'Días de práctica', sinRegistro: true }))
  }

  // ── Detalles (solo lo que suma) ──
  const detalles = []
  if (ver('estudio') && est.estudio === 'ok') {
    if (es.obra_top) detalles.push(['Obra más practicada', `${es.obra_top.titulo} · ${plural(es.obra_top.veces, 'vez', 'veces')}`])
    if (es.estudiadas > 0) detalles.push(['Marcadas como estudiadas', String(es.estudiadas)])
    if (es.dedicacion != null && es.dedicacion >= PCT_MINIMO_DEDICACION) detalles.push(['Dedicación', `${es.dedicacion}%`])
  }
  if (ver('constancia') && est.constancia === 'ok') {
    if (co.racha_dias >= RACHA_MINIMA_DIAS) detalles.push(['Racha más larga', `${co.racha_dias} días seguidos`])
    if (co.mejor_mes?.dias > 1) detalles.push(['Mejor mes', `${capitalizar(nombreMes(co.mejor_mes.mes))} · ${co.mejor_mes.dias} días`])
  }
  if (ver('asistencia') && est.asistencia === 'ok') {
    if (as.racha >= RACHA_MINIMA_ENSAYOS) detalles.push(['Ensayos seguidos', String(as.racha)])
  }
  if (ver('entrenamiento')) {
    if (est.entrenamiento === 'ok') {
      if (en.ejercicios > 0) detalles.push(['Ejercicios de entrenamiento', String(en.ejercicios)])
      if (en.lecciones_teoria > 0) detalles.push(['Lecciones de teoría', `${en.lecciones_teoria} de 8`])
    } else {
      detalles.push(['Entrenamiento', SIN_REGISTRO])
    }
  }

  // ── Gráfico: práctica por mes (o asistencia si no hay práctica) ──
  const serieAsist = ver('asistencia') && est.asistencia === 'ok' ? (as.por_mes || []).map(m => ({ mes: m.mes, valor: m.presentes })) : []
  const seriePractica = ver('constancia') && est.constancia === 'ok' ? (co.por_mes || []).map(m => ({ mes: m.mes, valor: m.dias })) : []

  const conciertos = ver('eventos') ? (ev.lista_conciertos || []) : []

  const pad = compacto ? '16px' : '24px'
  const tarjeta = { background: '#FFFFFF', border: `1px solid ${C.linea}`, borderRadius: '14px', padding: pad }
  const etiqueta = { fontSize: compacto ? '10px' : '11px', fontWeight: 700, color: C.gris, textTransform: 'uppercase', letterSpacing: '0.5px', margin: `0 0 ${compacto ? '10px' : '14px'}` }

  return (
    <div style={{ display: 'grid', gap: compacto ? '10px' : '14px' }}>
      {/* Encabezado + números */}
      <div style={tarjeta}>
        <div style={{ fontSize: compacto ? '10px' : '11px', fontWeight: 600, color: C.verde, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
          Temporada {reporte?.temporada}
        </div>
        <h2 style={{ fontFamily: 'Georgia, serif', fontWeight: 'normal', fontSize: compacto ? '20px' : '26px', color: C.texto, margin: '4px 0 2px' }}>
          {d.nombre || 'Mi temporada'}
        </h2>
        <div style={{ fontSize: compacto ? '11px' : '13px', color: C.grisClaro }}>
          {[capitalizar(d.voz), nombreCoro].filter(Boolean).join(' · ')}
          {d.desde && d.hasta && ` · del ${fechaCorta(d.desde)} al ${fechaCorta(d.hasta)}`}
        </div>

        {numeros.length > 0 && (
          <div style={{
            display: 'grid', gridTemplateColumns: `repeat(${compacto ? 2 : Math.min(numeros.length, 4)}, minmax(0, 1fr))`,
            gap: compacto ? '6px' : '10px',
            marginTop: compacto ? '14px' : '20px',
          }} className="temporada-numeros">
            {numeros.map((n, k) => <Numero key={k} {...n} compacto={compacto} />)}
          </div>
        )}
      </div>

      {/* Gráfico */}
      {(seriePractica.length > 0 || serieAsist.length > 0) && (
        <div style={{ ...tarjeta, background: '#F4FAF7', borderColor: '#DDEFE7' }}>
          {seriePractica.some(x => x.valor > 0) ? (
            <>
              <h3 style={etiqueta}>Días de práctica por mes</h3>
              <GraficoBarras serie={seriePractica} compacto={compacto} />
            </>
          ) : null}
          {serieAsist.length > 0 && (
            <div style={{ marginTop: seriePractica.some(x => x.valor > 0) ? (compacto ? '16px' : '24px') : 0 }}>
              <h3 style={etiqueta}>Ensayos presentes por mes</h3>
              <GraficoBarras serie={serieAsist} compacto={compacto} />
            </div>
          )}
        </div>
      )}

      {/* Detalles */}
      {(detalles.length > 0 || conciertos.length > 0) && (
        <div style={{ ...tarjeta, background: '#F9F7FC', borderColor: '#ECE6F6' }}>
          {detalles.length > 0 && (
            <>
              <h3 style={etiqueta}>Tu año en detalle</h3>
              <div>
                {detalles.map(([l, v], k) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', padding: compacto ? '7px 0' : '9px 0', borderTop: k ? `1px solid ${C.fondoSuave}` : 'none', fontSize: compacto ? '12px' : '14px' }}>
                    <span style={{ color: C.gris }}>{l}</span>
                    <span style={{ color: v === SIN_REGISTRO ? C.grisClaro : C.texto, fontStyle: v === SIN_REGISTRO ? 'italic' : 'normal', textAlign: 'right' }}>{v}</span>
                  </div>
                ))}
              </div>
            </>
          )}
          {conciertos.length > 0 && (
            <div style={{ marginTop: detalles.length ? (compacto ? '14px' : '20px') : 0 }}>
              <h3 style={etiqueta}>Conciertos</h3>
              {conciertos.map((c, k) => (
                <div key={k} style={{ display: 'flex', gap: '12px', padding: compacto ? '6px 0' : '8px 0', borderTop: k ? `1px solid ${C.fondoSuave}` : 'none', fontSize: compacto ? '12px' : '14px' }}>
                  <span style={{ color: C.verde, width: compacto ? '78px' : '104px', flexShrink: 0 }}>{fechaCorta(c.fecha)}</span>
                  <span style={{ color: C.texto }}>{c.titulo}{c.lugar && <span style={{ color: C.grisClaro }}> · {c.lugar}</span>}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Mensaje del director */}
      {reporte?.mensaje?.trim() && (
        <div style={{ ...tarjeta, background: '#FDF8F5', borderColor: '#F3E3DA', borderLeft: '3px solid #D85A30' }}>
          <h3 style={etiqueta}>Un mensaje para vos</h3>
          <p style={{ fontFamily: 'Georgia, serif', fontSize: compacto ? '14px' : '17px', lineHeight: 1.6, color: C.texto, margin: 0, whiteSpace: 'pre-wrap' }}>
            {reporte.mensaje.trim()}
          </p>
        </div>
      )}

      {/* Cierre */}
      <div style={{ ...tarjeta, background: C.verdeClaro, borderColor: '#9FE1CB', textAlign: 'center' }}>
        <p style={{ fontFamily: 'Georgia, serif', fontSize: compacto ? '18px' : '24px', lineHeight: 1.3, color: C.verdeOscuro, margin: 0 }}>
          GRACIAS por este año juntos{nombre ? `, ${nombre}` : ''}
        </p>
        <p style={{ fontSize: compacto ? '13px' : '15px', color: C.verde, margin: '6px 0 0' }}>¡Nos vemos el próximo!</p>
        <p style={{ fontSize: compacto ? '11px' : '12px', color: C.grisClaro, margin: compacto ? '12px 0 0' : '16px 0 0' }}>
          También vas a encontrar este resumen en Mi perfil.
        </p>
      </div>

      <style>{`@media (max-width: 560px) { .temporada-numeros { grid-template-columns: repeat(2, minmax(0, 1fr)) !important; } }`}</style>
    </div>
  )
}

function Numero({ valor, label, sub, sinRegistro, compacto, tono }) {
  return (
    <div style={{ background: sinRegistro ? C.fondoSuave : tono.bg, borderRadius: '12px', padding: compacto ? '12px' : '16px' }}>
      <div style={{ fontFamily: 'Georgia, serif', fontSize: sinRegistro ? (compacto ? '18px' : '22px') : (compacto ? '26px' : '34px'), lineHeight: 1.1, color: sinRegistro ? C.grisClaro : tono.fg }}>
        {sinRegistro ? '—' : valor}
      </div>
      <div style={{ fontSize: compacto ? '11px' : '12px', color: sinRegistro ? C.gris : tono.fg, opacity: sinRegistro ? 1 : 0.85, marginTop: '4px' }}>{label}</div>
      <div style={{ fontSize: compacto ? '10px' : '11px', color: C.grisClaro, marginTop: '2px', fontStyle: sinRegistro ? 'italic' : 'normal' }}>
        {sinRegistro ? 'Sin registro' : (sub || ' ')}
      </div>
    </div>
  )
}

// Barras verticales simples (HTML, así el texto no se achica en el celular).
// La barra más alta va en el verde oscuro.
function GraficoBarras({ serie, compacto }) {
  const max = Math.max(1, ...serie.map(s => s.valor))
  const alto = compacto ? 80 : 120
  return (
    <div role="img" aria-label="Gráfico por mes" style={{ display: 'flex', alignItems: 'flex-end', gap: compacto ? '4px' : '8px' }}>
      {serie.map(s => {
        const esMax = s.valor === max && s.valor > 0
        const h = s.valor > 0 ? Math.max(4, Math.round((s.valor / max) * alto)) : 0
        return (
          <div key={s.mes} style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ height: alto + 18, width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', alignItems: 'center' }}>
              {s.valor > 0 && (
                <span style={{ fontSize: compacto ? '10px' : '12px', color: esMax ? C.verde : C.gris, fontWeight: esMax ? 600 : 400, marginBottom: '3px' }}>{s.valor}</span>
              )}
              <div style={{ width: '100%', maxWidth: '40px', height: h, background: esMax ? C.verde : '#9FD8C5', borderRadius: '4px 4px 0 0' }} />
            </div>
            <div style={{ width: '100%', borderTop: `1px solid ${C.linea}`, textAlign: 'center', paddingTop: '5px', fontSize: compacto ? '10px' : '11px', color: C.grisClaro }}>
              {nombreMes(s.mes).slice(0, 3)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
