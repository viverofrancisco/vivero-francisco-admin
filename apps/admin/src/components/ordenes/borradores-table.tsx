"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { PageHeader } from "@/components/shared/page-header";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { Search } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

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

  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    busqueda
  );
  const enLista = filtradas.slice(0, visibles);
  const aqui = useAca();

  return (
    <>
      <PageHeader
        title="Borradores"
        actions={[
          {
            label: "Nueva orden",
            href: "/dashboard/ordenes/nueva",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      {/* Sin filtros: alcanza con el buscador. El total que iba acá —"Suman
          $X"— se fue: es la suma de lo que el cron dejó sin revisar, no plata
          que alguien deba, y al lado del título se leía como si lo fuera. */}
      <div className="flex flex-none flex-wrap items-center gap-2 [&_input]:h-9 md:gap-3">
        <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
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
      </div>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
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

      {/* Móvil: número y cliente arriba, y debajo la fecha con cuántos
          productos lleva y el total. */}
      <ListaMovil
        vacia={filtradas.length === 0}
        mensajeVacio="No hay borradores por revisar."
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((o) => (
          <Link
            key={o.id}
            href={`/dashboard/ordenes/${o.id}?from=${aqui}`}
            className={FILA_MOVIL}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                <span className="tabular-nums">#{o.numero}</span>{" "}
                {nombreCliente(o.cliente)}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                <span className="tabular-nums">{fecha(o.fecha)}</span> ·{" "}
                {o.lineas} {o.lineas === 1 ? "producto" : "productos"}
              </span>
            </span>
            <span className="flex-none text-sm font-semibold tabular-nums">
              {money(o.total)}
            </span>
          </Link>
        ))}
      </ListaMovil>
    </>
  );
}
