-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Estadística de accesos de los cantantes
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor
--
-- Una sola vez por proyecto de Supabase. Sirve para todos los coros que
-- comparten ese proyecto (cada director ve solo los datos de su coro).
-- Se puede ejecutar más de una vez sin problema.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Tabla donde se registra la actividad ────────────────────────
-- tipo:  sesion  = entró a la app
--        seccion = miró una pantalla (Inicio, Avisos, Repertorio...)
--        obra / evento / aviso / texto = abrió uno en particular
-- ref_id: id de la obra / evento / aviso / texto (si corresponde)
-- detalle: sección de la app (inicio, repertorio, calendario, avisos...)
CREATE TABLE IF NOT EXISTS public.actividad_app (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coro_id    uuid        NOT NULL,
  perfil_id  uuid        NOT NULL,
  tipo       text        NOT NULL
                         CHECK (tipo IN ('sesion', 'seccion', 'obra', 'evento', 'aviso', 'texto')),
  ref_id     text,
  detalle    text,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS actividad_app_coro_fecha_idx
  ON public.actividad_app (coro_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS actividad_app_perfil_fecha_idx
  ON public.actividad_app (perfil_id, creado_en DESC);

-- ─── 2. Permisos ────────────────────────────────────────────────────
ALTER TABLE public.actividad_app ENABLE ROW LEVEL SECURITY;

-- Cada persona solo puede registrar su propia actividad, en su propio coro
DROP POLICY IF EXISTS "actividad_insert_propia" ON public.actividad_app;
CREATE POLICY "actividad_insert_propia"
ON public.actividad_app FOR INSERT TO authenticated
WITH CHECK (
  perfil_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = actividad_app.coro_id
  )
);

-- Solo directores y admins ven la actividad, y solo la de su coro
DROP POLICY IF EXISTS "actividad_select_directores" ON public.actividad_app;
CREATE POLICY "actividad_select_directores"
ON public.actividad_app FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.coro_id = actividad_app.coro_id
      AND p.rol IN ('director', 'admin')
  )
);

-- Directores y admins pueden reiniciar la estadística (borrar la actividad de su coro)
DROP POLICY IF EXISTS "actividad_delete_directores" ON public.actividad_app;
CREATE POLICY "actividad_delete_directores"
ON public.actividad_app FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.coro_id = actividad_app.coro_id
      AND p.rol IN ('director', 'admin')
  )
);

-- ─── 3. Resumen por cantante (lo usa la pantalla Estadística) ───────
-- Devuelve una fila por persona del coro, con o sin actividad en el período.
-- Se usa una función (y no una consulta directa) porque Supabase entrega
-- como máximo 1000 filas por consulta.
CREATE OR REPLACE FUNCTION public.estadistica_accesos(p_coro_id uuid, p_desde timestamptz)
RETURNS TABLE (
  perfil_id      uuid,
  nombre         text,
  voz            text,
  rol            text,
  ingresos       bigint,
  dias_activos   bigint,
  vistas         bigint,
  ultimo_ingreso timestamptz,
  secciones      jsonb
)
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  WITH act AS (
    SELECT a.perfil_id, a.tipo, a.detalle, a.creado_en
    FROM public.actividad_app a
    WHERE a.coro_id = p_coro_id
      AND a.creado_en >= p_desde
  ),
  res AS (
    SELECT act.perfil_id,
           COUNT(*) FILTER (WHERE act.tipo = 'sesion')  AS ingresos,
           COUNT(*) FILTER (WHERE act.tipo <> 'sesion') AS vistas,
           COUNT(DISTINCT (act.creado_en AT TIME ZONE 'America/Argentina/Buenos_Aires')::date) AS dias_activos,
           MAX(act.creado_en) AS ultimo_ingreso -- último movimiento de cualquier tipo
    FROM act
    GROUP BY act.perfil_id
  ),
  sec AS (
    SELECT x.perfil_id, jsonb_object_agg(x.detalle, x.n) AS secciones
    FROM (
      SELECT act.perfil_id, act.detalle, COUNT(*) AS n
      FROM act
      WHERE act.tipo <> 'sesion' AND act.detalle IS NOT NULL
      GROUP BY act.perfil_id, act.detalle
    ) x
    GROUP BY x.perfil_id
  )
  SELECT p.id, p.nombre, p.voz, p.rol,
         COALESCE(res.ingresos, 0),
         COALESCE(res.dias_activos, 0),
         COALESCE(res.vistas, 0),
         res.ultimo_ingreso,
         COALESCE(sec.secciones, '{}'::jsonb)
  FROM public.perfiles p
  LEFT JOIN res ON res.perfil_id = p.id
  LEFT JOIN sec ON sec.perfil_id = p.id
  WHERE p.coro_id = p_coro_id
    AND COALESCE(p.estado, 'activo') NOT IN ('pendiente', 'inactivo')
  ORDER BY p.nombre;
$$;

REVOKE ALL ON FUNCTION public.estadistica_accesos(uuid, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.estadistica_accesos(uuid, timestamptz) TO authenticated;

-- ─── 4. Limpieza automática: se conservan 12 meses de historial ────
-- Requiere la extensión pg_cron (ya activa si usás los recordatorios de ensayo).
-- Si este proyecto no la tiene, se puede omitir este paso.
SELECT cron.schedule(
  'limpiar-actividad-app',
  '15 3 * * *',
  $$
    DELETE FROM public.actividad_app
    WHERE creado_en < now() - interval '12 months'
       OR perfil_id NOT IN (SELECT id FROM public.perfiles)
  $$
);
