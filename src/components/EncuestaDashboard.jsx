import { useEncuestaActiva, useCrearEncuesta } from '../hooks/useEncuestas'
import EncuestaWidget from './EncuestaWidget'

export default function EncuestaDashboard({ esAdmin = false }) {
  const { encuesta, resultados, miVoto, votar, cargando, recargar } = useEncuestaActiva()
  const { cerrarEncuesta } = useCrearEncuesta()

  if (cargando || !encuesta) return null

  async function handleCerrar() {
    await cerrarEncuesta(encuesta.id)
    recargar()
  }

  return (
    <div style={{ background: '#FFFFFF', borderRadius: '14px', padding: '18px', border: '1px solid #E8E6DF', marginBottom: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
        <h3 style={{ fontSize: '13px', fontWeight: '600', color: '#5F5E5A', textTransform: 'uppercase', letterSpacing: '0.5px', margin: 0 }}>
          Encuesta activa
        </h3>
        {encuesta.avisos?.titulo && (
          <span style={{ fontSize: '11px', color: '#B4B2A9' }}>{encuesta.avisos.titulo}</span>
        )}
      </div>
      <EncuestaWidget
        encuesta={encuesta}
        resultados={resultados}
        miVoto={miVoto}
        votar={votar}
        esAdmin={esAdmin}
        onCerrar={handleCerrar}
        compacto
      />
    </div>
  )
}