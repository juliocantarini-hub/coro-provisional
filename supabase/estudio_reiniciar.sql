-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Estudio: botón "Reiniciar estudio" (borra el historial de estudio del coro)
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- 1) reiniciar_actividad_estudio(p_coro_id): borra la actividad de estudio (las aperturas de obras) de las obras
--    del coro. Solo la puede ejecutar un director o admin de ESE coro. Devuelve cuántos registros borró.
--    Después de borrar, el porcentaje de estudio de todos vuelve a cero (el del director y el que ven los
--    cantantes en Repertorio). No toca Estadística ni Entrenamiento.
-- 2) Deja la función get_actividad_estudio_resumen(p_coro_id) como estaba (todo el historial) y borra una
--    tabla estudio_periodos que pudo quedar de una prueba anterior ("Empezar nuevo período"), si existía.
-- ═══════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_actividad_estudio_resumen();

CREATE OR REPLACE FUNCTION public.get_actividad_estudio_resumen(p_coro_id uuid)
RETURNS TABLE(usuario_id uuid, obras_unicas bigint, total_entradas bigint)
LANGUAGE sql
SECURITY DEFINER
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
  GROUP BY a.usuario_id;
$function$;

DROP TABLE IF EXISTS public.estudio_periodos;

CREATE OR REPLACE FUNCTION public.reiniciar_actividad_estudio(p_coro_id uuid)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  borradas bigint;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = p_coro_id AND p.rol IN ('director', 'admin')
  ) THEN
    RAISE EXCEPTION 'No tenés permiso para reiniciar el estudio de este coro.';
  END IF;

  DELETE FROM public.actividad_estudio a
  USING public.obras o
  WHERE o.id = a.obra_id AND o.coro_id = p_coro_id;

  GET DIAGNOSTICS borradas = ROW_COUNT;
  RETURN borradas;
END;
$function$;

REVOKE ALL ON FUNCTION public.reiniciar_actividad_estudio(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reiniciar_actividad_estudio(uuid) TO authenticated;
