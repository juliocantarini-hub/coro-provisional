-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Entrenamiento: "Práctica por voz" (audio generado desde MusicXML)
-- Ejecutar en: supabase.com → proyecto correspondiente → SQL Editor (todo junto)
-- Se puede ejecutar más de una vez sin problema (usa IF NOT EXISTS / OR REPLACE).
--
-- Qué crea:
--   · Tabla partituras_entrenamiento: una fila por obra cargada para practicar
--     por voz. Guarda el MusicXML en texto plano (no hace falta Storage).
--     Es independiente de "obras" / Repertorio — vive solo en Entrenamiento.
--   · RLS: cualquier miembro activo del coro puede leer las publicadas;
--     solo directores/admins de ese coro pueden crear, editar, borrar y publicar.
--     Usa las mismas funciones mis_coros_activos() / soy_director_de() que ya
--     están creadas por cerrar_tablas_produccion_1.sql / cerrar_perfiles_*.sql.
--     Si este proyecto todavía no las tiene, este script las crea también.
-- ═══════════════════════════════════════════════════════════════════

BEGIN;

-- ─── 0. Funciones de apoyo (por si este proyecto no corrió antes los otros scripts) ─
CREATE OR REPLACE FUNCTION public.mis_coros_activos()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT coro_id FROM public.perfiles
  WHERE id = auth.uid()
    AND (rol IN ('director', 'admin') OR estado IN ('activo', 'pausa'));
$$;

CREATE OR REPLACE FUNCTION public.soy_director_de(p_coro uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.perfiles
    WHERE id = auth.uid() AND coro_id = p_coro AND rol IN ('director', 'admin')
  );
$$;

-- ─── 1. Tabla ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.partituras_entrenamiento (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  coro_id       uuid NOT NULL REFERENCES public.coros(id) ON DELETE CASCADE,
  titulo        text NOT NULL,
  compositor    text,
  musicxml      text NOT NULL,     -- contenido del MusicXML, en texto plano
  duracion_seg  numeric,           -- duración total calculada al subirla (informativa)
  publicada     boolean NOT NULL DEFAULT false,
  creado_en     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partituras_entrenamiento_coro_idx
  ON public.partituras_entrenamiento (coro_id);

ALTER TABLE public.partituras_entrenamiento ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Miembros activos pueden leer partituras publicadas" ON public.partituras_entrenamiento;
CREATE POLICY "Miembros activos pueden leer partituras publicadas"
  ON public.partituras_entrenamiento FOR SELECT
  USING (publicada = true AND coro_id IN (SELECT public.mis_coros_activos()));

DROP POLICY IF EXISTS "Directores pueden leer todas las partituras de su coro" ON public.partituras_entrenamiento;
CREATE POLICY "Directores pueden leer todas las partituras de su coro"
  ON public.partituras_entrenamiento FOR SELECT
  USING (public.soy_director_de(coro_id));

DROP POLICY IF EXISTS "Directores pueden crear partituras" ON public.partituras_entrenamiento;
CREATE POLICY "Directores pueden crear partituras"
  ON public.partituras_entrenamiento FOR INSERT
  WITH CHECK (public.soy_director_de(coro_id));

DROP POLICY IF EXISTS "Directores pueden editar partituras de su coro" ON public.partituras_entrenamiento;
CREATE POLICY "Directores pueden editar partituras de su coro"
  ON public.partituras_entrenamiento FOR UPDATE
  USING (public.soy_director_de(coro_id))
  WITH CHECK (public.soy_director_de(coro_id));

DROP POLICY IF EXISTS "Directores pueden borrar partituras de su coro" ON public.partituras_entrenamiento;
CREATE POLICY "Directores pueden borrar partituras de su coro"
  ON public.partituras_entrenamiento FOR DELETE
  USING (public.soy_director_de(coro_id));

COMMIT;
