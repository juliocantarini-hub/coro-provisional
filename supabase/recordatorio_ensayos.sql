-- Recordatorio de ensayos/eventos 24hs antes, por push notification
-- Proyecto: corum-produccion-1 (coro-provisional, St. Brendan's)
-- NOTA: este cron ya fue cargado antes directo en el SQL Editor (no había
-- quedado documentado en el repo). Este archivo es solo el registro; no
-- hace falta volver a ejecutarlo salvo que el job se haya borrado.
--
-- Corre cada hora y busca eventos publicados cuya fecha_inicio caiga entre
-- 23 y 25hs desde el momento de la corrida (ventana de 2hs para no
-- depender de que el cron dispare justo a una hora exacta), enviando el
-- recordatorio solo una vez por evento (columna recordatorio_enviado en
-- la tabla eventos).

create extension if not exists pg_net;

-- Reemplazar <SERVICE_ROLE_KEY> por la service_role key de este proyecto
-- (Supabase → Project Settings → API → service_role). No es la anon key.
select cron.schedule(
  'recordatorio-ensayos-cada-hora',
  '0 * * * *',
  $cron$
  select net.http_post(
    url := 'https://qiyquvcelzitjkqoxpyx.supabase.co/functions/v1/recordatorio-ensayos',
    headers := jsonb_build_object('Content-Type', 'application/json')
  );
  $cron$
);

-- Para desprogramarlo más adelante:
-- select cron.unschedule('recordatorio-ensayos-cada-hora');
