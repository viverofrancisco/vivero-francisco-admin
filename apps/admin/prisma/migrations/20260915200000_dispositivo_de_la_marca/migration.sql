-- Desde qué aparato se marcó.
--
-- Para una sola pregunta: si dos personas de la misma visita marcaron desde el
-- mismo teléfono. Eso es alguien iniciando sesión con la cuenta de un compañero
-- para marcarle la entrada, y es lo único de ese engaño que deja rastro por sí
-- solo — el identificador es por instalación de la app, no por cuenta, así que
-- la cuenta prestada llega con el aparato de quien la usó.
--
-- No bloquea nada y no prueba nada: lo genera el cliente. Lo que hace es que el
-- atajo fácil deje una marca visible.
ALTER TABLE "VisitaPersonal"
  ADD COLUMN "entradaDispositivo" TEXT,
  ADD COLUMN "salidaDispositivo"  TEXT;
