import { requireAuth, viewerFromUser } from "@/lib/auth-helpers";
import { isAdminRole } from "@/lib/services/viewer";
import { listarSuscripciones } from "@/lib/services/suscripcion.service";
import { periodosSinOrdenPorSuscripcion } from "@/lib/services/orden.service";
import { SuscripcionesTable } from "@/components/suscripciones/suscripciones-table";

export default async function SuscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; pendientes?: string }>;
}) {
  const user = await requireAuth();
  const viewer = viewerFromUser(user);
  const { cliente, pendientes } = await searchParams;

  /**
   * Un admin de sector ve las suscripciones de sus clientes —las necesita para
   * agendar visitas— pero no lo que se cobra por ellas. Los precios no se
   * ocultan con CSS: no salen del servidor.
   */
  const verPrecios = isAdminRole(user.role);

  // Cuántos períodos vencidos sin orden tiene cada una: es lo que convierte el
  // aviso de "Por facturar" en algo que se puede resolver una por una. Es
  // facturación, así que solo se consulta para quien la ve.
  const [items, sinOrden] = await Promise.all([
    listarSuscripciones(viewer, { incluirCanceladas: true, clienteId: cliente }),
    verPrecios
      ? periodosSinOrdenPorSuscripcion(viewer)
      : Promise.resolve(new Map<string, { cantidad: number }>()),
  ]);

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <SuscripcionesTable
        verPrecios={verPrecios}
        suscripciones={items.map((s) => ({
          id: s.id,
          numero: s.numero,
          estado: s.estado,
          periodicidad: s.periodicidad,
          fechaInicio: s.fechaInicio.toISOString(),
          cliente: s.cliente,
          items: s.items.map((i) => ({
            id: i.id,
            visitasPorPeriodo: i.visitasPorPeriodo,
            producto: i.producto,
            ...(verPrecios
              ? { precio: Number(i.precio), ivaTasa: Number(i.ivaTasa) }
              : {}),
          })),
          ...(verPrecios
            ? {
                // Lo que se cobra por período: la suma de los ítems con su IVA.
                totalPeriodo: s.items.reduce(
                  (acc, i) =>
                    acc + Number(i.precio) * (1 + Number(i.ivaTasa) / 100),
                  0
                ),
                periodosPendientes: sinOrden.get(s.id)?.cantidad ?? 0,
              }
            : {}),
        }))}
        soloPendientes={pendientes === "1"}
      />
    </div>
  );
}
