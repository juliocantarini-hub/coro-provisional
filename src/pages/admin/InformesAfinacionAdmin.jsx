import { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

// Informes de "Grabarme y ver informe" de cada cantante, solo para directores y admins.
// Se guarda un resumen en números (nunca el audio) cada vez que un cantante termina un informe.

const COLOR = {
  verde: { fondo: '#EAF3DE', texto: '#27500A', barra: '#3FAE83' },
  amarillo: { fondo: '#FBF1CF', texto: '#5A4300', barra: '#E9BF45' },
  rojo: { fondo: '#FAE3E0', texto: '#7A1F17', barra: '#E8756B' },
  neutro: { fondo: '#F1EFE8', texto: '#5F5E5A', barra: '#B9B7AC' },
}
const estadoPct = (v) => (v == null ? 'neutro' : v >= 70 ? 'verde' : v >= 40 ? 'amarillo' : 'rojo')

function fechaCorta(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function Badge({ etiqueta, valor }) {
  const c = COLOR[estadoPct(valor)]
  return (
    <span style={{ background: c.fondo, color: c.texto, fontSize: '12px', fontWeight: 700, padding: '3px 9px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
      {etiqueta} {valor == null ? '–' : `${valor}%`}
    </span>
  )
}

function promedio(lista) {
  const v = lista.filter((x) => x != null)
  return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null
}

export default function InformesAfinacionAdmin() {
  const navigate = useNavigate()
  const [informes, setInformes] = useState([])
  const [personas, setPersonas] = useState({})
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abiertoPersona, setAbiertoPersona] = useState(null)
  const [abiertoInforme, setAbiertoInforme] = useState(null)
  const [copiado, setCopiado] = useState(null)
  const [reseteando, setReseteando] = useState(false)

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    const coro = await getCoroActual()
    if (!coro) { setCargando(false); return }
    const { data, error: err } = await supabase
      .from('informes_afinacion')
      .select('id, perfil_id, obra_titulo, voz, compas_desde, compas_hasta, pct_afinacion, pct_ritmo, corrimiento_cents, confianza, dudosa, compases, mensajes, creado_en')
      .eq('coro_id', coro.id)
      .order('creado_en', { ascending: false })
      .limit(400)
    if (err) {
      setError('No se pudieron cargar los informes. ¿Ya corriste informes_afinacion.sql en Supabase?')
      setCargando(false)
      return
    }
    setInformes(data || [])
    const ids = [...new Set((data || []).map((i) => i.perfil_id))]
    if (ids.length) {
      const { data: perfiles } = await supabase.from('perfiles').select('id, nombre, voz').in('id', ids)
      const mapa = {}
      for (const p of perfiles || []) mapa[p.id] = p
      setPersonas(mapa)
    }
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const grupos = useMemo(() => {
    const porPersona = new Map()
    for (const i of informes) {
      if (!porPersona.has(i.perfil_id)) porPersona.set(i.perfil_id, [])
      porPersona.get(i.perfil_id).push(i)
    }
    const q = busqueda.trim().toLowerCase()
    return [...porPersona.entries()]
      .map(([id, lista]) => ({ id, persona: personas[id] || { nombre: 'Cantante' }, lista }))
      .filter((g) => !q || (g.persona.nombre || '').toLowerCase().includes(q) || (g.persona.voz || '').toLowerCase().includes(q))
      .sort((a, b) => new Date(b.lista[0].creado_en) - new Date(a.lista[0].creado_en))
  }, [informes, personas, busqueda])

  async function borrar(id) {
    if (!window.confirm('¿Borrar este informe?')) return
    const { error: err } = await supabase.from('informes_afinacion').delete().eq('id', id)
    if (!err) setInformes((prev) => prev.filter((i) => i.id !== id))
  }

  // Resetear: borra TODOS los informes guardados del coro (por ejemplo para empezar de cero después de cambiar los márgenes).
  async function resetear() {
    if (!informes.length) return
    const ok = window.confirm(`¿Borrar los ${informes.length} informe${informes.length !== 1 ? 's' : ''} de todos los cantantes?\n\nEsto no se puede deshacer. Los cantantes no pierden nada: ellos no guardan historial.`)
    if (!ok) return
    setReseteando(true)
    setError('')
    const coro = await getCoroActual()
    if (!coro) { setReseteando(false); return }
    const { error: err } = await supabase.from('informes_afinacion').delete().eq('coro_id', coro.id)
    setReseteando(false)
    if (err) { setError('No se pudieron borrar los informes: ' + err.message); return }
    setInformes([])
    setPersonas({})
    setAbiertoPersona(null)
    setAbiertoInforme(null)
  }

  async function copiarDiagnostico(id) {
    const { data } = await supabase.from('informes_afinacion').select('diagnostico').eq('id', id).single()
    const texto = JSON.stringify(data?.diagnostico ?? null)
    try { await navigator.clipboard.writeText(texto); setCopiado(id); setTimeout(() => setCopiado(null), 2500) } catch { window.prompt('Copiá el diagnóstico:', texto) }
  }

  return (
    <div>
      <button onClick={() => navigate('/admin/entrenamiento')}
        style={{ background: 'none', border: 'none', padding: 0, marginBottom: '10px', fontSize: '13px', color: '#0F6E56', cursor: 'pointer', fontWeight: 500 }}>
        ← Volver a Entrenamiento
      </button>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>Informes de afinación</h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${informes.length} informe${informes.length !== 1 ? 's' : ''} · ${grupos.length} cantante${grupos.length !== 1 ? 's' : ''}`}
            {' · '}Se guarda un resumen en números; nunca el audio. Los cantantes no ven este historial.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <button onClick={cargar} style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: 500 }}>↻ Actualizar</button>
          <button onClick={resetear} disabled={reseteando || !informes.length}
            style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #E8B4AE', background: 'none', cursor: informes.length ? 'pointer' : 'default', color: '#A32D2D', fontWeight: 500, opacity: informes.length ? 1 : 0.5 }}>
            {reseteando ? 'Borrando…' : 'Resetear informes'}
          </button>
        </div>
      </div>

      <input value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar cantante o cuerda..."
        style={{ width: '100%', maxWidth: '320px', height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px', fontSize: '13px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box', marginBottom: '16px' }} />

      {error && <div style={{ padding: '14px', background: '#FAE3E0', color: '#7A1F17', borderRadius: '10px', fontSize: '13px' }}>{error}</div>}
      {!cargando && !error && grupos.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>Todavía no hay informes. Aparecerán cuando los cantantes usen “Grabarme y ver informe”.</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {grupos.map((g) => {
          const ultimos = g.lista.slice(0, 3)
          const abierto = abiertoPersona === g.id
          return (
            <div key={g.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
              <button onClick={() => setAbiertoPersona(abierto ? null : g.id)}
                style={{ width: '100%', textAlign: 'left', padding: '12px 14px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: '#1A1A18' }}>{g.persona.nombre || '—'}</div>
                  <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize' }}>
                    {g.persona.voz || '—'} · {g.lista.length} informe{g.lista.length !== 1 ? 's' : ''} · último {fechaCorta(g.lista[0].creado_en)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <Badge etiqueta="Afinación" valor={promedio(ultimos.map((i) => i.pct_afinacion))} />
                  <Badge etiqueta="Ritmo" valor={promedio(ultimos.map((i) => i.pct_ritmo))} />
                  <span style={{ color: '#B4B2A9', fontSize: '12px' }}>{abierto ? '▲' : '▼'}</span>
                </div>
              </button>
              {abierto && (
                <div style={{ borderTop: '1px solid #F1EFE8' }}>
                  <div style={{ padding: '6px 14px', fontSize: '10px', color: '#B4B2A9' }}>Los porcentajes de arriba son el promedio de los últimos 3 informes.</div>
                  {g.lista.map((i) => {
                    const ab = abiertoInforme === i.id
                    return (
                      <div key={i.id} style={{ borderTop: '1px solid #F1EFE8' }}>
                        <button onClick={() => setAbiertoInforme(ab ? null : i.id)}
                          style={{ width: '100%', textAlign: 'left', padding: '10px 14px', background: ab ? '#FAFAF6' : 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ fontSize: '12px', color: '#3D3D3A' }}>
                            <strong>{fechaCorta(i.creado_en)}</strong> · {i.obra_titulo || 'Obra'} · compases {i.compas_desde}–{i.compas_hasta}
                          </div>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            {i.dudosa ? <span style={{ fontSize: '11px', color: '#5A4300', background: COLOR.amarillo.fondo, padding: '2px 8px', borderRadius: '8px' }}>no se pudo seguir</span> : (<><Badge etiqueta="Afinación" valor={i.pct_afinacion} /><Badge etiqueta="Ritmo" valor={i.pct_ritmo} /></>)}
                          </div>
                        </button>
                        {ab && (
                          <div style={{ padding: '4px 14px 14px', fontSize: '12px', color: '#3D3D3A' }}>
                            {i.corrimiento_cents != null && Math.abs(i.corrimiento_cents) >= 25 && (
                              <div style={{ marginBottom: '8px' }}>Afinación general: <strong>{i.corrimiento_cents > 0 ? '+' : ''}{i.corrimiento_cents} cents</strong> respecto de lo escrito.</div>
                            )}
                            {Array.isArray(i.mensajes) && i.mensajes.length > 0 && (
                              <ul style={{ margin: '0 0 10px', paddingLeft: '18px', lineHeight: 1.5 }}>
                                {i.mensajes.map((m, k) => <li key={k}>{m}</li>)}
                              </ul>
                            )}
                            {Array.isArray(i.compases) && i.compases.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '10px' }}>
                                {i.compases.map((c) => (
                                  <div key={c.compas} style={{ width: '42px', padding: '3px 0 5px', border: '1px solid #D3D1C7', borderRadius: '8px', textAlign: 'center', background: '#fff' }}>
                                    <div style={{ fontSize: '11px', fontWeight: 600 }}>{c.compas}</div>
                                    <div style={{ height: '7px', margin: '2px 5px', borderRadius: '4px', background: (COLOR[c.estado] || COLOR.neutro).barra }} />
                                    <div style={{ height: '7px', margin: '0 5px', borderRadius: '4px', background: (COLOR[c.estadoRitmo || 'neutro'] || COLOR.neutro).barra }} />
                                  </div>
                                ))}
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                              <button onClick={() => copiarDiagnostico(i.id)} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: '#fff', cursor: 'pointer' }}>
                                {copiado === i.id ? '¡Copiado!' : '📋 Copiar diagnóstico'}
                              </button>
                              <button onClick={() => borrar(i.id)} style={{ padding: '6px 12px', fontSize: '12px', borderRadius: '8px', border: '1px solid #E8B4AE', background: '#fff', color: '#A32D2D', cursor: 'pointer' }}>Borrar</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
