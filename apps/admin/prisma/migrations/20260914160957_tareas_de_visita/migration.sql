-- CreateTable
CREATE TABLE "Tarea" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "descripcion" TEXT,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "deletedById" TEXT,
    "deletedByNombre" TEXT,

    CONSTRAINT "Tarea_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Tarea_deletedAt_orden_idx" ON "Tarea"("deletedAt", "orden");

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tarea" ADD CONSTRAINT "Tarea_deletedById_fkey" FOREIGN KEY ("deletedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- El nombre es único **entre las tareas vivas**, no en toda la tabla.
--
-- Eliminar "Poda de palmas" y volver a crearla tiene que funcionar: la vieja se
-- queda nombrando las visitas donde se hizo y la nueva ocupa su lugar en la
-- lista. Un `@@unique` común lo impediría para siempre.
--
-- **Prisma no sabe expresar un único parcial**, así que esto vive solo acá: el
-- próximo `migrate dev` va a querer borrarlo y hay que sacar esa línea del SQL
-- que genere.
CREATE UNIQUE INDEX "Tarea_nombre_vivas_key"
  ON "Tarea" ("nombre")
  WHERE "deletedAt" IS NULL;

-- El catálogo inicial, para que el portal no arranque con la lista vacía.
--
-- Va en la migración y no en un script aparte porque el deploy corre
-- `prisma migrate deploy` antes del build: así las tareas están en producción
-- el mismo minuto en que está la pantalla que las usa, sin que nadie tenga que
-- acordarse de correr nada. `scripts/seed-tareas.ts` hace lo mismo a mano, para
-- volver a sembrar en desarrollo.
--
-- Idempotente por nombre, no por id: si alguien ya creó "Poda de setos" a mano,
-- esto la respeta y no la duplica.
INSERT INTO "Tarea" ("id", "nombre", "orden", "createdAt", "updatedAt")
SELECT gen_random_uuid()::text, v.nombre, v.orden, NOW(), NOW()
FROM (
  VALUES
    ('Poda de césped', 10),
    ('Perfilado', 20),
    ('Control de maleza', 30),
    ('Poda de setos', 40),
    ('Poda de árboles', 50),
    ('Poda de palmas', 60),
    ('Deshoje de plantas de hojas grandes (alocasias, bijao, heliconias, etc.)', 70),
    ('Control manual de maleza', 80),
    ('Control químico de maleza', 90),
    ('Fertilización foliar', 100),
    ('Fertilización química', 110),
    ('Control fitosanitario (prevención de plagas)', 120),
    ('Control fitosanitario (tratamiento de plagas)', 130),
    ('Verificación del sistema de riego', 140),
    ('Aeración, escarificado y top dressing del césped', 150),
    ('Aplicación de tierra de sembrado', 160),
    ('Siembra de plantas', 170)
) AS v(nombre, orden)
WHERE NOT EXISTS (
  SELECT 1 FROM "Tarea" t WHERE t."nombre" = v.nombre AND t."deletedAt" IS NULL
);
