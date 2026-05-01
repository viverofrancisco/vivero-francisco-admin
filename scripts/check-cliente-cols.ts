import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });
async function main() {
  const cliente = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Cliente' ORDER BY ordinal_position`
  );
  const sector = await prisma.$queryRawUnsafe<{ column_name: string }[]>(
    `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='Sector' ORDER BY ordinal_position`
  );
  console.log("Cliente:", cliente.map((r) => r.column_name).join(", "));
  console.log("Sector:", sector.map((r) => r.column_name).join(", "));
}
main().finally(() => prisma.$disconnect());
