import { useEncuestasCantante, useEncuestaPorId } from '../hooks/useEncuestas'
import EncuestaWidget from '../components/EncuestaWidget'

function EncuestaCantanteItem({ encuestaId }) {
  const { encuesta, resultados, miVoto, votar } = useEncuestaPorId(encuestaId)

  if (!encuesta) return null

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8E6DF', borderRadius: '12px', padding: '16px', marginBottom: '14px' }}>
      <EncuestaWidget
        encuesta={encuesta}
        resultados={resultados}
        miVoto={miVoto}
        votar={votar}
      />
    </div>
  )
}

export default function Encuestas() {
  const { encuestas, cargando } = useEncuestasCantante()

  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <h2 style={{ fontFamily: 'Georgia, serif', fontSize: '20px', fontWeight: 'normal', color: '#1A1A18', margin: '0 0 2px' }}>
          Encuestas
        </h2>
        <p style={{ fontSize: '12px', color: '#888780', margin: 0 }}>
          {cargando ? 'Cargando...' : `${encuestas.length} encuesta${encuestas.length !== 1 ? 's' : ''}`}
        </p>
      </div>

      {cargando && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {[1, 2].map(i => <div key={i} style={{ height: '90px', background: '#F1EFE8', borderRadius: '12px', animation: 'pulse 1.5s ease-in-out infinite' }} />)}
          <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:0.5}}`}</style>
        </div>
      )}

      {!cargando && encuestas.length === 0 && (
        <div style={{ textAlign: 'center', padding: '32px', color: '#888780', fontSize: '13px' }}>
          Todavía no hay encuestas.
        </div>
      )}

      {!cargando && encuestas.map(e => (
        <EncuestaCantanteItem key={e.id} encuestaId={e.id} />
      ))}
    </div>
  )
}
