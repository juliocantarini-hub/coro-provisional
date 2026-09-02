import * as Tone from "tone";

let samplerInstance = null;
let cargaPromise = null;

export function getPianoSampler() {
  if (samplerInstance) return { sampler: samplerInstance, listo: cargaPromise };

  cargaPromise = new Promise((resolve) => {
    samplerInstance = new Tone.Sampler({
      urls: {
        C3: "C3.mp3",
        "D#3": "Ds3.mp3",
        "F#3": "Fs3.mp3",
        A3: "A3.mp3",
        C4: "C4.mp3",
        "D#4": "Ds4.mp3",
        "F#4": "Fs4.mp3",
        A4: "A4.mp3",
        C5: "C5.mp3",
      },
      release: 1,
      baseUrl: "https://tonejs.github.io/audio/salamander/",
      onload: () => resolve(samplerInstance),
    }).toDestination();
  });

  return { sampler: samplerInstance, listo: cargaPromise };
}