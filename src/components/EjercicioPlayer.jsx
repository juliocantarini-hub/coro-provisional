import { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import PianoVisual from "./PianoVisual";
import { registrarActividadEntrenamiento } from "../hooks/useEntrenamiento";
import { getPianoSampler } from "../lib/pianoSampler";

function transportarNota(notaBase, semitonos) {
  return Tone.Frequency(notaBase).transpose(semitonos).toNote();
}

export default function EjercicioPlayer({ ejercicio }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const [contadorTexto, setContadorTexto] = useState(null);
  const [notaActiva, setNotaActiva] = useState(null);
  const timeoutRef = useRef(null);
  const intervalRef = useRef(null);
  const cronometroRef = useRef(null);
  const mejorMarcaRef = useRef(
    Number(localStorage.getItem(`mejor-marca-${ejercicio.id}`)) || 0
  );
  const patron = ejercicio.patron_tone;

  useEffect(() => {
    return () => detener();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function limpiarTimers() {
    if (timeoutRef.current) { clearTimeout(timeoutRef.current); timeoutRef.current = null; }
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
    if (cronometroRef.current) { clearInterval(cronometroRef.current); cronometroRef.current = null; }
  }

  function detener() {
    Tone.Transport.cancel();
    Tone.Transport.stop();
    Tone.Draw.cancel();
    const { sampler } = getPianoSampler();
    if (sampler) {
      sampler.releaseAll();
      sampler.disconnect();
      sampler.toDestination();
    }
    limpiarTimers();
    setContadorTexto(null);
    setNotaActiva(null);
    setReproduciendo(false);
  }

  function marcarNotaEnTiempo(nota, tiempoInicio, duracionSeg) {
    Tone.Draw.schedule(() => setNotaActiva(nota), tiempoInicio);
    Tone.Draw.schedule(() => setNotaActiva((actual) => (actual === nota ? null : actual)), tiempoInicio + duracionSeg);
  }

  function ejecutarContador() {
    const fases = ["Inhalá", "Sostené", "Exhalá"];
    const segundos = patron.patron_segundos || [4, 4, 4];
    const repeticiones = patron.repeticiones || 1;
    let repActual = 0, faseActual = 0, segRestantes = segundos[0];
    setContadorTexto(`${fases[0]}: ${segRestantes}`);
    intervalRef.current = setInterval(() => {
      segRestantes--;
      if (segRestantes > 0) {
        setContadorTexto(`${fases[faseActual]}: ${segRestantes}`);
      } else {
        faseActual++;
        if (faseActual >= fases.length) {
          faseActual = 0;
          repActual++;
          if (repActual >= repeticiones) {
            clearInterval(intervalRef.current);
            setContadorTexto("¡Listo!");
            timeoutRef.current = setTimeout(() => {
              registrarActividadEntrenamiento(ejercicio.id);
              detener();
            }, 1000);
            return;
          }
        }
        segRestantes = segundos[faseActual];
        setContadorTexto(`${fases[faseActual]}: ${segRestantes}`);
      }
    }, 1000);
  }

  function ejecutarCronometro() {
    let segundos = 0;
    setContadorTexto(`0s  (mejor: ${mejorMarcaRef.current}s)`);
    cronometroRef.current = setInterval(() => {
      segundos++;
      setContadorTexto(`${segundos}s  (mejor: ${mejorMarcaRef.current}s)`);
    }, 1000);
  }

  function detenerCronometro() {
    if (cronometroRef.current) {
      clearInterval(cronometroRef.current);
      const segundosFinales = parseInt(contadorTexto) || 0;
      if (segundosFinales > mejorMarcaRef.current) {
        mejorMarcaRef.current = segundosFinales;
        localStorage.setItem(`mejor-marca-${ejercicio.id}`, segundosFinales);
      }
      if (segundosFinales > 0) {
        registrarActividadEntrenamiento(ejercicio.id, segundosFinales);
      }
    }
    detener();
  }

  function ejecutarTimerSimple() {
    let restante = ejercicio.duracion_estimada_seg || 15;
    setContadorTexto(`${restante}s`);
    intervalRef.current = setInterval(() => {
      restante--;
      if (restante > 0) {
        setContadorTexto(`${restante}s`);
      } else {
        clearInterval(intervalRef.current);
        setContadorTexto("¡Listo!");
        timeoutRef.current = setTimeout(() => {
          registrarActividadEntrenamiento(ejercicio.id);
          detener();
        }, 800);
      }
    }, 1000);
  }

  async function reproducir() {
    await Tone.start();
    setReproduciendo(true);

    if (patron.tipo === "contador") { ejecutarContador(); return; }
    if (patron.tipo === "cronometro_exhalacion") { ejecutarCronometro(); return; }
    if (patron.tipo === "instruccion_libre") { ejecutarTimerSimple(); return; }

    const { sampler, listo } = getPianoSampler();
    await listo;
    const synth = sampler;

    const tempo = patron.tempo_bpm || 80;
    const duracionNota = 60 / tempo;
    const repeticiones = patron.repeticiones || 1;
    const transporte = patron.transporte_semitonos_por_repeticion || 0;
    let tiempoAcumulado = 0;
    const ahora = Tone.now();

    function tocar(nota, duracion, inicio) {
      synth.triggerAttackRelease(nota, duracion, inicio);
      marcarNotaEnTiempo(nota, inicio, typeof duracion === "number" ? duracion : duracionNota);
    }

    switch (patron.tipo) {
      case "arpegio":
      case "escala": {
        for (let rep = 0; rep < repeticiones; rep++) {
          const notaBase = transportarNota(patron.nota_inicial, transporte * rep);
          patron.notas_semitonos.forEach((semitono) => {
            const nota = transportarNota(notaBase, semitono);
            tocar(nota, "8n", ahora + tiempoAcumulado);
            tiempoAcumulado += duracionNota;
          });
        }
        break;
      }
      case "escala_alterada": {
        patron.notas_semitonos.forEach((semitono, i) => {
          const esAlterado = patron.grado_alterado && (i + 1) === patron.grado_alterado;
          const ajuste = esAlterado ? -1 : 0;
          const nota = transportarNota(patron.nota_inicial, semitono + ajuste);
          tocar(nota, "8n", ahora + tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "frase": {
        patron.notas_semitonos.forEach((semitono) => {
          const nota = transportarNota(patron.nota_inicial, semitono);
          const duracionUsada = patron.articulacion === "legato" ? duracionNota * 0.95 : duracionNota * 0.7;
          tocar(nota, duracionUsada, ahora + tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "nota_sostenida": {
        const duracion = patron.duracion_referencia_seg || 3;
        tocar(patron.nota, duracion, ahora);
        tiempoAcumulado = duracion;
        break;
      }
      case "nota_sostenida_deslizante": {
        tocar(patron.nota_inicial, 0.5, ahora);
        tocar(patron.nota_final, 0.8, ahora + 0.5);
        tiempoAcumulado = 1.3;
        break;
      }
      case "nota_sostenida_dinamica": {
        const duracion = patron.duracion_seg || 8;
        tocar(patron.nota, duracion, ahora);
        tiempoAcumulado = duracion;
        break;
      }
      case "glissando": {
        tocar(patron.nota_inicial, 0.6, ahora);
        tocar(patron.nota_final, 0.6, ahora + 0.6);
        tiempoAcumulado = 1.2;
        if (patron.ida_y_vuelta) {
          tocar(patron.nota_inicial, 0.6, ahora + tiempoAcumulado);
          tiempoAcumulado += 0.6;
        }
        break;
      }
      case "intervalo": {
        tocar(patron.nota_base, duracionNota, ahora);
        tiempoAcumulado = duracionNota + 0.3;
        (patron.intervalos_semitonos || []).forEach((semi) => {
          const nota = transportarNota(patron.nota_base, semi);
          tocar(nota, duracionNota, ahora + tiempoAcumulado);
          tiempoAcumulado += duracionNota + 0.3;
        });
        break;
      }
      case "intervalo_armonico": {
        const duracion = 2;
        (patron.notas_base_semitonos || [0, 7]).forEach((semi) => {
          const nota = transportarNota(patron.nota_inicial, semi);
          tocar(nota, duracion, ahora);
        });
        tiempoAcumulado = duracion;
        break;
      }
      case "cadencia": {
        const gradosSemitonos = { I: 0, IV: 5, V: 7 };
        (patron.grados || ["I", "IV", "V", "I"]).forEach((grado) => {
          const nota = transportarNota(patron.nota_inicial, gradosSemitonos[grado] ?? 0);
          tocar(nota, duracionNota, ahora + tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "nota_unica_doble_ataque": {
        tocar(patron.nota, 0.6, ahora);
        tocar(patron.nota, 0.6, ahora + 1.2);
        tiempoAcumulado = 1.8;
        break;
      }
      case "secuencia_rapida": {
        const nota = patron.nota_inicial || "C3";
        const reps = patron.repeticiones || 3;
        for (let i = 0; i < reps; i++) {
          tocar(nota, 0.3, ahora + tiempoAcumulado);
          tiempoAcumulado += 0.4;
        }
        break;
      }
      case "patron_ritmico": {
        const dur16 = (60 / tempo) / 4;
        const ciclos = patron.transporte_por_ciclo || [0];
        ciclos.forEach((transporteCiclo) => {
          const notaBase = transportarNota(patron.nota_inicial, transporteCiclo);
          patron.notas_semitonos.forEach((semitono, i) => {
            const nota = transportarNota(notaBase, semitono);
            const durNota = (patron.duraciones_16avos?.[i] || 1) * dur16;
            tocar(nota, durNota, ahora + tiempoAcumulado);
            tiempoAcumulado += durNota;
          });
        });
        break;
      }
      default: {
        tiempoAcumulado = 0.1;
        break;
      }
    }

    timeoutRef.current = setTimeout(() => {
      setNotaActiva(null);
      setReproduciendo(false);
      registrarActividadEntrenamiento(ejercicio.id);
    }, (tiempoAcumulado + 0.5) * 1000);
  }

  const esCronometroManual = patron.tipo === "cronometro_exhalacion";
  const tienePiano = !["contador", "cronometro_exhalacion", "instruccion_libre"].includes(patron.tipo);

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
      <h3>{ejercicio.nombre}</h3>
      <p>{ejercicio.instruccion_texto}</p>
      {contadorTexto && (
        <p style={{ fontSize: 24, fontWeight: "bold", margin: "8px 0" }}>{contadorTexto}</p>
      )}
      {!reproduciendo ? (
        <button
          onClick={reproducir}
          aria-label="Reproducir"
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none",
            background: "#1D9E75", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="white">
            <path d="M8 5v14l11-7z" />
          </svg>
        </button>
      ) : (
        <button
          onClick={esCronometroManual ? detenerCronometro : detener}
          aria-label="Detener"
          style={{
            width: 44, height: 44, borderRadius: "50%", border: "none",
            background: "#c0392b", color: "white", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
            <rect x="6" y="6" width="12" height="12" rx="1" />
          </svg>
        </button>
      )}
      {tienePiano && <PianoVisual notaActiva={notaActiva} />}
    </div>
  );
}