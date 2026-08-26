"use client";

import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { nombreCliente } from "@vivero/shared";
import { aca, useFiltroUrl } from "@/lib/filtros-url";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import {
  resumenProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";

interface VisitaRow {
  id: string;
  numero: number;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
  };
  productos: ProductoDeVisita[];
  grupo: { id: string; nombre: string } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function VisitasTable({ visitas }: { visitas: VisitaRow[] }) {
  const router = useRouter();
  const [page, setPage] = useFiltroUrl("pagina", 1);

  const totalPages = Math.max(1, Math.ceil(visitas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = visitas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table containerClassName="h-full overflow-y-auto">
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-20">N.º</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginadas.map((v) => {
                const nombre = nombreCliente(v.cliente);
                return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/visitas/${v.id}?from=${aca()}`)
                    }
                  >
                    <TableCell className="font-bold tabular-nums">
                      #{v.numero}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={nombre} size={32} />
                        <span className="font-bold text-foreground">
                          {nombre}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {resumenProductos(v)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.grupo?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(v.fechaProgramada)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge
                        estado={v.estado as EstadoVisitaUI}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={pagina}
          total={visitas.length}
          onPageChange={setPage}
          sustantivo="visita"
        />
      </div>
    </div>
  );
}
