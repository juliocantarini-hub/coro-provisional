let detenerActivo = null;

export function tomarControlReproduccion(funcionDetener) {
  if (detenerActivo && detenerActivo !== funcionDetener) {
    detenerActivo();
  }
  detenerActivo = funcionDetener;
}

export function liberarControlReproduccion(funcionDetener) {
  if (detenerActivo === funcionDetener) {
    detenerActivo = null;
  }
}