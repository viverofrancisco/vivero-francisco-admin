import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { ClientesTable } from "@/components/clientes/clientes-table";

export default async function ClientesPage() {
  const user = await requireAuth();

  if (user.role === "JARDINERO") {
    redirect("/dashboard/visitas");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (user.role === "JARDINERO_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    where.sectorId = { in: sectorIds };
  }

  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      sector: { select: { id: true, nombre: true } },
    },
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestiona los clientes del vivero"
        createHref="/dashboard/clientes/nuevo"
        createLabel="Nuevo Cliente"
      />

      {clientes.length === 0 ? (
        <EmptyState message="No hay clientes registrados" />
      ) : (
        <ClientesTable clientes={clientes} />
      )}
    </div>
  );
}
