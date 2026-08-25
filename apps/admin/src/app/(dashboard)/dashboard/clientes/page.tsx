import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth, getUserSectorIds } from "@/lib/auth-helpers";
import { ClientesTable } from "@/components/clientes/clientes-table";
import { ClientesPageHeader } from "@/components/clientes/clientes-page-header";

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
      suscripciones: {
        where: { estado: "ACTIVO" },
        select: {
          items: { select: { producto: { select: { nombre: true } } } },
        },
      },
    },
  });

  const canCreate = user.role === "ADMIN" || user.role === "STAFF";
  // Hard delete es una herramienta de dev: solo ADMIN y fuera de producción.
  const devTools =
    process.env.NODE_ENV !== "production" && user.role === "ADMIN";

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <ClientesPageHeader canCreate={canCreate} />

      <ClientesTable clientes={clientes} devTools={devTools} />
    </div>
  );
}
