-- Quién cerró la visita como completada, y cuándo.
--
-- Hacía falta un par de campos propios: `fechaRealizada` es el día en que se
-- hizo el trabajo —lo elige quien cierra la visita y puede ser anterior— y
-- `updatedById` es el último que la tocó por cualquier motivo, así que una
-- corrección de fecha semanas después borraba el rastro de quién la completó.
--
-- Las 110 visitas ya completadas quedan en NULL: no hay forma de saber quién
-- las cerró ni cuándo, y suponerlo desde `updatedAt` sería inventar un dato.
ALTER TABLE "Visita" ADD COLUMN "completadaEl" TIMESTAMP(3);
ALTER TABLE "Visita" ADD COLUMN "completadaPorId" TEXT;

ALTER TABLE "Visita"
  ADD CONSTRAINT "Visita_completadaPorId_fkey"
  FOREIGN KEY ("completadaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Para filtrar por rango de fechas de completado sin recorrer la tabla.
CREATE INDEX "Visita_completadaEl_idx" ON "Visita"("completadaEl");
