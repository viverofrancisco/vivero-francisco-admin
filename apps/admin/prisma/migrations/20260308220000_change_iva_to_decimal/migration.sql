-- AlterTable: change iva from Boolean to Decimal
ALTER TABLE "ClienteServicio" DROP COLUMN "iva";
ALTER TABLE "ClienteServicio" ADD COLUMN "iva" DECIMAL(10,2) NOT NULL DEFAULT 0;
