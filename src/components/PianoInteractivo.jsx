import { useState } from "react";
import * as Tone from "tone";
import { getPianoSampler } from "../lib/pianoSampler";

const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS_BASE = [2, 3, 4];
const TOTAL_TECLAS_BLANCAS = OCTAVAS_BASE.length * TECLAS_BLANCAS.length;

export function BotonPiano({ abierto, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "10px 16px", border: "1px solid #D3D1C7", borderRadius: 8,
        background: abierto ? "#E1F5EE" : "#FFFFFF", cursor: "pointer",
        fontSize: 14, fontWeight: 500, color: "#04342C",
      }}
    >
      <span style={{ fontSize: 18 }}>🎹</span>
      <span>Buscá tu nota</span>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="#5F5E5A"
        style={{ transform: abierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
        <path d="M7 10l5 5 5-5z" />
      </svg>
    </button>
  );
}

export default function PianoInteractivo({ abierto }) {
  const [transporteOctava, setTransporteOctava] = useState(0);
  const [notaActiva, setNotaActiva] = useState(null);

  async function tocarNota(tecla, octava) {
    await Tone.start();
    const octavaFinal = octava + transporteOctava;
    const nota = `${tecla}${octavaFinal}`;
    const { sampler, listo } = getPianoSampler();
    await listo;
    sampler.triggerAttackRelease(nota, "4n");
    setNotaActiva(nota);
    setTimeout(() => setNotaActiva((actual) => (actual === nota ? null : actual)), 400);
  }

  if (!abierto) return null;

  return (
    <div style={{ padding: 16, border: "1px solid #ddd", borderRadius: 8, background: "#FFFFFF", marginBottom: 16, width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, color: "#888780" }}>Tocá una tecla para escuchar la nota</p>
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

      <div style={{ display: "flex", width: "100%", height: 90, position: "relative", userSelect: "none" }}>
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
                  height: 90,
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
                      height: 55,
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