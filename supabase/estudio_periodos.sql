-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Estudio: "Empezar nuevo período" (el porcentaje de estudio cuenta desde una fecha)
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- 1) Tabla estudio_periodos: cada vez que el director toca "Empezar nuevo período" en Estudio se guarda una
--    fila con la fecha. El período vigente es la última. No se borra la actividad de estudio: solo se
--    deja de contar lo anterior a esa fecha. "Volver al período anterior" borra esa última fila.
-- 2) Función get_actividad_estudio_resumen(p_coro_id): la que usa la pantalla Estudio. Ahora cuenta solo desde
--    el período vigente (si no hay ninguno, todo el historial). Solo aperturas del detalle de una obra
--    (tipo = 'apertura') de obras publicadas del coro.
--      obras_unicas   = cuántas obras distintas abrió el cantante
--      total_entradas = cuántas veces abrió el detalle de cualquier obra
-- 3) Borra una versión vieja de la función SIN parámetros (no filtraba por coro y ya no la usa nadie).
-- Los cantantes leen la fecha de inicio para que su propio porcentaje (Repertorio) cuente igual que el del director.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.estudio_periodos (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coro_id     uuid        NOT NULL,
  desde       timestamptz NOT NULL DEFAULT now(),
  creado_por  uuid        DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS estudio_periodos_coro_idx
  ON public.estudio_periodos (coro_id, created_at DESC);

ALTER TABLE public.estudio_periodos ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.estudio_periodos TO authenticated;

DROP POLICY IF EXISTS "estudio_periodos_select" ON public.estudio_periodos;
CREATE POLICY "estudio_periodos_select"
ON public.estudio_periodos FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = estudio_periodos.coro_id
  )
);

DROP POLICY IF EXISTS "estudio_periodos_insert_directores" ON public.estudio_periodos;
CREATE POLICY "estudio_periodos_insert_directores"
ON public.estudio_periodos FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = estudio_periodos.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP POLICY IF EXISTS "estudio_periodos_delete_directores" ON public.estudio_periodos;
CREATE POLICY "estudio_periodos_delete_directores"
ON public.estudio_periodos FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = estudio_periodos.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP FUNCTION IF EXISTS public.get_actividad_estudio_resumen();

CREATE OR REPLACE FUNCTION public.get_actividad_estudio_resumen(p_coro_id uuid)
RETURNS TABLE(usuario_id uuid, obras_unicas bigint, total_entradas bigint)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $function$
  SELECT
    a.usuario_id,
    COUNT(DISTINCT a.obra_id) AS obras_unicas,
    COUNT(*) AS total_entradas
  FROM actividad_estudio a
  JOIN perfiles p ON p.id = a.usuario_id
  JOIN obras o ON o.id = a.obra_id
  WHERE a.tipo = 'apertura'
  AND p.coro_id = p_coro_id
  AND o.coro_id = p_coro_id
  AND o.publicada = true
  AND a.created_at >= COALESCE(
    (SELECT e.desde FROM estudio_periodos e WHERE e.coro_id = p_coro_id ORDER BY e.created_at DESC LIMIT 1),
    '-infinity'::timestamptz)
  GROUP BY a.usuario_id;
$function$;
