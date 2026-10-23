import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

// Práctica de técnica vocal de los cantantes (Respiración, Resonancia y Vocalización), para directores y admins.
// Sale de la actividad que ya se registra cada vez que un cantante completa un ejercicio de Entrenamiento:
// cuántas veces practicó cada ejercicio, quién lo hizo y cuándo fue la última vez.

const VERDE = '#0F6E56'
const CATEGORIAS = [
  { id: 'vocalizacion', label: 'Vocalización', color: '#C0392B', bg: '#FBE5E3' },
  { id: 'resonancia', label: 'Resonancia', color: '#2E6DA4', bg: '#E3EDF7' },
  { id: 'respiracion', label: 'Respiración', color: '#0F6E56', bg: '#E1F5EE' },
]
const PERIODOS = [
  { id: 7, label: 'Últimos 7 días' },
  { id: 30, label: 'Últimos 30 días' },
  { id: 0, label: 'Todo' },
]

function fechaCorta(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`
const veces = (n) => plural(n, 'vez', 'veces')

function Pastilla({ activa, onClick, children, color = VERDE }) {
  return (
    <button onClick={onClick} style={{
      padding: '7px 14px', fontSize: '13px', borderRadius: '999px', cursor: 'pointer', fontWeight: 500,
      border: `1px solid ${activa ? color : '#D3D1C7'}`, background: activa ? color : '#FFFFFF', color: activa ? '#FFFFFF' : '#5F5E5A',
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

// Barrita proporcional al máximo, para ver de un vistazo qué se practica más
function Barra({ valor, max, color }) {
  return (
    <div style={{ height: '6px', borderRadius: '3px', background: '#EFEDE4', overflow: 'hidden', marginTop: '5px' }}>
      <div style={{ width: `${max ? Math.max(3, Math.round((valor / max) * 100)) : 0}%`, height: '100%', background: color, borderRadius: '3px' }} />
    </div>
  )
}

export default function InformesVocalizacionAdmin() {
  const navigate = useNavigate()
  const [ejercicios, setEjercicios] = useState([])
  const [actividad, setActividad] = useState([])
  const [personas, setPersonas] = useState({})
  const [totalCantantes, setTotalCantantes] = useState(0)
  const [diag, setDiag] = useState(null) // cuántas prácticas hay en el coro (sin filtrar por fecha) y cuántas son del usuario
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [categoria, setCategoria] = useState('vocalizacion')
  const [periodo, setPeriodo] = useState(30)
  const [vista, setVista] = useState('ejercicio') // 'ejercicio' | 'cantante'
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(null)
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false)
  const [borrando, setBorrando] = useState(false)
  const [aviso, setAviso] = useState('')

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const coro = await getCoroActual()
    if (!coro) { setCargando(false); return }

    const desde = periodo ? new Date(Date.now() - periodo * 86400000).toISOString() : null
    // Se trae por tandas de 1000 (el máximo de una consulta)
    const filas = []
    for (let pagina = 0; pagina < 50; pagina++) {
      let q = supabase.from('actividad_entrenamiento')
        .select('cantante_id, ejercicio_id, completado_en, duracion_real_seg')
        .eq('coro_id', coro.id)
        .order('completado_en', { ascending: false })
        .range(pagina * 1000, pagina * 1000 + 999)
      if (desde) q = q.gte('completado_en', desde)
      const { data, error: err } = await q
      if (err) {
        setError('No se pudo cargar la práctica. Si el error sigue, corré actividad_entrenamiento_directores.sql en Supabase. (' + err.message + ')')
        setCargando(false)
        return
      }
      filas.push(...(data || []))
      if (!data || data.length < 1000) break
    }

    const [ej, per] = await Promise.all([
      supabase.from('ejercicios_entrenamiento').select('id, categoria, nombre, activo, orden'),
      supabase.from('perfiles').select('id, nombre, voz, rol').eq('coro_id', coro.id),
    ])
    if (ej.error) { setError('No se pudieron cargar los ejercicios: ' + ej.error.message); setCargando(false); return }
    const mapa = {}
    for (const p of per.data || []) mapa[p.id] = p
    setEjercicios(ej.data || [])
    setPersonas(mapa)
    setTotalCantantes((per.data || []).length)
    setActividad(filas)
    // Diagnóstico para cuando no aparece nada: ¿no se guardó ninguna práctica, o hay prácticas fuera del período, o no tenés permiso para verlas?
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const [todas, propias] = await Promise.all([
        supabase.from('actividad_entrenamiento').select('cantante_id', { count: 'exact', head: true }).eq('coro_id', coro.id),
        user ? supabase.from('actividad_entrenamiento').select('cantante_id', { count: 'exact', head: true }).eq('cantante_id', user.id) : Promise.resolve({ count: null }),
      ])
      setDiag({ coro: todas.count, propias: propias.count, errorCoro: todas.error?.message || '', errorPropias: propias.error?.message || '' })
    } catch { setDiag(null) }
    setCargando(false)
  }, [periodo])

  useEffect(() => { cargar() }, [cargar])

  // Borra el historial de la categoría elegida (de todos los cantantes y de todo el tiempo, no solo del período que se está viendo)
  const borrarHistorial = async () => {
    const coro = await getCoroActual()
    const ids = ejercicios.filter((e) => e.categoria === categoria).map((e) => e.id)
    if (!coro || !ids.length) { setConfirmandoBorrado(false); return }
    setBorrando(true)
    setAviso('')
    const { count, error: err } = await supabase.from('actividad_entrenamiento')
      .delete({ count: 'exact' })
      .eq('coro_id', coro.id)
      .in('ejercicio_id', ids)
    setBorrando(false)
    setConfirmandoBorrado(false)
    if (err) { setError('No se pudo borrar el historial: ' + err.message); return }
    if (!count) { setError('No se borró nada. Si ya hay prácticas, falta correr actividad_entrenamiento_directores.sql en Supabase (agrega el permiso para borrar).'); return }
    setAviso(`Listo: se borraron ${plural(count, 'práctica', 'prácticas')} de ${cat.label.toLowerCase()}.`)
    cargar()
  }

  // Además de las tres de siempre, cualquier otra categoría que tenga ejercicios cargados (así no queda práctica sin mostrar)
  const categorias = useMemo(() => {
    const extra = [...new Set(ejercicios.map((e) => e.categoria).filter((c) => c && !CATEGORIAS.some((b) => b.id === c)))].sort()
    return [...CATEGORIAS, ...extra.map((id) => ({ id, label: id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' '), color: '#6B58B8', bg: '#EEEAF9' }))]
  }, [ejercicios])
  const cat = categorias.find((c) => c.id === categoria) || CATEGORIAS[0]

  // Todo lo de la categoría elegida: por ejercicio y por cantante
  const datos = useMemo(() => {
    const deCategoria = new Map(ejercicios.filter((e) => e.categoria === categoria).map((e) => [e.id, e]))
    const porEjercicio = new Map([...deCategoria.values()].map((e) => [e.id, { ej: e, total: 0, ultima: null, cantantes: new Map() }]))
    const porCantante = new Map()
    let total = 0
    for (const a of actividad) {
      const fila = porEjercicio.get(a.ejercicio_id)
      if (!fila) continue
      total++
      fila.total++
      if (!fila.ultima || a.completado_en > fila.ultima) fila.ultima = a.completado_en
      const c = fila.cantantes.get(a.cantante_id) || { veces: 0, ultima: null }
      c.veces++
      if (!c.ultima || a.completado_en > c.ultima) c.ultima = a.completado_en
      fila.cantantes.set(a.cantante_id, c)

      const pc = porCantante.get(a.cantante_id) || { id: a.cantante_id, total: 0, ultima: null, dias: new Set(), ejercicios: new Map() }
      pc.total++
      pc.dias.add(a.completado_en.slice(0, 10))
      if (!pc.ultima || a.completado_en > pc.ultima) pc.ultima = a.completado_en
      const e = pc.ejercicios.get(a.ejercicio_id) || { veces: 0, ultima: null }
      e.veces++
      if (!e.ultima || a.completado_en > e.ultima) e.ultima = a.completado_en
      pc.ejercicios.set(a.ejercicio_id, e)
      porCantante.set(a.cantante_id, pc)
    }
    const lista = [...porEjercicio.values()]
    return {
      total,
      ejercicios: lista.filter((f) => f.total > 0).sort((a, b) => b.total - a.total || (a.ej.nombre || '').localeCompare(b.ej.nombre || '')),
      sinPracticar: lista.filter((f) => f.total === 0 && f.ej.activo !== false).sort((a, b) => (a.ej.orden ?? 0) - (b.ej.orden ?? 0)),
      cantantes: [...porCantante.values()].sort((a, b) => b.total - a.total),
      nombreEj: (id) => deCategoria.get(id)?.nombre || 'Ejercicio',
    }
  }, [ejercicios, actividad, categoria])

  // Cuántas prácticas hay de cada categoría en el período (para los números de las pestañas) y cuál fue la última
  const resumen = useMemo(() => {
    const catDe = new Map(ejercicios.map((e) => [e.id, e]))
    const porCategoria = {}
    for (const a of actividad) {
      const e = catDe.get(a.ejercicio_id)
      const k = e?.categoria || 'otra'
      porCategoria[k] = (porCategoria[k] || 0) + 1
    }
    const ult = actividad[0] // vienen ordenadas de la más reciente a la más vieja
    const eUlt = ult ? catDe.get(ult.ejercicio_id) : null
    return { porCategoria, ultima: ult ? { cuando: ult.completado_en, nombre: eUlt?.nombre || 'un ejercicio que ya no está', categoria: eUlt?.categoria || null } : null }
  }, [ejercicios, actividad])

  const q = busqueda.trim().toLowerCase()
  const persona = (id) => personas[id] || { nombre: 'Cantante' }
  const coincide = (id) => !q || (persona(id).nombre || '').toLowerCase().includes(q) || (persona(id).voz || '').toLowerCase().includes(q)
  const ejerciciosVista = datos.ejercicios.filter((f) => !q || (f.ej.nombre || '').toLowerCase().includes(q) || [...f.cantantes.keys()].some(coincide))
  const cantantesVista = datos.cantantes.filter((c) => coincide(c.id) || [...c.ejercicios.keys()].some((id) => (datos.nombreEj(id) || '').toLowerCase().includes(q)))
  const maxEj = datos.ejercicios.reduce((m, f) => Math.max(m, f.total), 0)
  const maxCa = datos.cantantes.reduce((m, c) => Math.max(m, c.total), 0)
  const nPractican = datos.cantantes.length

  return (
    <div>
      <button onClick={() => navigate('/admin/entrenamiento')}
        style={{ background: 'none', border: 'none', padding: 0, marginBottom: '10px', fontSize: '13px', color: VERDE, cursor: 'pointer', fontWeight: 500 }}>
        ← Volver a Entrenamiento
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>🎶 Técnica vocal de los cantantes</h2>
        <button onClick={cargar} style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: VERDE, fontWeight: 500 }}>↻ Actualizar</button>
      </div>
      <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 14px' }}>
        Qué ejercicios practican y cuántas veces. Se cuenta cada vez que un cantante completa un ejercicio de Entrenamiento.
      </p>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
        {categorias.map((c) => <Pastilla key={c.id} activa={categoria === c.id} color={c.color} onClick={() => { setCategoria(c.id); setAbierto(null); setConfirmandoBorrado(false) }}>{c.label} · {resumen.porCategoria[c.id] || 0}</Pastilla>)}
      </div>
      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
        {PERIODOS.map((p) => <Pastilla key={p.id} activa={periodo === p.id} onClick={() => setPeriodo(p.id)}>{p.label}</Pastilla>)}
      </div>

      {error && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#501313', marginBottom: '12px' }}>{error}</div>}
      {aviso && !error && <div style={{ background: '#E1F5EE', border: '1px solid #9FD6C3', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#0B4F3F', marginBottom: '12px' }}>{aviso}</div>}
      {cargando && <div style={{ fontSize: '13px', color: '#888780' }}>Cargando…</div>}

      {!cargando && !error && (
        <>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '16px' }}>
            <Dato valor={datos.total} etiqueta={`${veces(datos.total).replace(/^\d+ /, '')} practicadas en total`} />
            <Dato valor={`${nPractican}${totalCantantes ? ` de ${totalCantantes}` : ''}`} etiqueta="cantantes que practicaron" />
            <Dato valor={datos.ejercicios.length} etiqueta={`ejercicios de ${cat.label.toLowerCase()} usados`} />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
            <Pastilla activa={vista === 'ejercicio'} onClick={() => { setVista('ejercicio'); setAbierto(null) }}>Por ejercicio</Pastilla>
            <Pastilla activa={vista === 'cantante'} onClick={() => { setVista('cantante'); setAbierto(null) }}>Por cantante</Pastilla>
            <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder={vista === 'ejercicio' ? 'Buscar ejercicio o cantante…' : 'Buscar cantante, cuerda o ejercicio…'}
              style={{ flex: '1 1 200px', minWidth: 0, boxSizing: 'border-box', padding: '8px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #D3D1C7' }} />
          </div>

          {datos.total === 0 && (
            <div style={{ fontSize: '13px', color: '#888780', padding: '28px 0', textAlign: 'center' }}>
              Nadie practicó ejercicios de {cat.label.toLowerCase()} en este período.
            </div>
          )}

          {datos.total === 0 && diag && (
            <div style={{ fontSize: '12px', color: '#5F5E5A', background: '#FFFFFF', border: '1px dashed #D3D1C7', borderRadius: '10px', padding: '10px 12px', marginBottom: '12px', lineHeight: 1.5 }}>
              <b>Diagnóstico:</b>{' '}
              {diag.errorCoro || diag.errorPropias
                ? `no se pudo contar la práctica (${diag.errorCoro || diag.errorPropias}).`
                : diag.coro > 0 && actividad.length === 0
                  ? `hay ${diag.coro} prácticas registradas en total en este coro, pero ninguna en este período: probá con "Todo".`
                  : diag.coro > 0
                    ? `hay ${diag.coro} prácticas registradas en el coro, pero ninguna es de ${cat.label.toLowerCase()} en este período (probá otra categoría o "Todo").${resumen.ultima ? ` La última práctica registrada fue «${resumen.ultima.nombre}»${resumen.ultima.categoria ? ` (${(categorias.find((c) => c.id === resumen.ultima.categoria)?.label || resumen.ultima.categoria).toLowerCase()})` : ''}, el ${fechaCorta(resumen.ultima.cuando)}.` : ''}`
                    : diag.propias > 0
                      ? `vos tenés ${diag.propias} prácticas registradas pero esta pantalla no las ve: falta correr actividad_entrenamiento_directores.sql en Supabase (o el coro de esas prácticas es otro).`
                      : 'todavía no hay ninguna práctica guardada en este coro. Un ejercicio solo cuenta cuando se completa hasta el final (no si lo frenás antes). Si ya completaste alguno y sigue en cero, el guardado está fallando.'}
            </div>
          )}

          {vista === 'ejercicio' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {ejerciciosVista.map((f) => {
                const id = `e-${f.ej.id}`
                const ab = abierto === id
                const quienes = [...f.cantantes.entries()].filter(([cid]) => coincide(cid) || (f.ej.nombre || '').toLowerCase().includes(q)).sort((a, b) => b[1].veces - a[1].veces)
                return (
                  <div key={f.ej.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
                    <div onClick={() => setAbierto(ab ? null : id)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{f.ej.nombre}{f.ej.activo === false && <span style={{ fontWeight: 400, color: '#B4B2A9' }}> · desactivado</span>}</div>
                        <div style={{ fontSize: '13px', color: cat.color, fontWeight: 700 }}>{veces(f.total)}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888780' }}>
                        {plural(f.cantantes.size, 'cantante', 'cantantes')} · última {fechaCorta(f.ultima)} <span style={{ color: '#B4B2A9' }}>{ab ? '▲' : '▼'}</span>
                      </div>
                      <Barra valor={f.total} max={maxEj} color={cat.color} />
                    </div>
                    {ab && (
                      <div style={{ borderTop: '1px solid #EEEBE1', padding: '8px 14px 10px', background: '#FBFAF6' }}>
                        {quienes.map(([cid, v]) => (
                          <div key={cid} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: '13px' }}>
                            <span style={{ color: '#1A1A18' }}>{persona(cid).nombre || 'Cantante'}{persona(cid).voz ? <span style={{ color: '#888780', textTransform: 'capitalize' }}> · {persona(cid).voz}</span> : null}</span>
                            <span style={{ color: '#5F5E5A', whiteSpace: 'nowrap' }}><b>{veces(v.veces)}</b> · {fechaCorta(v.ultima)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
              {datos.sinPracticar.length > 0 && !q && (
                <div style={{ marginTop: '8px', background: '#FFFFFF', border: '1px dashed #D3D1C7', borderRadius: '12px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#5F5E5A', marginBottom: '4px' }}>Sin practicar en este período</div>
                  <div style={{ fontSize: '12px', color: '#888780', lineHeight: 1.6 }}>{datos.sinPracticar.map((f) => f.ej.nombre).join(' · ')}</div>
                </div>
              )}
            </div>
          )}

          {vista === 'cantante' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {cantantesVista.map((c) => {
                const id = `c-${c.id}`
                const ab = abierto === id
                const p = persona(c.id)
                const ejs = [...c.ejercicios.entries()].sort((a, b) => b[1].veces - a[1].veces)
                return (
                  <div key={c.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
                    <div onClick={() => setAbierto(ab ? null : id)} style={{ padding: '12px 14px', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'baseline', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{p.nombre || 'Cantante'}{p.voz ? <span style={{ fontWeight: 400, color: '#888780', textTransform: 'capitalize' }}> · {p.voz}</span> : null}</div>
                        <div style={{ fontSize: '13px', color: cat.color, fontWeight: 700 }}>{veces(c.total)}</div>
                      </div>
                      <div style={{ fontSize: '12px', color: '#888780' }}>
                        {plural(c.ejercicios.size, 'ejercicio distinto', 'ejercicios distintos')} · {plural(c.dias.size, 'día', 'días')} · última {fechaCorta(c.ultima)} <span style={{ color: '#B4B2A9' }}>{ab ? '▲' : '▼'}</span>
                      </div>
                      <Barra valor={c.total} max={maxCa} color={cat.color} />
                    </div>
                    {ab && (
                      <div style={{ borderTop: '1px solid #EEEBE1', padding: '8px 14px 10px', background: '#FBFAF6' }}>
                        {ejs.map(([eid, v]) => (
                          <div key={eid} style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', padding: '4px 0', fontSize: '13px' }}>
                            <span style={{ color: '#1A1A18' }}>{datos.nombreEj(eid)}</span>
                            <span style={{ color: '#5F5E5A', whiteSpace: 'nowrap' }}><b>{veces(v.veces)}</b> · {fechaCorta(v.ultima)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {(resumen.porCategoria[categoria] || 0) > 0 && (
            <div style={{ marginTop: '24px', paddingTop: '14px', borderTop: '1px solid #E8E6DF' }}>
              {!confirmandoBorrado ? (
                <button onClick={() => { setAviso(''); setConfirmandoBorrado(true) }}
                  style={{ padding: '7px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #E5B5B2', background: '#FFFFFF', color: '#C0392B', cursor: 'pointer', fontWeight: 500 }}>
                  🗑 Borrar historial de {cat.label.toLowerCase()}…
                </button>
              ) : (
                <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontSize: '13px', color: '#501313', lineHeight: 1.5, marginBottom: '10px' }}>
                    Vas a borrar las <b>{plural(resumen.porCategoria[categoria], 'práctica', 'prácticas')}</b> de {cat.label.toLowerCase()} de todos los cantantes, de todo el tiempo (no solo del período que estás viendo). No se puede deshacer.
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    <button onClick={borrarHistorial} disabled={borrando}
                      style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '8px', border: 'none', background: '#C0392B', color: '#FFFFFF', cursor: 'pointer', fontWeight: 600, opacity: borrando ? 0.6 : 1 }}>
                      {borrando ? 'Borrando…' : 'Sí, borrar'}
                    </button>
                    <button onClick={() => setConfirmandoBorrado(false)} disabled={borrando}
                      style={{ padding: '7px 14px', fontSize: '13px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#FFFFFF', color: '#5F5E5A', cursor: 'pointer' }}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
