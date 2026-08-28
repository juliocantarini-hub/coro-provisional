import { useState, useRef } from "react";
import * as Tone from "tone";

const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS_BASE = [2, 3, 4];
const TOTAL_TECLAS_BLANCAS = OCTAVAS_BASE.length * TECLAS_BLANCAS.length;

export default function PianoInteractivo() {
  const [transporteOctava, setTransporteOctava] = useState(0);
  const [notaActiva, setNotaActiva] = useState(null);
  const synthRef = useRef(null);

  function getSynth() {
    if (!synthRef.current) {
      synthRef.current = new Tone.Synth().toDestination();
    }
    return synthRef.current;
  }

  async function tocarNota(tecla, octava) {
    await Tone.start();
    const octavaFinal = octava + transporteOctava;
    const nota = `${tecla}${octavaFinal}`;
    const synth = getSynth();
    synth.triggerAttackRelease(nota, "4n");
    setNotaActiva(nota);
    setTimeout(() => setNotaActiva((actual) => (actual === nota ? null : actual)), 400);
  }

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, marginBottom: 20, background: "#FFFFFF" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div>
          <h3 style={{ margin: "0 0 2px" }}>🎹 Buscá tu nota</h3>
          <p style={{ margin: 0, fontSize: 13, color: "#888780" }}>Tocá una tecla para escuchar la nota</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <button
            onClick={() => setTransporteOctava((v) => Math.max(v - 1, -2))}
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #D3D1C7", background: "#F1EFE8", cursor: "pointer" }}
          >
            −
          </button>
          <span style={{ fontSize: 12, color: "#5F5E5A", minWidth: 60, textAlign: "center" }}>
            {transporteOctava === 0 ? "Rango base" : `${transporteOctava > 0 ? "+" : ""}${transporteOctava} oct.`}
          </span>
          <button
            onClick={() => setTransporteOctava((v) => Math.min(v + 1, 2))}
            style={{ width: 30, height: 30, borderRadius: 6, border: "1px solid #D3D1C7", background: "#F1EFE8", cursor: "pointer" }}
          >
            +
          </button>
        </div>
      </div>

      <div style={{ display: "flex", width: "100%", height: 70, position: "relative", userSelect: "none" }}>
        {OCTAVAS_BASE.map((octava) =>
          TECLAS_BLANCAS.map((tecla) => {
            const notaCompleta = `${tecla}${octava + transporteOctava}`;
            const activa = notaActiva === notaCompleta;
            return (
              <div
                key={`${tecla}${octava}`}
                onClick={() => tocarNota(tecla, octava)}
                style={{
                  flex: `1 1 ${100 / TOTAL_TECLAS_BLANCAS}%`,
                  minWidth: 0,
                  height: 70,
                  border: "1px solid #B4B2A9",
                  borderRadius: "0 0 3px 3px",
                  background: activa ? "#1D9E75" : "#FFFFFF",
                  transition: "background 0.1s",
                  position: "relative",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                {TECLAS_NEGRAS[tecla] && (
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      tocarNota(TECLAS_NEGRAS[tecla], octava);
                    }}
                    style={{
                      position: "absolute",
                      right: "-18%",
                      top: 0,
                      width: "36%",
                      height: 42,
                      background:
                        notaActiva === `${TECLAS_NEGRAS[tecla]}${octava + transporteOctava}` ? "#1D9E75" : "#1A1A18",
                      borderRadius: "0 0 2px 2px",
                      zIndex: 2,
                      cursor: "pointer",
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