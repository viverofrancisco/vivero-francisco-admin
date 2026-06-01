-- AlterTable
ALTER TABLE "VisitaMessage" ALTER COLUMN "body" DROP NOT NULL;

-- CreateTable
CREATE TABLE "VisitaMessageMedia" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VisitaMessageMedia_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "VisitaMessageMedia_messageId_idx" ON "VisitaMessageMedia"("messageId");

-- AddForeignKey
ALTER TABLE "VisitaMessageMedia" ADD CONSTRAINT "VisitaMessageMedia_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "VisitaMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
