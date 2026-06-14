import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const hashedPassword = await bcrypt.hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@viverofrancisco.com" },
    update: {},
    create: {
      name: "Administrador",
      email: "admin@viverofrancisco.com",
      password: hashedPassword,
      role: "ADMIN",
    },
  });

  console.log("Usuario admin creado:", admin.email);

  // Tipos de actividad para los informes mensuales. Idempotente: si ya
  // existe un tipo con el mismo nombre, no duplica ni sobrescribe — el
  // admin puede haber editado nombre/descripción desde la UI.
  const tiposIniciales: Array<{
    nombre: string;
    descripcionTemplate: string;
    orden: number;
  }> = [
    {
      nombre: "Poda y perfilado de césped",
      descripcionTemplate:
        "El equipo de mantenimiento realizó el cuidado integral de áreas verdes y senderos mediante el uso de maquinaria especializada. La intervención garantizó un acabado uniforme y bordes definidos, optimizando la estética y el orden del paisaje residencial.",
      orden: 10,
    },
    {
      nombre: "Poda de árboles",
      descripcionTemplate:
        "Se realizó el mantenimiento de copas y laterales para despejar aceras y proteger las estructuras cercanas. La operación se llevó a cabo con equipo de ascenso especializado, logrando un entorno seguro, con visibilidad óptima y cumplimiento de los perímetros de seguridad.",
      orden: 20,
    },
    {
      nombre: "Poda de penicetos",
      descripcionTemplate:
        "Se realizó el mantenimiento técnico de los penicetos mediante una poda de renovación. Esta acción, que incluyó el despeje a baja altura y el retiro inmediato de residuos, busca incentivar el rebrote del follaje y garantizar una imagen impecable.",
      orden: 30,
    },
    {
      nombre: "Fumigación y matababosas",
      descripcionTemplate:
        "Aplicación de tratamiento químico específico para la eliminación y control de babosas y otras plagas comunes del invierno, cuya proliferación aumenta debido a la humedad de la temporada.",
      orden: 40,
    },
    {
      nombre: "Poda y alineación de hiedras",
      descripcionTemplate:
        "Se utilizó una podadora eléctrica para realizar un recorte preciso y uniforme de las superficies lateral y superior del seto. La intervención se centró en controlar la altura y mantener la forma plana y densa de la barrera vegetal.",
      orden: 50,
    },
  ];

  for (const tipo of tiposIniciales) {
    const existing = await prisma.tipoActividad.findFirst({
      where: { nombre: tipo.nombre },
    });
    if (!existing) {
      await prisma.tipoActividad.create({ data: tipo });
      console.log("Tipo de actividad creado:", tipo.nombre);
    }
  }

  // Singleton EmpresaConfig (id="default") para guardar firmas. Si no existe
  // se crea vacío para que el admin lo llene desde Configuración.
  await prisma.empresaConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  // Las plantillas de notificación (incluida INVITACION_CUENTA) se siembran con
  // `npx tsx scripts/seed-notificaciones.ts`, y los templates de Meta con
  // `npx tsx scripts/seed-meta-templates.ts`. Ver docs/notificaciones-whatsapp.md.
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
