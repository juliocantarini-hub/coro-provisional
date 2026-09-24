import { useState, useMemo, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useEventos, formatFecha, formatHora, diasRestantes } from '../../hooks/useEventos'
import { useAuth } from '../../hooks/useAuth'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

const TIPOS = [
  { valor: '',          label: 'Todos' },
  { valor: 'ensayo',    label: 'Ensayos' },
  { valor: 'concierto', label: 'Conciertos' },
  { valor: 'reunion',   label: 'Reuniones' },
  { valor: 'extra',     label: 'Otros' },
]

const TIPO_COLOR = {
  ensayo:    { bg: '#E1F5EE', color: '#04342C', dot: '#1D9E75' },
  concierto: { bg: '#FAECE7', color: '#712B13', dot: '#D85A30' },
  reunion:   { bg: '#E6F1FB', color: '#042C53', dot: '#378ADD' },
  extra:     { bg: '#F1EFE8', color: '#5F5E5A', dot: '#888780' },
}

const DIAS_SEMANA = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do']
const MESES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']

export default function Calendario() {
  const navigate   = useNavigate()
  const { perfil } = useAuth()
  const hoy        = new Date()

  const [vista, setVista]           = useState('lista')
  const [tipoFiltro, setTipoFiltro] = useState('')
  const [mes, setMes]               = useState(hoy.getMonth())
  const [anio, setAnio]             = useState(hoy.getFullYear())
  const [cantantes, setCantantes]   = useState([])

  const { eventos, cargando, error, recargar } = useEventos({
    tipo: tipoFiltro || undefined,
    soloFuturos: vista === 'lista',
    mes: vista === 'mes' ? mes : undefined,
    anio: vista === 'mes' ? anio : undefined,
  })

  // Cargar cantantes para mostrar cumpleaños
  useEffect(() => {
    getCoroActual().then(coro => {
      supabase
        .from('perfiles')
        .select('id, nombre, fecha_nacimiento')
        .eq('estado', 'activo')
        .eq('coro_id', coro.id)
        .not('fecha_nacimiento', 'is', null)
        .then(({ data }) => setCantantes(data || []))
    })
  }, [])

  // Cumpleaños por día del mes actual
  const cumpleaniosPorDia = useMemo(() => {
    const map = {}
    cantantes.forEach(c => {
      if (!c.fecha_nacimiento) return
      const nac = new Date(c.fecha_nacimiento + 'T12:00:00')
      if (nac.getMonth() === mes) {
        const dia = nac.getDate()
        const key = `${anio}-${String(mes + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
        if (!map[key]) map[key] = []
        map[key].push(c)
      }
    })
    return map
  }, [cantantes, mes, anio])

  const celdasMes = useMemo(() => {
    const primerDia = new Date(anio, mes, 1)
    const ultimoDia = new Date(anio, mes + 1, 0)
    let offset = primerDia.getDay() - 1
    if (offset < 0) offset = 6
    const celdas = []
    for (let i = offset - 1; i >= 0; i--) {
      const d = new Date(anio, mes, -i)
      celdas.push({ fecha: d, mesActual: false })
    }
    for (let d = 1; d <= ultimoDia.getDate(); d++) {
      celdas.push({ fecha: new Date(anio, mes, d), mesActual: true })
    }
    while (celdas.length < 42) {
      const ultimo = celdas[celdas.length - 1].fecha
      const sig = new Date(ultimo)
      sig.setDate(sig.getDate() + 1)
      celdas.push({ fecha: sig, mesActual: false })
    }
    return celdas
  }, [mes, anio])

  const eventosPorDia = useMemo(() => {
    const map = {}
    eventos.forEach(ev => {
      const key = new Date(ev.fecha_inicio).toISOString().slice(0, 10)
      if (!map[key]) map[key] = []
      map[key].push(ev)
    })
    return map
  }, [eventos])

  function navMes(delta) {
    let nuevoMes = mes + delta
    let nuevoAnio = anio
    if (nuevoMes < 0)  { nuevoMes = 11; nuevoAnio-- }
    if (nuevoMes > 11) { nuevoMes = 0;  nuevoAnio++ }
    setMes(nuevoMes)
    setAnio(nuevoAnio)
  }

  function esHoy(fecha) {
    return fecha.toDateString() === hoy.toDateString()
  }

  function miAsistencia(evento) {
    if (!perfil) return 'pendiente'
    const a = evento.asistencias?.find(a => a.perfil_id === perfil.id)
    return a?.estado || 'pendiente'
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '22px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
            Calendario
          </h2>
          <p style={{ fontSize: '13px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${eventos.length} evento${eventos.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div style={{ display: 'flex', border: '1px solid #D3D1C7', borderRadius: '8px', overflow: 'hidden' }}>
          {['lista', 'mes'].map(v => (
            <button key={v} onClick={() => setVista(v)} style={{
              padding: '6px 14px', fontSize: '13px', cursor: 'pointer',
              border: 'none', background: vista === v ? '#0F6E56' : '#FFFFFF',
              color: vista === v ? '#FFFFFF' : '#5F5E5A', fontWeight: vista === v ? '500' : '400',
            }}>
              {v === 'lista' ? 'Lista' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: '6px', marginBottom: '16px', flexWrap: 'wrap' }}>
        {TIPOS.map(t => (
          <button key={t.valor} onClick={() => setTipoFiltro(t.valor)} style={{
            padding: '4px 12px', borderRadius: '20px', fontSize: '12px', cursor: 'pointer',
            border: `1px solid ${tipoFiltro === t.valor ? '#1D9E75' : '#D3D1C7'}`,
            background: tipoFiltro === t.valor ? '#E1F5EE' : 'none',
            color: tipoFiltro === t.valor ? '#04342C' : '#5F5E5A',
            fontWeight: tipoFiltro === t.valor ? '500' : '400',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div style={{ background: '#FCEBEB', border: '1px solid #E24B4A', borderRadius: '8px', padding: '12px 14px', fontSize: '13px', color: '#501313', marginBottom: '16px', display: 'flex', justifyContent: 'space-between' }}>
          {error}
          <button onClick={recargar} style={{ background: 'none', border: 'none', color: '#A32D2D', cursor: 'pointer', fontWeight: '500', fontSize: '12px' }}>Reintentar</button>
        </div>
      )}

      {/* VISTA MES */}
      {vista === 'mes' && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <button onClick={() => navMes(-1)} style={navBtnStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
            </button>
            <span style={{ fontFamily: 'Georgia, serif', fontSize: '17px', color: '#1A1A18' }}>
              {MESES[mes]} {anio}
            </span>
            <button onClick={() => navMes(1)} style={navBtnStyle}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
            </button>
          </div>

          <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E8E6DF' }}>
              {DIAS_SEMANA.map(d => (
                <div key={d} style={{ textAlign: 'center', padding: '8px 4px', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase' }}>
                  {d}
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
              {celdasMes.map((celda, i) => {
                const key = celda.fecha.toISOString().slice(0, 10)
                const evsDia = eventosPorDia[key] || []
                const cumpleDia = cumpleaniosPorDia[key] || []
                const hoyQ = esHoy(celda.fecha)
                return (
                  <div key={i} style={{
                    minHeight: '72px', padding: '6px',
                    borderRight: (i + 1) % 7 !== 0 ? '1px solid #F1EFE8' : 'none',
                    borderBottom: i < 35 ? '1px solid #F1EFE8' : 'none',
                    background: !celda.mesActual ? '#F8F7F3' : '#FFFFFF',
                  }}>
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
                      alignItems: 'center', justifyContent: 'center', marginBottom: '4px',
                      background: hoyQ ? '#0F6E56' : 'none',
                      fontSize: '12px', fontWeight: hoyQ ? '600' : '400',
                      color: hoyQ ? '#FFFFFF' : celda.mesActual ? '#1A1A18' : '#D3D1C7',
                    }}>
                      {celda.fecha.getDate()}
                    </div>
                    {evsDia.slice(0, 2).map(ev => {
                      const tc = TIPO_COLOR[ev.tipo] || TIPO_COLOR.extra
                      return (
                        <div key={ev.id} onClick={() => navigate(`/calendario/${ev.id}`)}
                          style={{ fontSize: '9px', background: tc.bg, color: tc.color, borderRadius: '3px', padding: '2px 4px', marginBottom: '2px', cursor: 'pointer', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: '500' }}>
                          {ev.titulo}
                        </div>
                      )
                    })}
                    {evsDia.length > 2 && (
                      <div style={{ fontSize: '9px', color: '#888780' }}>+{evsDia.length - 2}</div>
                    )}
                    {/* Cumpleaños */}
                    {cumpleDia.map(c => (
                      <div key={c.id}
                        style={{ fontSize: '10px', background: '#FFE4B8', color: '#8A3B00', border: '1px solid #F5B95B', borderRadius: '3px', padding: '2px 4px', marginBottom: '2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis', fontWeight: '700' }}
                        title={`🎂 Cumpleaños de ${c.nombre}`}>
                        🎂 {c.nombre}
                      </div>
                    ))}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Leyenda */}
          <div style={{ display: 'flex', gap: '14px', marginTop: '10px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#FFF3E0', border: '1px solid #FFB74D' }} />
              <span style={{ fontSize: '11px', color: '#888780' }}>Cumpleaños</span>
            </div>
          </div>
        </div>
      )}

      {/* VISTA LISTA */}
      {vista === 'lista' && (
        <div>
          {cargando && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {[1,2,3].map(i => <div key={i} style={{ height: '88px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
              <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
            </div>
          )}

          {!cargando && eventos.length === 0 && (
            <div style={{ textAlign: 'center', padding: '48px 24px', color: '#888780' }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="#D3D1C7" style={{ marginBottom: '12px' }}>
                <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
              </svg>
              <p style={{ fontSize: '14px', margin: 0 }}>No hay eventos próximos.</p>
            </div>
          )}

          {!cargando && eventos.map(ev => {
            const tc = TIPO_COLOR[ev.tipo] || TIPO_COLOR.extra
            const dias = diasRestantes(ev.fecha_inicio)
            const asist = miAsistencia(ev)
            return (
              <div key={ev.id} onClick={() => navigate(`/calendario/${ev.id}`)}
                style={{
                  background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px',
                  padding: '14px 16px', marginBottom: '10px', cursor: 'pointer',
                  display: 'flex', gap: '14px', alignItems: 'center',
                  transition: 'border-color 0.12s, box-shadow 0.12s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = '#B4D8CE'; e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.05)' }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = '#E8E6DF'; e.currentTarget.style.boxShadow = 'none' }}
              >
                <div style={{ width: '48px', flexShrink: 0, textAlign: 'center', background: tc.bg, borderRadius: '10px', padding: '8px 4px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '600', color: tc.color, lineHeight: 1 }}>
                    {new Date(ev.fecha_inicio).getDate()}
                  </div>
                  <div style={{ fontSize: '10px', color: tc.color, textTransform: 'uppercase', letterSpacing: '0.3px', marginTop: '2px' }}>
                    {MESES[new Date(ev.fecha_inicio).getMonth()].slice(0, 3)}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{ev.titulo}</span>
                    <span style={{ fontSize: '10px', background: tc.bg, color: tc.color, padding: '2px 7px', borderRadius: '10px', fontWeight: '600' }}>
                      {ev.tipo}
                    </span>
                    {dias === 0 && <span style={{ fontSize: '10px', color: '#D85A30', fontWeight: '600' }}>Hoy</span>}
                    {dias === 1 && <span style={{ fontSize: '10px', color: '#D85A30', fontWeight: '600' }}>Mañana</span>}
                    {dias > 1 && dias <= 7 && <span style={{ fontSize: '10px', color: '#888780' }}>en {dias} días</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: '#888780' }}>
                    {formatHora(ev.fecha_inicio)}
                    {ev.fecha_fin && ` – ${formatHora(ev.fecha_fin)}`}
                    {ev.lugar && <> · {ev.lugar}</>}
                  </div>
                </div>
                <AsistenciaPill estado={asist} />
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#D3D1C7" style={{ flexShrink: 0 }}>
                  <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
                </svg>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AsistenciaPill({ estado }) {
  const map = {
    confirmado: { bg: '#EAF3DE', color: '#27500A', txt: 'Asistiré ✓' },
    no_asiste:  { bg: '#FCEBEB', color: '#501313', txt: 'No asistiré' },
    pendiente:  { bg: '#F1EFE8', color: '#888780', txt: 'Pendiente' },
  }
  const s = map[estado] || map.pendiente
  return (
    <span style={{ fontSize: '11px', background: s.bg, color: s.color, padding: '3px 8px', borderRadius: '8px', fontWeight: '500', flexShrink: 0 }}>
      {s.txt}
    </span>
  )
}

const navBtnStyle = {
  width: '32px', height: '32px', borderRadius: '8px',
  border: '1px solid #D3D1C7', background: '#FFFFFF',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  color: '#5F5E5A',
}