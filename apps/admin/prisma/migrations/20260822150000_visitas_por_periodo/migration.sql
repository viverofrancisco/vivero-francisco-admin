-- Las visitas incluidas pasan a contarse **por período de cobro**, no por mes.
--
-- El valor guardado era mensual, así que en una suscripción trimestral "4"
-- significaba 12 por trimestre. Se multiplica por los meses del período para
-- que el contrato siga diciendo lo mismo; en las mensuales el factor es 1 y no
-- cambia nada.
ALTER TABLE "SuscripcionItem" RENAME COLUMN "frecuenciaMensual" TO "visitasPorPeriodo";

UPDATE "SuscripcionItem" i
SET "visitasPorPeriodo" = i."visitasPorPeriodo" * CASE s."periodicidad"
      WHEN 'TRIMESTRAL' THEN 3
      WHEN 'SEMESTRAL'  THEN 6
      WHEN 'ANUAL'      THEN 12
      ELSE 1
    END
FROM "Suscripcion" s
WHERE s."id" = i."suscripcionId"
  AND i."visitasPorPeriodo" IS NOT NULL
  AND s."periodicidad" <> 'MENSUAL';
