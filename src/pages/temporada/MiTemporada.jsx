import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import HistoriasTemporada from '../../components/temporada/HistoriasTemporada'
import { cargarReporte, marcarReporteVisto, marcarAvisoMostrado } from '../../hooks/useReporteTemporada'

// /temporada/:id — el reporte de temporada del cantante, en pantalla completa.
// También es el destino de la notificación push al publicarlo.
export default function MiTemporada() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [reporte, setReporte] = useState(null)
  const [estado, setEstado] = useState('cargando')

  useEffect(() => {
    let vivo = true
    cargarReporte(id).then(r => {
      if (!vivo) return
      if (!r.ok) { setEstado('no'); return }
      setReporte(r.data)
      setEstado('ok')
      marcarAvisoMostrado(r.data.id)
      if (r.data.estado === 'publicado' && !r.data.visto_en) marcarReporteVisto(r.data.id)
    })
    return () => { vivo = false }
  }, [id])

  function cerrar() {
    if (window.history.length > 1) navigate(-1)
    else navigate('/', { replace: true })
  }

  if (estado === 'cargando') return <p style={{ color: '#888780', fontSize: '13px' }}>Cargando…</p>
  if (estado === 'no') {
    return (
      <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '14px', padding: '22px' }}>
        <p style={{ margin: '0 0 12px', fontSize: '14px', color: '#1A1A18' }}>Este reporte no está disponible.</p>
        <button onClick={() => navigate('/')} style={{ background: '#0F6E56', color: '#FFFFFF', border: 'none', borderRadius: '8px', padding: '8px 14px', cursor: 'pointer' }}>Ir a Inicio</button>
      </div>
    )
  }
  return <HistoriasTemporada reporte={reporte} onCerrar={cerrar} />
}
