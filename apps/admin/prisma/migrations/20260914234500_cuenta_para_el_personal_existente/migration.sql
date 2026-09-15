-- Cuenta para el personal que ya estaba cargado.
--
-- Desde ahora la cuenta nace con la ficha, en la misma transacción. El personal
-- cargado antes de este cambio quedaría sin cuenta para siempre, y su ficha
-- mostraría un hueco donde el resto muestra un usuario.
--
-- El usuario es el mismo que genera el código: inicial del nombre y primer
-- apellido, sin tildes ni eñes, en minúsculas. Si se repite se le agrega un
-- número. Nadie queda con contraseña: la elige cada uno abriendo el enlace que
-- un admin genera desde la ficha, así que estas cuentas existen pero todavía no
-- entran a ningún lado.
DO $$
DECLARE
  ficha     RECORD;
  base      TEXT;
  candidato TEXT;
  intento   INT;
  nuevo     TEXT;
BEGIN
  FOR ficha IN
    SELECT "id", "nombre", "apellido"
    FROM "Personal"
    WHERE "deletedAt" IS NULL AND "userId" IS NULL
    ORDER BY "createdAt"
  LOOP
    -- `translate` y no `unaccent`: la extensión no está instalada, y pedirla
    -- en una migración ata el despliegue a un permiso que la base gestionada
    -- puede no dar.
    base := regexp_replace(
      lower(translate(
        coalesce(substring(btrim(ficha."nombre") from 1 for 1), '') ||
        coalesce(split_part(btrim(coalesce(ficha."apellido", '')), ' ', 1), ''),
        'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
        'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
      )),
      '[^a-z0-9]', '', 'g'
    );

    -- Sin apellido no hay dos cosas que juntar: el nombre entero, y si ni eso
    -- llega a tres caracteres se rellena, porque el código valida ese mínimo.
    IF length(base) < 3 THEN
      base := regexp_replace(
        lower(translate(
          btrim(ficha."nombre"),
          'áàäâãéèëêíìïîóòöôõúùüûñçÁÀÄÂÃÉÈËÊÍÌÏÎÓÒÖÔÕÚÙÜÛÑÇ',
          'aaaaaeeeeiiiiooooouuuuncAAAAAEEEEIIIIOOOOOUUUUNC'
        )),
        '[^a-z0-9]', '', 'g'
      );
    END IF;
    IF length(base) < 3 THEN
      base := base || 'usuario';
    END IF;
    base := substring(base from 1 for 30);

    candidato := base;
    intento := 1;
    WHILE EXISTS (SELECT 1 FROM "User" WHERE "usuario" = candidato) LOOP
      intento := intento + 1;
      candidato := substring(base from 1 for 28) || intento::TEXT;
    END LOOP;

    nuevo := gen_random_uuid()::TEXT;
    INSERT INTO "User" ("id", "name", "apellido", "usuario", "role", "createdAt", "updatedAt")
    VALUES (nuevo, ficha."nombre", ficha."apellido", candidato, 'PERSONAL', now(), now());

    UPDATE "Personal" SET "userId" = nuevo WHERE "id" = ficha."id";
  END LOOP;
END $$;
