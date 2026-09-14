import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { NuevaSuscripcionPage } from "@/components/suscripciones/nueva-suscripcion-page";

export default async function NuevaSuscripcionRoute({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; from?: string }>;
}) {
  const { cliente: clienteInicial, from } = await searchParams;
  // Solo rutas internas del dashboard: evita un open redirect.
  const backHref =
    from && from.startsWith("/dashboard/") ? from : "/dashboard/suscripciones";
  await requireAuth();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = { deletedAt: null };
  const clientes = await prisma.cliente.findMany({
    where,
    orderBy: { nombre: "asc" },
    select: { id: true, nombre: true, apellido: true, empresa: true },
  });
  return (
    <NuevaSuscripcionPage
      clientes={clientes}
      // Solo si sigue siendo visible para quien mira.
      clienteInicial={
        clientes.some((c) => c.id === clienteInicial) ? clienteInicial : undefined
      }
      backHref={backHref}
    />
  );
}
