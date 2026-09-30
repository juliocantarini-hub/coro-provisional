import { notaAMidi } from "../lib/afinacion";

const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS = [2, 3, 4, 5];
const TOTAL_TECLAS_BLANCAS = OCTAVAS.length * TECLAS_BLANCAS.length;

// ataqueId: algo que cambia con cada nota nueva (le pasamos el instante de
// inicio de la nota) aunque la altura se repita (do-do-do-do). Al cambiar,
// React desmonta y vuelve a montar el "destello" de abajo, lo que reinicia
// su animación CSS — así cada repetición de una misma nota se ve como un
// toque nuevo (un destello breve), en vez de que la tecla quede prendida
// fija sin distinguir cuántas notas sonaron. Si no se pasa ataqueId (otros
// usos de este componente, como el piano de EjercicioPlayer) simplemente no
// hay destello y la tecla se prende/apaga como antes.
export default function PianoVisual({ notaActiva, ataqueId }) {
  // Comparamos por número de MIDI (semitono absoluto) en vez de por el nombre
  // de la nota tal cual, porque una misma tecla puede escribirse de más de una
  // forma (por ejemplo Eb y D# son la misma tecla): si la partitura usa
  // bemoles (como pasa en obras con esa armadura de clave) y acá solo
  // comparábamos el texto contra "D#", nunca coincidía y la tecla no se
  // marcaba. notaAMidi entiende sostenidos y bemoles, así que resuelve
  // cualquiera de las dos formas a la misma tecla.
  const notaActivaMidi = notaActiva ? notaAMidi(notaActiva) : null;

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
                {activa && (
                  <div
                    key={ataqueId ?? "sin-ataque"}
                    style={{
                      position: "absolute", inset: 0, borderRadius: "0 0 3px 3px",
                      background: "#FFFFFF", animation: "piano-destello 0.35s ease-out",
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
                    {negraActiva && (
                      <div
                        key={ataqueId ?? "sin-ataque"}
                        style={{
                          position: "absolute", inset: 0, borderRadius: "0 0 2px 2px",
                          background: "#FFFFFF", animation: "piano-destello 0.35s ease-out",
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
