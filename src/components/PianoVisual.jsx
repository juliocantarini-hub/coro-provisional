const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS = [2, 3, 4];

export default function PianoVisual({ notaActiva }) {
  // notaActiva viene como "C3", "F#4", etc. (formato de Tone.js)
  const notaNombre = notaActiva ? notaActiva.replace(/\d+$/, "") : null;
  const notaOctava = notaActiva ? parseInt(notaActiva.match(/\d+$/)?.[0]) : null;

  return (
    <div style={{ display: "flex", position: "relative", height: 70, marginTop: 10, userSelect: "none" }}>
      {OCTAVAS.map((octava) =>
        TECLAS_BLANCAS.map((tecla) => {
          const activa = notaNombre === tecla && notaOctava === octava;
          return (
            <div
              key={`${tecla}${octava}`}
              style={{
                width: 24,
                height: 70,
                border: "1px solid #B4B2A9",
                borderRadius: "0 0 4px 4px",
                background: activa ? "#1D9E75" : "#FFFFFF",
                transition: "background 0.1s",
                position: "relative",
                flexShrink: 0,
              }}
            >
              {TECLAS_NEGRAS[tecla] && (
                <div
                  style={{
                    position: "absolute",
                    right: -8,
                    top: 0,
                    width: 16,
                    height: 42,
                    background:
                      notaNombre === TECLAS_NEGRAS[tecla] && notaOctava === octava
                        ? "#1D9E75"
                        : "#1A1A18",
                    borderRadius: "0 0 3px 3px",
                    zIndex: 2,
                  }}
                />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}