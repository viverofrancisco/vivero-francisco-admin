import Link from "next/link";
import { nombreCliente } from "@vivero/shared";
import { requireAuth, viewerFromSession } from "@/lib/auth-helpers";
import { listInformes } from "@/lib/services/informe.service";
import { listClientes } from "@/lib/services/cliente.service";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { InformesTable } from "@/components/informes/informes-table";
import { InformesFilters } from "@/components/informes/informes-filters";
import { InformesPagination } from "@/components/informes/informes-pagination";

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
    page?: string;
  }>;
}) {
  await requireAuth();
  const viewer = await viewerFromSession();
  const params = await searchParams;

  const clienteId = params.clienteId || undefined;
  const from = parseDate(params.from);
  const to = parseDate(params.to);
  const page = Math.max(1, Number(params.page) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const [{ items, total }, clientesPage] = await Promise.all([
    listInformes(viewer, {
      clienteId,
      from,
      to,
      offset,
      limit: PAGE_SIZE,
    }),
    listClientes(viewer, { limit: 200 }),
  ]);

  const serialized = items.map((i) => ({
    id: i.id,
    titulo: i.titulo,
    fechaDesde: i.fechaDesde?.toISOString() ?? null,
    fechaHasta: i.fechaHasta?.toISOString() ?? null,
    pdfUrl: i.pdfUrl,
    generatedAt: i.generatedAt.toISOString(),
    cliente: {
      id: i.cliente.id,
      nombre: nombreCliente(i.cliente),
    },
    generatedBy: {
      nombre: `${i.generatedBy.name ?? ""} ${i.generatedBy.apellido ?? ""}`.trim(),
    },
    visitasCount: i._count.visitas,
  }));

  const clientesOptions = clientesPage.items.map((c) => ({
    value: c.id,
    label: nombreCliente(c),
  }));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Informes</h1>
          <p className="text-sm text-muted-foreground">
            Informes mensuales generados por cliente.
          </p>
        </div>
        <Link href="/dashboard/informes/nuevo">
          <Button>
            <Plus className="h-4 w-4 mr-1.5" />
            Generar nuevo informe
          </Button>
        </Link>
      </div>

      <InformesFilters
        clientes={clientesOptions}
        clienteId={clienteId ?? null}
        from={params.from ?? null}
        to={params.to ?? null}
      />

      <InformesTable items={serialized} />

      {total > 0 ? (
        <InformesPagination
          page={page}
          totalPages={totalPages}
          total={total}
          pageSize={PAGE_SIZE}
        />
      ) : null}
    </div>
  );
}
