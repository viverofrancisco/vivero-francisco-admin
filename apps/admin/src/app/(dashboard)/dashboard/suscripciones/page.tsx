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
   * Quien no ve plata ve las suscripciones —las necesita para agendar
   * visitas— pero no lo que se cobra por ellas. Los precios no se ocultan
   * con CSS: no salen del servidor.
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
    <div className="flex h-full flex-col gap-3 p-3 md:gap-6 md:p-6">
      <SuscripcionesTable
        verPrecios={verPrecios}
        suscripciones={items.map((s) => ({
          id: s.id,
          numero: s.numero,
          estado: s.estado,
          periodicidad: s.periodicidad,
          fechaInicio: s.fechaInicio.toISOString(),
          visitasPorPeriodo: s.visitasPorPeriodo,
          cliente: s.cliente,
          propiedad: { id: s.propiedad.id, nombre: s.propiedad.nombre },
          ...(verPrecios
            ? {
                precio: Number(s.precio),
                ivaTasa: Number(s.ivaTasa),
                // Lo que se cobra por período, con su IVA.
                totalPeriodo:
                  Number(s.precio) * (1 + Number(s.ivaTasa) / 100),
                periodosPendientes: sinOrden.get(s.id)?.cantidad ?? 0,
              }
            : {}),
        }))}
        soloPendientes={pendientes === "1"}
      />
    </div>
  );
}
