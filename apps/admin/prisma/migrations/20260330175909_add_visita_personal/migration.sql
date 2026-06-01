-- CreateTable
CREATE TABLE "VisitaPersonal" (
    "id" TEXT NOT NULL,
    "visitaId" TEXT NOT NULL,
    "personalId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "addedById" TEXT,
    "removedAt" TIMESTAMP(3),
    "removedById" TEXT,

    CONSTRAINT "VisitaPersonal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VisitaPersonal_visitaId_personalId_key" ON "VisitaPersonal"("visitaId", "personalId");

-- AddForeignKey
ALTER TABLE "VisitaPersonal" ADD CONSTRAINT "VisitaPersonal_visitaId_fkey" FOREIGN KEY ("visitaId") REFERENCES "Visita"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaPersonal" ADD CONSTRAINT "VisitaPersonal_personalId_fkey" FOREIGN KEY ("personalId") REFERENCES "Personal"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaPersonal" ADD CONSTRAINT "VisitaPersonal_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VisitaPersonal" ADD CONSTRAINT "VisitaPersonal_removedById_fkey" FOREIGN KEY ("removedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
