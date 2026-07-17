function pad(n) {
  return String(n).padStart(2, '0')
}

function formatICSDate(dateInput) {
  const d = new Date(dateInput)
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`
}

function escapeICS(str = '') {
  return String(str)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export function generarICS(evento) {
  const dtStart = formatICSDate(evento.fecha_inicio)
  const dtEnd = evento.fecha_fin
    ? formatICSDate(evento.fecha_fin)
    : formatICSDate(new Date(new Date(evento.fecha_inicio).getTime() + 60 * 60 * 1000)) // +1h por defecto
  const dtStamp = formatICSDate(new Date())
  const uid = `${evento.id}@corum-recursocoral`

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CORUM by Recurso Coral//ES',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    `SUMMARY:${escapeICS(evento.titulo)}`,
  ]

  const ubicacion = evento.direccion || evento.lugar
  if (ubicacion) lines.push(`LOCATION:${escapeICS(ubicacion)}`)
  if (evento.notas) lines.push(`DESCRIPTION:${escapeICS(evento.notas)}`)

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export function descargarICS(evento) {
  const contenido = generarICS(evento)
  const blob = new Blob([contenido], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${(evento.titulo || 'evento').replace(/[^a-z0-9áéíóúñ]/gi, '_')}.ics`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
