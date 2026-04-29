import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth-helpers";
import { NotificacionList } from "@/components/configuracion/notificacion-list";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const TIPOS_CLIENTE = [
  "CONFIRMACION_VISITA_CLIENTE",
  "RECORDATORIO_VISITA_CLIENTE",
] as const;

export default async function NotificacionesClientesPage() {
  await requireAdmin();

  const plantillas = await prisma.notificacionPlantilla.findMany({
    where: { tipo: { in: [...TIPOS_CLIENTE] } },
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
          <h1 className="text-2xl font-bold">Notificaciones para Clientes</h1>
          <p className="text-gray-500">
            Confirmaciones y recordatorios de visitas
          </p>
        </div>
      </div>

      <NotificacionList plantillas={plantillas} />
    </div>
  );
}
