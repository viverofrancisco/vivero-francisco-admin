-- Un cliente cambiando su correo desde la app: el nuevo espera su código acá.
-- CreateTable
CREATE TABLE "CambioDeCorreoPendiente" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "emailNuevo" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CambioDeCorreoPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CambioDeCorreoPendiente_userId_key" ON "CambioDeCorreoPendiente"("userId");

-- AddForeignKey
ALTER TABLE "CambioDeCorreoPendiente" ADD CONSTRAINT "CambioDeCorreoPendiente_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

