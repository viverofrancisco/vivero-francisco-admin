"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { Plus, Search } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { aca, useFiltroUrl } from "@/lib/filtros-url";

interface OrdenRow {
  id: string;
  numero: number;
  fecha: string;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  lineas: number;
  total: number;
}

/**
 * Las órdenes que todavía nadie decidió cobrar.
 *
 * Tienen página propia porque son otra cosa que el resto: acá se revisa y se
 * ajusta —es el único estado editable— mientras que en Órdenes ya está todo
 * decidido y lo que importa es si entró la plata. Casi todas las crea el cron
 * de renovaciones; una emisión que falla también deja la orden acá.
 */
export function BorradoresTable({ ordenes }: { ordenes: OrdenRow[] }) {
  const router = useRouter();
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ordenes;
    return ordenes.filter(
      (o) =>
        nombreCliente(o.cliente).toLowerCase().includes(q) ||
        String(o.numero).includes(q)
    );
  }, [ordenes, busqueda]);

  const total = filtradas.reduce((a, o) => a + o.total, 0);
  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Borradores</h1>
          <p className="text-sm text-muted-foreground">
            Órdenes por revisar. Se pueden editar hasta que se facturan.
          </p>
        </div>
        <Link href="/dashboard/ordenes/nueva">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Button>
        </Link>
      </div>

      <div className="flex flex-none flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o número..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        {filtradas.length > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">
            Suman{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {money(total)}
            </span>
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtradas.length === 0 ? (
            <EmptyState message="No hay borradores por revisar." />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-20">N.º</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-center">Productos</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/ordenes/${o.id}?from=${aca()}`
                      )
                    }
                  >
                    <TableCell className="font-bold tabular-nums">
                      #{o.numero}
                    </TableCell>
                    <TableCell className="font-medium">
                      {nombreCliente(o.cliente)}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fecha(o.fecha)}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {o.lineas}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(o.total)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <TablePagination
          page={pagina}
          total={filtradas.length}
          onPageChange={setPage}
          sustantivo="borrador"
          plural="borradores"
        />
      </div>
    </>
  );
}
