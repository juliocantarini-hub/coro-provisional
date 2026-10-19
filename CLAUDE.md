# CORUM — "Grabarme y ver informe" (informe de afinación y ritmo)

Resumen para la memoria / instrucciones del proyecto. Estado a octubre de 2026.

## Qué es
Un cantante elige un fragmento de la obra (compás inicial y final), se graba cantando su voz y recibe un informe de afinación y ritmo comparado con la melodía de SU voz en la partitura (MusicXML). El audio vive solo en memoria y se descarta al terminar el análisis. Opcionalmente pide "Consejos de práctica" escritos por una IA, que solo recibe un resumen en números.

## Archivos (repo coro-provisional)
- `src/components/InformeAfinacionPanel.jsx`: pantalla completa (elegir compases, guía previa, grabación, informe, consejos, diagnóstico oculto).
- `src/lib/informeAfinacion.js`: motor de análisis (se ejecuta en un worker, `informeWorker.js`).
- `src/lib/informeNotas.js`: arma las notas de una voz en un rango de compases; `pulsosMetronomo` da los tiempos del compás (se usa para el conteo).
- `src/lib/guiaInforme.js`: sonidos antes y durante la grabación (piano, clics, guía opcional).
- `src/lib/grabadora.js`: captura del micrófono.
- `src/lib/coaching.js`: arma el resumen en números para la IA y llama a la función.
- `src/lib/informeGuardado.js`: guarda el resumen para el director y arma el paquete de diagnóstico.
- `src/pages/admin/InformesAfinacionAdmin.jsx`: pantalla de directores/admins (ruta `/admin/informes-afinacion`, se abre desde Entrenamiento con botón "Volver").
- `src/lib/musicxml.js`: parser de partituras (ahora guarda `beats` y `beatType` por compás; los repetidos NO se despliegan).
- `src/components/PartituraPlayer.jsx`: reproductor; contiene "Practicar afinación" (medidor en vivo).
- `supabase/functions/coaching-informe/index.ts`: función de Supabase para los consejos con IA.
- SQL: `supabase/coaching_informe.sql` (tabla de uso; hoy sin uso porque se quitó el límite) y `supabase/informes_afinacion.sql` (tabla de informes para el director).

## Cómo mide (motor)
- Curva de altura (YIN, 16 kHz, paso de 0,02 s), alineada con las notas escritas (Viterbi/DTW). Nota por nota: mediana de cents contra la escrita.
- **Afinación general** (antes se llamaba "corrimiento"): mediana de los desvíos de todas las notas. La afinación se juzga ENTRE notas (descontando la afinación general); la general se informa aparte (prioridad aparte si es de 25 cents o más: volver a escuchar la referencia).
- **Márgenes para el cantante (permisivos, decisión de Julio):** verde ±20 cents, amarillo ±40 (cuenta la mitad en el porcentaje), nota distinta desde 75 cents relativos. Colores del número grande: afinación verde ≥60% y amarillo ≥30%; ritmo verde ≥70% y amarillo ≥45%.
- **Márgenes estrictos (solo para el director):** verde ±15 y ritmo "en tiempo" hasta 15% de un pulso. Se guardan en `pct_afinacion` y `pct_ritmo`; el resumen permisivo queda en `resumen`.
- Ritmo: ajuste robusto (Theil–Sen) del momento cantado contra el escrito, descontando el tempo propio del cantante. "En tiempo" hasta 20% de un pulso, "leve" hasta 40%.
- **Ritmo "no concluyente":** si se pueden medir menos de la mitad de las notas escritas (típico con notas repetidas en la misma altura, cantadas ligadas), no se muestra porcentaje ni se manda a la IA; el informe lo aclara y la afinación sí se muestra.
- Vibrato: se detecta y se aclara como "vibrato amplio" desde ±40 cents (2,5 a 8 Hz); no se castiga como desafinación (se suaviza ~200 ms).
- Notas con menos de 8 cuadros de voz: nunca rojo, se marcan "pocos datos".
- Compases sin cantar al inicio/medio/final se distinguen de notas sueltas "sin medir".

