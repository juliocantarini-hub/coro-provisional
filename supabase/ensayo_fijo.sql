-- Ensayo fijo semanal (noviembre 2026)
-- Proyectos con varios coros (corum-produccion-1 y coral-voces-02).
--
-- Cada coro define su ensayo de todas las semanas (día, hora y lugar) desde
-- Gestión → Eventos. Todos los días a las 9 (hora argentina) se crea solo el
-- próximo ensayo, una semana antes, como un evento más del calendario:
--   * Se publica directo y sin aviso de "Nuevo evento".
--   * Queda marcado como automático (eventos.automatico).
--   * No saltea feriados: si no hay ensayo, se borra el evento y no se vuelve a crear
--     (ensayo_fijo.generado_hasta recuerda hasta qué fecha ya se generó).
--   * Se puede editar como cualquier evento.
-- Se puede repetir sin problema.

create table if not exists public.ensayo_fijo (
  coro_id        uuid primary key references public.coros(id) on delete cascade,
  activo         boolean not null default true,
  dia_semana     smallint not null check (dia_semana between 0 and 6),  -- 0 = domingo … 6 = sábado
  hora_inicio    time not null,
  hora_fin       time,
  lugar          text,
  titulo         text not null default 'Ensayo',
  generado_hasta date,
  actualizado    timestamptz not null default now()
);

alter table public.ensayo_fijo enable row level security;
grant select, insert, update, delete on public.ensayo_fijo to authenticated;

drop policy if exists ensayo_fijo_director on public.ensayo_fijo;
create policy ensayo_fijo_director on public.ensayo_fijo
  for all to authenticated
  using (public.soy_director_de(coro_id))
  with check (public.soy_director_de(coro_id));

alter table public.eventos add column if not exists automatico boolean not null default false;

create or replace function public.generar_ensayos_fijos()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  r     record;
  f     date;
  n     integer := 0;
  hoy   date := (now() at time zone 'America/Argentina/Buenos_Aires')::date;
begin
  for r in select * from ensayo_fijo where activo loop
    -- Próximo día de ensayo entre mañana y dentro de 7 días
    f := hoy + 1 + ((r.dia_semana - extract(dow from hoy + 1)::int + 7) % 7);
    continue when r.generado_hasta is not null and f <= r.generado_hasta;

    if not exists (
      select 1 from eventos e
      where e.coro_id = r.coro_id
        and e.tipo = 'ensayo'
        and (e.fecha_inicio at time zone 'America/Argentina/Buenos_Aires')::date = f
    ) then
      insert into eventos (coro_id, titulo, tipo, fecha_inicio, fecha_fin, lugar, publicado, automatico)
      values (
        r.coro_id, r.titulo, 'ensayo',
        (f + r.hora_inicio) at time zone 'America/Argentina/Buenos_Aires',
        case when r.hora_fin is null then null
             else (f + r.hora_fin) at time zone 'America/Argentina/Buenos_Aires' end,
        r.lugar, true, true
      );
      n := n + 1;
    end if;

    update ensayo_fijo set generado_hasta = f where coro_id = r.coro_id;
  end loop;
  return n;
end;
$$;

revoke all on function public.generar_ensayos_fijos() from public, anon;
grant execute on function public.generar_ensayos_fijos() to authenticated;

-- Todos los días a las 9 de Argentina (12 UTC)
select cron.schedule('generar-ensayos-fijos', '0 12 * * *', $cron$ select public.generar_ensayos_fijos(); $cron$);
