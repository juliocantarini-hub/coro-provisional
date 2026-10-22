import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'
import { NIVELES, EJERCICIOS_POR_NIVEL, APROBADO_PCT, estadoNiveles, estrellasPara } from '../../lib/ritmo'

// Progreso de ritmo de cada cantante, para directores y admins.
// Permite abrir todos los niveles de un cantante o reiniciar su progreso.

const VERDE = '#0F6E56'

function fechaCorta(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function colorPct(p) {
  if (p == null) return { fondo: '#F1EFE8', texto: '#888780' }
  if (p >= APROBADO_PCT) return { fondo: '#EAF3DE', texto: '#27500A' }
  if (p >= 50) return { fondo: '#FBF1CF', texto: '#5A4300' }
  return { fondo: '#FAE3E0', texto: '#7A1F17' }
}

function ChipsNiveles({ estado }) {
  return (
    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
      {estado.map((n) => (
        <span key={n.id} title={`Nivel ${n.id}: ${n.superado ? 'superado' : n.abierto ? `${n.aprobados} aprobados` : 'cerrado'}`}
          style={{
            width: '24px', height: '24px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            background: n.superado ? VERDE : n.abierto ? '#FBF1CF' : '#EAE7DD',
            color: n.superado ? '#FFFFFF' : n.abierto ? '#5A4300' : '#B4B2A9',
          }}>{n.id}</span>
      ))}
    </div>
  )
}

export default function RitmoAdmin() {
  const navigate = useNavigate()
  const [coro, setCoro] = useState(null)
  const [personas, setPersonas] = useState([])
  const [progreso, setProgreso] = useState([])
  const [ajustes, setAjustes] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abierta, setAbierta] = useState(null)
  const [trabajando, setTrabajando] = useState(null)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const c = await getCoroActual()
    if (!c) { setCargando(false); return }
    setCoro(c)
    const [per, pro, aju] = await Promise.all([
      supabase.from('perfiles').select('id, nombre, voz, rol').eq('coro_id', c.id),
      supabase.from('ritmo_progreso').select('perfil_id, nivel, ejercicio, mejor_pct, ultimo_pct, intentos, actualizado_en').eq('coro_id', c.id),
      supabase.from('ritmo_ajustes').select('perfil_id, nivel_hasta, reiniciado_en').eq('coro_id', c.id),
    ])
    if (pro.error || aju.error) {
      setError('No se pudo cargar el progreso. ¿Ya corriste ritmo_progreso.sql en Supabase?')
      setCargando(false)
      return
    }
    setPersonas(per.data || [])
    setProgreso(pro.data || [])
    const m = {}
    for (const a of aju.data || []) m[a.perfil_id] = a
    setAjustes(m)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filas = useMemo(() => {
    const q = busqueda.trim().toLowerCase()
    return personas
      .map((p) => {
        const propias = progreso.filter((f) => f.perfil_id === p.id)
        const hasta = ajustes[p.id]?.nivel_hasta || 0
        const estado = estadoNiveles(propias, hasta)
        const estrellas = propias.reduce((s, f) => s + estrellasPara(f.mejor_pct), 0)
        const ultimo = propias.reduce((u, f) => (!u || f.actualizado_en > u ? f.actualizado_en : u), null)
        const nivelActual = estado.find((n) => n.abierto && !n.superado)?.id ?? NIVELES.length
        return { p, propias, hasta, estado, estrellas, ultimo, nivelActual }
      })
      .filter((x) => !q || (x.p.nombre || '').toLowerCase().includes(q) || (x.p.voz || '').toLowerCase().includes(q))
      .sort((a, b) => (b.ultimo || '').localeCompare(a.ultimo || '') || (a.p.nombre || '').localeCompare(b.p.nombre || ''))
  }, [personas, progreso, ajustes, busqueda])

  async function guardarAjuste(perfilId, campos) {
    const fila = { perfil_id: perfilId, coro_id: coro.id, actualizado_en: new Date().toISOString(), ...campos }
    const previo = ajustes[perfilId]
    const { error: err } = await supabase.from('ritmo_ajustes').upsert(
      { nivel_hasta: previo?.nivel_hasta || 0, reiniciado_en: previo?.reiniciado_en || null, ...fila },
      { onConflict: 'perfil_id' },
    )
    if (err) throw err
    setAjustes((prev) => ({ ...prev, [perfilId]: { perfil_id: perfilId, nivel_hasta: fila.nivel_hasta ?? previo?.nivel_hasta ?? 0, reiniciado_en: fila.reiniciado_en ?? previo?.reiniciado_en ?? null } }))
  }

  async function desbloquearTodos(x) {
    setTrabajando(x.p.id); setError('')
    try { await guardarAjuste(x.p.id, { nivel_hasta: NIVELES.length }) } catch (e) { setError('No se pudo desbloquear: ' + (e.message || e)) }
    setTrabajando(null)
  }

  async function volverAProgresivo(x) {
    setTrabajando(x.p.id); setError('')
    try { await guardarAjuste(x.p.id, { nivel_hasta: 0 }) } catch (e) { setError('No se pudo cambiar: ' + (e.message || e)) }
    setTrabajando(null)
  }

  async function reiniciar(x) {
    if (!window.confirm(`¿Reiniciar el progreso de ritmo de ${x.p.nombre || 'este cantante'}?\n\nSe borran sus resultados y vuelve al nivel 1. Esto no se puede deshacer.`)) return
    setTrabajando(x.p.id); setError('')
    try {
      const { error: err } = await supabase.from('ritmo_progreso').delete().eq('coro_id', coro.id).eq('perfil_id', x.p.id)
      if (err) throw err
      await guardarAjuste(x.p.id, { nivel_hasta: 0, reiniciado_en: new Date().toISOString() })
      setProgreso((prev) => prev.filter((f) => f.perfil_id !== x.p.id))
    } catch (e) { setError('No se pudo reiniciar: ' + (e.message || e)) }
    setTrabajando(null)
  }

  const btn = (peligro) => ({
    padding: '7px 12px', fontSize: '12px', borderRadius: '8px', cursor: 'pointer', fontWeight: 500,
    border: `1px solid ${peligro ? '#C0392B' : VERDE}`, background: '#FFFFFF', color: peligro ? '#C0392B' : VERDE,
  })

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: '0 0 6px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: 0 }}>🥁 Ritmo de los cantantes</h2>
        <button onClick={() => navigate('/admin/entrenamiento')} style={btn(false)}>← Entrenamiento</button>
      </div>
      <p style={{ fontSize: '13px', color: '#888780', margin: '0 0 14px' }}>
        Cada cantante avanza nivel por nivel (aprobando {3} ejercicios con {APROBADO_PCT} % o más). Acá podés abrirle todos los niveles o reiniciar su progreso.
      </p>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o cuerda…"
        style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', fontSize: '13px', borderRadius: '8px', border: '1px solid #D3D1C7', marginBottom: '12px' }} />

      {error && <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: '#501313', marginBottom: '12px' }}>{error}</div>}
      {cargando && <div style={{ fontSize: '13px', color: '#888780' }}>Cargando…</div>}

      {!cargando && !error && filas.length === 0 && (
        <div style={{ fontSize: '13px', color: '#888780', padding: '30px 0', textAlign: 'center' }}>No hay cantantes para mostrar.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filas.map((x) => {
          const abiertaEsta = abierta === x.p.id
          const ocupado = trabajando === x.p.id
          return (
            <div key={x.p.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
              <div onClick={() => setAbierta(abiertaEsta ? null : x.p.id)}
                style={{ padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', cursor: 'pointer' }}>
                <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1A1A18' }}>{x.p.nombre || 'Cantante'}{x.p.voz ? <span style={{ fontWeight: 400, color: '#888780' }}> · {x.p.voz}</span> : null}</div>
                  <div style={{ fontSize: '12px', color: '#888780' }}>
                    {x.propias.length ? `Nivel ${x.nivelActual} · ★ ${x.estrellas} · último ${fechaCorta(x.ultimo)}` : 'Todavía no empezó'}
                    {x.hasta > 0 && <span style={{ color: '#B5791B', fontWeight: 600 }}> · niveles abiertos por el director</span>}
                  </div>
                </div>
                <ChipsNiveles estado={x.estado} />
              </div>

              {abiertaEsta && (
                <div style={{ borderTop: '1px solid #EEEBE1', padding: '12px 14px', background: '#FBFAF6' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', fontSize: '12px', minWidth: '320px' }}>
                      <thead>
                        <tr style={{ color: '#888780', textAlign: 'left' }}>
                          <th style={{ padding: '4px 10px 4px 0', fontWeight: 500 }}>Nivel</th>
                          {Array.from({ length: EJERCICIOS_POR_NIVEL }, (_, i) => <th key={i} style={{ padding: '4px 6px', fontWeight: 500, textAlign: 'center' }}>Ej. {i + 1}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {NIVELES.map((n, i) => (
                          <tr key={n.id} style={{ opacity: x.estado[i].abierto ? 1 : 0.5 }}>
                            <td style={{ padding: '3px 10px 3px 0', color: '#1A1A18', whiteSpace: 'nowrap' }}>{n.id}. {n.nombre}{x.estado[i].superado ? ' ✓' : ''}</td>
                            {Array.from({ length: EJERCICIOS_POR_NIVEL }, (_, k) => {
                              const f = x.propias.find((r) => r.nivel === n.id && r.ejercicio === k + 1)
                              const c = colorPct(f ? f.mejor_pct : null)
                              return (
                                <td key={k} style={{ padding: '3px 4px', textAlign: 'center' }}>
                                  <span title={f ? `${f.intentos} intento(s)` : 'sin hacer'} style={{ display: 'inline-block', minWidth: '40px', padding: '2px 4px', borderRadius: '6px', background: c.fondo, color: c.texto, fontWeight: 600 }}>
                                    {f ? `${f.mejor_pct}%` : '–'}
                                  </span>
                                </td>
                              )
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '12px' }}>
                    {x.hasta < NIVELES.length
                      ? <button disabled={ocupado} onClick={() => desbloquearTodos(x)} style={btn(false)}>🔓 Desbloquear todos los niveles</button>
                      : <button disabled={ocupado} onClick={() => volverAProgresivo(x)} style={btn(false)}>🔒 Volver a desbloqueo por avance</button>}
                    <button disabled={ocupado} onClick={() => reiniciar(x)} style={btn(true)}>↺ Reiniciar progreso</button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
