-- Las ubicaciones del vivero, como las *Locations* de Shopify. Reemplazan el
-- enum fijo `LugarDeRetiro` (HIPODROMO, AURORA): los dos viveros nacen como
-- filas, con ids fijos para poder pasarles los pedidos que ya los citaban, y
-- la dirección queda por cargar desde Configuración → Ubicaciones.

CREATE TABLE "Ubicacion" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "direccion" TEXT,
    "ciudad" TEXT,
    "referencia" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "telefono" TEXT,
    "horario" TEXT,
    "retiro" BOOLEAN NOT NULL DEFAULT true,
    "activa" BOOLEAN NOT NULL DEFAULT true,
    "posicion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Ubicacion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Ubicacion_activa_posicion_idx" ON "Ubicacion"("activa", "posicion");

INSERT INTO "Ubicacion" ("id", "nombre", "ciudad", "posicion", "updatedAt") VALUES
  ('ubicacion_hipodromo', 'Vivero Hipódromo', 'Guayaquil', 10, CURRENT_TIMESTAMP),
  ('ubicacion_aurora', 'Vivero Aurora', 'Guayaquil', 20, CURRENT_TIMESTAMP);

ALTER TABLE "Orden" ADD COLUMN "retiroUbicacionId" TEXT;

UPDATE "Orden" SET "retiroUbicacionId" = CASE "retiroEn"
    WHEN 'HIPODROMO' THEN 'ubicacion_hipodromo'
    WHEN 'AURORA' THEN 'ubicacion_aurora'
  END
WHERE "retiroEn" IS NOT NULL;

ALTER TABLE "Orden" DROP COLUMN "retiroEn";
DROP TYPE "LugarDeRetiro";

ALTER TABLE "Orden" ADD CONSTRAINT "Orden_retiroUbicacionId_fkey" FOREIGN KEY ("retiroUbicacionId") REFERENCES "Ubicacion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "Orden_retiroUbicacionId_idx" ON "Orden"("retiroUbicacionId");
