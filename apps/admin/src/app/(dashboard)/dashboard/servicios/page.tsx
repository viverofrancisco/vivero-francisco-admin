import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServiciosTable } from "@/components/servicios/servicios-table";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { Plus } from "lucide-react";

export default async function ServiciosPage() {
  await requireAuth();

  const servicios = await prisma.servicio.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { clientes: true } } },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="text-gray-500">Gestiona los servicios del vivero</p>
        </div>
        <Link href="/dashboard/servicios/nuevo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nuevo Servicio
          </Button>
        </Link>
      </div>

      <ServiciosTable servicios={servicios} />
    </div>
  );
}
