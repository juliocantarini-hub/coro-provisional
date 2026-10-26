-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Estudio: resumen de actividad de estudio por cantante (de un coro)
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- Es la función que usa la pantalla admin "Estudio". Ya existe en los proyectos (se creó a mano en su
-- momento); este archivo la deja guardada en el repo y, de paso, borra una versión vieja SIN parámetros
-- que quedó en el proyecto y ya no usa nadie: no filtraba por coro, así que cualquier usuario logueado
-- podía pedir la actividad de estudio de todos los coros del proyecto.
--
-- Qué cuenta: solo las aperturas del detalle de una obra (tipo = 'apertura') de obras publicadas del
-- coro, sin filtro de fechas (todo el historial).
--   obras_unicas   = cuántas obras distintas abrió el cantante
--   total_entradas = cuántas veces abrió el detalle de cualquier obra
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
