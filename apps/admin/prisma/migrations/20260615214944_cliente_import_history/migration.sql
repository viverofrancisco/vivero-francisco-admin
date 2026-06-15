-- CreateTable
CREATE TABLE "ClienteImport" (
    "id" TEXT NOT NULL,
    "createdById" TEXT,
    "status" TEXT NOT NULL DEFAULT 'procesando',
    "total" INTEGER NOT NULL,
    "created" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "results" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClienteImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ClienteImport_createdAt_idx" ON "ClienteImport"("createdAt");

-- AddForeignKey
ALTER TABLE "ClienteImport" ADD CONSTRAINT "ClienteImport_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
