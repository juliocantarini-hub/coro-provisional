-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Entrenamiento rítmico: progreso de cada cantante
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- ritmo_progreso: el mejor resultado de cada cantante en cada ejercicio (nivel 1 a 8, ejercicio 1 a 5).
-- ritmo_ajustes:  lo que el director decide por cantante: abrir todos los niveles ("nivel_hasta")
--                 o reiniciar el progreso ("reiniciado_en").
-- El cantante ve y guarda lo suyo; directores y admins del coro ven todo y pueden
-- desbloquear niveles o reiniciar el progreso de un cantante.
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.ritmo_progreso (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  coro_id        uuid        NOT NULL,
  perfil_id      uuid        NOT NULL,
  nivel          integer     NOT NULL,
  ejercicio      integer     NOT NULL,
  mejor_pct      integer     NOT NULL DEFAULT 0,
  ultimo_pct     integer,
  intentos       integer     NOT NULL DEFAULT 0,
  actualizado_en timestamptz NOT NULL DEFAULT now(),
  UNIQUE (perfil_id, nivel, ejercicio)
);
CREATE INDEX IF NOT EXISTS ritmo_progreso_coro_idx ON public.ritmo_progreso (coro_id);

CREATE TABLE IF NOT EXISTS public.ritmo_ajustes (
  perfil_id      uuid        PRIMARY KEY,
  coro_id        uuid        NOT NULL,
  nivel_hasta    integer     NOT NULL DEFAULT 0,
  reiniciado_en  timestamptz,
  actualizado_en timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ritmo_ajustes_coro_idx ON public.ritmo_ajustes (coro_id);

ALTER TABLE public.ritmo_progreso ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ritmo_ajustes  ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ritmo_progreso TO authenticated;
GRANT SELECT, INSERT, UPDATE         ON public.ritmo_ajustes  TO authenticated;

-- ── ritmo_progreso ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "ritmo_progreso_select_propio" ON public.ritmo_progreso;
CREATE POLICY "ritmo_progreso_select_propio"
ON public.ritmo_progreso FOR SELECT TO authenticated
USING (perfil_id = auth.uid());

DROP POLICY IF EXISTS "ritmo_progreso_select_directores" ON public.ritmo_progreso;
CREATE POLICY "ritmo_progreso_select_directores"
ON public.ritmo_progreso FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_progreso.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP POLICY IF EXISTS "ritmo_progreso_insert_propio" ON public.ritmo_progreso;
CREATE POLICY "ritmo_progreso_insert_propio"
ON public.ritmo_progreso FOR INSERT TO authenticated
WITH CHECK (
  perfil_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.coro_id = ritmo_progreso.coro_id)
);

DROP POLICY IF EXISTS "ritmo_progreso_update_propio" ON public.ritmo_progreso;
CREATE POLICY "ritmo_progreso_update_propio"
ON public.ritmo_progreso FOR UPDATE TO authenticated
USING (perfil_id = auth.uid())
WITH CHECK (perfil_id = auth.uid());

DROP POLICY IF EXISTS "ritmo_progreso_delete_directores" ON public.ritmo_progreso;
CREATE POLICY "ritmo_progreso_delete_directores"
ON public.ritmo_progreso FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_progreso.coro_id AND p.rol IN ('director', 'admin')
  )
);

-- ── ritmo_ajustes ───────────────────────────────────────────────────
DROP POLICY IF EXISTS "ritmo_ajustes_select_propio" ON public.ritmo_ajustes;
CREATE POLICY "ritmo_ajustes_select_propio"
ON public.ritmo_ajustes FOR SELECT TO authenticated
USING (perfil_id = auth.uid());

DROP POLICY IF EXISTS "ritmo_ajustes_select_directores" ON public.ritmo_ajustes;
CREATE POLICY "ritmo_ajustes_select_directores"
ON public.ritmo_ajustes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_ajustes.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP POLICY IF EXISTS "ritmo_ajustes_insert_directores" ON public.ritmo_ajustes;
CREATE POLICY "ritmo_ajustes_insert_directores"
ON public.ritmo_ajustes FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_ajustes.coro_id AND p.rol IN ('director', 'admin')
  )
);

DROP POLICY IF EXISTS "ritmo_ajustes_update_directores" ON public.ritmo_ajustes;
CREATE POLICY "ritmo_ajustes_update_directores"
ON public.ritmo_ajustes FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_ajustes.coro_id AND p.rol IN ('director', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid() AND p.coro_id = ritmo_ajustes.coro_id AND p.rol IN ('director', 'admin')
  )
);
