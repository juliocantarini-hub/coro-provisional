-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Técnica vocal: que directores y admins vean la práctica de sus cantantes
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
--
-- La tabla actividad_entrenamiento ya existe: guarda una fila cada vez que un cantante completa un
-- ejercicio de Entrenamiento (Respiración, Resonancia, Vocalización). Cada cantante sigue viendo solo lo suyo.
-- Esta política agrega que los directores y admins del coro puedan leer la de todos, para la
-- pantalla "Técnica vocal de los cantantes" (qué ejercicios practican y cuántas veces).
-- ═══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "actividad_entrenamiento_select_directores" ON public.actividad_entrenamiento;
CREATE POLICY "actividad_entrenamiento_select_directores"
ON public.actividad_entrenamiento FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.perfiles p
    WHERE p.id = auth.uid()
      AND p.coro_id = actividad_entrenamiento.coro_id
      AND p.rol IN ('director', 'admin')
  )
);
