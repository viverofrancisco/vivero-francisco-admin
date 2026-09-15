-- Corrige a quién convirtió en jardinero la migración anterior.
--
-- `20260914180000_visita_por_tareas` sacó el rol `PERSONAL_ADMIN` y mandó esas
-- cuentas a `PERSONAL`, dando por sentado que un capataz era gente de campo. No
-- lo era: llevaba las visitas de sus sectores, veía a sus clientes y agendaba.
-- Con el modelo nuevo, `PERSONAL` significa algo muy concreto —"ve las visitas
-- donde **está asignado** y carga su parte"— así que una cuenta con ese rol y
-- sin ficha en `Personal` no ve absolutamente nada al entrar.
--
-- La regla es la que separa las dos cosas: **si no hay ficha de Personal, no es
-- un jardinero**. Una cuenta de jardinero se crea desde la ficha y nace
-- vinculada, así que ninguna legítima queda sin `Personal` ni por un instante.
UPDATE "User"
SET "role" = 'STAFF'
WHERE "role" = 'PERSONAL'
  AND "id" NOT IN (
    SELECT "userId" FROM "Personal" WHERE "userId" IS NOT NULL
  );

-- Y la cuenta del dueño, que además no es oficina sino administración. Va por
-- correo y no por regla porque no hay ninguna regla que la distinga: es un
-- hecho sobre esta instalación, no un patrón.
UPDATE "User" SET "role" = 'ADMIN' WHERE "email" = 'jorgefco95@gmail.com';
