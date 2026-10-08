-- CreateTable
CREATE TABLE "RegistroPendiente" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT,
    "telefono" TEXT,
    "passwordHash" TEXT NOT NULL,
    "codigoHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "intentos" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RegistroPendiente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudCliente" (
    "id" TEXT NOT NULL,
    "numero" SERIAL NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productoId" TEXT,
    "mensaje" TEXT NOT NULL,
    "direccion" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atendidaEl" TIMESTAMP(3),
    "atendidaPorId" TEXT,
    "atendidaPorNombre" TEXT,

    CONSTRAINT "SolicitudCliente_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RegistroPendiente_email_key" ON "RegistroPendiente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "SolicitudCliente_numero_key" ON "SolicitudCliente"("numero");

-- CreateIndex
CREATE INDEX "SolicitudCliente_clienteId_idx" ON "SolicitudCliente"("clienteId");

-- CreateIndex
CREATE INDEX "SolicitudCliente_atendidaEl_idx" ON "SolicitudCliente"("atendidaEl");

-- AddForeignKey
ALTER TABLE "SolicitudCliente" ADD CONSTRAINT "SolicitudCliente_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCliente" ADD CONSTRAINT "SolicitudCliente_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudCliente" ADD CONSTRAINT "SolicitudCliente_atendidaPorId_fkey" FOREIGN KEY ("atendidaPorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
