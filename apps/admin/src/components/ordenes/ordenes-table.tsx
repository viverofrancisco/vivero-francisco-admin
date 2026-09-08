"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { nombreCliente } from "@vivero/shared";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";
import {
  money,
  fecha,
  estadoCobro,
  cobroLabel,
  cobroVariant,
} from "./formato";

interface OrdenRow {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  lineas: number;
  facturas: number;
  total: number;
  /** Lo que falta cobrar de su factura viva. `null` = sin sincronizar. */
  saldo: number | null;
}

/**
 * El filtro es por **cobro**, no por estado de la orden.
 *
 * Los borradores tienen su propia página y anulada es el único otro estado, así
 * que un filtro de estados hubiera tenido una sola opción útil.
 */
const FILTROS = [
  { value: "", label: "Todas" },
  { value: "SIN_COBRAR", label: "Sin cobrar" },
  { value: "PARCIAL", label: "Cobrado parcialmente" },
  { value: "COBRADO", label: "Cobrado" },
  { value: "ANULADA", label: "Anuladas" },
];

export function OrdenesTable({ ordenes }: { ordenes: OrdenRow[] }) {
  const router = useRouter();
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  const [estado, setEstado] = useFiltroUrl("estado", "");

  /** Cualquier filtro que cambie vuelve a la primera página. */
  const cambiar = (fn: () => void) => {
    fn();
    setPage(1);
  };

  const filtradas = useMemo(() => {
    let r = ordenes;
    if (estado === "ANULADA") r = r.filter((o) => o.estado === "ANULADA");
    else if (estado) {
      r = r.filter(
        (o) => o.estado !== "ANULADA" && estadoCobro(o.total, o.saldo) === estado
      );
    }
    const q = busqueda.trim().toLowerCase();
    if (q) {
      r = r.filter(
        (o) =>
          nombreCliente(o.cliente).toLowerCase().includes(q) ||
          String(o.numero).includes(q)
      );
    }
    return r;
  }, [ordenes, estado, busqueda]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  // En móvil la lista crece al bajar en lugar de paginar.
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    `${busqueda}|${estado}`
  );
  const enLista = filtradas.slice(0, visibles);
  const aqui = useAca();

  return (
    <>
      <PageHeader
        title="Órdenes"
        actions={[
          {
            label: "Nueva orden",
            href: "/dashboard/ordenes/nueva",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <BarraFiltros
        activos={estado ? 1 : 0}
        onLimpiar={() => cambiar(() => setEstado(""))}
        busqueda={
          <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente o número..."
              value={busqueda}
              onChange={(e) => cambiar(() => setBusqueda(e.target.value))}
              className="pl-9"
            />
          </div>
        }
      >
        <div className="w-48">
          <CustomSelect
            value={estado}
            onChange={(v) => cambiar(() => setEstado(v))}
            options={FILTROS}
            placeholder="Todas"
          />
        </div>
      </BarraFiltros>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtradas.length === 0 ? (
            <EmptyState
              message={
                ordenes.length === 0
                  ? "Todavía no hay órdenes"
                  : "Ninguna orden coincide con los filtros"
              }
            />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-20">N.º</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Cobro</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/ordenes/${o.id}?from=${aca()}`)
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
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(o.total)}
                    </TableCell>
                    <TableCell className="text-right">
                      {o.estado === "ANULADA" ? (
                        <Badge variant="destructive">Anulada</Badge>
                      ) : (
                        <Badge
                          variant={cobroVariant[estadoCobro(o.total, o.saldo)]}
                        >
                          {cobroLabel[estadoCobro(o.total, o.saldo)]}
                        </Badge>
                      )}
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
          sustantivo="orden"
          plural="órdenes"
        />
      </div>

      {/* Móvil: número y cliente arriba, fecha y total abajo, y el estado del
          cobro a la derecha — que es lo que se viene a mirar. Cinco columnas
          en 400 px dejan el total pegado al borde y la fecha partida. */}
      <ListaMovil
        vacia={filtradas.length === 0}
        mensajeVacio={
          ordenes.length === 0
            ? "Todavía no hay órdenes"
            : "Ninguna orden coincide con los filtros"
        }
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
              <span className="block truncate text-xs font-medium tabular-nums text-muted-foreground">
                {fecha(o.fecha)} · {money(o.total)}
              </span>
            </span>
            {o.estado === "ANULADA" ? (
              <Badge variant="destructive">Anulada</Badge>
            ) : (
              <Badge variant={cobroVariant[estadoCobro(o.total, o.saldo)]}>
                {cobroLabel[estadoCobro(o.total, o.saldo)]}
              </Badge>
            )}
          </Link>
        ))}
      </ListaMovil>
    </>
  );
}
