-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Mensajes sorpresa por pantalla (Repertorio, Calendario, etc.)
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor
--
-- Requiere haber ejecutado antes estadistica_accesos.sql (usa la tabla
-- actividad_app). Una sola vez por proyecto de Supabase; se puede
-- ejecutar más de una vez sin problema.
-- ═══════════════════════════════════════════════════════════════════

-- Cada cantante puede consultar SOLO su propia actividad (la estadística
-- completa sigue siendo solo para directores). Devuelve una única fila:
--   ultima_vista      → la última vez que miró esa pantalla (o abrió algo de ella)
--   primera_actividad → la primera vez que la app registró algo suyo
-- Ambas se calculan con lo ocurrido ANTES de p_antes_de (el momento en que
-- abrió la app), para no contar la visita que está haciendo ahora mismo.
CREATE OR REPLACE FUNCTION public.mi_actividad_resumen(
  p_coro_id   uuid,
  p_seccion   text,
  p_antes_de  timestamptz
)
RETURNS TABLE (
  ultima_vista      timestamptz,
  primera_actividad timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    MAX(a.creado_en) FILTER (WHERE a.tipo <> 'sesion' AND a.detalle = p_seccion),
    MIN(a.creado_en)
  FROM public.actividad_app a
  WHERE a.perfil_id = auth.uid()   -- solo lo propio
    AND a.coro_id   = p_coro_id
    AND a.creado_en < p_antes_de;
$$;

REVOKE ALL ON FUNCTION public.mi_actividad_resumen(uuid, text, timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mi_actividad_resumen(uuid, text, timestamptz) TO authenticated;
