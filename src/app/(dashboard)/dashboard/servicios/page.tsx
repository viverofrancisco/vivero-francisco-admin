import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { EmptyState } from "@/components/shared/empty-state";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ClipboardList, Plus, UserPlus } from "lucide-react";

export default async function ServiciosPage() {
  await requireAuth();

  const servicios = await prisma.servicio.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clientes: true } } },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-gray-500">Gestiona los servicios del vivero</p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/servicios/asignaciones">
            <Button variant="outline">
              <ClipboardList className="mr-2 h-4 w-4" />
              Ver Asignaciones
            </Button>
          </Link>
          <Link href="/dashboard/servicios/asignar">
            <Button variant="outline">
              <UserPlus className="mr-2 h-4 w-4" />
              Asignar a Clientes
            </Button>
          </Link>
          <Link href="/dashboard/servicios/nuevo">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nuevo Servicio
            </Button>
          </Link>
        </div>
      </div>

      {servicios.length === 0 ? (
        <EmptyState message="No hay servicios registrados" />
      ) : (
        <ServiciosTable servicios={servicios} />
      )}
    </div>
  );
}
