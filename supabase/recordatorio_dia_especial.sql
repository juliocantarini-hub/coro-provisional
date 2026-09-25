-- Recordatorio de días especiales / efemérides por push notification
-- Proyecto: corum-produccion-1 (coro-provisional, St. Brendan's)
-- Ejecutar en el SQL Editor de Supabase, UNA VEZ, después de deployar la Edge Function
-- `recordatorio-dia-especial` (supabase functions deploy recordatorio-dia-especial).

create extension if not exists pg_net;

-- Reemplazar <SERVICE_ROLE_KEY> por la service_role key de este proyecto
-- (Supabase → Project Settings → API → service_role). No es la anon key.
select cron.schedule(
  'recordatorio-dia-especial',
  '0 12 * * *',  -- 12:00 UTC = 09:00 hora Argentina
  $cron$
  select net.http_post(
    url := 'https://qiyquvcelzitjkqoxpyx.supabase.co/functions/v1/recordatorio-dia-especial',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $cron$
);

-- Para desprogramarlo más adelante:
-- select cron.unschedule('recordatorio-dia-especial');
