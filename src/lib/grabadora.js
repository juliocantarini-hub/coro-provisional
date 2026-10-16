// Grabación de la voz en memoria. Nunca se guarda en disco ni se sube a
// ningún lado: solo vive en un Float32Array hasta que termina el análisis.
//
// Se desactivan eco, supresión de ruido y control automático de ganancia: son
// filtros pensados para llamadas, que deforman la altura y el volumen de una
// voz cantada. Se reduce a ~16 kHz en el momento para ocupar poco (unos 4 MB
// por minuto).

const OBJETIVO_HZ = 16000

export async function iniciarGrabacion() {
  if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador no permite usar el micrófono.')
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  })
  const Contexto = window.AudioContext || window.webkitAudioContext
  const ctx = new Contexto()
  if (ctx.state === 'suspended') await ctx.resume()

  const fuente = ctx.createMediaStreamSource(stream)
  const proc = ctx.createScriptProcessor(4096, 1, 1) // simple y soportado en todos los navegadores
  const silencio = ctx.createGain()
  silencio.gain.value = 0 // el procesador necesita estar conectado, pero no queremos oírnos
  const factor = Math.max(1, Math.round(ctx.sampleRate / OBJETIVO_HZ))
  const sampleRate = ctx.sampleRate / factor

  const trozos = []
  let total = 0
  let nivel = 0
  const inicioCtx = ctx.currentTime
  let sobra = new Float32Array(0)

  proc.onaudioprocess = (ev) => {
    const entrada = ev.inputBuffer.getChannelData(0)
    const bloque = new Float32Array(sobra.length + entrada.length)
    bloque.set(sobra, 0)
    bloque.set(entrada, sobra.length)
    const n = Math.floor(bloque.length / factor)
    const salida = new Float32Array(n)
    let sumaCuad = 0
    for (let i = 0; i < n; i++) {
      let s = 0
      for (let k = 0; k < factor; k++) s += bloque[i * factor + k]
      salida[i] = s / factor
      sumaCuad += salida[i] * salida[i]
    }
    sobra = bloque.slice(n * factor)
    trozos.push(salida)
    total += n
    nivel = n ? Math.sqrt(sumaCuad / n) : 0
  }
  fuente.connect(proc)
  proc.connect(silencio)
  silencio.connect(ctx.destination)

  function limpiar() {
    try { proc.disconnect() } catch { /* ya desconectado */ }
    try { fuente.disconnect() } catch { /* ya desconectado */ }
    stream.getTracks().forEach((t) => t.stop())
    try { ctx.close() } catch { /* ya cerrado */ }
  }

  return {
    sampleRate,
    segundos: () => total / sampleRate,
    nivel: () => nivel,
    inicioCtx,
    detener() {
      limpiar()
      const muestras = new Float32Array(total)
      let pos = 0
      for (const t of trozos) { muestras.set(t, pos); pos += t.length }
      trozos.length = 0
      return { muestras, sampleRate }
    },
    cancelar() {
      limpiar()
      trozos.length = 0
    },
  }
}
