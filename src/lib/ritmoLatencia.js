// Retraso de los toques en este dispositivo (ms). Entre que el cantante oye el pulso y el toque llega a la app pasa un
// tiempo (parlante o auriculares Bluetooth, pantalla táctil, navegador). Se guarda en el aparato y se descuenta al corregir.
// Se puede medir con la calibración y además se va afinando solo con los intentos de ritmo.

const CLAVE = 'ritmo_latencia_ms'
export const LATENCIA_MIN = -100
export const LATENCIA_MAX = 400

const acotar = (v) => Math.max(LATENCIA_MIN, Math.min(LATENCIA_MAX, Math.round(v)))

export function leerLatencia() {
  try {
    const v = Number(localStorage.getItem(CLAVE))
    return Number.isFinite(v) ? acotar(v) : 0
  } catch { return 0 }
}

export function guardarLatencia(ms) {
  try { localStorage.setItem(CLAVE, String(acotar(ms))) } catch { /* sin almacenamiento */ }
}

export function borrarLatencia() {
  try { localStorage.removeItem(CLAVE) } catch { /* sin almacenamiento */ }
}

/**
 * Después de un intento corregido con la latencia "usada", acerca la guardada a lo que se midió.
 * Solo aprende si se tocaron bastantes notas (con pocas no se puede separar el retraso del error de ritmo).
 */
export function aprenderDeIntento(resultado, usada) {
  if (!resultado || !Array.isArray(resultado.notas)) return
  const tocadas = resultado.notas.filter((n) => n.estado !== 'falta').length
  if (tocadas < 4 || tocadas < 0.75 * resultado.notas.length) return
  if (resultado.extras > 1) return
  const resto = resultado.desfaseMs || 0
  if (Math.abs(resto) < 15) return
  guardarLatencia(usada + 0.4 * resto)
}
