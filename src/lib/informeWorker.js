// Web Worker: corre el análisis fuera del hilo de la interfaz para que la
// pantalla no se congele mientras se procesa la grabación.
import { analizarGrabacion } from './informeAfinacion'

self.onmessage = (e) => {
  const { muestras, sampleRate, notas, opciones } = e.data
  try {
    const informe = analizarGrabacion(muestras, sampleRate, notas, opciones || {})
    self.postMessage({ ok: true, informe })
  } catch (err) {
    self.postMessage({ ok: false, error: String(err?.message || err) })
  }
}
