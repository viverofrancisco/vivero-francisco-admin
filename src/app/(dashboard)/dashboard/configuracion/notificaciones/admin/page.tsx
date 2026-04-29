import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { NotificacionList } from "@/components/configuracion/notificacion-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TIPOS_ADMIN = [
  "RESUMEN_DIARIO_ADMIN",
  "ALERTA_VISITA_COMPLETADA",
  "ALERTA_VISITA_INCOMPLETA",
  "MENSAJE_ENTRANTE_CLIENTE",
] as const;

export default async function NotificacionesAdminPage() {
  await requireAdmin();

  const plantillas = await prisma.notificacionPlantilla.findMany({
    where: { tipo: { in: [...TIPOS_ADMIN] } },
    orderBy: { nombre: "asc" },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/configuracion/notificaciones">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">
            Notificaciones para Administradores
          </h1>
          <p className="text-gray-500">
            Resúmenes diarios y alertas de visitas
          </p>
        </div>
      </div>

      <NotificacionList plantillas={plantillas} />
    </div>
  );
}
