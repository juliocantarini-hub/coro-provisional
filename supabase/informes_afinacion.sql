-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Informes de afinación para el director ("Grabarme y ver informe")
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- Guarda, cada vez que un cantante termina un informe, un RESUMEN EN NÚMEROS
-- (porcentajes, corrimiento, estado por compás, mensajes y la curva de altura).
-- NUNCA se guarda el audio. Solo directores y admins del coro pueden verlos;
-- el cantante no ve historial (solo el informe de la toma actual en su pantalla).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.informes_afinacion (
  id               bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coro_id          uuid        NOT NULL,
  perfil_id        uuid        NOT NULL,
  obra_titulo      text,
  voz              text,
  compas_desde     text,
  compas_hasta     text,
  pct_afinacion    integer,
  pct_ritmo        integer,
  corrimiento_cents integer,
  confianza        numeric,
  dudosa           boolean     NOT NULL DEFAULT false,
  resumen          jsonb,
  compases         jsonb,
  mensajes         jsonb,
  diagnostico      jsonb,
  creado_en        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS informes_afinacion_coro_fecha_idx
  ON public.informes_afinacion (coro_id, creado_en DESC);
CREATE INDEX IF NOT EXISTS informes_afinacion_perfil_fecha_idx
  ON public.informes_afinacion (perfil_id, creado_en DESC);

ALTER TABLE public.informes_afinacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.informes_afinacion TO authenticated;

-- Cada persona solo puede registrar sus propios informes, en su propio coro
DROP POLICY IF EXISTS "informes_afinacion_insert_propio" ON public.informes_afinacion;
CREATE POLICY "informes_afinacion_insert_propio"
ON public.informes_afinacion FOR INSERT TO authenticated
WITH CHECK (
  perfil_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = informes_afinacion.coro_id
  )
);

-- Solo directores y admins ven los informes, y solo los de su coro
DROP POLICY IF EXISTS "informes_afinacion_select_directores" ON public.informes_afinacion;
CREATE POLICY "informes_afinacion_select_directores"
ON public.informes_afinacion FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.coro_id = informes_afinacion.coro_id
      AND p.rol IN ('director', 'admin')
  )
);

-- Directores y admins pueden borrar informes de su coro
DROP POLICY IF EXISTS "informes_afinacion_delete_directores" ON public.informes_afinacion;
CREATE POLICY "informes_afinacion_delete_directores"
ON public.informes_afinacion FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.coro_id = informes_afinacion.coro_id
      AND p.rol IN ('director', 'admin')
  )
);
