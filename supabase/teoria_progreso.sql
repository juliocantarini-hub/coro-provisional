-- ═══════════════════════════════════════════════════════════════════
-- CORUM — "Entendé la partitura": lecciones de teoría completadas por cada cantante
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- Una fila por cantante y lección, con la fecha en que la completó por primera vez.
-- El cantante guarda y ve lo suyo; directores y admins del coro ven todo y pueden borrar.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.teoria_progreso (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coro_id        uuid        NOT NULL,
  perfil_id      uuid        NOT NULL,
  leccion        text        NOT NULL,
  completada_en  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, leccion)
);
CREATE INDEX IF NOT EXISTS teoria_progreso_coro_idx ON public.teoria_progreso (coro_id);

ALTER TABLE public.teoria_progreso ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teoria_progreso TO authenticated;

DROP POLICY IF EXISTS "teoria_progreso_select_propio" ON public.teoria_progreso;
CREATE POLICY "teoria_progreso_select_propio"
ON public.teoria_progreso FOR SELECT TO authenticated
USING (perfil_id = auth.uid());

DROP POLICY IF EXISTS "teoria_progreso_select_directores" ON public.teoria_progreso;
CREATE POLICY "teoria_progreso_select_directores"
ON public.teoria_progreso FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = teoria_progreso.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP POLICY IF EXISTS "teoria_progreso_insert_propio" ON public.teoria_progreso;
CREATE POLICY "teoria_progreso_insert_propio"
ON public.teoria_progreso FOR INSERT TO authenticated
WITH CHECK (
  perfil_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.coro_id = teoria_progreso.coro_id)
);

DROP POLICY IF EXISTS "teoria_progreso_delete_directores" ON public.teoria_progreso;
CREATE POLICY "teoria_progreso_delete_directores"
ON public.teoria_progreso FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = teoria_progreso.coro_id AND p.rol IN ('director', 'admin')
  )
);

NOTIFY pgrst, 'reload schema';
