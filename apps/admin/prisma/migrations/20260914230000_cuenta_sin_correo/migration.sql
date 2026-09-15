-- Una cuenta puede no tener correo, y entrar con un usuario.
--
-- Un jardinero no tiene correo: la mayoría no usa uno, y exigirlo para crearle
-- la cuenta obligaba a inventar direcciones que después nadie lee y que ensucian
-- cualquier intento de mandar algo de verdad. Así que `email` pasa a ser
-- opcional y aparece `usuario` al lado: con **uno de los dos** se entra.
--
-- El único sobre una columna que admite nulos deja convivir tantas cuentas sin
-- correo como haga falta —Postgres no considera iguales a dos nulos— así que no
-- hace falta ningún valor centinela.
--
-- La contraseña no se crea acá ni en ningún lado: la elige la propia persona
-- abriendo un enlace de un solo uso, igual que el resto del portal. Lo único
-- que hay que dictarle es su usuario.
ALTER TABLE "User" ALTER COLUMN "email" DROP NOT NULL;
ALTER TABLE "User" ADD COLUMN "usuario" TEXT;
CREATE UNIQUE INDEX "User_usuario_key" ON "User"("usuario");
