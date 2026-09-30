import { useEffect, useRef, useState } from "react";
import { notaAMidi } from "../lib/afinacion";

const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS = [2, 3, 4, 5];
const TOTAL_TECLAS_BLANCAS = OCTAVAS.length * TECLAS_BLANCAS.length;

// ataqueId: algo que cambia con cada nota nueva (le pasamos el instante de
// inicio de la nota) aunque la altura se repita (do-do-do-do). Lo usamos para
// distinguir dos casos: si la nota cambia de altura, la tecla que se prende
// ya es una tecla distinta — eso alcanza como señal visual, no hace falta
// destello. Pero si la MISMA tecla vuelve a sonar dos veces seguidas (un
// "do-do" consecutivo, sin otra nota en el medio), no hay cambio de tecla que
// se note a simple vista, así que ahí sí disparamos un destello breve para
// marcar el nuevo golpe. Si no se pasa ataqueId (otros usos de este
// componente, como el piano de EjercicioPlayer) simplemente no hay destello y
// la tecla se prende/apaga como antes.
export default function PianoVisual({ notaActiva, ataqueId }) {
  // Comparamos por número de MIDI (semitono absoluto) en vez de por el nombre
  // de la nota tal cual, porque una misma tecla puede escribirse de más de una
  // forma (por ejemplo Eb y D# son la misma tecla): si la partitura usa
  // bemoles (como pasa en obras con esa armadura de clave) y acá solo
  // comparábamos el texto contra "D#", nunca coincidía y la tecla no se
  // marcaba. notaAMidi entiende sostenidos y bemoles, así que resuelve
  // cualquiera de las dos formas a la misma tecla.
  const notaActivaMidi = notaActiva ? notaAMidi(notaActiva) : null;

  // anteriorRef guarda el último {midi, ataqueId} visto, para poder detectar
  // una repetición CONSECUTIVA de la misma nota (no alcanza con "esta nota ya
  // sonó antes en algún momento" — tiene que ser el golpe inmediatamente
  // anterior). flash guarda {midi, ataqueId} de la repetición detectada más
  // reciente: solo la tecla cuyo midi coincide con flash.midi muestra el
  // destello, y solo mientras esa sea la nota activa — así un cambio a otra
  // nota nunca hereda un destello que no le corresponde.
  const anteriorRef = useRef({ midi: null, ataqueId: null });
  const [flash, setFlash] = useState(null);

  useEffect(() => {
    const anterior = anteriorRef.current;
    const esRepeticionConsecutiva =
      notaActivaMidi != null &&
      notaActivaMidi === anterior.midi &&
      ataqueId != null &&
      ataqueId !== anterior.ataqueId;
    if (esRepeticionConsecutiva) {
      setFlash({ midi: notaActivaMidi, ataqueId });
    }
    anteriorRef.current = { midi: notaActivaMidi, ataqueId };
  }, [notaActivaMidi, ataqueId]);

  return (
    <div style={{ width: "100%", marginTop: 10 }}>
      <style>{`
        @keyframes piano-destello {
          from { opacity: 0.85; }
          to { opacity: 0; }
        }
      `}</style>
      <div style={{ display: "flex", width: "100%", height: 60, position: "relative", userSelect: "none" }}>
        {OCTAVAS.map((octava) =>
          TECLAS_BLANCAS.map((tecla) => {
            const activa = notaActivaMidi != null && notaAMidi(`${tecla}${octava}`) === notaActivaMidi;
            const negraActiva =
              TECLAS_NEGRAS[tecla] && notaActivaMidi != null &&
              notaAMidi(`${TECLAS_NEGRAS[tecla]}${octava}`) === notaActivaMidi;
            const mostrarDestello = activa && flash != null && flash.midi === notaActivaMidi;
            return (
              <div
                key={`${tecla}${octava}`}
                style={{
                  flex: `1 1 ${100 / TOTAL_TECLAS_BLANCAS}%`,
                  minWidth: 0,
                  height: 60,
                  border: "1px solid #B4B2A9",
                  borderRadius: "0 0 3px 3px",
                  background: activa ? "#1D9E75" : "#FFFFFF",
                  transition: "background 0.1s",
                  position: "relative",
                  boxSizing: "border-box",
                }}
              >
                {mostrarDestello && (
                  <div
                    key={flash.ataqueId}
                    style={{
                      position: "absolute", inset: 0, borderRadius: "0 0 3px 3px",
                      background: "#FFFFFF", animation: "piano-destello 0.35s ease-out",
                      animationFillMode: "forwards",
                      pointerEvents: "none",
                    }}
                  />
                )}
                {TECLAS_NEGRAS[tecla] && (
                  <div
                    style={{
                      position: "absolute",
                      right: "-18%",
                      top: 0,
                      width: "36%",
                      height: 36,
                      background: negraActiva ? "#1D9E75" : "#1A1A18",
                      borderRadius: "0 0 2px 2px",
                      zIndex: 2,
                    }}
                  >
                    {negraActiva && flash != null && flash.midi === notaActivaMidi && (
                      <div
                        key={flash.ataqueId}
                        style={{
                          position: "absolute", inset: 0, borderRadius: "0 0 2px 2px",
                          background: "#FFFFFF", animation: "piano-destello 0.35s ease-out",
                          animationFillMode: "forwards",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
