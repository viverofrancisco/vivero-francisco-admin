import { nombreCliente } from "@vivero/shared";
import { requireAuth, viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import {
  listInformesYBorradores,
  type EstadoInformeFiltro,
} from "@/lib/services/informe.service";
import { listClientes } from "@/lib/services/cliente.service";
import { PageHeader } from "@/components/shared/page-header";
import { InformesTable } from "@/components/informes/informes-table";
import { InformesFilters } from "@/components/informes/informes-filters";

const PAGE_SIZE = 20;

function parseDate(value: string | undefined): Date | undefined {
  if (!value) return undefined;
  const m = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (!m) return undefined;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export default async function InformesPage({
  searchParams,
}: {
  searchParams: Promise<{
    clienteId?: string;
    from?: string;
    to?: string;
    estado?: string;
    page?: string;
  }>;
}) {
  await requireStaff();
  await requireAuth();
  const viewer = await viewerFromSession();
  const params = await searchParams;

  const clienteId = params.clienteId || undefined;
  const from = parseDate(params.from);
  const to = parseDate(params.to);
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  // Solo los dos valores que existen: cualquier otra cosa en la URL se ignora
  // en vez de devolver una lista vacía sin explicar por qué.
  const estado: EstadoInformeFiltro | undefined =
    params.estado === "borrador" || params.estado === "emitido"
      ? params.estado
      : undefined;

  const [{ items, total }, clientesPage] = await Promise.all([
    listInformesYBorradores(viewer, {
      clienteId,
      from,
      to,
      estado,
      offset,
      limit: PAGE_SIZE,
    }),
    listClientes(viewer, { limit: 200 }),
  ]);

  const serialized = items.map((x) =>
    x.tipo === "emitido"
      ? {
          id: x.informe!.id,
          tipo: "emitido" as const,
          numero: x.informe!.numero,
          titulo: x.informe!.titulo,
          pdfUrl: x.informe!.pdfUrl,
          fecha: x.informe!.generatedAt.toISOString(),
          version: x.informe!.versionActual,
          deInforme: null,
          cliente: {
            id: x.informe!.cliente.id,
            nombre: nombreCliente(x.informe!.cliente),
          },
        }
      : {
          id: x.borrador!.id,
          tipo: "borrador" as const,
          // El suyo, que es el que va a heredar el informe cuando se genere.
          numero: x.borrador!.numero,
          deInforme: x.borrador!.informe?.numero ?? null,
          titulo: x.borrador!.titulo ?? "Sin título",
          pdfUrl: null,
          fecha: x.borrador!.updatedAt.toISOString(),
          version: 1,
          cliente: x.borrador!.cliente
            ? {
                id: x.borrador!.cliente.id,
                nombre: nombreCliente(x.borrador!.cliente),
              }
            : null,
        }
  );

  const clientesOptions = clientesPage.items.map((c) => ({
    value: c.id,
    label: nombreCliente(c),
  }));

  return (
    <div className="flex h-full flex-col gap-6 p-4 md:p-6">
      <PageHeader
        title="Informes"
        actions={[
          {
            label: "Generar nuevo informe",
            href: "/dashboard/informes/nuevo",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <InformesFilters
        clientes={clientesOptions}
        clienteId={clienteId ?? null}
        from={params.from ?? null}
        to={params.to ?? null}
        estado={estado ?? null}
      />

      <InformesTable
        items={serialized}
        page={page}
        total={total}
        porPagina={PAGE_SIZE}
      />
    </div>
  );
}
