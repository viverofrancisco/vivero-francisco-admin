import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ClientesTable } from "@/components/clientes/clientes-table";

export default async function ClientesPage() {
  const user = await requireAuth();

  if (user.role === "PERSONAL") {
    redirect("/dashboard/visitas");
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};


  const clientes = await prisma.cliente.findMany({
    where: { ...where, deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: {
      propiedades: {
        where: { deletedAt: null },
        select: {
          id: true,
          nombre: true,
          ciudad: true,
          direccion: true,
          sector: { select: { id: true, nombre: true } },
        },
        orderBy: { createdAt: "asc" },
      },
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
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">

      <ClientesTable
        clientes={clientes}
        canCreate={canCreate}
        devTools={devTools}
      />
    </div>
  );
}
