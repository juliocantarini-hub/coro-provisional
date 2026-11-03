import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import BotonVolver from '../../components/BotonVolver'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import { LECCIONES, COLOR_TEORIA, FONDO_TEORIA } from '../../lib/teoria'

// "Entendé la partitura": qué lecciones de teoría completó cada cantante, para directores y admins.
// Sale de la tabla teoria_progreso (ver supabase/teoria_progreso.sql).

const VERDE = '#0F6E56'

function fecha(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

function Pastilla({ activa, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', fontSize: '13px', borderRadius: '999px', cursor: 'pointer', fontWeight: 500,
      border: `1px solid ${activa ? COLOR_TEORIA : '#D3D1C7'}`, background: activa ? COLOR_TEORIA : '#FFFFFF', color: activa ? '#FFFFFF' : '#5F5E5A',
    }}>{children}</button>
  )
}

function Dato({ valor, etiqueta }) {
  return (
    <div style={{ flex: '1 1 120px', background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '10px 14px' }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#1A1A18', lineHeight: 1.1 }}>{valor}</div>
      <div style={{ fontSize: '12px', color: '#888780' }}>{etiqueta}</div>
    </div>
  )
}

function Barra({ valor, max }) {
  return (
    <div style={{ height: '6px', borderRadius: '3px', background: '#EFEDE4', overflow: 'hidden', marginTop: '5px' }}>
      <div style={{ width: `${max ? Math.round((valor / max) * 100) : 0}%`, height: '100%', background: COLOR_TEORIA, borderRadius: '3px' }} />
    </div>
  )
}

const tarjeta = { background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '12px 14px', cursor: 'pointer' }

export default function InformesTeoriaAdmin() {
  const navigate = useNavigate()
  const [filas, setFilas] = useState([])
  const [cantantes, setCantantes] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [vista, setVista] = useState('leccion') // 'leccion' | 'cantante'
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    // En los proyectos de un solo coro getCoroActual() devuelve null: ahí no se filtra por coro
    const coro = await getCoroActual()
    const delCoro = (q) => (coro ? q.eq('coro_id', coro.id) : q)
    const prog = await delCoro(supabase.from('teoria_progreso').select('perfil_id, leccion, completada_en')).limit(5000)
    // Si la tabla perfiles no tiene la columna estado, se piden los datos sin ella
    let per = await delCoro(supabase.from('perfiles').select('id, nombre, voz, rol, estado'))
    if (per.error) per = await delCoro(supabase.from('perfiles').select('id, nombre, voz, rol'))
    if (prog.error) {
      setError('No se pudo cargar el progreso. Si es la primera vez, corré supabase/teoria_progreso.sql en Supabase. (' + prog.error.message + ')')
      setCargando(false)
      return
    }
    // Cantantes activos (si la columna estado no viene, se toman todos)
    const lista = (per.data || []).filter((p) => !p.estado || p.estado === 'activo')
    lista.sort((a, b) => (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    setFilas(prog.data || [])
    setCantantes(lista)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const datos = useMemo(() => {
    const porCantante = new Map() // id → Map(leccion → fecha)
    for (const f of filas) {
      if (!porCantante.has(f.perfil_id)) porCantante.set(f.perfil_id, new Map())
      porCantante.get(f.perfil_id).set(f.leccion, f.completada_en)
    }
    const porLeccion = LECCIONES.map((l, i) => ({
      ...l, n: i + 1,
      hicieron: cantantes.filter((c) => porCantante.get(c.id)?.has(l.id)),
      faltan: cantantes.filter((c) => !porCantante.get(c.id)?.has(l.id)),
    }))
    const conCantantes = cantantes.map((c) => {
      const m = porCantante.get(c.id) || new Map()
      const fechas = [...m.values()].sort()
      return { ...c, hechas: m, cantidad: LECCIONES.filter((l) => m.has(l.id)).length, ultima: fechas[fechas.length - 1] || null }
    }).sort((a, b) => b.cantidad - a.cantidad || (a.nombre || '').localeCompare(b.nombre || '', 'es'))
    const empezaron = conCantantes.filter((c) => c.cantidad > 0).length
    const todas = conCantantes.filter((c) => c.cantidad === LECCIONES.length).length
    const total = conCantantes.reduce((s, c) => s + c.cantidad, 0)
    return { porLeccion, conCantantes, empezaron, todas, total }
  }, [filas, cantantes])

  const q = busqueda.trim().toLowerCase()
  const coincide = (c) => !q || (c.nombre || '').toLowerCase().includes(q) || (c.voz || '').toLowerCase().includes(q)
  const nombre = (c) => `${c.nombre || 'Cantante'}${c.voz ? ` · ${c.voz}` : ''}`

  return (
    <div style={{ position: 'relative' }}>
      <BotonVolver texto="Entrenamiento" onClick={() => navigate('/admin/entrenamiento')} />
      <div style={{ paddingRight: window.innerWidth > 768 ? '150px' : 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>🎼 Entendé la partitura</h2>
        <button onClick={cargar} style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: VERDE, fontWeight: 500 }}>↻ Actualizar</button>
      </div>
      <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 14px' }}>
        Qué lecciones de teoría completó cada cantante. Una lección cuenta como completada cuando termina el repaso final.
      </p>

      {error && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#501313', marginBottom: '12px' }}>{error}</div>}
      {cargando && <div style={{ fontSize: '13px', color: '#888780' }}>Cargando…</div>}

      {!cargando && !error && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <Dato valor={`${datos.empezaron} de ${cantantes.length}`} etiqueta="cantantes que hicieron al menos una" />
            <Dato valor={datos.todas} etiqueta={`completaron las ${LECCIONES.length}`} />
            <Dato valor={datos.total} etiqueta="lecciones completadas en total" />
          </div>

          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <Pastilla activa={vista === 'leccion'} onClick={() => { setVista('leccion'); setAbierto(null) }}>Por lección</Pastilla>
            <Pastilla activa={vista === 'cantante'} onClick={() => { setVista('cantante'); setAbierto(null) }}>Por cantante</Pastilla>
          </div>
          <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cantante o cuerda…"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '13px', borderRadius: '10px', border: '1px solid #D3D1C7', marginBottom: '12px' }} />

          {vista === 'leccion' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {datos.porLeccion.map((l) => {
                const hicieron = l.hicieron.filter(coincide)
                const faltan = l.faltan.filter(coincide)
                const open = abierto === l.id
                return (
                  <div key={l.id} style={tarjeta} onClick={() => setAbierto(open ? null : l.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{l.n}. {l.titulo}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: COLOR_TEORIA, whiteSpace: 'nowrap' }}>{l.hicieron.length} de {cantantes.length}</div>
                    </div>
                    <Barra valor={l.hicieron.length} max={cantantes.length} />
                    {open && (
                      <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: 1.6 }} onClick={(e) => e.stopPropagation()}>
                        <div style={{ fontWeight: 600, color: VERDE }}>✓ La completaron ({hicieron.length})</div>
                        {hicieron.length === 0 && <div style={{ color: '#888780' }}>Nadie todavía.</div>}
                        {hicieron.map((c) => {
                          const f = filas.find((x) => x.perfil_id === c.id && x.leccion === l.id)
                          return <div key={c.id} style={{ color: '#1A1A18' }}>{nombre(c)} <span style={{ color: '#888780' }}>· {fecha(f?.completada_en)}</span></div>
                        })}
                        <div style={{ fontWeight: 600, color: '#888780', marginTop: '8px' }}>Les falta ({faltan.length})</div>
                        <div style={{ color: '#5F5E5A' }}>{faltan.map(nombre).join(', ') || '—'}</div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {vista === 'cantante' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {datos.conCantantes.filter(coincide).map((c) => {
                const open = abierto === c.id
                return (
                  <div key={c.id} style={tarjeta} onClick={() => setAbierto(open ? null : c.id)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline' }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{nombre(c)}</div>
                      <div style={{ fontSize: '13px', fontWeight: 700, color: c.cantidad ? COLOR_TEORIA : '#B4B2A9', whiteSpace: 'nowrap' }}>{c.cantidad} de {LECCIONES.length}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '4px', marginTop: '6px', flexWrap: 'wrap' }}>
                      {LECCIONES.map((l, i) => (
                        <span key={l.id} title={l.titulo} style={{
                          width: '22px', height: '22px', borderRadius: '11px', fontSize: '11px', fontWeight: 700,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                          background: c.hechas.has(l.id) ? COLOR_TEORIA : FONDO_TEORIA, color: c.hechas.has(l.id) ? '#FFFFFF' : '#B98AAE',
                        }}>{i + 1}</span>
                      ))}
                    </div>
                    {open && (
                      <div style={{ marginTop: '10px', fontSize: '13px', lineHeight: 1.6 }}>
                        {LECCIONES.map((l, i) => (
                          <div key={l.id} style={{ color: c.hechas.has(l.id) ? '#1A1A18' : '#B4B2A9' }}>
                            {c.hechas.has(l.id) ? '✓' : '·'} {i + 1}. {l.titulo}
                            {c.hechas.has(l.id) && <span style={{ color: '#888780' }}> · {fecha(c.hechas.get(l.id))}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </>
      )}
    </div>
  )
}
