// Medidor visual de afinación: a pedido de Julio, nada de barra ni aguja que
// se desliza — un bloque que simplemente se ilumina del color que corresponde
// en cada instante (verde = afinado, amarillo = cerca, rojo = nota
// equivocada/lejos, gris = sin lectura). Los márgenes de cada banda son
// configurables (bandaVerde/bandaAmarilla) para poder ajustarlos sin tocar el
// resto del componente.
const COLOR_SIN_LECTURA = '#E5E3DC'
const COLOR_VERDE = '#4CAF82'
const COLOR_AMARILLO = '#E0B23D'
const COLOR_ROJO = '#D9574E'

export default function MedidorAfinacion({ cents, bandaVerde = 10, bandaAmarilla = 25 }) {
  const hayLectura = cents != null && isFinite(cents)
  const distancia = hayLectura ? Math.abs(cents) : null

  const color = !hayLectura
    ? COLOR_SIN_LECTURA
    : distancia <= bandaVerde
      ? COLOR_VERDE
      : distancia <= bandaAmarilla
        ? COLOR_AMARILLO
        : COLOR_ROJO

  return (
    <div
      style={{
        width: '100%',
        height: '40px',
        borderRadius: '10px',
        background: color,
        // Lecturas nuevas llegan cada 80ms (ver intervalo del mic en
        // PartituraPlayer) — sin una transición breve el color saltaría de
        // golpe a cada lectura; con esta se funde suave de un color al otro.
        transition: 'background-color 0.15s ease-out',
      }}
    />
  )
}
