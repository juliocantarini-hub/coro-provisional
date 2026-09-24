import { useMemo, useState } from "react";
import * as Tone from "tone";
import { getPianoSampler } from "../lib/pianoSampler";

const TECLAS_BLANCAS = ["C", "D", "E", "F", "G", "A", "B"];
const TECLAS_NEGRAS = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };
const OCTAVAS_BASE_DEFAULT = [2, 3, 4];
const TOTAL_TECLAS_BLANCAS = OCTAVAS_BASE_DEFAULT.length * TECLAS_BLANCAS.length;

// Orden cromático para comparar notas entre sí (no son números MIDI reales,
// alcanza con que sean crecientes en el mismo sentido que el teclado).
const ORDEN_NOTA = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
function semitono(nota, octava) {
  return octava * 12 + ORDEN_NOTA[nota];
}

// Tesituras por cuerda (guía visual, no una referencia vocal exacta).
const RANGOS_VOZ = {
  soprano:   { desde: semitono("C", 4), hasta: semitono("G", 5) },
  contralto: { desde: semitono("G", 3), hasta: semitono("D", 5) },
  tenor:     { desde: semitono("C", 3), hasta: semitono("G", 4) },
  bajo:      { desde: semitono("F", 2), hasta: semitono("D", 4) },
};

const NOMBRE_VOZ = { soprano: "Soprano", contralto: "Contralto", tenor: "Tenor", bajo: "Bajo" };

function enRango(nota, octava, rango) {
  if (!rango) return false;
  const s = semitono(nota, octava);
  return s >= rango.desde && s <= rango.hasta;
}

// Elige qué 3 octavas mostrar en el teclado para que el rango de la cuerda
// seleccionada quede lo más centrado posible, en vez de mostrar siempre el
// mismo tramo fijo (C2-B4). Si no hay voz seleccionada, o su rango no entra
// en una ventana de 3 octavas, se usa el teclado por defecto.
function calcularOctavasVisibles(rango) {
  const cantidadOctavas = OCTAVAS_BASE_DEFAULT.length;
  if (!rango) return OCTAVAS_BASE_DEFAULT;
  const anchoVentana = cantidadOctavas * 12;
  let mejorBase = null;
  let mejorDiferencia = Infinity;
  for (let base = 0; base <= 7; base++) {
    const inicio = base * 12;
    const fin = inicio + anchoVentana - 1;
    if (rango.desde >= inicio && rango.hasta <= fin) {
      const margenIzquierdo = rango.desde - inicio;
      const margenDerecho = fin - rango.hasta;
      const diferencia = Math.abs(margenIzquierdo - margenDerecho);
      if (diferencia < mejorDiferencia) {
        mejorDiferencia = diferencia;
        mejorBase = base;
      }
    }
  }
  if (mejorBase === null) return OCTAVAS_BASE_DEFAULT;
  return [mejorBase, mejorBase + 1, mejorBase + 2];
}

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

export default function PianoInteractivo({ abierto, voz }) {
  const [transporteOctava, setTransporteOctava] = useState(0);
  const [notaActiva, setNotaActiva] = useState(null);
  const octavas = useMemo(() => calcularOctavasVisibles(RANGOS_VOZ[voz]), [voz]);

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
        <div>
          <p style={{ margin: 0, fontSize: 13, color: "#888780" }}>Tocá una tecla para escuchar la nota</p>
          {RANGOS_VOZ[voz] && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: "#1D9E75", fontWeight: 500 }}>
              Tu rango ({NOMBRE_VOZ[voz]}) está resaltado en el teclado
            </p>
          )}
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

      <div style={{ display: "flex", width: "100%", height: 90, position: "relative", userSelect: "none" }}>
        {octavas.map((octava) =>
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
                  background: activa ? "#1D9E75" : enRango(tecla, octava, RANGOS_VOZ[voz]) ? "#CFF0E3" : "#FFFFFF",
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
                        notaActiva === `${TECLAS_NEGRAS[tecla]}${octava + transporteOctava}`
                          ? "#1D9E75"
                          : enRango(TECLAS_NEGRAS[tecla], octava, RANGOS_VOZ[voz]) ? "#3F7A66" : "#1A1A18",
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