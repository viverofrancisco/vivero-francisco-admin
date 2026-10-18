-- Un correo es de una sola persona en todo el sistema: no lo comparten dos
-- fichas de cliente vivas, ni un cliente y alguien del equipo.
--
-- `User.email` ya era único; lo que faltaba es que la cuenta de un cliente
-- guardara ahí su correo real (llevaba `cliente+<id>@viverofrancisco.local`)
-- y un índice único sobre el correo de las fichas vivas. Prisma no expresa un
-- índice parcial, por eso está escrito a mano (como el de las tareas).

-- 1. El correo se guarda limpio: minúsculas, sin espacios, y vacío es NULL.
UPDATE "Cliente" SET "email" = NULL WHERE "email" IS NOT NULL AND btrim("email") = '';
UPDATE "Cliente" SET "email" = lower(btrim("email")) WHERE "email" IS NOT NULL;
UPDATE "User" SET "email" = NULL WHERE "email" IS NOT NULL AND btrim("email") = '';
UPDATE "User" SET "email" = lower(btrim("email")) WHERE "email" IS NOT NULL;

-- 2. Si hay correos repetidos, la migración se detiene y dice cuáles, en vez de
--    fallar con un "duplicate key" que no nombra a nadie. Se arreglan
--    fusionando las fichas (o corrigiendo el correo) y se vuelve a desplegar.
DO $$
DECLARE
  repetidos text;
BEGIN
  SELECT string_agg(email, ', ') INTO repetidos FROM (
    SELECT "email" FROM "Cliente"
    WHERE "deletedAt" IS NULL AND "email" IS NOT NULL
    GROUP BY "email" HAVING count(*) > 1
  ) x;
  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay fichas de cliente con el mismo correo: %. Fusiónalas antes de desplegar.', repetidos;
  END IF;

  SELECT string_agg(c."email", ', ') INTO repetidos
  FROM "Cliente" c
  JOIN "User" u ON u."email" = c."email" AND u."id" IS DISTINCT FROM c."userId"
  WHERE c."deletedAt" IS NULL AND c."email" IS NOT NULL;
  IF repetidos IS NOT NULL THEN
    RAISE EXCEPTION 'Hay fichas de cliente con el correo de otra cuenta: %. Corrígelas antes de desplegar.', repetidos;
  END IF;
END $$;

-- 3. La cuenta de cada cliente pasa a llevar el correo de su ficha; sin correo
--    en la ficha (o con la ficha archivada), queda sin correo: el login del
--    cliente es por correo, así que esa cuenta no tenía por dónde entrar.
UPDATE "User" u
SET "email" = c."email"
FROM "Cliente" c
WHERE c."userId" = u."id" AND u."role" = 'CLIENTE' AND c."deletedAt" IS NULL;

UPDATE "User" SET "email" = NULL
WHERE "role" = 'CLIENTE' AND "email" LIKE 'cliente+%@viverofrancisco.local';

-- 4. Dos fichas vivas no pueden tener el mismo correo. Las archivadas no
--    cuentan: la que se fusionó guarda el suyo como historia.
CREATE UNIQUE INDEX "Cliente_email_vivo_key" ON "Cliente" (lower("email"))
  WHERE "deletedAt" IS NULL AND "email" IS NOT NULL;
