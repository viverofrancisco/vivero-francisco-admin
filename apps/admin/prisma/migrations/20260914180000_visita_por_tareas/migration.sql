-- La visita deja de llevar productos y pasa a llevar tareas.
--
-- Lo que cambia de fondo: una visita ya no es "estos productos del catálogo
-- hechos tal día" sino "alguien fue tal día", y lo que se hizo lo carga cada
-- jardinero al terminar, marcando tareas de una lista cerrada. Con eso se cae
-- toda la procedencia de plata que colgaba de la visita: una tarea no tiene
-- precio, así que no hay línea de orden que pueda venir de ella.
--
-- El orden es el de siempre: crear lo nuevo → backfillear → borrar lo viejo.

-- ──────────────────────────────────────────────────────────────────────────
-- 1. Estados: aparece EN_CURSO
--
-- Cerrar dejó de ser un acto único —cada jardinero carga lo suyo y la oficina
-- cierra— así que hace falta un estado para "empezó pero nadie la dio por
-- terminada". `ADD VALUE` dentro de una transacción es válido desde PG 12
-- mientras el valor nuevo no se use en la misma transacción; acá no se usa.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TYPE "EstadoVisita" ADD VALUE 'EN_CURSO' AFTER 'PROGRAMADA';

-- ──────────────────────────────────────────────────────────────────────────
-- 2. Cada asignado registra lo suyo
--
-- Las horas están por persona porque no todos llegan y se van juntos. Las de
-- la visita (`Visita.horaEntrada`/`horaSalida`) se quedan y pasan a calcularse
-- de acá: la primera entrada y la última salida.
-- ──────────────────────────────────────────────────────────────────────────
ALTER TABLE "VisitaPersonal"
  ADD COLUMN "horaEntrada"  TEXT,
  ADD COLUMN "horaSalida"   TEXT,
  ADD COLUMN "registradoEl" TIMESTAMP(3);

-- Qué hizo cada uno. Cuelga de `VisitaPersonal` y no de la visita para poder
-- contestar "¿quién hizo el control de maleza?" y no solo "¿se hizo?".
CREATE TABLE "VisitaPersonalTarea" (
    "visitaPersonalId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,

    CONSTRAINT "VisitaPersonalTarea_pkey" PRIMARY KEY ("visitaPersonalId","tareaId")
);
CREATE INDEX "VisitaPersonalTarea_tareaId_idx" ON "VisitaPersonalTarea"("tareaId");
ALTER TABLE "VisitaPersonalTarea" ADD CONSTRAINT "VisitaPersonalTarea_visitaPersonalId_fkey"
  FOREIGN KEY ("visitaPersonalId") REFERENCES "VisitaPersonal"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitaPersonalTarea" ADD CONSTRAINT "VisitaPersonalTarea_tareaId_fkey"
  FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Lo que la visita exige. No bloquea nada: es la pregunta que la oficina se
-- hace al revisar, y se contesta contra la unión de lo que cargó cada uno.
CREATE TABLE "VisitaTareaObligatoria" (
    "visitaId" TEXT NOT NULL,
    "tareaId" TEXT NOT NULL,

    CONSTRAINT "VisitaTareaObligatoria_pkey" PRIMARY KEY ("visitaId","tareaId")
);
CREATE INDEX "VisitaTareaObligatoria_tareaId_idx" ON "VisitaTareaObligatoria"("tareaId");
ALTER TABLE "VisitaTareaObligatoria" ADD CONSTRAINT "VisitaTareaObligatoria_visitaId_fkey"
  FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "VisitaTareaObligatoria" ADD CONSTRAINT "VisitaTareaObligatoria_tareaId_fkey"
  FOREIGN KEY ("tareaId") REFERENCES "Tarea"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ──────────────────────────────────────────────────────────────────────────
-- 3. Backfill: que no se pierda de qué visita es cada orden
--
-- `OrdenVisita` ya existía, pero lo escribía el servidor deduciéndolo de la
-- procedencia de las líneas. Antes de borrar esa procedencia se completa acá
-- lo que falte, para que "¿de qué visitas es esta orden?" siga teniendo
-- respuesta en las órdenes que ya están emitidas.
-- ──────────────────────────────────────────────────────────────────────────
INSERT INTO "OrdenVisita" ("ordenId", "visitaId")
SELECT DISTINCT ol."ordenId", vp."visitaId"
FROM "OrdenLineaOrigen" olo
JOIN "OrdenLinea" ol ON ol."id" = olo."ordenLineaId"
JOIN "VisitaProducto" vp ON vp."id" = olo."visitaProductoId"
ON CONFLICT DO NOTHING;

-- ──────────────────────────────────────────────────────────────────────────
-- 4. Se va la procedencia por línea, y los productos de la visita
--
-- `OrdenLineaOrigen` existía para que una línea pudiera pagar el mismo trabajo
-- de varias visitas sin cobrarlo dos veces. Sin productos en la visita no hay
-- trabajo que enlazar: las líneas se siguen armando a mano o desde un período
-- de suscripción, que tiene su propia guarda (`OrdenLinea.suscripcionItemId` +
-- `periodoInicio`, único). Primero la que apunta, después la apuntada.
--
-- Las órdenes **no se tocan**: sus líneas, sus montos y sus facturas quedan
-- como están. Lo que se pierde es el detalle de qué renglón de qué visita pagó
-- cada línea, que es exactamente lo que se decidió dejar de registrar.
-- ──────────────────────────────────────────────────────────────────────────
DROP TABLE "OrdenLineaOrigen";
DROP TABLE "VisitaProducto";

-- ──────────────────────────────────────────────────────────────────────────
-- 5. Se va PERSONAL_ADMIN
--
-- El capataz que manejaba las visitas de todo su grupo y las cerraba por los
-- demás. Deja de tener sentido cuando cada jardinero tiene su cuenta y carga
-- sus propias tareas y horas: no hay nada que delegar. Las cuentas que lo
-- tengan pasan a PERSONAL —ven las visitas donde están asignados y registran
-- lo suyo—; agendar queda para ADMIN/STAFF.
--
-- Sacar un valor de un enum obliga a recrear el tipo, y el UPDATE va **antes**,
-- mientras el valor viejo todavía existe.
--
-- `SectorAdmin` se va con él: existía solo para acotar a ese rol a sus
-- sectores, así que sin el rol no acota nada. `Sector` se queda, que es como se
-- agrupan los clientes.
-- ──────────────────────────────────────────────────────────────────────────
UPDATE "User" SET "role" = 'PERSONAL' WHERE "role" = 'PERSONAL_ADMIN';

ALTER TYPE "UserRole" RENAME TO "UserRole_viejo";
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'STAFF', 'PERSONAL', 'CLIENTE');
ALTER TABLE "User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "User" ALTER COLUMN "role" TYPE "UserRole" USING ("role"::text::"UserRole");
ALTER TABLE "User" ALTER COLUMN "role" SET DEFAULT 'STAFF';
DROP TYPE "UserRole_viejo";

DROP TABLE "SectorAdmin";
