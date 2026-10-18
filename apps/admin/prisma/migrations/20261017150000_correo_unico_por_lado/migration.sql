-- El correo de una cuenta deja de ser único en toda la tabla y pasa a serlo
-- por lado: el equipo (ADMIN, STAFF, PERSONAL) y los clientes (CLIENTE) son
-- mundos aparte, como en Shopify, y la misma persona puede estar en los dos
-- con el mismo correo. Prisma no expresa índices parciales: van a mano, y
-- el schema queda sin @unique en `email`.

DROP INDEX "User_email_key";

CREATE UNIQUE INDEX "User_email_equipo_key" ON "User" (lower("email"))
  WHERE "email" IS NOT NULL AND "role" IN ('ADMIN', 'STAFF', 'PERSONAL');

CREATE UNIQUE INDEX "User_email_cliente_key" ON "User" (lower("email"))
  WHERE "email" IS NOT NULL AND "role" = 'CLIENTE';

-- Para buscar por correo sin el índice único que había.
CREATE INDEX "User_email_idx" ON "User" ("email");
