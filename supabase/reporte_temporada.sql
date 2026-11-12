-- ═══════════════════════════════════════════════════════════════════
-- CORUM — Reporte de fin de temporada
-- Ejecutar en: supabase.com → tu proyecto → SQL Editor (una vez por proyecto).
-- Se puede ejecutar más de una vez sin problema.
-- Requiere la función soy_director_de(uuid) (cerrar_perfiles_produccion_1.sql).
--
-- Cómo funciona:
--  1) El director elige el rango de la temporada y toca "Generar". La función
--     generar_reportes_temporada calcula los números de cada cantante y los guarda
--     CONGELADOS en reportes_temporada (una fila por cantante y temporada), en borrador.
--  2) El director revisa cada uno, puede ocultar secciones, agregar un mensaje
--     personal o excluir a alguien.
--  3) Publica de a un cantante. Recién ahí el cantante puede leer su fila.
--  Regenerar actualiza los borradores, pero nunca toca un reporte ya publicado.
--
--  reporte_temporada_coro devuelve el resumen general del coro (solo directores),
--  calculado en el momento, para el rango que se elija.
--
--  Fuentes: asistencia (listas_asistencia / registros_asistencia), eventos publicados,
--  aperturas de obras (actividad_estudio), progreso_estudio, actividad_entrenamiento y
--  teoria_progreso. El reporte del CANTANTE no usa actividad_app (uso por pantalla) ni
--  informes de afinación: esos datos solo aparecen en el resumen general del director.
-- ═══════════════════════════════════════════════════════════════════

-- ─── 1. Tabla ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.reportes_temporada (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coro_id         uuid        NOT NULL,
  perfil_id       uuid        NOT NULL,
  temporada       integer     NOT NULL,
  desde           date        NOT NULL,
  hasta           date        NOT NULL,
  datos           jsonb       NOT NULL DEFAULT '{}'::jsonb,
  ocultas         text[]      NOT NULL DEFAULT '{}',
  mensaje         text,
  estado          text        NOT NULL DEFAULT 'borrador'
                              CHECK (estado IN ('borrador', 'publicado', 'excluido')),
  generado_en     timestamptz NOT NULL DEFAULT now(),
  publicado_en    timestamptz,
  visto_en        timestamptz,
  destacar_hasta  date,
  UNIQUE (coro_id, perfil_id, temporada)
);
CREATE INDEX IF NOT EXISTS reportes_temporada_perfil_idx ON public.reportes_temporada (perfil_id, estado);

ALTER TABLE public.reportes_temporada ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.reportes_temporada FROM anon;
GRANT SELECT, UPDATE, DELETE ON public.reportes_temporada TO authenticated;

-- El cantante ve solo el suyo, y solo si está publicado
DROP POLICY IF EXISTS "reportes_temporada_select_propio" ON public.reportes_temporada;
CREATE POLICY "reportes_temporada_select_propio"
ON public.reportes_temporada FOR SELECT TO authenticated
USING (
  perfil_id = auth.uid()
  AND estado = 'publicado'
  AND EXISTS (SELECT 1 FROM public.perfiles p WHERE p.id = auth.uid() AND p.coro_id = reportes_temporada.coro_id)
);

-- Directores y admins del coro: ven, editan y borran todos los de su coro
DROP POLICY IF EXISTS "reportes_temporada_select_directores" ON public.reportes_temporada;
CREATE POLICY "reportes_temporada_select_directores"
ON public.reportes_temporada FOR SELECT TO authenticated
USING (public.soy_director_de(coro_id));

DROP POLICY IF EXISTS "reportes_temporada_update_directores" ON public.reportes_temporada;
CREATE POLICY "reportes_temporada_update_directores"
ON public.reportes_temporada FOR UPDATE TO authenticated
USING (public.soy_director_de(coro_id))
WITH CHECK (public.soy_director_de(coro_id));

