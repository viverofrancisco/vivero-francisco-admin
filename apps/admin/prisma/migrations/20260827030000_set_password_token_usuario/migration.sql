-- El token de contraseña deja de ser solo de clientes: ahora también invita a
-- un usuario del portal o le restablece la contraseña.
--
-- `clienteId` pasa a ser opcional y aparece `userId`; el CHECK obliga a que
-- haya exactamente uno. Sin él, un token sin dueño quedaría "válido" contra
-- nadie y uno con los dos no se sabría a quién le cambia la contraseña.
ALTER TABLE "SetPasswordToken" ALTER COLUMN "clienteId" DROP NOT NULL;
ALTER TABLE "SetPasswordToken" ADD COLUMN "userId" TEXT;

ALTER TABLE "SetPasswordToken"
  ADD CONSTRAINT "SetPasswordToken_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "SetPasswordToken_userId_idx" ON "SetPasswordToken"("userId");

ALTER TABLE "SetPasswordToken"
  ADD CONSTRAINT "SetPasswordToken_un_solo_dueno"
  CHECK (num_nonnulls("clienteId", "userId") = 1);
