// Medidor visual de afinación: una barra horizontal de -50 a +50 centésimas de
// semitono, con bandas de color (verde = afinado, amarillo = cerca, rojo =
// lejos) y una marca que se mueve según qué tan afinado está el cantante en
// cada instante. Los anchos de las bandas son configurables (bandaVerde/
// bandaAmarilla) para poder ajustarlos sin tocar el resto del componente.
export default function MedidorAfinacion({ cents, bandaVerde = 10, bandaAmarilla = 25 }) {
  const hayLectura = cents != null && isFinite(cents)
  const valor = hayLectura ? Math.max(-50, Math.min(50, cents)) : 0
  const posicionPct = ((valor + 50) / 100) * 100

  // Anchos relativos de cada banda (en "unidades" de cents, de -50 a +50),
  // convertidos a porcentajes del ancho total de la barra.
  const mitadRoja = 50 - bandaAmarilla
  const mitadAmarilla = bandaAmarilla - bandaVerde
  const anchoVerde = bandaVerde * 2

  return (
    <div style={{ width: '100%', opacity: hayLectura ? 1 : 0.45, transition: 'opacity 0.2s' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#B4B2A9', marginBottom: '3px', fontVariantNumeric: 'tabular-nums' }}>
        <span>-50</span>
        <span>0</span>
        <span>+50</span>
      </div>
      <div style={{ position: 'relative', height: '14px', borderRadius: '7px', overflow: 'hidden', display: 'flex' }}>
        <div style={{ flex: `${mitadRoja} 1 0`, background: '#F6CFCB' }} />
        <div style={{ flex: `${mitadAmarilla} 1 0`, background: '#F5E7B8' }} />
        <div style={{ flex: `${anchoVerde} 1 0`, background: '#C9EBDD' }} />
        <div style={{ flex: `${mitadAmarilla} 1 0`, background: '#F5E7B8' }} />
        <div style={{ flex: `${mitadRoja} 1 0`, background: '#F6CFCB' }} />
        {hayLectura && (
          <div style={{
            position: 'absolute', left: `${posicionPct}%`, top: 0, bottom: 0,
            width: '3px', marginLeft: '-1.5px', background: '#1A1A18', borderRadius: '2px',
            // Lecturas nuevas llegan cada 80ms (ver intervalo del mic en
            // PartituraPlayer); con una transición tan corta como la anterior
            // (0.1s linear) la marca prácticamente saltaba de golpe a cada
            // lectura en vez de deslizarse. Alargarla a 0.25s con "ease-out"
            // la hace deslizar en vez de saltar. Esto es puramente visual: no
            // toca ni retrasa el cálculo de cents (el que decide verde/
            // amarillo/rojo), solo cómo se anima la marca entre los valores
            // que ya recibía antes — el único costo es que la marca tarda
            // una fracción de segundo más en terminar de llegar a su
            // posición final tras un cambio real de nota.
            transition: 'left 0.25s ease-out',
          }} />
        )}
      </div>
    </div>
  )
}
