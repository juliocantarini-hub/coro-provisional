import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import { ETIQUETAS_SECCION, olvidarUltimaSesion } from '../../lib/actividad'

const PERIODOS = [
  { dias: 7,   label: '7 días' },
  { dias: 30,  label: '30 días' },
  { dias: 90,  label: '3 meses' },
  { dias: 365, label: '12 meses' },
]

const ORDENES = [
  { valor: 'ingresos',  label: 'Más ingresos' },
  { valor: 'reciente',  label: 'Actividad reciente' },
  { valor: 'inactivos', label: 'Sin actividad primero' },
  { valor: 'nombre',    label: 'Nombre' },
]

const COLUMNAS = '1.5fr 80px 90px 90px 160px 1.4fr'

function esMovil() {
  return window.innerWidth <= 768
}

// ─── Formatos ────────────────────────────────────────────────────────────────

function horaLocal(iso) {
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

function capitalizar(texto) {
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

function inicioDeDia(fecha) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate())
}

function ultimoIngreso(iso) {
  if (!iso) return { texto: 'Sin actividad', nivel: 'nulo' }
  const fecha = new Date(iso)
  const dias = Math.round((inicioDeDia(new Date()) - inicioDeDia(fecha)) / 86400000)
  const corta = fecha.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
  if (dias <= 0) return { texto: `Hoy ${horaLocal(iso)}`, nivel: 'ok' }
  if (dias === 1) return { texto: `Ayer ${horaLocal(iso)}`, nivel: 'ok' }
  return { texto: `Hace ${dias} días · ${corta}`, nivel: dias <= 3 ? 'ok' : dias <= 14 ? 'medio' : 'bajo' }
}

const COLOR_NIVEL = { ok: '#1D9E75', medio: '#D85A30', bajo: '#A32D2D', nulo: '#B4B2A9' }

// ─── Pantalla ────────────────────────────────────────────────────────────────

