-- CreateTable
CREATE TABLE "VisitaMessage" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "authorUserId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisitaChatRead" (
    "visitaId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaChatRead_pkey" PRIMARY KEY ("visitaId","userId")
);

-- CreateIndex
CREATE INDEX "VisitaMessage_visitaId_createdAt_idx" ON "VisitaMessage"("visitaId", "createdAt");

-- CreateIndex
CREATE INDEX "VisitaMessage_authorUserId_idx" ON "VisitaMessage"("authorUserId");

-- CreateIndex
CREATE INDEX "VisitaChatRead_userId_lastReadAt_idx" ON "VisitaChatRead"("userId", "lastReadAt");

-- AddForeignKey
ALTER TABLE "VisitaMessage" ADD CONSTRAINT "VisitaMessage_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaMessage" ADD CONSTRAINT "VisitaMessage_authorUserId_fkey" FOREIGN KEY ("authorUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaChatRead" ADD CONSTRAINT "VisitaChatRead_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaChatRead" ADD CONSTRAINT "VisitaChatRead_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
