-- Chats internos del equipo: oficina y gente de campo hablando entre ellas.
-- Nunca con un cliente: el cliente dice lo suyo en la calificación de su visita.

-- CreateTable
CREATE TABLE "Chat" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "createdById" TEXT,

    CONSTRAINT "Chat_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMiembro" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agregadoEl" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "salioEl" TIMESTAMP(3),
    "leidoEl" TIMESTAMP(3),

    CONSTRAINT "ChatMiembro_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatMensaje" (
    "id" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "texto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),
    "autorId" TEXT,
    "autorNombre" TEXT NOT NULL,
    "respondeAId" TEXT,

    CONSTRAINT "ChatMensaje_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatAdjunto" (
    "id" TEXT NOT NULL,
    "mensajeId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL DEFAULT 'imagen',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatAdjunto_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Chat_deletedAt_idx" ON "Chat"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "ChatMiembro_chatId_userId_key" ON "ChatMiembro"("chatId", "userId");

-- CreateIndex
CREATE INDEX "ChatMiembro_userId_salioEl_idx" ON "ChatMiembro"("userId", "salioEl");

-- CreateIndex
CREATE INDEX "ChatMensaje_chatId_createdAt_idx" ON "ChatMensaje"("chatId", "createdAt");

-- CreateIndex
CREATE INDEX "ChatMensaje_autorId_idx" ON "ChatMensaje"("autorId");

-- CreateIndex
CREATE INDEX "ChatMensaje_respondeAId_idx" ON "ChatMensaje"("respondeAId");

-- CreateIndex
CREATE INDEX "ChatAdjunto_mensajeId_idx" ON "ChatAdjunto"("mensajeId");

-- AddForeignKey
ALTER TABLE "Chat" ADD CONSTRAINT "Chat_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMiembro" ADD CONSTRAINT "ChatMiembro_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMiembro" ADD CONSTRAINT "ChatMiembro_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMensaje" ADD CONSTRAINT "ChatMensaje_chatId_fkey" FOREIGN KEY ("chatId") REFERENCES "Chat"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMensaje" ADD CONSTRAINT "ChatMensaje_autorId_fkey" FOREIGN KEY ("autorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatMensaje" ADD CONSTRAINT "ChatMensaje_respondeAId_fkey" FOREIGN KEY ("respondeAId") REFERENCES "ChatMensaje"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatAdjunto" ADD CONSTRAINT "ChatAdjunto_mensajeId_fkey" FOREIGN KEY ("mensajeId") REFERENCES "ChatMensaje"("id") ON DELETE CASCADE ON UPDATE CASCADE;
