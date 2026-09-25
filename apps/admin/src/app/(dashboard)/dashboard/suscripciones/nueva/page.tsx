import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
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
  // Un plan es plata: se arma desde la oficina.
  await requireStaff();

  const clientes = await prisma.cliente.findMany({
    where: { deletedAt: null },
    orderBy: { nombre: "asc" },
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      inactivoDesde: true,
      // De qué jardín es el plan. Con una sola, el formulario la elige solo.
      propiedades: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          nombre: true,
          direccion: true,
          // Qué planes vivos tiene ya cada propiedad, para avisarlo al
          // elegirla: un segundo plan sobre el mismo jardín suele ser un
          // duplicado, no una decisión.
          suscripciones: {
            where: { estado: "ACTIVO" },
            select: { numero: true },
            orderBy: { numero: "asc" },
          },
        },
      },
    },
  });

  return (
    <NuevaSuscripcionPage
      clientes={clientes.map((c) => ({
        id: c.id,
        nombre: c.nombre,
        apellido: c.apellido,
        empresa: c.empresa,
        inactivoDesde: c.inactivoDesde?.toISOString() ?? null,
        propiedades: c.propiedades.map((p) => ({
          id: p.id,
          nombre: p.nombre,
          direccion: p.direccion,
          planesActivos: p.suscripciones.map((s) => s.numero),
        })),
      }))}
      // Solo si sigue siendo visible para quien mira.
      clienteInicial={
        clientes.some((c) => c.id === clienteInicial) ? clienteInicial : undefined
      }
      backHref={backHref}
    />
  );
}
