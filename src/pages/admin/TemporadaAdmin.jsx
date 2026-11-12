import { useEffect, useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import ResumenTemporada from '../../components/temporada/ResumenTemporada'
import {
  listarReportesCoro, generarReportes, actualizarReporte, enviarPushTemporada, resumenCoro, cargarReporte,
} from '../../hooks/useReporteTemporada'
import { imprimirResumen, SECCIONES_IMPRESION } from '../../lib/pdfTemporada'
import { ETIQUETAS_SECCION } from '../../lib/actividad'
import { SECCIONES, avisosRevision, estadoSecciones, nombreMes, fechaCorta } from '../../lib/temporada'

// ─────────────────────────────────────────────────────────────────────────────
// /admin/temporada — Reporte de fin de temporada
//  Pestaña "Cantantes": generar borradores, revisar cada uno, editar y publicar de a uno.
//  Pestaña "Resumen del coro": el reporte general del coro (solo directores).
// ─────────────────────────────────────────────────────────────────────────────

const ESTADOS = {
  borrador:  { label: 'Borrador',  color: '#854F0B', bg: '#FAEEDA' },
  publicado: { label: 'Publicado', color: '#27500A', bg: '#EAF3DE' },
  excluido:  { label: 'Excluido',  color: '#5F5E5A', bg: '#F1EFE8' },
}
const ORDEN_ESTADO = { borrador: 0, publicado: 1, excluido: 2 }

function hoyIso() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function capitalizar(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s }

export default function TemporadaAdmin() {
  const anioActual = new Date().getFullYear()
  const [temporada, setTemporada] = useState(anioActual)
  const [desde, setDesde] = useState(`${anioActual}-01-01`)
  const [hasta, setHasta] = useState(`${anioActual}-12-31`)
  const [pestana, setPestana] = useState('cantantes')
  const [reportes, setReportes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')
  const [abiertoId, setAbiertoId] = useState(null)
  const navigate = useNavigate()

  const cargar = useCallback(async (t) => {
    setCargando(true); setError('')
    const r = await listarReportesCoro(t)
    if (!r.ok) {
      setError(r.error?.includes('reportes_temporada')
        ? 'Falta correr supabase/reporte_temporada.sql en Supabase.'
        : 'No se pudieron cargar los reportes. (' + r.error + ')')
      setReportes([])
    } else {
      setReportes(r.data)
      if (r.data.length) {
        setDesde(r.data.reduce((m, x) => (x.desde < m ? x.desde : m), r.data[0].desde))
        setHasta(r.data[0].hasta)
      } else {
        setDesde(`${t}-01-01`); setHasta(`${t}-12-31`)
      }
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar(temporada) }, [temporada, cargar])

  async function generar() {
    setGenerando(true); setError('')
    const r = await generarReportes(temporada, desde, hasta)
    setGenerando(false)
    if (!r.ok) { setError('No se pudieron generar los reportes. (' + r.error + ')'); return }
    await cargar(temporada)
  }

  const ordenados = useMemo(() => [...reportes].sort((a, b) =>
    (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) || (a.datos?.nombre || '').localeCompare(b.datos?.nombre || '', 'es')
  ), [reportes])

  const cuenta = useMemo(() => ({
    borrador: reportes.filter(r => r.estado === 'borrador').length,
    publicado: reportes.filter(r => r.estado === 'publicado').length,
    vistos: reportes.filter(r => r.estado === 'publicado' && r.visto_en).length,
    excluido: reportes.filter(r => r.estado === 'excluido').length,
  }), [reportes])

  function reemplazar(nuevo) {
    setReportes(rs => rs.map(r => (r.id === nuevo.id ? nuevo : r)))
  }

  const indice = ordenados.findIndex(r => r.id === abiertoId)
  const abierto = indice >= 0 ? ordenados[indice] : null

  return (
    <div>
      <button onClick={() => navigate('/admin/estadistica')}
        style={{ background: 'none', border: 'none', color: '#0F6E56', fontSize: '13px', cursor: 'pointer', padding: '0 0 10px' }}>
        ← Estadística
      </button>
      <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 4px' }}>
        Reporte de fin de temporada
      </h2>
      <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 18px', lineHeight: 1.5 }}>
        Generá los borradores, revisá cada uno y publicalo cuando esté listo. El cantante lo ve recién cuando lo publicás.
      </p>

      {/* Rango de la temporada */}
      <div style={tarjeta}>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <Campo label="Temporada">
            <input type="number" value={temporada} min={2024} max={2100}
              onChange={e => setTemporada(parseInt(e.target.value, 10) || anioActual)}
              style={{ ...input, width: '96px' }} />
          </Campo>
          <Campo label="Desde">
            <input type="date" value={desde} onChange={e => setDesde(e.target.value)} style={input} />
          </Campo>
          <Campo label="Hasta">
            <input type="date" value={hasta} min={desde} onChange={e => setHasta(e.target.value)} style={input} />
          </Campo>
          {pestana === 'cantantes' && (
            <button onClick={generar} disabled={generando || !desde || !hasta} style={{ ...boton('#0F6E56'), marginBottom: '14px', opacity: generando ? 0.6 : 1 }}>
              {generando ? 'Generando…' : reportes.length ? 'Actualizar borradores' : 'Generar borradores'}
            </button>
          )}
        </div>
        <p style={{ fontSize: '12px', color: '#888780', margin: 0, lineHeight: 1.5 }}>
          A quien entró después del inicio se le cuenta desde su ingreso. Actualizar los borradores no cambia los reportes ya publicados.
        </p>
      </div>

      {error && <div style={alerta}>{error}</div>}

      {/* Pestañas */}
      <div style={{ display: 'flex', gap: '6px', margin: '16px 0 14px' }}>
        {[['cantantes', 'Cantantes'], ['coro', 'Resumen del coro']].map(([k, l]) => (
          <button key={k} onClick={() => setPestana(k)}
            style={{ border: 'none', borderRadius: '20px', padding: '7px 14px', fontSize: '13px', cursor: 'pointer',
              background: pestana === k ? '#0F6E56' : '#F1EFE8', color: pestana === k ? '#FFFFFF' : '#5F5E5A', fontWeight: pestana === k ? 600 : 400 }}>
            {l}
          </button>
        ))}
      </div>

      {pestana === 'coro' ? (
        <ResumenDelCoro desde={desde} hasta={hasta} temporada={temporada} cuenta={cuenta} hayReportes={reportes.length > 0} />
      ) : cargando ? (
        <p style={{ fontSize: '13px', color: '#888780' }}>Cargando…</p>
      ) : reportes.length === 0 ? (
        <div style={{ ...tarjeta, textAlign: 'center', color: '#5F5E5A', fontSize: '13px' }}>
          Todavía no hay reportes de la temporada {temporada}. Elegí el rango y tocá "Generar borradores".
        </div>
      ) : (
        <>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px', fontSize: '12px' }}>
            <Chip {...ESTADOS.borrador} label={`${cuenta.borrador} en borrador`} />
            <Chip {...ESTADOS.publicado} label={`${cuenta.publicado} publicados · ${cuenta.vistos} vistos`} />
            {cuenta.excluido > 0 && <Chip {...ESTADOS.excluido} label={`${cuenta.excluido} excluidos`} />}
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {ordenados.map(r => <FilaReporte key={r.id} reporte={r} onAbrir={() => setAbiertoId(r.id)} />)}
          </div>
        </>
      )}

      <style>{`@media (max-width: 560px) {
        .temporada-dato { flex-direction: column; gap: 2px !important; }
        .temporada-dato-valor { text-align: left !important; }
      }`}</style>

      {abierto && (
        <Revision
          key={abierto.id}
          reporte={abierto}
          desde={desde} hasta={hasta}
          onCambio={reemplazar}
          onCerrar={() => setAbiertoId(null)}
          onAnterior={indice > 0 ? () => setAbiertoId(ordenados[indice - 1].id) : null}
          onSiguiente={indice < ordenados.length - 1 ? () => setAbiertoId(ordenados[indice + 1].id) : null}
          posicion={`${indice + 1} de ${ordenados.length}`}
        />
      )}
    </div>
  )
}

// ─── Fila de la lista ───────────────────────────────────────────────────────
function FilaReporte({ reporte, onAbrir }) {
  const d = reporte.datos || {}
  const est = estadoSecciones(d)
  const avisos = reporte.estado === 'excluido' ? [] : avisosRevision(reporte)
  const e = ESTADOS[reporte.estado]
  const asist = est.asistencia === 'sin_registro' ? 'Sin registro' : `${d.asistencia?.presentes ?? 0}/${d.asistencia?.listas ?? 0}${d.asistencia?.pct != null ? ` (${d.asistencia.pct}%)` : ''}`
  const estudio = est.estudio === 'sin_registro' ? 'Sin registro'
    : `${d.estudio?.obras_abiertas ?? 0}/${d.estudio?.obras_temporada ?? 0} obras · ${d.estudio?.dedicacion ?? 0}%`

  return (
    <div onClick={onAbrir}
      style={{ ...tarjeta, marginBottom: 0, padding: '12px 14px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px', opacity: reporte.estado === 'excluido' ? 0.65 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A18' }}>{d.nombre || '—'}</span>
          {d.voz && <span style={{ fontSize: '11px', color: '#04342C', background: '#E1F5EE', padding: '1px 7px', borderRadius: '8px', textTransform: 'capitalize' }}>{d.voz}</span>}
          <Chip {...e} />
          {reporte.estado === 'publicado' && <span style={{ fontSize: '11px', color: reporte.visto_en ? '#27500A' : '#888780' }}>{reporte.visto_en ? '👁 visto' : 'sin ver'}</span>}
          {reporte.mensaje && <span title="Tiene mensaje personal" style={{ fontSize: '12px' }}>💌</span>}
        </div>
        <div style={{ fontSize: '12px', color: '#888780', marginTop: '4px', display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <span>Asistencia: {asist}</span>
          <span>Estudio: {estudio}</span>
          <span>Días de práctica: {d.constancia?.dias_activos ?? 0}</span>
        </div>
        {avisos.length > 0 && (
          <div style={{ fontSize: '11px', color: '#854F0B', marginTop: '4px' }}>⚠ {avisos.length} {avisos.length === 1 ? 'cosa para mirar' : 'cosas para mirar'}</div>
        )}
      </div>
      <span style={{ fontSize: '13px', color: '#0F6E56', fontWeight: 500, flexShrink: 0 }}>Revisar →</span>
    </div>
  )
}

// ─── Revisión de un cantante ────────────────────────────────────────────────
function Revision({ reporte, desde, hasta, onCambio, onCerrar, onAnterior, onSiguiente, posicion }) {
  const [ocultas, setOcultas] = useState(reporte.ocultas || [])
  const [mensaje, setMensaje] = useState(reporte.mensaje || '')
  const [destacar, setDestacar] = useState(reporte.destacar_hasta || `${reporte.temporada + 1}-01-31`)
  const [conPush, setConPush] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState('')
  const [ok, setOk] = useState('')

  const d = reporte.datos || {}
  const borradorLocal = { ...reporte, ocultas, mensaje }
  const avisos = avisosRevision(borradorLocal)
  const hayCambios = JSON.stringify([...(reporte.ocultas || [])].sort()) !== JSON.stringify([...ocultas].sort())
    || (reporte.mensaje || '') !== mensaje
    || (reporte.destacar_hasta || '') !== (destacar || '')

  useEffect(() => {
    function tecla(e) { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', tecla)
    return () => window.removeEventListener('keydown', tecla)
  }, [onCerrar])

  function alternar(clave) {
    setOcultas(o => (o.includes(clave) ? o.filter(x => x !== clave) : [...o, clave]))
  }

  async function guardar(extra = {}, textoOk = 'Cambios guardados') {
    setGuardando(true); setError(''); setOk('')
    const r = await actualizarReporte(reporte.id, { ocultas, mensaje: mensaje.trim() || null, destacar_hasta: destacar || null, ...extra })
    setGuardando(false)
    if (!r.ok) { setError('No se pudo guardar. (' + r.error + ')'); return null }
    onCambio(r.data)
    setOk(textoOk)
    return r.data
  }

  async function publicar() {
    const nuevo = await guardar({ estado: 'publicado', publicado_en: new Date().toISOString() }, conPush ? 'Publicado. Se envió la notificación.' : 'Publicado.')
    if (nuevo && conPush) enviarPushTemporada(nuevo)
  }

  async function regenerar() {
    setGuardando(true); setError(''); setOk('')
    const r = await generarReportes(reporte.temporada, desde, hasta, reporte.perfil_id)
    if (!r.ok) { setGuardando(false); setError('No se pudo actualizar. (' + r.error + ')'); return }
    const fresco = await cargarReporte(reporte.id)
    setGuardando(false)
    if (fresco.ok) { onCambio(fresco.data); setOk('Datos actualizados') }
  }

  const est = estadoSecciones(d)
  const publicado = reporte.estado === 'publicado'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(26,26,24,0.45)', display: 'flex', justifyContent: 'center', alignItems: 'flex-start', overflowY: 'auto', padding: '16px' }}
      onClick={e => { if (e.target === e.currentTarget) onCerrar() }}>
      <div style={{ background: '#FAF9F5', borderRadius: '16px', width: '100%', maxWidth: '920px', padding: '18px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
        {/* Encabezado */}
        <div style={{ marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
            <div style={{ flex: 1, minWidth: 0, fontFamily: 'Georgia, serif', fontSize: '20px', lineHeight: 1.25, color: '#1A1A18' }}>{d.nombre}</div>
            <button onClick={onCerrar} aria-label="Cerrar" style={{ ...botonSec, fontSize: '18px', padding: '2px 10px', flexShrink: 0 }}>×</button>
          </div>
          <div style={{ fontSize: '12px', color: '#888780', marginTop: '4px', lineHeight: 1.5 }}>
              {posicion} · {capitalizar(d.voz) || 'Sin cuerda'} · desde el {fechaCorta(reporte.desde)}
              {publicado && reporte.publicado_en && ` · publicado el ${new Date(reporte.publicado_en).toLocaleDateString('es-AR')}`}
              {publicado && (reporte.visto_en ? ` · visto el ${new Date(reporte.visto_en).toLocaleDateString('es-AR')}` : ' · todavía sin ver')}
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            <button onClick={onAnterior} disabled={!onAnterior} style={{ ...botonSec, flex: 1, maxWidth: '160px', opacity: onAnterior ? 1 : 0.4 }}>← Anterior</button>
            <button onClick={onSiguiente} disabled={!onSiguiente} style={{ ...botonSec, flex: 1, maxWidth: '160px', opacity: onSiguiente ? 1 : 0.4 }}>Siguiente →</button>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '18px', alignItems: 'start' }}>
          {/* Edición */}
          <div>
            {avisos.length > 0 && (
              <div style={{ background: '#FAEEDA', border: '1px solid #EF9F27', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px' }}>
                {avisos.map((a, k) => <div key={k} style={{ fontSize: '12px', color: '#633806', lineHeight: 1.5 }}>⚠ {a}</div>)}
              </div>
            )}

            <div style={tarjeta}>
              <h3 style={tituloSeccion}>Números reales (solo para vos)</h3>
              <Dato label="Asistencia" valor={est.asistencia === 'sin_registro' ? 'Sin registro'
                : `${d.asistencia.presentes} presentes · ${d.asistencia.justificados} justificados · ${d.asistencia.ausentes} ausentes · ${d.asistencia.sin_marcar} sin marcar (de ${d.asistencia.listas})`} />
              <Dato label="Eventos del coro" valor={`${d.eventos?.conciertos ?? 0} conciertos · ${d.eventos?.ensayos ?? 0} ensayos · ${d.eventos?.otros ?? 0} otros`} />
              <Dato label="Estudio" valor={est.estudio === 'sin_registro' ? 'Sin obras en la temporada'
                : `${d.estudio.obras_abiertas} de ${d.estudio.obras_temporada} obras · ${d.estudio.aperturas} aperturas · dedicación ${d.estudio.dedicacion ?? 0}% · ${d.estudio.estudiadas} marcadas estudiadas`} />
              <Dato label="Entrenamiento" valor={`${d.entrenamiento?.ejercicios ?? 0} ejercicios · ${d.entrenamiento?.lecciones_teoria ?? 0} lecciones de teoría`} />
              <Dato label="Constancia" valor={`${d.constancia?.dias_activos ?? 0} días · racha ${d.constancia?.racha_dias ?? 0}${d.constancia?.mejor_mes ? ` · mejor mes ${nombreMes(d.constancia.mejor_mes.mes)}` : ''}`} />
              <div style={{ fontSize: '11px', color: '#888780', marginTop: '6px' }}>
                Generado el {new Date(reporte.generado_en).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
              </div>
            </div>

            <div style={tarjeta}>
              <h3 style={tituloSeccion}>Secciones que ve el cantante</h3>
              {SECCIONES.map(s => (
                <label key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#1A1A18', padding: '4px 0', cursor: 'pointer' }}>
                  <input type="checkbox" checked={!ocultas.includes(s.clave)} onChange={() => alternar(s.clave)} />
                  {s.titulo}
                  {est[s.clave] !== 'ok' && <span style={{ fontSize: '11px', color: '#888780' }}>(Sin registro)</span>}
                </label>
              ))}
            </div>

            <div style={tarjeta}>
              <h3 style={tituloSeccion}>Mensaje personal (opcional)</h3>
              <textarea value={mensaje} maxLength={600} rows={4} onChange={e => setMensaje(e.target.value)}
                placeholder="Va al final del reporte, antes del cierre."
                style={{ ...input, height: 'auto', padding: '10px 12px', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5 }} />
              <div style={{ fontSize: '11px', color: '#888780', textAlign: 'right' }}>{mensaje.length}/600</div>

              <Campo label="Tarjeta en Inicio hasta">
                <input type="date" value={destacar || ''} min={hoyIso()} onChange={e => setDestacar(e.target.value)} style={input} />
              </Campo>
            </div>

            {error && <div style={alerta}>{error}</div>}
            {ok && <div style={{ ...alerta, background: '#E1F5EE', borderColor: '#1D9E75', color: '#04342C' }}>{ok}</div>}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {reporte.estado === 'borrador' && (
                <>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#5F5E5A' }}>
                    <input type="checkbox" checked={conPush} onChange={e => setConPush(e.target.checked)} />
                    Avisarle con una notificación push
                  </label>
                  <button onClick={publicar} disabled={guardando} style={boton('#0F6E56')}>
                    {guardando ? 'Guardando…' : 'Publicar para este cantante'}
                  </button>
                </>
              )}
              {hayCambios && (
                <button onClick={() => guardar()} disabled={guardando} style={boton('#378ADD')}>Guardar cambios</button>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {reporte.estado !== 'publicado' && (
                  <button onClick={regenerar} disabled={guardando} style={botonSec}>Actualizar sus datos</button>
                )}
                {reporte.estado === 'publicado' && (
                  <button onClick={() => guardar({ estado: 'borrador', publicado_en: null }, 'Despublicado: el cantante ya no lo ve.')} disabled={guardando} style={botonSec}>
                    Despublicar
                  </button>
                )}
                {reporte.estado === 'borrador' && (
                  <button onClick={() => guardar({ estado: 'excluido' }, 'Excluido del reporte.')} disabled={guardando} style={botonSec}>Excluir</button>
                )}
                {reporte.estado === 'excluido' && (
                  <button onClick={() => guardar({ estado: 'borrador' }, 'Vuelve a estar en borrador.')} disabled={guardando} style={botonSec}>Incluir de nuevo</button>
                )}
              </div>
              {publicado && (
                <p style={{ fontSize: '11px', color: '#888780', margin: 0, lineHeight: 1.5 }}>
                  Los cambios en las secciones o el mensaje se ven enseguida. Para recalcular sus números, despublicalo primero.
                </p>
              )}
            </div>
          </div>

          {/* Vista previa: exactamente lo que va a ver */}
          <div>
            <div style={{ fontSize: '11px', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', textAlign: 'center' }}>
              Vista previa: así lo ve el cantante
            </div>
            <div style={{ background: '#F1EFE8', borderRadius: '14px', padding: '10px' }}>
              <ResumenTemporada reporte={borradorLocal} compacto />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Resumen general del coro ───────────────────────────────────────────────
function ResumenDelCoro({ desde, hasta, temporada, cuenta, hayReportes }) {
  const [datos, setDatos] = useState(null)
  const [modalImprimir, setModalImprimir] = useState(false)
  const [seccionesImpr, setSeccionesImpr] = useState(SECCIONES_IMPRESION.map(s => s.clave))
  const [errorImpr, setErrorImpr] = useState('')

  function alternarSeccion(clave) {
    setSeccionesImpr(sel => (sel.includes(clave) ? sel.filter(c => c !== clave) : [...sel, clave]))
  }
  function generarImpresion() {
    setErrorImpr('')
    const ok = imprimirResumen(datos, {
      nombreCoro: import.meta.env.VITE_CORO_NOMBRE || '', temporada,
      cuenta: hayReportes ? cuenta : null, secciones: seccionesImpr,
    })
    if (!ok) { setErrorImpr('El navegador bloqueó la ventana. Permití las ventanas emergentes para este sitio y probá de nuevo.'); return }
    setModalImprimir(false)
  }
  const [cargando, setCargando] = useState(false)
  const [error, setError] = useState('')

  const cargar = useCallback(async () => {
    if (!desde || !hasta) return
    setCargando(true); setError('')
    const r = await resumenCoro(desde, hasta)
    setCargando(false)
    if (!r.ok) { setError(r.error?.includes('reporte_temporada_coro') ? 'Falta correr supabase/reporte_temporada.sql en Supabase.' : 'No se pudo cargar el resumen. (' + r.error + ')'); return }
    setDatos(r.data)
  }, [desde, hasta])

  useEffect(() => { cargar() }, [cargar])

  if (cargando && !datos) return <p style={{ fontSize: '13px', color: '#888780' }}>Calculando…</p>
  if (error) return <div style={alerta}>{error}</div>
  if (!datos) return null

  const { cantantes, asistencia, eventos, repertorio, entrenamiento, uso_app, participacion, datos_desde } = datos
  const obras = repertorio?.obras || []

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', marginBottom: '12px', flexWrap: 'wrap' }}>
        <div style={{ fontSize: '12px', color: '#888780' }}>Del {fechaCorta(datos.desde)} {datos.desde?.slice(0, 4)} al {fechaCorta(datos.hasta)} {datos.hasta?.slice(0, 4)}</div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={cargar} style={botonSec}>{cargando ? 'Actualizando…' : 'Actualizar'}</button>
          <button onClick={() => setModalImprimir(true)} style={{ ...botonSec, background: '#0F6E56', borderColor: '#0F6E56', color: '#FFFFFF', fontWeight: 500 }}>
            🖨 Imprimir resumen
          </button>
        </div>
      </div>
      {errorImpr && <div style={alerta}>{errorImpr}</div>}

      {modalImprimir && (
        <div onClick={e => { if (e.target === e.currentTarget) setModalImprimir(false) }}
          style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(26,26,24,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div style={{ background: '#FFFFFF', borderRadius: '16px', padding: '24px', width: '100%', maxWidth: '420px', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', margin: '0 0 6px', color: '#1A1A18' }}>Imprimir resumen</h3>
            <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 16px', lineHeight: 1.5 }}>
              Elegí las secciones a incluir. En la ventana de impresión podés elegir "Guardar como PDF".
            </p>
            <div style={{ display: 'grid', gap: '10px', marginBottom: '20px' }}>
              {SECCIONES_IMPRESION.filter(s => s.clave !== 'reportes' || hayReportes).map(s => (
                <label key={s.clave} style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '14px', color: '#1A1A18', cursor: 'pointer' }}>
                  <input type="checkbox" checked={seccionesImpr.includes(s.clave)} onChange={() => alternarSeccion(s.clave)}
                    style={{ width: '18px', height: '18px', accentColor: '#0F6E56' }} />
                  {s.label}
                </label>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button onClick={() => setModalImprimir(false)} style={{ ...botonSec, flex: 1, padding: '10px', fontSize: '13px' }}>Cancelar</button>
              <button onClick={generarImpresion} disabled={!seccionesImpr.length}
                style={{ ...boton('#0F6E56'), flex: 2, opacity: seccionesImpr.length ? 1 : 0.5 }}>
                🖨 Generar e imprimir
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px', marginBottom: '14px' }}>
        <Numero valor={cantantes?.activos ?? 0} label="Cantantes activos" />
        <Numero valor={asistencia?.sin_registro ? '—' : `${asistencia?.pct ?? 0}%`} label={asistencia?.sin_registro ? 'Asistencia: sin registro' : 'Asistencia general'} />
        <Numero valor={eventos?.conciertos ?? 0} label="Conciertos" />
        <Numero valor={repertorio?.obras_temporada ?? 0} label="Obras en la temporada" />
        <Numero valor={repertorio?.dedicacion_promedio != null ? `${repertorio.dedicacion_promedio}%` : '—'} label="Dedicación promedio" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
        <Bloque titulo="Cantantes por cuerda">
          {(cantantes?.por_cuerda || []).length === 0 ? <SinRegistro /> : cantantes.por_cuerda.map(c => (
            <Barra key={c.voz} label={capitalizar(c.voz)} valor={c.n} max={Math.max(...cantantes.por_cuerda.map(x => x.n))} texto={String(c.n)} />
          ))}
        </Bloque>

        <Bloque titulo="Asistencia">
          {asistencia?.sin_registro ? <SinRegistro /> : (
            <>
              <div style={{ fontSize: '12px', color: '#5F5E5A', marginBottom: '8px' }}>{asistencia.listas} listas tomadas</div>
              <Subtitulo>Por cuerda</Subtitulo>
              {asistencia.por_cuerda.map(c => <Barra key={c.voz} label={capitalizar(c.voz)} valor={c.pct} max={100} texto={`${c.pct}%`} />)}
              <Subtitulo>Por mes</Subtitulo>
              {asistencia.por_mes.map(m => <Barra key={m.mes} label={capitalizar(nombreMes(m.mes))} valor={m.pct ?? 0} max={100} texto={`${m.pct ?? 0}% · ${m.listas}`} />)}
            </>
          )}
        </Bloque>

        <Bloque titulo="Conciertos y eventos">
          {(eventos?.conciertos || 0) + (eventos?.ensayos || 0) + (eventos?.otros || 0) === 0 ? <SinRegistro /> : (
            <>
              <div style={{ fontSize: '13px', color: '#1A1A18', marginBottom: '8px' }}>
                {eventos.conciertos} conciertos · {eventos.ensayos} ensayos · {eventos.otros} otros
              </div>
              {eventos.lista_conciertos.map((c, k) => (
                <div key={k} style={{ fontSize: '12px', color: '#5F5E5A', padding: '3px 0' }}>🎤 {c.titulo} · {fechaCorta(c.fecha)}{c.lugar ? ` · ${c.lugar}` : ''}</div>
              ))}
            </>
          )}
        </Bloque>

        <Bloque titulo="Repertorio" nota={datos_desde?.estudio ? `Registro de estudio desde el ${fechaCorta(datos_desde.estudio)}` : null}>
          {obras.length === 0 ? <SinRegistro /> : (
            <>
              <Subtitulo>Dedicación por cuerda</Subtitulo>
              {(repertorio.dedicacion_por_cuerda || []).map(c => <Barra key={c.voz} label={capitalizar(c.voz)} valor={c.pct ?? 0} max={100} texto={`${c.pct ?? 0}%`} />)}
              <Subtitulo>Obras (de más a menos estudiada)</Subtitulo>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                <thead>
                  <tr style={{ color: '#888780', textAlign: 'left' }}>
                    <th style={th}>Obra</th><th style={{ ...th, textAlign: 'right' }}>Aperturas</th><th style={{ ...th, textAlign: 'right' }}>Cantantes</th><th style={{ ...th, textAlign: 'right' }}>Estudiada</th>
                  </tr>
                </thead>
                <tbody>
                  {obras.map((o, k) => (
                    <tr key={k} style={{ borderTop: '1px solid #F1EFE8', color: '#1A1A18' }}>
                      <td style={td}>{o.titulo}{!o.publicada && <span style={{ color: '#888780' }}> (despublicada)</span>}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.aperturas}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.cantantes}</td>
                      <td style={{ ...td, textAlign: 'right' }}>{o.estudiada_por}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Bloque>

        <Bloque titulo="Entrenamiento" nota={datos_desde?.entrenamiento ? `Registro desde el ${fechaCorta(datos_desde.entrenamiento)}` : null}>
          {(entrenamiento?.ejercicios || 0) + (entrenamiento?.lecciones_teoria || 0) === 0 ? <SinRegistro /> : (
            <>
              <Dato label="Ejercicios completados" valor={`${entrenamiento.ejercicios} (${entrenamiento.cantantes_que_practicaron} personas)`} />
              <Dato label="Lecciones de teoría" valor={`${entrenamiento.lecciones_teoria} (${entrenamiento.cantantes_teoria} personas)`} />
            </>
          )}
        </Bloque>

        <Bloque titulo="Uso de la app" nota={datos_desde?.uso_app ? `Registro de accesos desde el ${fechaCorta(datos_desde.uso_app)}` : null}>
          {!uso_app?.sesiones ? <SinRegistro /> : (
            <>
              <Dato label="Ingresos" valor={uso_app.sesiones} />
              <Dato label="Cantantes que entraron" valor={`${uso_app.cantantes_con_ingreso} de ${cantantes?.activos ?? 0}`} />
              <Subtitulo>Ingresos por mes</Subtitulo>
              {uso_app.por_mes.map(m => <Barra key={m.mes} label={capitalizar(nombreMes(m.mes))} valor={m.sesiones} max={Math.max(...uso_app.por_mes.map(x => x.sesiones))} texto={`${m.sesiones} · ${m.personas} pers.`} />)}
              {uso_app.pantallas.length > 0 && (
                <>
                  <Subtitulo>Pantallas más visitadas</Subtitulo>
                  {uso_app.pantallas.map(p => <Barra key={p.pantalla} label={ETIQUETAS_SECCION[p.pantalla] || capitalizar(p.pantalla)} valor={p.visitas} max={uso_app.pantallas[0].visitas} texto={String(p.visitas)} />)}
                </>
              )}
            </>
          )}
        </Bloque>

        <Bloque titulo="Participación">
          {!participacion?.encuestas && !participacion?.avisos ? <SinRegistro /> : (
            <>
              <Dato label="Encuestas" valor={participacion.encuestas ? `${participacion.encuestas} · participación promedio ${participacion.participacion_encuestas ?? 0}%` : 'Sin registro'} />
              <Dato label="Avisos publicados" valor={participacion.avisos ? `${participacion.avisos} · leídos en promedio por el ${participacion.lectura_avisos ?? 0}%` : 'Sin registro'} />
            </>
          )}
        </Bloque>

        <Bloque titulo="Reportes de los cantantes">
          {!hayReportes ? <div style={{ fontSize: '13px', color: '#888780' }}>Todavía no se generaron.</div> : (
            <>
              <Dato label="En borrador" valor={cuenta.borrador} />
              <Dato label="Publicados" valor={cuenta.publicado} />
              <Dato label="Ya los vieron" valor={cuenta.vistos} />
              {cuenta.excluido > 0 && <Dato label="Excluidos" valor={cuenta.excluido} />}
            </>
          )}
        </Bloque>
      </div>
    </div>
  )
}

// ─── Piezas chicas ──────────────────────────────────────────────────────────
function Campo({ label, children }) {
  return (
    <div style={{ marginBottom: '14px' }}>
      <label style={{ display: 'block', fontSize: '11px', fontWeight: 500, color: '#5F5E5A', marginBottom: '5px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{label}</label>
      {children}
    </div>
  )
}
function Chip({ label, color, bg }) {
  return <span style={{ fontSize: '11px', fontWeight: 500, color, background: bg, padding: '2px 8px', borderRadius: '8px' }}>{label}</span>
}
function Dato({ label, valor }) {
  return (
    <div className="temporada-dato" style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '12px', padding: '6px 0', borderBottom: '1px solid #F1EFE8' }}>
      <span style={{ color: '#888780', flexShrink: 0 }}>{label}</span>
      <span className="temporada-dato-valor" style={{ color: '#1A1A18', textAlign: 'right' }}>{valor}</span>
    </div>
  )
}
function Numero({ valor, label }) {
  return (
    <div style={{ background: '#E1F5EE', borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontSize: '24px', fontWeight: 600, color: '#0F6E56', lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '12px', color: '#0F6E56', opacity: 0.8, marginTop: '4px' }}>{label}</div>
    </div>
  )
}
function Bloque({ titulo, nota, children }) {
  return (
    <div style={{ ...tarjeta, marginBottom: 0 }}>
      <h3 style={tituloSeccion}>{titulo}</h3>
      {children}
      {nota && <div style={{ fontSize: '11px', color: '#888780', marginTop: '8px' }}>{nota}</div>}
    </div>
  )
}
function Subtitulo({ children }) {
  return <div style={{ fontSize: '11px', fontWeight: 700, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.4px', margin: '12px 0 6px' }}>{children}</div>
}
function SinRegistro() {
  return <div style={{ fontSize: '13px', color: '#888780', fontStyle: 'italic' }}>Sin registro esta temporada</div>
}
function Barra({ label, valor, max, texto }) {
  const ancho = max > 0 ? Math.max(2, Math.round((valor / max) * 100)) : 0
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '92px 1fr auto', alignItems: 'center', gap: '8px', fontSize: '12px', padding: '3px 0' }}>
      <span style={{ color: '#5F5E5A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      <div style={{ height: '8px', background: '#F1EFE8', borderRadius: '4px', overflow: 'hidden' }}>
        <div style={{ width: `${ancho}%`, height: '100%', background: '#1D9E75', borderRadius: '4px' }} />
      </div>
      <span style={{ color: '#1A1A18', minWidth: '40px', textAlign: 'right' }}>{texto}</span>
    </div>
  )
}

const tarjeta = { background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '14px', padding: '16px', marginBottom: '12px' }
const tituloSeccion = { fontSize: '12px', fontWeight: 600, color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 10px' }
const input = { width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', color: '#1A1A18', background: '#FFFFFF', outline: 'none', boxSizing: 'border-box' }
const alerta = { background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#501313', marginBottom: '12px' }
const botonSec = { background: '#FFFFFF', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '7px 12px', fontSize: '12px', color: '#1A1A18', cursor: 'pointer' }
const th = { fontWeight: 500, padding: '4px 2px' }
const td = { padding: '5px 2px' }
function boton(color) {
  return { background: color, color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '10px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', height: '38px' }
}