export default function EstadisticaAdmin() {
  const [periodo, setPeriodo]     = useState(30)
  const [datos, setDatos]         = useState([])
  const [cargando, setCargando]   = useState(true)
  const [error, setError]         = useState(null) // null | 'sql' | 'general'
  const [coroId, setCoroId]       = useState(null)
  const [desde, setDesde]         = useState(null)
  const [busqueda, setBusqueda]   = useState('')
  const [orden, setOrden]         = useState('ingresos')
  const [soloCantantes, setSoloCantantes] = useState(false)
  const [abierto, setAbierto]     = useState(null)
  const movil = esMovil()

  const cargar = useCallback(async () => {
    setCargando(true)
    setError(null)
    try {
      const coro = await getCoroActual()
      if (!coro) throw new Error('No se pudo identificar el coro.')
      const desdeISO = new Date(Date.now() - periodo * 86400000).toISOString()
      const { data, error: err } = await supabase.rpc('estadistica_accesos', {
        p_coro_id: coro.id,
        p_desde: desdeISO,
      })
      if (err) throw err
      setCoroId(coro.id)
      setDesde(desdeISO)
      setDatos((data || []).map(d => ({
        ...d,
        ingresos: Number(d.ingresos),
        dias_activos: Number(d.dias_activos),
        vistas: Number(d.vistas),
      })))
    } catch (err) {
      console.error('Estadística:', err)
      const msg = `${err?.code || ''} ${err?.message || ''}`
      setError(/PGRST202|42883|estadistica_accesos/.test(msg) ? 'sql' : 'general')
      setDatos([])
    } finally {
      setCargando(false)
    }
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  const base = soloCantantes ? datos.filter(d => d.rol === 'cantante') : datos
  const q = busqueda.trim().toLowerCase()
  const filtrados = base
    .filter(d => !q || d.nombre?.toLowerCase().includes(q) || d.voz?.toLowerCase().includes(q))
    .sort(comparador(orden))

  const conActividad  = base.filter(d => d.ingresos > 0).length
  const totalIngresos = base.reduce((s, d) => s + d.ingresos, 0)
  const totalVistas   = base.reduce((s, d) => s + d.vistas, 0)
  const sinDatos      = !cargando && !error && base.every(d => d.ingresos === 0 && d.vistas === 0)

  return (
    <div>
      {/* Encabezado */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>Estadística de accesos</h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : error ? '' : `${conActividad} de ${base.length} ingresaron en los últimos ${PERIODOS.find(p => p.dias === periodo)?.label}`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={cargar}
            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
            ↻ Actualizar
          </button>
          {coroId && !error && (
            <button
              onClick={() => descargarResumen(base.slice().sort(comparador(orden)), PERIODOS.find(p => p.dias === periodo)?.label)}
              disabled={cargando || base.length === 0}
              style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
              ↓ Descargar resumen
            </button>
          )}
          {coroId && !error && (
            <ReiniciarEstadistica coroId={coroId} onListo={() => { setAbierto(null); cargar() }} />
          )}
        </div>
      </div>

      {/* Período */}
      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {PERIODOS.map(p => (
          <button key={p.dias} onClick={() => { setPeriodo(p.dias); setAbierto(null) }}
            style={{
              padding: '6px 14px', fontSize: '12px', borderRadius: '16px', cursor: 'pointer', fontWeight: '500',
              border: periodo === p.dias ? '1px solid #0F6E56' : '1px solid #D3D1C7',
              background: periodo === p.dias ? '#0F6E56' : '#FFFFFF',
              color: periodo === p.dias ? '#FFFFFF' : '#5F5E5A',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {error === 'sql' && (
        <Aviso color="#712B13" bg="#FAECE7" titulo="Falta activar la estadística en Supabase">
          Todavía no se ejecutó el SQL de estadística en este proyecto de Supabase. Ejecutá el archivo <b>supabase/estadistica_accesos.sql</b> en el SQL Editor y volvé a tocar “Actualizar”.
        </Aviso>
      )}
      {error === 'general' && (
        <Aviso color="#A32D2D" bg="#FCEBEB" titulo="No pudimos cargar la estadística">
          Revisá tu conexión e intentá de nuevo con “Actualizar”.
        </Aviso>
      )}

      {!error && (
        <>
          {/* Totales */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '16px' }}>
            <Total valor={conActividad} label="Cantantes que ingresaron" color="#0F6E56" bg="#E1F5EE" />
            <Total valor={totalIngresos} label="Ingresos en total" color="#378ADD" bg="#E6F1FB" />
            <Total valor={totalVistas} label="Pantallas vistas" color="#7C3AED" bg="#F3EFF8" />
          </div>

          {/* Filtros */}
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cantante..."
              style={{ flex: '1 1 200px', maxWidth: '300px', height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }} />
            <select value={orden} onChange={e => setOrden(e.target.value)}
              style={{ height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 10px', fontSize: '13px', background: '#FFFFFF', color: '#1A1A18' }}>
              {ORDENES.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
            </select>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5F5E5A', cursor: 'pointer' }}>
              <input type="checkbox" checked={soloCantantes} onChange={e => setSoloCantantes(e.target.checked)} />
              Solo cantantes
            </label>
          </div>
        </>
      )}

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2, 3, 4].map(i => <div key={i} style={{ height: '64px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {sinDatos && (
        <Aviso color="#04342C" bg="#E1F5EE" titulo="Todavía no hay actividad registrada en este período">
          A medida que los cantantes usen la app, sus ingresos y pantallas vistas van a aparecer acá.
        </Aviso>
      )}

      {/* MÓVIL: tarjetas */}
      {!cargando && !error && movil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtrados.map(d => (
            <TarjetaMovil
              key={d.perfil_id}
              d={d}
              expandido={abierto === d.perfil_id}
              onToggle={() => setAbierto(abierto === d.perfil_id ? null : d.perfil_id)}
              coroId={coroId}
              desde={desde}
            />
          ))}
          {filtrados.length === 0 && !sinDatos && <Vacio />}
        </div>
      )}

      {/* DESKTOP: tabla */}
      {!cargando && !error && !movil && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: COLUMNAS, padding: '10px 16px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Cantante</span>
            <span>Ingresos</span>
            <span>Días activos</span>
            <span>Pantallas</span>
            <span>Última actividad</span>
            <span>Más visto</span>
          </div>
          {filtrados.length === 0 && <Vacio />}
          {filtrados.map((d, i) => {
            const u = ultimoIngreso(d.ultimo_ingreso)
            const expandido = abierto === d.perfil_id
            return (
              <div key={d.perfil_id} style={{ borderBottom: i < filtrados.length - 1 ? '1px solid #F1EFE8' : 'none' }}>
                <div onClick={() => setAbierto(expandido ? null : d.perfil_id)}
                  style={{ display: 'grid', gridTemplateColumns: COLUMNAS, padding: '12px 16px', alignItems: 'center', cursor: 'pointer', background: expandido ? '#F8F7F3' : 'transparent' }}>
                  <Nombre d={d} />
                  <span style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A18' }}>{d.ingresos}</span>
                  <span style={{ fontSize: '13px', color: '#5F5E5A' }}>{d.dias_activos}</span>
                  <span style={{ fontSize: '13px', color: '#5F5E5A' }}>{d.vistas}</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#5F5E5A' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_NIVEL[u.nivel], flexShrink: 0 }} />
                    {u.texto}
                  </span>
                  <TopSecciones secciones={d.secciones} />
                </div>
                {expandido && <Historial perfilId={d.perfil_id} coroId={coroId} desde={desde} />}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ─── Orden ───────────────────────────────────────────────────────────────────

function comparador(orden) {
  const tiempo = d => (d.ultimo_ingreso ? new Date(d.ultimo_ingreso).getTime() : null)
  const porNombre = (a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es')
  return (a, b) => {
    if (orden === 'nombre') return porNombre(a, b)
    if (orden === 'reciente') {
      const ta = tiempo(a), tb = tiempo(b)
      if (ta === null && tb === null) return porNombre(a, b)
      if (ta === null) return 1
      if (tb === null) return -1
      return tb - ta
    }
    if (orden === 'inactivos') {
      const ta = tiempo(a), tb = tiempo(b)
      if (ta === null && tb === null) return porNombre(a, b)
      if (ta === null) return -1
      if (tb === null) return 1
      return ta - tb
    }
    return (b.ingresos - a.ingresos) || (b.vistas - a.vistas) || porNombre(a, b)
  }
}

// ─── Piezas chicas ───────────────────────────────────────────────────────────

function Nombre({ d }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {d.nombre || '—'}
        {d.rol !== 'cantante' && (
          <span style={{ marginLeft: '6px', fontSize: '10px', fontWeight: '600', color: '#712B13', background: '#FAECE7', padding: '1px 7px', borderRadius: '8px', textTransform: 'capitalize' }}>{d.rol}</span>
        )}
      </div>
      <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize', marginTop: '1px' }}>{d.voz || '—'}</div>
    </div>
  )
}

function TopSecciones({ secciones }) {
  const items = Object.entries(secciones || {}).sort((a, b) => b[1] - a[1]).slice(0, 3)
  if (items.length === 0) return <span style={{ fontSize: '12px', color: '#B4B2A9' }}>—</span>
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
      {items.map(([clave, n]) => (
        <span key={clave} style={{ fontSize: '11px', color: '#04342C', background: '#E1F5EE', padding: '2px 8px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
          {ETIQUETAS_SECCION[clave] || clave} · {n}
        </span>
      ))}
    </div>
  )
}

function Total({ valor, label, color, bg }) {
  return (
    <div style={{ background: bg, borderRadius: '12px', padding: '14px' }}>
      <div style={{ fontSize: '24px', fontWeight: '600', color, lineHeight: 1 }}>{valor}</div>
      <div style={{ fontSize: '11px', color, opacity: 0.8, marginTop: '4px' }}>{label}</div>
    </div>
  )
}

// Tarjeta de cada persona en el celular:
// cabecera (iniciales, nombre, voz y última actividad), tres cifras juntas y lo más visto.
// Sin actividad, la tarjeta se reduce a una línea para no llenar la pantalla de ceros.
function TarjetaMovil({ d, expandido, onToggle, coroId, desde }) {
  const u = ultimoIngreso(d.ultimo_ingreso)
  const activo = d.ultimo_ingreso != null
  const iniciales = (d.nombre || '?').split(' ').map(n => (n.match(/[\p{L}\p{N}]/u) || [''])[0]).filter(Boolean).slice(0, 2).join('').toUpperCase() || '?'
  const voz = d.voz ? capitalizar(d.voz) : null
  const alPulsar = e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onToggle() }
  }

  return (
    <div style={{
      background: '#FFFFFF', borderRadius: '14px', overflow: 'hidden',
      border: `1px solid ${expandido ? '#9FE1CB' : '#E8E6DF'}`,
      boxShadow: expandido ? '0 2px 10px rgba(15,110,86,0.10)' : 'none',
    }}>
      <div
        role="button" tabIndex={0} aria-expanded={expandido}
        onClick={onToggle} onKeyDown={alPulsar}
        style={{ padding: '14px', cursor: 'pointer', WebkitTapHighlightColor: 'transparent', outline: 'none' }}
      >
        {/* Cabecera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '14px', fontWeight: '600',
            background: activo ? '#E1F5EE' : '#F1EFE8', color: activo ? '#0F6E56' : '#888780',
          }}>{iniciales}</div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '15px', fontWeight: '600', color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {d.nombre || '—'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: '8px', rowGap: '3px', marginTop: '3px', fontSize: '12px', color: '#5F5E5A' }}>
              {d.rol !== 'cantante' && (
                <span style={{ fontSize: '10px', fontWeight: '600', color: '#712B13', background: '#FAECE7', padding: '1px 7px', borderRadius: '8px', textTransform: 'capitalize' }}>{d.rol}</span>
              )}
              {voz && <span style={{ color: '#888780' }}>{voz}</span>}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: COLOR_NIVEL[u.nivel], flexShrink: 0 }} />
                {u.texto}
              </span>
            </div>
          </div>

          <span aria-hidden="true" style={{
            width: '30px', height: '30px', borderRadius: '50%', flexShrink: 0, background: '#F1EFE8',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="#0F6E56"
              style={{ transform: expandido ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M7.41 8.59 12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
            </svg>
          </span>
        </div>

        {activo && (
          <>
            {/* Cifras */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', background: '#F8F7F3', borderRadius: '10px', marginTop: '12px' }}>
              <Cifra label="Ingresos" valor={d.ingresos} />
              <Cifra label="Días activos" valor={d.dias_activos} separada />
              <Cifra label="Pantallas" valor={d.vistas} separada />
            </div>

            {/* Lo más visto */}
            {Object.keys(d.secciones || {}).length > 0 && (
              <div style={{ marginTop: '12px' }}>
                <div style={{ fontSize: '10px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px', marginBottom: '6px' }}>Más visto</div>
                <TopSecciones secciones={d.secciones} />
              </div>
            )}
          </>
        )}
      </div>
      {expandido && <Historial perfilId={d.perfil_id} coroId={coroId} desde={desde} />}
    </div>
  )
}

function Cifra({ label, valor, separada }) {
  return (
    <div style={{ textAlign: 'center', padding: '10px 4px', borderLeft: separada ? '1px solid #E8E6DF' : 'none' }}>
      <div style={{ fontSize: '18px', fontWeight: '600', color: '#1A1A18', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '11px', color: '#888780', marginTop: '3px' }}>{label}</div>
    </div>
  )
}

function Aviso({ titulo, color, bg, children }) {
  return (
    <div style={{ background: bg, borderRadius: '12px', padding: '14px 16px', marginBottom: '16px' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color, marginBottom: '4px' }}>{titulo}</div>
      <div style={{ fontSize: '12px', color, lineHeight: 1.5 }}>{children}</div>
    </div>
  )
}

function Vacio() {
  return <div style={{ padding: '28px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>No hay cantantes para mostrar.</div>
}

// ─── Historial de una persona ────────────────────────────────────────────────

const TABLAS = { obra: 'obras', evento: 'eventos', aviso: 'avisos', texto: 'textos' }
const ID_VALIDO = /^([0-9a-f-]{36}|\d+)$/i
const PASO = 150

const COLOR_TIPO = { sesion: '#0F6E56', seccion: '#B4B2A9', obra: '#1D9E75', evento: '#378ADD', aviso: '#D85A30', texto: '#7C3AED' }

function describir(f, titulos) {
  const seccion = ETIQUETAS_SECCION[f.detalle] || f.detalle || 'una pantalla'
  const titulo = titulos[`${f.tipo}:${f.ref_id}`]
  switch (f.tipo) {
    case 'sesion':  return 'Ingresó a la app'
    case 'seccion': return `Vio ${seccion}`
    case 'obra':    return titulo ? `Abrió la obra “${titulo}”` : 'Abrió una obra'
    case 'evento':  return titulo ? `Abrió el evento “${titulo}”` : 'Abrió un evento'
    case 'aviso':   return titulo ? `Abrió el aviso “${titulo}”` : 'Abrió un aviso'
    case 'texto':   return titulo ? `Leyó el texto “${titulo}”` : 'Leyó un texto'
    default:        return f.tipo
  }
}

function agruparPorDia(filas) {
  const grupos = []
  for (const f of filas) {
    const fecha = new Date(f.creado_en)
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`
    let g = grupos[grupos.length - 1]
    if (!g || g.clave !== clave) {
      g = { clave, fecha, items: [] }
      grupos.push(g)
    }
    g.items.push(f)
  }
  return grupos
}

function Historial({ perfilId, coroId, desde }) {
  const [filas, setFilas]       = useState([])
  const [titulos, setTitulos]   = useState({})
  const [cargando, setCargando] = useState(true)
  const [hayMas, setHayMas]     = useState(false)
  const [limite, setLimite]     = useState(PASO)
  const [error, setError]       = useState(false)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setCargando(true)
      setError(false)
      const { data, error: err } = await supabase
        .from('actividad_app')
        .select('id, tipo, ref_id, detalle, creado_en')
        .eq('coro_id', coroId)
        .eq('perfil_id', perfilId)
        .gte('creado_en', desde)
        .order('creado_en', { ascending: false })
        .limit(limite + 1)

      if (cancelado) return
      if (err) { setError(true); setCargando(false); return }

      const visibles = (data || []).slice(0, limite)

      // Buscamos los títulos de las obras / eventos / avisos / textos que abrió
      const nuevos = {}
      await Promise.all(Object.entries(TABLAS).map(async ([tipo, tabla]) => {
        const ids = [...new Set(
          visibles.filter(f => f.tipo === tipo && ID_VALIDO.test(f.ref_id || '')).map(f => f.ref_id)
        )]
        if (ids.length === 0) return
        const { data: filasTabla } = await supabase.from(tabla).select('id, titulo').in('id', ids)
        for (const r of filasTabla || []) nuevos[`${tipo}:${r.id}`] = r.titulo
      }))

      if (cancelado) return
      setTitulos(nuevos)
      setFilas(visibles)
      setHayMas((data || []).length > limite)
      setCargando(false)
    }

    cargar()
    return () => { cancelado = true }
  }, [perfilId, coroId, desde, limite])

  const grupos = agruparPorDia(filas)

  return (
    <div style={{ padding: '4px 16px 16px', background: '#F8F7F3', borderTop: '1px solid #F1EFE8' }}>
      {cargando && filas.length === 0 && <p style={{ fontSize: '12px', color: '#888780', margin: '12px 0 0' }}>Cargando historial...</p>}
      {error && <p style={{ fontSize: '12px', color: '#A32D2D', margin: '12px 0 0' }}>No pudimos cargar el historial.</p>}
      {!cargando && !error && filas.length === 0 && (
        <p style={{ fontSize: '12px', color: '#888780', margin: '12px 0 0' }}>Sin actividad registrada en este período.</p>
      )}

      {grupos.map(g => (
        <div key={g.clave} style={{ marginTop: '12px' }}>
          <div style={{ fontSize: '11px', fontWeight: '600', color: '#5F5E5A', marginBottom: '4px' }}>
            {capitalizar(g.fecha.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' }))}
          </div>
          {g.items.map(f => (
            <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', padding: '3px 0' }}>
              <span style={{ fontSize: '11px', color: '#888780', width: '38px', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{horaLocal(f.creado_en)}</span>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: COLOR_TIPO[f.tipo] || '#B4B2A9', flexShrink: 0, alignSelf: 'center' }} />
              <span style={{ fontSize: '12px', color: '#1A1A18', fontWeight: f.tipo === 'sesion' ? '600' : '400' }}>{describir(f, titulos)}</span>
            </div>
          ))}
        </div>
      ))}

      {hayMas && (
        <button onClick={() => setLimite(l => l + PASO)}
          style={{ marginTop: '12px', padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
          Ver más
        </button>
      )}
    </div>
  )
}

// ─── Reiniciar (borrar) la estadística ───────────────────────────────────────

const PALABRA_CONFIRMAR = 'BORRAR'

function ReiniciarEstadistica({ coroId, onListo }) {
  const [abierta, setAbierta]   = useState(false)
  const [total, setTotal]       = useState(null) // cuántos registros se van a borrar
  const [texto, setTexto]       = useState('')
  const [borrando, setBorrando] = useState(false)
  const [error, setError]       = useState(null)

  async function abrir() {
    setAbierta(true)
    setTexto('')
    setError(null)
    setTotal(null)
    const { count, error: err } = await supabase
      .from('actividad_app')
      .select('*', { count: 'exact', head: true })
      .eq('coro_id', coroId)
    if (err) { setError('No pudimos contar los registros. Intentá de nuevo.'); return }
    setTotal(count || 0)
  }

  function cerrar() {
    if (!borrando) setAbierta(false)
  }

  async function borrar() {
    setBorrando(true)
    setError(null)
    const { count, error: err } = await supabase
      .from('actividad_app')
      .delete({ count: 'exact' })
      .eq('coro_id', coroId)
    setBorrando(false)

    if (err) { setError('No se pudo borrar. Intentá de nuevo.'); return }
    // Sin permiso, Supabase no da error: simplemente no borra nada
    if (total > 0 && (count || 0) === 0) {
      setError('No se borró nada. Falta ejecutar en Supabase el SQL con el permiso de borrado (archivo supabase/estadistica_accesos.sql).')
      return
    }
    olvidarUltimaSesion()
    setAbierta(false)
    onListo()
  }

  const confirmado  = texto.trim().toUpperCase() === PALABRA_CONFIRMAR
  const puedeBorrar = confirmado && !borrando && total !== null && total > 0

  return (
    <>
      <button onClick={abrir}
        style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #E5B5A8', background: 'none', cursor: 'pointer', color: '#A32D2D', fontWeight: '500' }}>
        Reiniciar estadística
      </button>

      {abierta && (
        <div onClick={cerrar}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)', zIndex: 80, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
          <div onClick={e => e.stopPropagation()} role="dialog" aria-modal="true"
            style={{ background: '#FFFFFF', borderRadius: '14px', padding: '22px', maxWidth: '430px', width: '100%', boxShadow: '0 12px 40px rgba(0,0,0,0.25)' }}>
            <h3 style={{ fontFamily: 'Georgia, serif', fontSize: '18px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 10px' }}>
              ¿Reiniciar la estadística?
            </h3>

            <p style={{ fontSize: '13px', color: '#5F5E5A', lineHeight: 1.6, margin: '0 0 10px' }}>
              {total === null && !error && 'Contando registros...'}
              {total === 0 && 'No hay registros para borrar.'}
              {total > 0 && (
                <>
                  Se van a borrar <b>{total}</b> registros de actividad de todas las personas de este coro: ingresos, pantallas vistas e historial. <b>Esta acción no se puede deshacer.</b>
                </>
              )}
            </p>

            {total > 0 && (
              <>
                <p style={{ fontSize: '12px', color: '#0F6E56', background: '#E1F5EE', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.5, margin: '0 0 12px' }}>
                  Antes de borrar, cerrá esta ventana, elegí “12 meses” y tocá “Descargar resumen” para guardar una copia.
                </p>
                <p style={{ fontSize: '13px', color: '#5F5E5A', margin: '0 0 6px' }}>
                  Para confirmar, escribí <b>{PALABRA_CONFIRMAR}</b>:
                </p>
                <input value={texto} onChange={e => setTexto(e.target.value)} autoFocus
                  placeholder={PALABRA_CONFIRMAR}
                  style={{ width: '100%', height: '38px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </>
            )}

            {error && (
              <p style={{ fontSize: '12px', color: '#A32D2D', background: '#FCEBEB', borderRadius: '8px', padding: '8px 10px', lineHeight: 1.5, margin: '12px 0 0' }}>{error}</p>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button onClick={cerrar} disabled={borrando}
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#5F5E5A' }}>
                Cancelar
              </button>
              <button onClick={borrar} disabled={!puedeBorrar}
                style={{ padding: '8px 16px', fontSize: '13px', borderRadius: '8px', border: 'none', fontWeight: '600',
                  background: puedeBorrar ? '#A32D2D' : '#E8E6DF', color: puedeBorrar ? '#FFFFFF' : '#B4B2A9', cursor: puedeBorrar ? 'pointer' : 'not-allowed' }}>
                {borrando ? 'Borrando...' : 'Borrar todo'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Descargar resumen (CSV) ─────────────────────────────────────────────────

const SEPARADOR = ';' // Excel en español separa las columnas con punto y coma

function celdaCsv(valor) {
  let s = String(valor ?? '')
  if (/^[=+\-@]/.test(s)) s = "'" + s // evita que Excel lo interprete como fórmula
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function fechaHoraCsv(iso) {
  if (!iso) return ''
  const fecha = new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  return `${fecha} ${horaLocal(iso)}`
}

function descargarResumen(filas, periodoLabel) {
  const encabezado = ['Nombre', 'Voz', 'Rol', 'Ingresos', 'Días activos', 'Pantallas vistas', 'Última actividad', 'Secciones más vistas']
  const lineas = filas.map(d => [
    d.nombre,
    d.voz,
    d.rol,
    d.ingresos,
    d.dias_activos,
    d.vistas,
    fechaHoraCsv(d.ultimo_ingreso),
    Object.entries(d.secciones || {})
      .sort((a, b) => b[1] - a[1])
      .map(([clave, n]) => `${ETIQUETAS_SECCION[clave] || clave}: ${n}`)
      .join(' | '),
  ])
  const csv = [encabezado, ...lineas].map(f => f.map(celdaCsv).join(SEPARADOR)).join('\r\n')

  const hoy = new Date()
  const fecha = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, '0')}-${String(hoy.getDate()).padStart(2, '0')}`
  const periodo = (periodoLabel || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-')

  // El BOM inicial hace que Excel respete las tildes
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const enlace = document.createElement('a')
  enlace.href = url
  enlace.download = `estadistica-accesos-${periodo}-${fecha}.csv`
  document.body.appendChild(enlace)
  enlace.click()
  enlace.remove()
  URL.revokeObjectURL(url)
}
