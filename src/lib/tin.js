// "Tin" suave para avisar que llegó un aviso nuevo con la app abierta.
// Se genera con Web Audio (no necesita archivo de sonido).
// Los celulares no dejan sonar nada hasta que la persona toca la pantalla al menos
// una vez: si todavía no se puede, el tin queda pendiente y suena en ese primer toque.

let ctx = null
let pendiente = false
let escuchando = false

function contexto() {
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  return ctx
}

function sonar(c) {
  const t = c.currentTime
  const salida = c.createGain()
  salida.gain.setValueAtTime(0.0001, t)
  salida.gain.exponentialRampToValueAtTime(0.18, t + 0.01)
  salida.gain.exponentialRampToValueAtTime(0.0001, t + 0.9)
  salida.connect(c.destination)
  // Nota principal (Mi6) y un armónico suave, como una campanita
  ;[[1318.5, 1], [2637, 0.35]].forEach(([frec, vol]) => {
    const osc = c.createOscillator()
    const g = c.createGain()
    osc.type = 'sine'
    osc.frequency.value = frec
    g.gain.value = vol
    osc.connect(g)
    g.connect(salida)
    osc.start(t)
    osc.stop(t + 0.95)
  })
}

function alPrimerToque() {
  const c = contexto()
  if (!c) return
  c.resume().then(() => {
    if (pendiente) { pendiente = false; sonar(c) }
  }).catch(() => {})
}

// Desbloquea el audio con el primer toque (y deja sonar un tin pendiente)
function escucharToques() {
  if (escuchando) return
  escuchando = true
  ;['pointerdown', 'touchstart', 'keydown'].forEach(ev =>
    window.addEventListener(ev, alPrimerToque, { passive: true })
  )
}

export function tocarTin() {
  try {
    const c = contexto()
    if (!c) return
    escucharToques()
    if (c.state === 'running') { sonar(c); return }
    pendiente = true
    c.resume().then(() => {
      if (c.state === 'running' && pendiente) { pendiente = false; sonar(c) }
    }).catch(() => {})
  } catch {
    // Sin audio disponible: no pasa nada
  }
}

// Para que el audio quede habilitado desde el primer toque, aunque todavía no haya avisos
export function prepararTin() {
  escucharToques()
}