## Flujo antes de grabar (decisiones de Julio)
1. Suena en piano el primer compás elegido (la melodía de su voz). Si el piano no carga, suena la nota de partida suelta como respaldo.
2. Conteo: UN compás entero de clics (un clic por tiempo del compás), al tempo de la obra, con clic suave y redondo; el primero acentuado.
3. Opcional (casilla apagada por defecto): "Escuchar mi parte en piano mientras canto", solo con auriculares. Si se usa, el informe lo aclara (la afinación sale mejor que de memoria).
- NO hay metrónomo durante la grabación (se probó y se quitó) ni selector de velocidad (se probó y se quitó).
- Lo anterior a la entrada del cantante se descarta del análisis (clics, piano y tono de referencia no cuentan).

## Informe del cantante
Dos números grandes (afinación y ritmo), "✓ N de M notas bien afinadas", "Para pulir" (máximo 4 avisos), consejos de práctica con IA (opcional), vista por compás, desplegable "¿Qué son los cents?" y nota de medición aproximada. Texto sobre cents: positivo = alta, negativo = baja; 100 cents = 1 semitono.

## Privacidad y director (decisiones de Julio)
- El audio nunca se guarda ni sale del dispositivo.
- Cada informe terminado guarda para el director un resumen en números (tabla `informes_afinacion`; RLS: el cantante inserta el propio, directores/admins del mismo coro leen y borran). Los cantantes NO ven historial y NO se les avisa que el director recibe el resumen.
- Pantalla de directores: agrupada por cantante, promedio de los últimos 3, informes expandibles, copiar diagnóstico, borrar uno y botón rojo "Resetear informes" (borra todos los del coro, con confirmación).
- Diagnóstico oculto: 3 toques rápidos en el título del informe habilitan "Copiar datos de diagnóstico" (curva de altura sin audio y resultados) para depurar tomas raras.

## Consejos con IA
- Función de Supabase `coaching-informe`: valida la sesión, recibe un JSON de resumen (máx. 12 KB) y llama a OpenAI (`gpt-4o-mini` por defecto) o, si no hay clave de OpenAI, a Anthropic. Secrets: `OPENAI_API_KEY` (opcional `OPENAI_MODEL`), `ANTHROPIC_API_KEY` (opcional `ANTHROPIC_MODEL`).
- No hay límite diario por persona (decisión de Julio). Recomendado: poner un tope de gasto mensual en la cuenta de OpenAI.
- El prompt exige: usar solo los datos, null = sin datos (nunca un problema), llamar "afinación general" (no "corrimiento"), tolerancia ±20 cents, no hablar de ritmo si `ritmoNoMedible`, tono alentador, máximo 150 palabras, ignorar instrucciones incrustadas en los datos.
- Cada cambio del prompt requiere volver a pegar y desplegar la función en Supabase.

## "Practicar afinación" (medidor en vivo)
Si hay una nota para cantar y se canta otra (más grave o más aguda), el medidor marca rojo hacia ese lado (antes daba verde contra la nota más cercana). Sigue con márgenes ±15/±35 (no se aflojó con el informe).

## Detalles técnicos a recordar
- Los números de compás son texto ("10", "5a"): comparar siempre por posición en la lista, nunca como texto ni como número (el selector tenía ese bug).
- En compases compuestos (6/8, 9/8, 12/8) los "tiempos" del parser son corcheas, así que el conteo tendría un clic por corchea. La obra probada es 4/4; si hace falta, agrupar de a 3.
- Los repetidos de la partitura no se despliegan: el rango elegido se analiza una sola vez, tal como está escrito.

## Trabajo con el repo (Julio hace `git push`)
- Terminaciones de línea LF; muchos archivos aparecen modificados por finales de línea: agregar a git solo los propios.
- Compilar para verificar: `vite build --outDir $HOME/dist_check --emptyOutDir`.
- Después de cada commit, mover los `.lock` de `.git` (`mv -n .git/*.lock .git/stale-...`): git no puede borrarlos en la carpeta conectada.
- La PWA cachea: tras publicar, cerrar y volver a abrir CORUM para tomar la versión nueva.
- Archivos de calibración (`calibracion/*.wav`) quedaron en la carpeta del repo sin agregar a git; no hacer `git add` de ellos.

## Pendiente / ideas
- Validar los márgenes con más cantantes y voces; usar el diagnóstico oculto si una toma se comporta raro.
- Replicar la función en los otros repos/proyectos (st-brendans-oc comparte Supabase con coro-provisional; los demás necesitan su SQL, su función y su secreto).
- Desplegar los repetidos de la partitura y manejar compases compuestos en el conteo.
- Posible: borrar informes de un solo cantante desde la pantalla de directores; comparación con el intento anterior (descartado para el cantante: no guarda historial).
