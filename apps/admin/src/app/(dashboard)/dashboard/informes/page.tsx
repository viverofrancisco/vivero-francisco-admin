import { requireAuth, viewerFromSession, requireStaff } from "@/lib/auth-helpers";
import {
  listInformesYBorradores,
  type EstadoInformeFiltro,
} from "@/lib/services/informe.service";
import { PageHeader } from "@/components/shared/page-header";
import { InformesTable } from "@/components/informes/informes-table";
import { InformesFilters } from "@/components/informes/informes-filters";
import { serializarInformeItem } from "@/lib/informes/lista";

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
    q?: string;
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
  const q = params.q || undefined;
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

  const { items, total } = await listInformesYBorradores(viewer, {
    clienteId,
    q,
    from,
    to,
    estado,
    offset,
    limit: PAGE_SIZE,
  });

  const serialized = items.map(serializarInformeItem);

  return (
    <div className="flex h-full flex-col gap-4 p-4 md:gap-6 md:p-6">
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
        q={params.q ?? null}
        from={params.from ?? null}
        to={params.to ?? null}
        estado={estado ?? null}
      />

      <InformesTable
        items={serialized}
        page={page}
        total={total}
        porPagina={PAGE_SIZE}
        // Los mismos que se usaron para consultar: la tabla los necesita para
        // armar el `?from=` y para pedir la tanda siguiente, y así no tiene
        // que leerlos con `useSearchParams()`.
        filtros={Object.fromEntries(
          Object.entries(params).filter(([, v]) => typeof v === "string" && v)
        ) as Record<string, string>}
      />
    </div>
  );
}
