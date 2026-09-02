const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS = [2, 3, 4, 5];
const TOTAL_TECLAS_BLANCAS = OCTAVAS.length * TECLAS_BLANCAS.length;

export default function PianoVisual({ notaActiva }) {
  const notaNombre = notaActiva ? notaActiva.replace(/\d+$/, "") : null;
  const notaOctava = notaActiva ? parseInt(notaActiva.match(/\d+$/)?.[0]) : null;

  return (
    <div style={{ width: "100%", maxWidth: 500, marginTop: 10 }}>
      <div style={{ display: "flex", width: "100%", height: 60, position: "relative", userSelect: "none" }}>
        {OCTAVAS.map((octava) =>
          TECLAS_BLANCAS.map((tecla) => {
            const activa = notaNombre === tecla && notaOctava === octava;
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
                {TECLAS_NEGRAS[tecla] && (
                  <div
                    style={{
                      position: "absolute",
                      right: "-18%",
                      top: 0,
                      width: "36%",
                      height: 36,
                      background:
                        notaNombre === TECLAS_NEGRAS[tecla] && notaOctava === octava
                          ? "#1D9E75"
                          : "#1A1A18",
                      borderRadius: "0 0 2px 2px",
                      zIndex: 2,
                    }}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}