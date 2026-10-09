"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import {
  ETIQUETA_ESTADO_OBRA,
  fechaSola,
  nombreCliente,
  paraBuscar,
  type EstadoObra,
  type ObraFila,
} from "@vivero/shared";
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
import { PageHeader } from "@/components/shared/page-header";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { TablePagination, FILAS_POR_PAGINA } from "@/components/shared/table-pagination";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";
import { cn } from "@/lib/utils";

const ESTADOS: { clave: "" | EstadoObra; etiqueta: string }[] = [
  { clave: "EN_CURSO", etiqueta: "En curso" },
  { clave: "TERMINADA", etiqueta: "Terminadas" },
  { clave: "CANCELADA", etiqueta: "Canceladas" },
  { clave: "", etiqueta: "Todas" },
];

function dinero(n: number) {
  return n.toLocaleString("es-EC", { style: "currency", currency: "USD" });
}

function EstadoPastilla({ estado }: { estado: EstadoObra }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        estado === "EN_CURSO" && "bg-primary/10 text-primary",
        estado === "TERMINADA" && "bg-muted text-muted-foreground",
        estado === "CANCELADA" && "bg-red-50 text-red-700"
      )}
    >
      {ETIQUETA_ESTADO_OBRA[estado]}
    </span>
  );
}

function quien(o: ObraFila): string {
  if (!o.cliente) return "Sin cliente";
  return o.propiedad
    ? `${nombreCliente(o.cliente)} · ${o.propiedad.nombre}`
    : nombreCliente(o.cliente);
}

/**
 * Las obras: cada trabajo puntual, con su centro de costo. Arranca en las que
 * están en curso, que son las que reciben movimientos; las demás están a un
 * filtro.
 */
export function ObrasTable({ obras }: { obras: ObraFila[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  const [estado, setEstado] = useFiltroUrl<string>("estado", "EN_CURSO");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const aqui = useAca();

  const filtradas = useMemo(() => {
    const palabras = paraBuscar(busqueda.trim()).split(/\s+/).filter(Boolean);
    return obras.filter((o) => {
      if (estado && o.estado !== estado) return false;
      if (palabras.length === 0) return true;
      const texto = paraBuscar(
        `#${o.numero} ${o.nombre} ${o.cliente ? nombreCliente(o.cliente) : ""}`
      );
      return palabras.every((p) => texto.includes(p));
    });
  }, [obras, busqueda, estado]);

  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice((pagina - 1) * FILAS_POR_PAGINA, pagina * FILAS_POR_PAGINA);
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    `${busqueda}|${estado}`
  );
  const vacia = filtradas.length === 0 ? "No hay obras con esos filtros." : "";

  return (
    <>
      <PageHeader
        title="Obras"
        actions={[
          { label: "Nueva obra", href: "/dashboard/obras/nueva", icon: "plus", primary: true },
        ]}
      />

      <div className="flex flex-none flex-wrap items-center gap-2 md:gap-3">
        <div className="relative min-w-0 flex-1 md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por obra, cliente o número..."
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value);
              setPage(1);
            }}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex gap-1.5 overflow-x-auto">
          {ESTADOS.map((e) => (
            <button
              key={e.clave || "todas"}
              type="button"
              onClick={() => {
                setEstado(e.clave);
                setPage(1);
              }}
              className={cn(
                "h-9 flex-none rounded-full border px-3 text-sm font-medium",
                estado === e.clave
                  ? "border-primary bg-primary/10 text-primary"
                  : "bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              {e.etiqueta}
            </button>
          ))}
        </div>
      </div>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {vacia ? (
            <EmptyState message={vacia} />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-20">N.º</TableHead>
                  <TableHead>Obra</TableHead>
                  <TableHead>Centro de costo</TableHead>
                  <TableHead>Inicio</TableHead>
                  <TableHead className="text-right">Presupuesto</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((o) => (
                  <TableRow
                    key={o.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/dashboard/obras/${o.id}?from=${aca()}`)}
                  >
                    <TableCell className="font-bold tabular-nums">#{o.numero}</TableCell>
                    <TableCell>
                      <span className="block font-medium">{o.nombre}</span>
                      <span className="block text-xs text-muted-foreground">{quien(o)}</span>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {o.centroCosto?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {o.fechaInicio ? fechaSola(o.fechaInicio, { day: "numeric", month: "short", year: "numeric" }) : "—"}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {o.presupuesto != null ? dinero(o.presupuesto) : "—"}
                    </TableCell>
                    <TableCell>
                      <EstadoPastilla estado={o.estado} />
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
          sustantivo="obra"
          plural="obras"
        />
      </div>

      <ListaMovil
        vacia={!!vacia}
        mensajeVacio={vacia}
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {filtradas.slice(0, visibles).map((o) => (
          <Link key={o.id} href={`/dashboard/obras/${o.id}?from=${aqui}`} className={FILA_MOVIL}>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                <span className="tabular-nums">#{o.numero}</span> {o.nombre}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {quien(o)}
              </span>
            </span>
            <EstadoPastilla estado={o.estado} />
          </Link>
        ))}
      </ListaMovil>
    </>
  );
}
