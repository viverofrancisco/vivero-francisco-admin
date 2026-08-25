import { viewerFromSession } from "@/lib/auth-helpers";
import { listarSuscripciones } from "@/lib/services/suscripcion.service";
import { periodosSinOrdenPorSuscripcion } from "@/lib/services/orden.service";
import { SuscripcionesTable } from "@/components/suscripciones/suscripciones-table";

export default async function SuscripcionesPage({
  searchParams,
}: {
  searchParams: Promise<{ cliente?: string; pendientes?: string }>;
}) {
  const viewer = await viewerFromSession();
  const { cliente, pendientes } = await searchParams;
  // Cuántos períodos vencidos sin orden tiene cada una: es lo que convierte el
  // aviso de "Por facturar" en algo que se puede resolver una por una.
  const [items, sinOrden] = await Promise.all([
    listarSuscripciones(viewer, { incluirCanceladas: true, clienteId: cliente }),
    periodosSinOrdenPorSuscripcion(viewer),
  ]);

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <SuscripcionesTable
        suscripciones={items.map((s) => ({
          id: s.id,
          estado: s.estado,
          periodicidad: s.periodicidad,
          fechaInicio: s.fechaInicio.toISOString(),
          cliente: s.cliente,
          items: s.items.map((i) => ({
            id: i.id,
            precio: Number(i.precio),
            ivaTasa: Number(i.ivaTasa),
            visitasPorPeriodo: i.visitasPorPeriodo,
            producto: i.producto,
          })),
          // Lo que se cobra por período: la suma de los ítems con su IVA.
          totalPeriodo: s.items.reduce(
            (acc, i) => acc + Number(i.precio) * (1 + Number(i.ivaTasa) / 100),
            0
          ),
          periodosPendientes: sinOrden.get(s.id)?.cantidad ?? 0,
        }))}
        soloPendientes={pendientes === "1"}
      />
    </div>
  );
}
