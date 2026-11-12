-- Aviso para confirmar asistencia (noviembre 2026)
-- Agrega la marca del aviso de "una semana antes" en eventos.
-- La función recordatorio-ensayos (la misma que ya corre cada hora) ahora manda:
--   * Día anterior: a los ensayos, el recordatorio de siempre; a conciertos, reuniones
--     y extras, el recordatorio a quienes confirmaron y un pedido de confirmación a
--     quienes no respondieron.
--   * Una semana antes (entre 2 y 7 días), solo conciertos, reuniones y extras:
--     pedido de confirmación a quienes no respondieron.
-- Se puede repetir sin problema. No hace falta tocar el cron.

alter table public.eventos
  add column if not exists recordatorio_semana_enviado boolean not null default false;
