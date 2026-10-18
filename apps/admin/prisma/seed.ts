import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  // Sin `upsert`: el correo es único por lado, no en toda la tabla, así que
  // no sirve de clave para Prisma.
  const admin =
    (await prisma.user.findFirst({
      where: { email: "admin@viverofrancisco.com", role: "ADMIN" },
    })) ??
    (await prisma.user.create({
      data: {
        name: "Administrador",
        email: "admin@viverofrancisco.com",
        password: hashedPassword,
        role: "ADMIN",
      },
    }));

  console.log("Usuario admin creado:", admin.email);

  // Singleton EmpresaConfig (id="default") para guardar firmas. Si no existe
  // se crea vacío para que el admin lo llene desde Configuración.
  await prisma.empresaConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  // Las plantillas de notificación (incluida INVITACION_CUENTA) se siembran con
  // `npx tsx scripts/seed-notificaciones.ts`, y los templates de Meta con
  // `npx tsx scripts/seed-meta-templates.ts`. Ver .claude/docs/notificaciones-whatsapp.md.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
