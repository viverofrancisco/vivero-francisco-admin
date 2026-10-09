-- Centros de costo: las partes de la empresa, separadas de las obras.
--
-- En Contífico el vivero cargaba en sus centros de costo las obras mezcladas
-- con tres áreas (Mantenimiento y las sucursales Hipódromo y Aurora), que la
-- migración anterior había traído como obras de tipo "área". Acá las áreas
-- pasan a ser centros de costo de verdad, y cada obra pertenece a uno.

-- CreateTable
CREATE TABLE "CentroCosto" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "contificoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CentroCosto_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "CentroCosto_nombre_key" ON "CentroCosto"("nombre");
CREATE UNIQUE INDEX "CentroCosto_contificoId_key" ON "CentroCosto"("contificoId");

-- Los cinco de partida, desde la migración y no desde un script que alguien
-- tenga que acordarse de correr: llegan a producción con la pantalla.
INSERT INTO "CentroCosto" ("id", "nombre", "orden", "updatedAt") VALUES
  ('cc_administracion', 'Administración', 10, CURRENT_TIMESTAMP),
  ('cc_vivero_hipodromo', 'Vivero Hipódromo', 20, CURRENT_TIMESTAMP),
  ('cc_vivero_aurora', 'Vivero Aurora', 30, CURRENT_TIMESTAMP),
  ('cc_mantenimiento', 'Mantenimiento', 40, CURRENT_TIMESTAMP),
  ('cc_obras', 'Obras', 50, CURRENT_TIMESTAMP);

ALTER TABLE "Obra" ADD COLUMN "centroCostoId" TEXT;

-- Las obras que eran áreas le pasan su id de Contífico al centro que les
-- corresponde, para que volver a importar las reconozca, y se van.
UPDATE "CentroCosto" c SET "contificoId" = o."contificoId"
FROM "Obra" o
WHERE o."tipo" = 'AREA' AND o."contificoId" IS NOT NULL AND (
  (c."id" = 'cc_mantenimiento' AND o."nombre" ILIKE '%mantenimiento%') OR
  (c."id" = 'cc_vivero_hipodromo' AND o."nombre" ~* 'hip(o|ó)dromo') OR
  (c."id" = 'cc_vivero_aurora' AND o."nombre" ILIKE '%aurora%')
);
DELETE FROM "Obra" WHERE "tipo" = 'AREA';

-- El resto son obras de verdad: van a Obras.
UPDATE "Obra" SET "centroCostoId" = 'cc_obras';

ALTER TABLE "Obra" DROP COLUMN "tipo";
DROP TYPE "TipoObra";

CREATE INDEX "Obra_centroCostoId_idx" ON "Obra"("centroCostoId");
ALTER TABLE "Obra" ADD CONSTRAINT "Obra_centroCostoId_fkey" FOREIGN KEY ("centroCostoId") REFERENCES "CentroCosto"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
