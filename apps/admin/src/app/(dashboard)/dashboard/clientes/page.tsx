import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { PageHeader } from "@/components/shared/page-header";
import { ClientesTable } from "@/components/clientes/clientes-table";

export default async function ClientesPage() {
  const user = await requireAuth();

  if (user.role === "PERSONAL") {
    redirect("/dashboard/visitas");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (user.role === "PERSONAL_ADMIN") {
    const sectorIds = await getUserSectorIds(user.id);
    where.sectorId = { in: sectorIds };
  }

  const clientes = await prisma.cliente.findMany({
    where: { ...where, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      sector: { select: { id: true, nombre: true } },
    },
  });

  const canCreate = user.role === "ADMIN" || user.role === "STAFF";

  return (
    <div className="p-4 md:p-6 space-y-6">
      <PageHeader
        title="Clientes"
        description="Gestiona los clientes del vivero"
        createHref={canCreate ? "/dashboard/clientes/nuevo" : undefined}
        createLabel="Nuevo Cliente"
      />

      <ClientesTable clientes={clientes} />
    </div>
  );
}
