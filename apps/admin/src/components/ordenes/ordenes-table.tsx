"use client";

import { useTransition } from "react";
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
import { nombreCliente, resumenDePropiedades } from "@vivero/shared";
import {
  aca,
  useAca,
  useBusquedaEnUrl,
  useFiltroUrl,
} from "@/lib/filtros-url";
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
  /** En qué propiedades se trabajó. Vacío en la orden de un período de plan. */
  propiedades: string[];
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

export function OrdenesTable({
  ordenes,
  q = "",
  estado = "",
}: {
  ordenes: OrdenRow[];
  /** Lo que el servidor ya filtró: la lista que llega es la respuesta. */
  q?: string;
  estado?: string;
}) {
  const router = useRouter();
  const [pendiente, startTransition] = useTransition();
  const [page, setPage] = useFiltroUrl("pagina", 1);

  /*
   * Los filtros viajan en la URL y los resuelve el servidor, así que se
   * escriben con `router.replace` y no con `useFiltroUrl`: reescribir la URL a
   * mano no le pide nada al servidor, y la tabla seguiría mostrando lo de
   * antes mientras los controles dicen otra cosa.
   *
   * `replace` y no `push` para que atrás salga del listado en vez de deshacer
   * letra por letra, y adentro de una transición para que la lista de antes se
   * quede —atenuada— hasta que llegue la nueva, en vez de parpadear con el
   * esqueleto de `loading.tsx` en cada tecla.
   */
  function actualizar(patch: Record<string, string | null>) {
    const params = new URLSearchParams(window.location.search);
    for (const [clave, valor] of Object.entries(patch)) {
      if (valor) params.set(clave, valor);
      else params.delete(clave);
    }
    params.delete("pagina");
    const qs = params.toString();
    startTransition(() => {
      router.replace(`/dashboard/ordenes${qs ? `?${qs}` : ""}`);
    });
  }

  // Lo tecleado manda mientras se escribe; la URL solo cuando cambia por fuera.
  const [busqueda, setBusqueda] = useBusquedaEnUrl(q, (v) =>
    actualizar({ q: v || null })
  );

  const filtradas = ordenes;

  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  // En móvil la lista crece al bajar en lugar de paginar.
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    `${q}|${estado}`
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
        onLimpiar={() => actualizar({ estado: null })}
        busqueda={
          <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente o número..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="pl-9"
            />
          </div>
        }
      >
        <div className="w-48">
          <CustomSelect
            value={estado}
            onChange={(v) => actualizar({ estado: v || null })}
            options={FILTROS}
            placeholder="Todas"
          />
        </div>
      </BarraFiltros>

      <div
        className={`hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card transition-opacity md:flex ${
          pendiente ? "opacity-60" : ""
        }`}
      >
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
                      {/* De qué casa. Debajo del nombre y no en una columna
                          propia: es el mismo "dónde" que el cliente, y una
                          columna se paga en ancho todo el tiempo. */}
                      {o.propiedades.length > 0 ? (
                        <span className="block text-xs font-normal text-muted-foreground">
                          {resumenDePropiedades(o.propiedades)}
                        </span>
                      ) : null}
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
              <span className="block truncate text-xs font-medium text-muted-foreground">
                <span className="tabular-nums">
                  {fecha(o.fecha)} · {money(o.total)}
                </span>
                {o.propiedades.length > 0
                  ? ` · ${resumenDePropiedades(o.propiedades)}`
                  : ""}
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
