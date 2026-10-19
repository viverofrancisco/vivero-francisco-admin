-- La contraseña puede elegirse después del código: el *Crear cuenta* del
-- aviso de un pedido o una solicitud de invitado va directo a verificar.
ALTER TABLE "RegistroPendiente" ALTER COLUMN "passwordHash" DROP NOT NULL;
