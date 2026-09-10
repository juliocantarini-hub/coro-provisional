import { useState, useRef, useEffect } from "react";
import * as Tone from "tone";
import PianoVisual from "./PianoVisual";
import { registrarActividadEntrenamiento } from "../hooks/useEntrenamiento";
import { getPianoSampler } from "../lib/pianoSampler";
import { tomarControlReproduccion, liberarControlReproduccion } from "../lib/reproductorActivo";

const VELOCIDADES = [0.5, 0.75, 1, 1.5, 2];

function transportarNota(notaBase, semitonos) {
  return Tone.Frequency(notaBase).transpose(semitonos).toNote();
}

export default function EjercicioPlayer({ ejercicio }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const [contadorTexto, setContadorTexto] = useState(null);
  const [notaActiva, setNotaActiva] = useState(null);
  const [velocidad, setVelocidad] = useState(1);
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
    Tone.Transport.cancel(0);
    Tone.Transport.stop();
    Tone.Draw.cancel();
    const { sampler } = getPianoSampler();
    if (sampler) sampler.releaseAll();
    limpiarTimers();
    setContadorTexto(null);
    setNotaActiva(null);
    setReproduciendo(false);
    liberarControlReproduccion(detener);
  }

  function marcarNotaEnTiempo(nota, tiempoInicio, duracionSeg) {
    Tone.Draw.schedule(() => setNotaActiva(nota), tiempoInicio);
    Tone.Draw.schedule(() => setNotaActiva((actual) => (actual === nota ? null : actual)), tiempoInicio + duracionSeg);
  }

  function beep(frecuencia = 660) {
    const osc = new Tone.Synth({ oscillator: { type: "sine" }, volume: -10 }).toDestination();
    osc.triggerAttackRelease(frecuencia, 0.15);
    setTimeout(() => osc.dispose(), 300);
  }

  function ejecutarContador() {
    const fases = patron.fases || ["Inhalá", "Sostené", "Exhalá"];
    const segundos = patron.patron_segundos || [4, 4, 4];
    const repeticiones = patron.repeticiones || 1;
    let repActual = 0, faseActual = 0, segRestantes = segundos[0];
    setContadorTexto(`${fases[0]}: ${segRestantes}`);
    beep(880);
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
            beep(440);
            timeoutRef.current = setTimeout(() => {
              registrarActividadEntrenamiento(ejercicio.id);
              detener();
            }, 1000);
            return;
          }
        }
        segRestantes = segundos[faseActual];
        setContadorTexto(`${fases[faseActual]}: ${segRestantes}`);
        beep(880);
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
    tomarControlReproduccion(detener);
    setReproduciendo(true);

    if (patron.tipo === "contador") { ejecutarContador(); return; }
    if (patron.tipo === "cronometro_exhalacion") { ejecutarCronometro(); return; }
    if (patron.tipo === "instruccion_libre") { ejecutarTimerSimple(); return; }

    const { sampler, listo } = getPianoSampler();
    await listo;
    const synth = sampler;

    Tone.Transport.cancel(0);
    Tone.Transport.stop();
    Tone.Transport.position = 0;

    const tempo = (patron.tempo_bpm || 80) * velocidad;
    const duracionNota = 60 / tempo;
    const repeticiones = patron.repeticiones || 1;
    const transporte = patron.transporte_semitonos_por_repeticion || 0;
    let tiempoAcumulado = 0;

    function tocar(nota, duracion, inicioRelativo) {
      const durSeg = typeof duracion === "number" ? duracion / velocidad : duracionNota;
      Tone.Transport.scheduleOnce((time) => {
        synth.triggerAttackRelease(nota, durSeg, time);
        marcarNotaEnTiempo(nota, time, durSeg);
      }, inicioRelativo);
    }

    switch (patron.tipo) {
      case "arpegio":
      case "escala": {
        for (let rep = 0; rep < repeticiones; rep++) {
          const notaBase = transportarNota(patron.nota_inicial, transporte * rep);
          patron.notas_semitonos.forEach((semitono) => {
            const nota = transportarNota(notaBase, semitono);
            tocar(nota, "8n", tiempoAcumulado);
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
          tocar(nota, "8n", tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "frase": {
        patron.notas_semitonos.forEach((semitono) => {
          const nota = transportarNota(patron.nota_inicial, semitono);
          const duracionUsada = patron.articulacion === "legato" ? duracionNota * 0.95 : duracionNota * 0.7;
          tocar(nota, duracionUsada, tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "nota_sostenida": {
        const duracion = (patron.duracion_referencia_seg || 3) / velocidad;
        tocar(patron.nota, duracion, 0);
        tiempoAcumulado = duracion;
        break;
      }
      case "nota_sostenida_deslizante": {
        const d1 = 0.5 / velocidad, d2 = 0.8 / velocidad;
        tocar(patron.nota_inicial, d1, 0);
        tocar(patron.nota_final, d2, d1);
        tiempoAcumulado = d1 + d2;
        break;
      }
      case "nota_sostenida_dinamica": {
        const duracion = (patron.duracion_seg || 8) / velocidad;
        const repsDin = patron.repeticiones || 1;
        const transDin = patron.transporte_semitonos_por_repeticion || 0;
        for (let rep = 0; rep < repsDin; rep++) {
          const notaRep = transportarNota(patron.nota, transDin * rep);
          tocar(notaRep, duracion, tiempoAcumulado);
          tiempoAcumulado += duracion + 0.3;
        }
        break;
      }
      case "glissando": {
        const d = 0.6 / velocidad;
        tocar(patron.nota_inicial, d, 0);
        tocar(patron.nota_final, d, d);
        tiempoAcumulado = d * 2;
        if (patron.ida_y_vuelta) {
          tocar(patron.nota_inicial, d, tiempoAcumulado);
          tiempoAcumulado += d;
        }
        break;
      }
      case "intervalo": {
        const pausa = 0.3 / velocidad;
        tocar(patron.nota_base, duracionNota, 0);
        tiempoAcumulado = duracionNota + pausa;
        (patron.intervalos_semitonos || []).forEach((semi) => {
          const nota = transportarNota(patron.nota_base, semi);
          tocar(nota, duracionNota, tiempoAcumulado);
          tiempoAcumulado += duracionNota + pausa;
        });
        break;
      }
      case "intervalo_armonico": {
        const duracion = 2 / velocidad;
        (patron.notas_base_semitonos || [0, 7]).forEach((semi) => {
          const nota = transportarNota(patron.nota_inicial, semi);
          tocar(nota, duracion, 0);
        });
        tiempoAcumulado = duracion;
        break;
      }
      case "cadencia": {
        const gradosSemitonos = { I: 0, IV: 5, V: 7 };
        (patron.grados || ["I", "IV", "V", "I"]).forEach((grado) => {
          const nota = transportarNota(patron.nota_inicial, gradosSemitonos[grado] ?? 0);
          tocar(nota, duracionNota, tiempoAcumulado);
          tiempoAcumulado += duracionNota;
        });
        break;
      }
      case "nota_unica_doble_ataque": {
        const d = 0.6 / velocidad, pausa = 1.2 / velocidad;
        tocar(patron.nota, d, 0);
        tocar(patron.nota, d, pausa);
        tiempoAcumulado = pausa + d;
        break;
      }
            case "secuencia_rapida": {
        const notaBaseSeq = patron.nota_inicial || "C3";
        const reps = patron.repeticiones || 3;
        const ciclosSeq = patron.ciclos_transporte || 1;
        const transSeq = patron.transporte_semitonos_por_repeticion || 0;
        const d = 0.3 / velocidad, paso = 0.4 / velocidad;
        for (let ciclo = 0; ciclo < ciclosSeq; ciclo++) {
          const nota = transportarNota(notaBaseSeq, transSeq * ciclo);
          for (let i = 0; i < reps; i++) {
            tocar(nota, d, tiempoAcumulado);
            tiempoAcumulado += paso;
          }
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
            tocar(nota, durNota, tiempoAcumulado);
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

    Tone.Transport.scheduleOnce((time) => {
      Tone.Draw.schedule(() => {
        setNotaActiva(null);
        setReproduciendo(false);
        registrarActividadEntrenamiento(ejercicio.id);
        liberarControlReproduccion(detener);
      }, time);
    }, tiempoAcumulado + 0.3);

    Tone.Transport.start();
  }

  const esCronometroManual = patron.tipo === "cronometro_exhalacion";
  const tienePiano = !["contador", "cronometro_exhalacion", "instruccion_libre"].includes(patron.tipo);
  const tieneVelocidad = !["contador", "cronometro_exhalacion", "instruccion_libre"].includes(patron.tipo);

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 12 }}>
      <h3>{ejercicio.nombre}</h3>
      <p>{ejercicio.instruccion_texto}</p>
      {contadorTexto && (
        <p style={{ fontSize: 24, fontWeight: "bold", margin: "8px 0" }}>{contadorTexto}</p>
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
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

        {tieneVelocidad && (
          <div style={{ display: "flex", gap: 4 }}>
            {VELOCIDADES.map((v) => (
              <button
                key={v}
                onClick={() => setVelocidad(v)}
                disabled={reproduciendo}
                style={{
                  padding: "5px 9px", borderRadius: 6, fontSize: 12,
                  border: `1px solid ${velocidad === v ? "#1D9E75" : "#D3D1C7"}`,
                  background: velocidad === v ? "#E1F5EE" : "#FFFFFF",
                  color: velocidad === v ? "#04342C" : "#5F5E5A",
                  fontWeight: velocidad === v ? 600 : 400,
                  cursor: reproduciendo ? "default" : "pointer",
                  opacity: reproduciendo ? 0.6 : 1,
                }}
              >
                {v}x
              </button>
            ))}
          </div>
        )}
      </div>
      {tienePiano && <PianoVisual notaActiva={notaActiva} />}
    </div>
  );
}