-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Consejos de práctica con IA (Grabarme y ver informe)
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto)
--
-- Solo registra QUIÉN pidió consejos y CUÁNDO, para limitar el uso diario.
-- No guarda audio, ni informes, ni el texto generado.
-- Antes: deployar la función `coaching-informe` y cargar el secret OPENAI_API_KEY (o ANTHROPIC_API_KEY)
-- (Edge Functions → Secrets).
-- ═══════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.coaching_informe_uso (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  perfil_id  uuid        NOT NULL,
  coro_id    uuid        NOT NULL,
  creado_en  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS coaching_informe_uso_perfil_fecha_idx
  ON public.coaching_informe_uso (perfil_id, creado_en DESC);

-- Solo la Edge Function (service_role) escribe y lee esta tabla.
ALTER TABLE public.coaching_informe_uso ENABLE ROW LEVEL SECURITY;