DROP POLICY IF EXISTS "reportes_temporada_delete_directores" ON public.reportes_temporada;
CREATE POLICY "reportes_temporada_delete_directores"
ON public.reportes_temporada FOR DELETE TO authenticated
USING (public.soy_director_de(coro_id));

-- ─── 2. El cantante marca que ya lo vio (solo puede tocar visto_en) ─
CREATE OR REPLACE FUNCTION public.marcar_reporte_temporada_visto(p_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE public.reportes_temporada
     SET visto_en = now()
   WHERE id = p_id AND perfil_id = auth.uid() AND estado = 'publicado' AND visto_en IS NULL;
$$;
REVOKE ALL ON FUNCTION public.marcar_reporte_temporada_visto(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.marcar_reporte_temporada_visto(uuid) TO authenticated;

-- ─── 3. Generar (o regenerar) los borradores ─────────────────────────
-- p_perfil_id opcional: regenerar uno solo.
CREATE OR REPLACE FUNCTION public.generar_reportes_temporada(
  p_coro_id uuid, p_temporada integer, p_desde date, p_hasta date, p_perfil_id uuid DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz constant text := 'America/Argentina/Buenos_Aires';
  t_desde timestamptz := (p_desde::timestamp AT TIME ZONE tz);
  t_fin   timestamptz := ((p_hasta + 1)::timestamp AT TIME ZONE tz);
  v_hay_listas boolean;
  v_obras uuid[];
  v_total_obras integer;
  r record;
  v_inicio date;
  t_ini timestamptz;
  v_eventos jsonb; v_asist jsonb; v_estudio jsonb; v_entr jsonb; v_const jsonb;
  v_listas integer; v_pres integer; v_just integer; v_aus integer; v_conreg integer; v_racha integer;
  v_mejor_mes_asist jsonb;
  v_ap integer; v_unicas integer; v_estudiadas integer; v_ded integer; v_top jsonb; v_top3 jsonb;
  v_ejercicios integer; v_teoria integer;
  v_dias date[]; v_racha_dias integer; v_mejor_mes jsonb; v_por_mes jsonb; v_asist_mes jsonb;
  v_n integer := 0;
BEGIN
  IF NOT public.soy_director_de(p_coro_id) THEN
    RAISE EXCEPTION 'Solo los directores del coro pueden generar el reporte';
  END IF;
  IF p_hasta < p_desde THEN
    RAISE EXCEPTION 'La fecha final es anterior a la inicial';
  END IF;

  SELECT EXISTS (SELECT 1 FROM listas_asistencia WHERE coro_id = p_coro_id AND fecha BETWEEN p_desde AND p_hasta)
    INTO v_hay_listas;

  -- Obras de la temporada: publicadas hoy o que alguien abrió durante la temporada
  -- (así cuenta el estudio de obras que después se despublicaron).
  SELECT coalesce(array_agg(o.id), '{}') INTO v_obras
    FROM obras o
   WHERE o.coro_id = p_coro_id
     AND (o.creado_en IS NULL OR o.creado_en < t_fin)
     AND (o.publicada OR EXISTS (
           SELECT 1 FROM actividad_estudio a
            WHERE a.obra_id = o.id AND a.tipo = 'apertura' AND a.created_at >= t_desde AND a.created_at < t_fin));
  v_total_obras := coalesce(array_length(v_obras, 1), 0);

  FOR r IN
    SELECT pf.id, pf.nombre, pf.voz, pf.rol, pf.creado_en
      FROM perfiles pf
     WHERE pf.coro_id = p_coro_id AND pf.estado = 'activo'
       AND (p_perfil_id IS NULL OR pf.id = p_perfil_id)
  LOOP
    -- Se cuenta desde que la persona entró al coro (o desde el inicio de la temporada)
    v_inicio := greatest(p_desde, coalesce((r.creado_en AT TIME ZONE tz)::date, p_desde));
    IF v_inicio > p_hasta THEN CONTINUE; END IF;
    t_ini := (v_inicio::timestamp AT TIME ZONE tz);

    -- Eventos del coro dentro de la temporada (publicados, o ya ocurridos aunque se hayan despublicado) desde que entró
    SELECT jsonb_build_object(
             'conciertos', count(*) FILTER (WHERE e.tipo = 'concierto'),
             'ensayos',    count(*) FILTER (WHERE e.tipo = 'ensayo'),
             'otros',      count(*) FILTER (WHERE e.tipo NOT IN ('concierto', 'ensayo')),
             'lista_conciertos', coalesce(
                jsonb_agg(jsonb_build_object('titulo', e.titulo, 'fecha', (e.fecha_inicio AT TIME ZONE tz)::date, 'lugar', e.lugar)
                          ORDER BY e.fecha_inicio) FILTER (WHERE e.tipo = 'concierto'), '[]'::jsonb))
      INTO v_eventos
      FROM eventos e
     WHERE e.coro_id = p_coro_id AND (e.publicado OR e.fecha_inicio <= now())
       AND e.fecha_inicio >= t_ini AND e.fecha_inicio < t_fin;

    -- Asistencia
    IF NOT v_hay_listas THEN
      v_asist := jsonb_build_object('sin_registro', true);
    ELSE
      WITH l AS (
        SELECT la.id, la.fecha, rg.estado
          FROM listas_asistencia la
          LEFT JOIN registros_asistencia rg ON rg.lista_id = la.id AND rg.perfil_id = r.id
         WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN v_inicio AND p_hasta
      )
      SELECT count(*), count(*) FILTER (WHERE estado = 'presente'), count(*) FILTER (WHERE estado = 'justificado'),
             count(*) FILTER (WHERE estado = 'ausente'), count(estado)
        INTO v_listas, v_pres, v_just, v_aus, v_conreg
        FROM l;

      WITH l AS (
        SELECT la.id, la.fecha, coalesce(rg.estado = 'presente', false) AS pres
          FROM listas_asistencia la
          LEFT JOIN registros_asistencia rg ON rg.lista_id = la.id AND rg.perfil_id = r.id
         WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN v_inicio AND p_hasta
      ), g AS (
        SELECT pres, row_number() OVER (ORDER BY fecha, id) - row_number() OVER (PARTITION BY pres ORDER BY fecha, id) AS grupo
          FROM l
      )
      SELECT coalesce(max(c), 0) INTO v_racha
        FROM (SELECT count(*) AS c FROM g WHERE pres GROUP BY grupo) x;

      SELECT jsonb_build_object('mes', m, 'pct', pct, 'listas', n) INTO v_mejor_mes_asist
        FROM (
          SELECT to_char(la.fecha, 'YYYY-MM') AS m,
                 round(100.0 * count(*) FILTER (WHERE rg.estado = 'presente') / count(*)) AS pct,
                 count(*) AS n
            FROM listas_asistencia la
            LEFT JOIN registros_asistencia rg ON rg.lista_id = la.id AND rg.perfil_id = r.id
           WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN v_inicio AND p_hasta
           GROUP BY 1
          HAVING count(*) >= 2
           ORDER BY pct DESC, n DESC
           LIMIT 1
        ) mm;

      SELECT coalesce(jsonb_agg(jsonb_build_object('mes', m, 'listas', n, 'presentes', p, 'pct', round(100.0 * p / n)) ORDER BY m), '[]'::jsonb)
        INTO v_asist_mes
        FROM (
          SELECT to_char(la.fecha, 'YYYY-MM') AS m, count(*) AS n, count(*) FILTER (WHERE rg.estado = 'presente') AS p
            FROM listas_asistencia la
            LEFT JOIN registros_asistencia rg ON rg.lista_id = la.id AND rg.perfil_id = r.id
           WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN v_inicio AND p_hasta
           GROUP BY 1
        ) am;

      v_asist := jsonb_build_object(
        'sin_registro', false, 'por_mes', v_asist_mes,
        'listas', v_listas, 'presentes', v_pres, 'justificados', v_just, 'ausentes', v_aus,
        'sin_marcar', v_listas - v_conreg,
        'pct', CASE WHEN v_listas > 0 THEN round(100.0 * v_pres / v_listas) END,
        'racha', v_racha,
        'mejor_mes', v_mejor_mes_asist);
    END IF;

    -- Estudio del repertorio
    SELECT count(*), count(DISTINCT a.obra_id) INTO v_ap, v_unicas
      FROM actividad_estudio a
     WHERE a.usuario_id = r.id AND a.tipo = 'apertura' AND a.obra_id = ANY (v_obras)
       AND a.created_at >= t_ini AND a.created_at < t_fin;

    SELECT coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'veces', veces) ORDER BY veces DESC, titulo), '[]'::jsonb)
      INTO v_top3
      FROM (
        SELECT o.titulo, count(*) AS veces
          FROM actividad_estudio a JOIN obras o ON o.id = a.obra_id
         WHERE a.usuario_id = r.id AND a.tipo = 'apertura' AND a.obra_id = ANY (v_obras)
           AND a.created_at >= t_ini AND a.created_at < t_fin
         GROUP BY o.id, o.titulo
         ORDER BY count(*) DESC, o.titulo
         LIMIT 3
      ) t;
    v_top := CASE WHEN jsonb_array_length(v_top3) > 0 THEN v_top3 -> 0 END;

    SELECT count(*) INTO v_estudiadas
      FROM progreso_estudio pe
     WHERE pe.perfil_id = r.id AND pe.estado = 'estudiada' AND pe.obra_id = ANY (v_obras);

    -- Misma fórmula que Repertorio: (cobertura + frecuencia) / 2, umbral 30 aperturas por obra
    v_ded := CASE WHEN v_total_obras > 0 THEN
               least(100, round((100.0 * v_unicas / v_total_obras
                 + least(100, (CASE WHEN v_unicas > 0 THEN v_ap::numeric / v_unicas ELSE 0 END) / 30 * 100)) / 2))::int
             END;

    v_estudio := jsonb_build_object(
      'obras_temporada', v_total_obras, 'obras_abiertas', v_unicas, 'aperturas', v_ap,
      'estudiadas', v_estudiadas, 'dedicacion', v_ded, 'obra_top', v_top, 'obras_top', v_top3);

    -- Entrenamiento
    SELECT count(*) INTO v_ejercicios
      FROM actividad_entrenamiento ae
     WHERE ae.cantante_id = r.id AND (ae.coro_id IS NULL OR ae.coro_id = p_coro_id)
       AND ae.completado_en >= t_ini AND ae.completado_en < t_fin;

    SELECT count(*) INTO v_teoria
      FROM teoria_progreso tp
     WHERE tp.perfil_id = r.id AND tp.coro_id = p_coro_id
       AND tp.completada_en >= t_ini AND tp.completada_en < t_fin;

    v_entr := jsonb_build_object('ejercicios', v_ejercicios, 'lecciones_teoria', v_teoria);

    -- Constancia: días con estudio o entrenamiento (no usa el registro de pantallas)
    SELECT coalesce(array_agg(DISTINCT d ORDER BY d), '{}') INTO v_dias
      FROM (
        SELECT (a.created_at AT TIME ZONE tz)::date AS d FROM actividad_estudio a
         WHERE a.usuario_id = r.id AND a.obra_id = ANY (v_obras) AND a.created_at >= t_ini AND a.created_at < t_fin
        UNION
        SELECT (ae.completado_en AT TIME ZONE tz)::date FROM actividad_entrenamiento ae
         WHERE ae.cantante_id = r.id AND (ae.coro_id IS NULL OR ae.coro_id = p_coro_id)
           AND ae.completado_en >= t_ini AND ae.completado_en < t_fin
        UNION
        SELECT (tp.completada_en AT TIME ZONE tz)::date FROM teoria_progreso tp
         WHERE tp.perfil_id = r.id AND tp.coro_id = p_coro_id AND tp.completada_en >= t_ini AND tp.completada_en < t_fin
      ) dd;

    SELECT coalesce(max(c), 0) INTO v_racha_dias
      FROM (SELECT count(*) AS c FROM (SELECT d, d - (row_number() OVER (ORDER BY d))::int AS g FROM unnest(v_dias) AS d) x GROUP BY g) y;

    SELECT jsonb_build_object('mes', m, 'dias', n) INTO v_mejor_mes
      FROM (SELECT to_char(d, 'YYYY-MM') AS m, count(*) AS n FROM unnest(v_dias) AS d GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 1) mm;

    -- Días de práctica de cada mes de la temporada (para el gráfico), hasta hoy
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'mes', to_char(mm.m, 'YYYY-MM'),
             'dias', (SELECT count(*) FROM unnest(v_dias) AS d WHERE date_trunc('month', d::timestamp) = mm.m)
           ) ORDER BY mm.m), '[]'::jsonb)
      INTO v_por_mes
      FROM generate_series(date_trunc('month', v_inicio::timestamp),
                           date_trunc('month', least(p_hasta, current_date)::timestamp),
                           interval '1 month') AS mm(m);

    v_const := jsonb_build_object('dias_activos', coalesce(array_length(v_dias, 1), 0), 'racha_dias', v_racha_dias,
                                  'mejor_mes', v_mejor_mes, 'por_mes', v_por_mes);

    INSERT INTO reportes_temporada (coro_id, perfil_id, temporada, desde, hasta, datos, estado, generado_en)
    VALUES (
      p_coro_id, r.id, p_temporada, v_inicio, p_hasta,
      jsonb_build_object(
        'nombre', r.nombre, 'voz', r.voz, 'temporada', p_temporada,
        'desde', v_inicio, 'hasta', p_hasta, 'ingreso_en_temporada', v_inicio > p_desde,
        'eventos', v_eventos, 'asistencia', v_asist, 'estudio', v_estudio,
        'entrenamiento', v_entr, 'constancia', v_const),
      CASE WHEN r.rol = 'cantante' THEN 'borrador' ELSE 'excluido' END,
      now())
    ON CONFLICT (coro_id, perfil_id, temporada) DO UPDATE
       SET desde = EXCLUDED.desde, hasta = EXCLUDED.hasta, datos = EXCLUDED.datos, generado_en = now()
     WHERE reportes_temporada.estado <> 'publicado';

    v_n := v_n + 1;
  END LOOP;

  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.generar_reportes_temporada(uuid, integer, date, date, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generar_reportes_temporada(uuid, integer, date, date, uuid) TO authenticated;

-- ─── 4. Resumen general del coro (solo directores) ──────────────────
CREATE OR REPLACE FUNCTION public.reporte_temporada_coro(p_coro_id uuid, p_desde date, p_hasta date)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tz constant text := 'America/Argentina/Buenos_Aires';
  t_desde timestamptz := (p_desde::timestamp AT TIME ZONE tz);
  t_fin   timestamptz := ((p_hasta + 1)::timestamp AT TIME ZONE tz);
  v_obras uuid[];
  v_total_obras integer;
  v_activos integer;
  v_cantantes jsonb; v_asist jsonb; v_eventos jsonb; v_rep jsonb; v_entr jsonb; v_uso jsonb; v_part jsonb; v_desde jsonb;
BEGIN
  IF NOT public.soy_director_de(p_coro_id) THEN
    RAISE EXCEPTION 'Solo los directores del coro pueden ver el resumen';
  END IF;

  SELECT coalesce(array_agg(o.id), '{}') INTO v_obras
    FROM obras o
   WHERE o.coro_id = p_coro_id
     AND (o.creado_en IS NULL OR o.creado_en < t_fin)
     AND (o.publicada OR EXISTS (
           SELECT 1 FROM actividad_estudio a
            WHERE a.obra_id = o.id AND a.tipo = 'apertura' AND a.created_at >= t_desde AND a.created_at < t_fin));
  v_total_obras := coalesce(array_length(v_obras, 1), 0);

  -- Cantantes activos
  SELECT count(*) INTO v_activos FROM perfiles WHERE coro_id = p_coro_id AND estado = 'activo' AND rol = 'cantante';
  SELECT jsonb_build_object('activos', v_activos, 'por_cuerda',
           coalesce(jsonb_agg(jsonb_build_object('voz', voz, 'n', n) ORDER BY n DESC), '[]'::jsonb))
    INTO v_cantantes
    FROM (SELECT coalesce(nullif(lower(trim(voz)), ''), 'sin cuerda') AS voz, count(*) AS n
            FROM perfiles WHERE coro_id = p_coro_id AND estado = 'activo' AND rol = 'cantante' GROUP BY 1) c;

  -- Asistencia
  IF NOT EXISTS (SELECT 1 FROM listas_asistencia WHERE coro_id = p_coro_id AND fecha BETWEEN p_desde AND p_hasta) THEN
    v_asist := jsonb_build_object('sin_registro', true);
  ELSE
    WITH rg AS (
      SELECT la.fecha, rr.estado, coalesce(nullif(lower(trim(pf.voz)), ''), 'sin cuerda') AS voz
        FROM listas_asistencia la
        JOIN registros_asistencia rr ON rr.lista_id = la.id
        LEFT JOIN perfiles pf ON pf.id = rr.perfil_id AND pf.coro_id = p_coro_id
       WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN p_desde AND p_hasta
    )
    SELECT jsonb_build_object(
      'sin_registro', false,
      'listas', (SELECT count(*) FROM listas_asistencia WHERE coro_id = p_coro_id AND fecha BETWEEN p_desde AND p_hasta),
      'pct', (SELECT round(100.0 * count(*) FILTER (WHERE estado = 'presente') / nullif(count(*), 0)) FROM rg),
      'por_cuerda', (SELECT coalesce(jsonb_agg(jsonb_build_object('voz', voz, 'pct', pct) ORDER BY voz), '[]'::jsonb)
                       FROM (SELECT voz, round(100.0 * count(*) FILTER (WHERE estado = 'presente') / count(*)) AS pct FROM rg GROUP BY voz) x),
      'por_mes', (SELECT coalesce(jsonb_agg(jsonb_build_object('mes', m, 'pct', pct, 'listas', n) ORDER BY m), '[]'::jsonb)
                    FROM (SELECT to_char(la.fecha, 'YYYY-MM') AS m,
                                 count(DISTINCT la.id) AS n,
                                 round(100.0 * count(rr.*) FILTER (WHERE rr.estado = 'presente') / nullif(count(rr.*), 0)) AS pct
                            FROM listas_asistencia la
                            LEFT JOIN registros_asistencia rr ON rr.lista_id = la.id
                           WHERE la.coro_id = p_coro_id AND la.fecha BETWEEN p_desde AND p_hasta
                           GROUP BY 1) x))
      INTO v_asist;
  END IF;

  -- Eventos de la temporada (publicados, o ya ocurridos aunque se hayan despublicado)
  SELECT jsonb_build_object(
           'conciertos', count(*) FILTER (WHERE tipo = 'concierto'),
           'ensayos',    count(*) FILTER (WHERE tipo = 'ensayo'),
           'otros',      count(*) FILTER (WHERE tipo NOT IN ('concierto', 'ensayo')),
           'lista_conciertos', coalesce(
              jsonb_agg(jsonb_build_object('titulo', titulo, 'fecha', (fecha_inicio AT TIME ZONE tz)::date, 'lugar', lugar)
                        ORDER BY fecha_inicio) FILTER (WHERE tipo = 'concierto'), '[]'::jsonb))
    INTO v_eventos
    FROM eventos
   WHERE coro_id = p_coro_id AND (publicado OR fecha_inicio <= now()) AND fecha_inicio >= t_desde AND fecha_inicio < t_fin;

  -- Repertorio y dedicación (misma fórmula que Repertorio)
  WITH s AS (
    SELECT pf.id, coalesce(nullif(lower(trim(pf.voz)), ''), 'sin cuerda') AS voz,
           count(a.id) AS ap, count(DISTINCT a.obra_id) AS un
      FROM perfiles pf
      LEFT JOIN actividad_estudio a
        ON a.usuario_id = pf.id AND a.tipo = 'apertura' AND a.obra_id = ANY (v_obras)
       AND a.created_at >= greatest(t_desde, coalesce(pf.creado_en, t_desde)) AND a.created_at < t_fin
     WHERE pf.coro_id = p_coro_id AND pf.estado = 'activo' AND pf.rol = 'cantante'
     GROUP BY pf.id, pf.voz
  ), d AS (
    SELECT voz, CASE WHEN v_total_obras > 0 THEN
             least(100, round((100.0 * un / v_total_obras + least(100, (CASE WHEN un > 0 THEN ap::numeric / un ELSE 0 END) / 30 * 100)) / 2))
           END AS pct
      FROM s
  )
  SELECT jsonb_build_object(
    'obras_temporada', v_total_obras,
    'dedicacion_promedio', (SELECT round(avg(pct)) FROM d),
    'dedicacion_por_cuerda', (SELECT coalesce(jsonb_agg(jsonb_build_object('voz', voz, 'pct', pct) ORDER BY voz), '[]'::jsonb)
                                FROM (SELECT voz, round(avg(pct)) AS pct FROM d GROUP BY voz) x),
    'obras', (SELECT coalesce(jsonb_agg(jsonb_build_object('titulo', titulo, 'aperturas', ap, 'cantantes', cant, 'estudiada_por', est, 'publicada', publicada)
                                        ORDER BY ap DESC, titulo), '[]'::jsonb)
                FROM (SELECT o.titulo, o.publicada,
                             (SELECT count(*) FROM actividad_estudio a
                               WHERE a.obra_id = o.id AND a.tipo = 'apertura' AND a.created_at >= t_desde AND a.created_at < t_fin) AS ap,
                             (SELECT count(DISTINCT a.usuario_id) FROM actividad_estudio a
                               WHERE a.obra_id = o.id AND a.tipo = 'apertura' AND a.created_at >= t_desde AND a.created_at < t_fin) AS cant,
                             (SELECT count(*) FROM progreso_estudio pe WHERE pe.obra_id = o.id AND pe.estado = 'estudiada') AS est
                        FROM obras o WHERE o.id = ANY (v_obras)) x))
    INTO v_rep;

  -- Entrenamiento
  SELECT jsonb_build_object(
    'ejercicios', (SELECT count(*) FROM actividad_entrenamiento ae
                    WHERE ae.coro_id = p_coro_id AND ae.completado_en >= t_desde AND ae.completado_en < t_fin),
    'cantantes_que_practicaron', (SELECT count(DISTINCT ae.cantante_id) FROM actividad_entrenamiento ae
                    WHERE ae.coro_id = p_coro_id AND ae.completado_en >= t_desde AND ae.completado_en < t_fin),
    'lecciones_teoria', (SELECT count(*) FROM teoria_progreso tp
                    WHERE tp.coro_id = p_coro_id AND tp.completada_en >= t_desde AND tp.completada_en < t_fin),
    'cantantes_teoria', (SELECT count(DISTINCT tp.perfil_id) FROM teoria_progreso tp
                    WHERE tp.coro_id = p_coro_id AND tp.completada_en >= t_desde AND tp.completada_en < t_fin))
    INTO v_entr;

  -- Uso de la app (registro de accesos)
  SELECT jsonb_build_object(
    'sesiones', (SELECT count(*) FROM actividad_app WHERE coro_id = p_coro_id AND tipo = 'sesion' AND creado_en >= t_desde AND creado_en < t_fin),
    'cantantes_con_ingreso', (SELECT count(DISTINCT aa.perfil_id) FROM actividad_app aa
                               JOIN perfiles pf ON pf.id = aa.perfil_id AND pf.coro_id = p_coro_id AND pf.rol = 'cantante' AND pf.estado = 'activo'
                              WHERE aa.coro_id = p_coro_id AND aa.tipo = 'sesion' AND aa.creado_en >= t_desde AND aa.creado_en < t_fin),
    'por_mes', (SELECT coalesce(jsonb_agg(jsonb_build_object('mes', m, 'sesiones', n, 'personas', pers) ORDER BY m), '[]'::jsonb)
                  FROM (SELECT to_char(creado_en AT TIME ZONE tz, 'YYYY-MM') AS m, count(*) AS n, count(DISTINCT perfil_id) AS pers
                          FROM actividad_app WHERE coro_id = p_coro_id AND tipo = 'sesion' AND creado_en >= t_desde AND creado_en < t_fin
                         GROUP BY 1) x),
    'pantallas', (SELECT coalesce(jsonb_agg(jsonb_build_object('pantalla', detalle, 'visitas', n) ORDER BY n DESC), '[]'::jsonb)
                    FROM (SELECT detalle, count(*) AS n FROM actividad_app
                           WHERE coro_id = p_coro_id AND tipo = 'seccion' AND detalle IS NOT NULL AND creado_en >= t_desde AND creado_en < t_fin
                           GROUP BY detalle ORDER BY n DESC LIMIT 8) x))
    INTO v_uso;

  -- Participación: encuestas y lectura de avisos
  SELECT jsonb_build_object(
    'encuestas', (SELECT count(*) FROM encuestas WHERE coro_id = p_coro_id AND creado_en >= t_desde AND creado_en < t_fin),
    'participacion_encuestas', (SELECT round(avg(pct)) FROM (
         SELECT 100.0 * count(DISTINCT v.perfil_id) / nullif(v_activos, 0) AS pct
           FROM encuestas en LEFT JOIN encuesta_votos v ON v.encuesta_id = en.id
          WHERE en.coro_id = p_coro_id AND en.creado_en >= t_desde AND en.creado_en < t_fin
          GROUP BY en.id) x),
    'avisos', (SELECT count(*) FROM avisos WHERE coro_id = p_coro_id AND publicado AND creado_en >= t_desde AND creado_en < t_fin),
    'lectura_avisos', (SELECT round(avg(pct)) FROM (
         SELECT 100.0 * count(DISTINCT l.perfil_id) / nullif(v_activos, 0) AS pct
           FROM avisos av LEFT JOIN avisos_leidos l ON l.aviso_id = av.id
          WHERE av.coro_id = p_coro_id AND av.publicado AND av.creado_en >= t_desde AND av.creado_en < t_fin
          GROUP BY av.id) x))
    INTO v_part;

  -- Desde cuándo hay datos de cada fuente (para aclararlo en pantalla)
  SELECT jsonb_build_object(
    'uso_app', (SELECT (min(creado_en) AT TIME ZONE tz)::date FROM actividad_app WHERE coro_id = p_coro_id),
    'estudio', (SELECT (min(a.created_at) AT TIME ZONE tz)::date FROM actividad_estudio a WHERE a.obra_id = ANY (v_obras)),
    'entrenamiento', (SELECT (min(completado_en) AT TIME ZONE tz)::date FROM actividad_entrenamiento WHERE coro_id = p_coro_id),
    'teoria', (SELECT (min(completada_en) AT TIME ZONE tz)::date FROM teoria_progreso WHERE coro_id = p_coro_id))
    INTO v_desde;

  RETURN jsonb_build_object(
    'desde', p_desde, 'hasta', p_hasta,
    'cantantes', v_cantantes, 'asistencia', v_asist, 'eventos', v_eventos,
    'repertorio', v_rep, 'entrenamiento', v_entr, 'uso_app', v_uso,
    'participacion', v_part, 'datos_desde', v_desde);
END;
$$;
REVOKE ALL ON FUNCTION public.reporte_temporada_coro(uuid, date, date) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reporte_temporada_coro(uuid, date, date) TO authenticated;

NOTIFY pgrst, 'reload schema';
