-- Rastro de que este trabajo ya estuvo en una orden que se anuló.
--
-- Anular libera la procedencia (pone en null `visitaProductoId`) para que el
-- trabajo pueda volver a facturarse. El efecto secundario es que no queda
-- ninguna señal de que alguna vez estuvo en una orden, y el proceso que arma
-- borradores automáticos lo volvería a agarrar — pisando la decisión de no
-- cobrarlo. Con esta marca, los automatismos lo saltean; a mano se puede igual.
ALTER TABLE "VisitaProducto" ADD COLUMN "liberadoAt" TIMESTAMP(3);
