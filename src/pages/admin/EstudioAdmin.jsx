import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { getCoroActual } from '../../lib/coro'

function useEsMovil() {
  return window.innerWidth <= 768
}

export default function EstudioAdmin() {
  const [datos, setDatos]       = useState([])
  const [cargando, setCargando] = useState(true)
  const [totalObras, setTotalObras] = useState(0)
  const [busqueda, setBusqueda] = useState('')
  const esMovil = useEsMovil()

  const cargar = useCallback(async () => {
    setCargando(true)

    const coro = await getCoroActual()
    if (!coro) { setCargando(false); return }

    const { count: countObras } = await supabase
      .from('obras')
      .select('*', { count: 'exact', head: true })
      .eq('coro_id', coro.id)
      .eq('publicada', true)

    setTotalObras(countObras || 0)

    const { data: cantantes } = await supabase
      .from('perfiles')
      .select('id, nombre, voz')
      .eq('rol', 'cantante')
      .eq('estado', 'activo')
      .eq('coro_id', coro.id)
      .order('nombre')

    if (!cantantes || cantantes.length === 0) {
      setDatos([])
      setCargando(false)
      return
    }

    const { data: resumen } = await supabase
      .rpc('get_actividad_estudio_resumen', { p_coro_id: coro.id })

    const resumenMap = {}
    for (const r of resumen || []) {
      resumenMap[r.usuario_id] = r
    }

    const stats = cantantes.map(c => {
      const r = resumenMap[c.id]
      const obrasUnicas   = r ? Number(r.obras_unicas)   : 0
      const totalEntradas = r ? Number(r.total_entradas) : 0

      const pctCobertura      = countObras > 0 ? (obrasUnicas / countObras) * 100 : 0
      const promedioAperturas = obrasUnicas > 0 ? totalEntradas / obrasUnicas : 0
      const pctFrecuencia     = Math.min((promedioAperturas / 30) * 100, 100)
      const porcentaje        = Math.min(100, Math.round((pctCobertura + pctFrecuencia) / 2))

      return {
        ...c,
        obrasVisitadas: obrasUnicas,
        totalEntradas,
        porcentaje,
      }
    })

    stats.sort((a, b) => b.porcentaje - a.porcentaje)
    setDatos(stats)
    setCargando(false)
  }, [])

  useEffect(() => { cargar() }, [cargar])

  const filtrados = datos.filter(d =>
    !busqueda ||
    d.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    d.voz?.toLowerCase().includes(busqueda.toLowerCase())
  )

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>Actividad de estudio</h2>
          <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
            {cargando ? 'Cargando...' : `${datos.length} cantante${datos.length !== 1 ? 's' : ''} · ${totalObras} obras en repertorio`}
          </p>
        </div>
        <button onClick={cargar}
          style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '8px', border: '1px solid #D3D1C7', background: 'none', cursor: 'pointer', color: '#0F6E56', fontWeight: '500' }}>
          ↻ Actualizar
        </button>
      </div>

      <div style={{ position: 'relative', marginBottom: '16px', maxWidth: '320px' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="#B4B2A9" style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)' }}>
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
        </svg>
        <input value={busqueda} onChange={e => setBusqueda(e.target.value)} placeholder="Buscar cantante..."
          style={{ width: '100%', height: '36px', border: '1px solid #D3D1C7', borderRadius: '8px', padding: '0 12px 0 32px', fontSize: '13px', outline: 'none', background: '#FFFFFF', boxSizing: 'border-box' }} />
      </div>

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1,2,3,4].map(i => <div key={i} style={{ height: '72px', background: '#F1EFE8', borderRadius: '10px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {/* MÓVIL: tarjetas */}
      {!cargando && esMovil && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filtrados.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>Sin datos aún.</div>
          )}
          {filtrados.map(d => (
            <div key={d.id} style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: '500', color: '#1A1A18' }}>{d.nombre || '—'}</div>
                  <div style={{ fontSize: '12px', color: '#888780', marginTop: '2px', textTransform: 'capitalize' }}>{d.voz || '—'}</div>
                </div>
                <PorcentajeBadge valor={d.porcentaje} />
              </div>
              <BarraProgreso valor={d.porcentaje} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '10px' }}>
                <Stat label="Obras visitadas" valor={`${d.obrasVisitadas}/${totalObras}`} />
                <Stat label="Total entradas" valor={d.totalEntradas} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* DESKTOP: tabla */}
      {!cargando && !esMovil && (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 120px 120px', padding: '10px 16px', background: '#F8F7F3', borderBottom: '1px solid #E8E6DF', fontSize: '11px', fontWeight: '600', color: '#888780', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <span>Cantante</span>
            <span>% Estudio</span>
            <span>Progreso</span>
            <span>Obras visitadas</span>
            <span>Total entradas</span>
          </div>
          {filtrados.length === 0 && (
            <div style={{ padding: '32px', textAlign: 'center', color: '#888780', fontSize: '13px' }}>Sin datos aún. Los registros aparecerán cuando los cantantes estudien.</div>
          )}
          {filtrados.map((d, i) => (
            <div key={d.id} style={{ display: 'grid', gridTemplateColumns: '1fr 100px 140px 120px 120px', padding: '12px 16px', alignItems: 'center', borderBottom: i < filtrados.length - 1 ? '1px solid #F1EFE8' : 'none' }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '500', color: '#1A1A18' }}>{d.nombre || '—'}</div>
                <div style={{ fontSize: '11px', color: '#888780', textTransform: 'capitalize', marginTop: '1px' }}>{d.voz || '—'}</div>
              </div>
              <PorcentajeBadge valor={d.porcentaje} />
              <div style={{ paddingRight: '12px' }}>
                <BarraProgreso valor={d.porcentaje} />
              </div>
              <span style={{ fontSize: '12px', color: '#5F5E5A' }}>{d.obrasVisitadas} de {totalObras}</span>
              <span style={{ fontSize: '12px', color: '#5F5E5A' }}>{d.totalEntradas}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BarraProgreso({ valor }) {
  const color = valor >= 70 ? '#27500A' : valor >= 40 ? '#D85A30' : '#B4B2A9'
  const bg    = valor >= 70 ? '#EAF3DE' : valor >= 40 ? '#FAECE7' : '#F1EFE8'
  return (
    <div style={{ height: '6px', background: bg, borderRadius: '4px', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${valor}%`, background: color, borderRadius: '4px', transition: 'width 0.4s ease' }} />
    </div>
  )
}

function PorcentajeBadge({ valor }) {
  const color = valor >= 70 ? '#27500A' : valor >= 40 ? '#712B13' : '#888780'
  const bg    = valor >= 70 ? '#EAF3DE' : valor >= 40 ? '#FAECE7' : '#F1EFE8'
  return (
    <span style={{ background: bg, color, fontSize: '12px', fontWeight: '700', padding: '3px 10px', borderRadius: '10px', whiteSpace: 'nowrap' }}>
      {valor}%
    </span>
  )
}

function Stat({ label, valor }) {
  return (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A18' }}>{valor}</div>
      <div style={{ fontSize: '10px', color: '#B4B2A9', marginTop: '1px' }}>{label}</div>
    </div>
  )
}