-- Cambios programados del ensayo semanal (noviembre 2026)
-- Proyectos con varios coros (corum-produccion-1 y coral-voces-02).
-- Requiere haber corrido antes ensayo_fijo.sql.
--
-- Desde Gestión → Eventos → Ensayo semanal se pueden programar a futuro:
--   * "Sin ensayos" de tal mes a tal mes (vacaciones, receso).
--   * "Otro horario" de tal mes a tal mes (día, horario y lugar distintos).
-- La creación automática de cada ensayo (todos los días a las 9) los respeta.
-- Se puede repetir sin problema.

create table if not exists public.ensayo_fijo_cambios (
  id           uuid primary key default gen_random_uuid(),
  coro_id      uuid not null references public.coros(id) on delete cascade,
  tipo         text not null check (tipo in ('sin_ensayo', 'horario')),
  desde        date not null,
  hasta        date not null,
  dia_semana   smallint check (dia_semana between 0 and 6),
  hora_inicio  time,
  hora_fin     time,
  lugar        text,
  creado_en    timestamptz not null default now(),
  check (hasta >= desde)
);

alter table public.ensayo_fijo_cambios enable row level security;
grant select, insert, update, delete on public.ensayo_fijo_cambios to authenticated;

drop policy if exists ensayo_fijo_cambios_director on public.ensayo_fijo_cambios;
create policy ensayo_fijo_cambios_director on public.ensayo_fijo_cambios
  for all to authenticated
  using (public.soy_director_de(coro_id))
  with check (public.soy_director_de(coro_id));

create or replace function public.generar_ensayos_fijos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  c     record;
  d     date;
  dia   smallint;
  hi    time;
  hf    time;
  lug   text;
  n     integer := 0;
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  for r in select * from ensayo_fijo where activo loop
    -- Revisa cada día de la próxima semana
    for i in 1..7 loop
      d := hoy + i;
      continue when r.generado_hasta is not null and d <= r.generado_hasta;

      -- Período sin ensayos
      continue when exists (
        select 1 from ensayo_fijo_cambios x
        where x.coro_id = r.coro_id and x.tipo = 'sin_ensayo' and d between x.desde and x.hasta
      );

      -- Otro horario (si hay varios para la misma fecha, vale el último cargado)
      select * into c from ensayo_fijo_cambios x
      where x.coro_id = r.coro_id and x.tipo = 'horario' and d between x.desde and x.hasta
      order by x.creado_en desc limit 1;

      if found then
        dia := coalesce(c.dia_semana, r.dia_semana);
        hi  := coalesce(c.hora_inicio, r.hora_inicio);
        hf  := case when c.hora_inicio is not null then c.hora_fin else r.hora_fin end;
        lug := coalesce(nullif(c.lugar, ''), r.lugar);
      else
        dia := r.dia_semana;
        hi  := r.hora_inicio;
        hf  := r.hora_fin;
        lug := r.lugar;
      end if;

      continue when extract(dow from d)::int <> dia;

      if not exists (
        select 1 from eventos e
        where e.coro_id = r.coro_id
          and e.tipo = 'ensayo'
          and (e.fecha_inicio at time zone 'America/Argentina/Buenos_Aires')::date = d
      ) then
        insert into eventos (coro_id, titulo, tipo, fecha_inicio, fecha_fin, lugar, publicado, automatico)
        values (
          r.coro_id, r.titulo, 'ensayo',
          (d + hi) at time zone 'America/Argentina/Buenos_Aires',
          case when hf is null then null else (d + hf) at time zone 'America/Argentina/Buenos_Aires' end,
          lug, true, true
        );
        n := n + 1;
      end if;
    end loop;

    -- Hasta acá ya está revisado: si se borra un ensayo, no se vuelve a crear
    update ensayo_fijo set generado_hasta = hoy + 7 where coro_id = r.coro_id;
  end loop;
  return n;
end;
$$;

revoke all on function public.generar_ensayos_fijos() from public, anon;
grant execute on function public.generar_ensayos_fijos() to authenticated;
