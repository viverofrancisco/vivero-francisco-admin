"use client";

import { useMemo, useState } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { Loader2, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";
import {
  PERIODICIDAD_LABEL,
  estadoVariant,
  fecha,
  money,
} from "./formato";

interface SuscripcionRow {
  id: string;
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  /** Lo que se cobra por período. Ausente para quien no ve precios. */
  totalPeriodo?: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  items: {
    id: string;
    precio?: number;
    ivaTasa?: number;
    visitasPorPeriodo: number | null;
    producto: { id: string; nombre: string };
  }[];
  /**
   * Períodos vencidos que todavía no tienen orden. Con el cron sano, 0.
   * Ausente para quien no ve precios: es un pendiente de facturación.
   */
  periodosPendientes?: number;
}

const ESTADOS = ["ACTIVO", "PAUSADO", "CANCELADO"] as const;

export function SuscripcionesTable({
  suscripciones,
  soloPendientes = false,
  verPrecios = true,
}: {
  suscripciones: SuscripcionRow[];
  /** Se llega así desde el aviso de "Por facturar". */
  soloPendientes?: boolean;
  /**
   * Si se muestran precios y todo lo que cuelga de ellos: el total del
   * período, el equivalente mensual y los avisos de facturación. Un admin de
   * sector ve la suscripción para agendar, no para cobrar.
   */
  verPrecios?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useFiltroUrl("q", "");
  const [estado, setEstado] = useFiltroUrl<string | null>("estado", "ACTIVO");
  const [pendientes, setPendientes] = useFiltroUrl(
    "sinOrden",
    soloPendientes
  );
  const [generando, setGenerando] = useState(false);

  /**
   * Cuántos filtros están puestos, para el contador del botón. El buscador no
   * cuenta: está a la vista y con su texto adentro.
   */
  const filtrosActivos = (estado ? 1 : 0) + (pendientes ? 1 : 0);

  const limpiarFiltros = () => {
    setEstado(null);
    setPendientes(false);
  };

  /** Cuántas suscripciones esperan que se les cree la orden del período. */
  const conPendientes = suscripciones.filter(
    (s) => (s.periodosPendientes ?? 0) > 0
  ).length;

  /**
   * Dispara el mismo proceso que corre el cron todos los días.
   *
   * Vive acá y no en "Por facturar" porque acá se ve **qué** se va a generar:
   * la columna dice cuántos períodos le faltan a cada suscripción. Allá era un
   * número suelto y apretar era un salto de fe.
   */
  const generarRenovaciones = async () => {
    setGenerando(true);
    try {
      const res = await fetch("/api/ordenes/renovaciones", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(
        body.creadas === 0
          ? "No había períodos por generar"
          : `${body.creadas} ${body.creadas === 1 ? "orden creada" : "órdenes creadas"}`
      );
      for (const o of body.omitidas ?? []) {
        toast.warning(`Suscripción omitida: ${o.motivo}`);
      }
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos generar");
    } finally {
      setGenerando(false);
    }
  };

  const filtradas = useMemo(() => {
    let r = suscripciones;
    if (pendientes) r = r.filter((s) => (s.periodosPendientes ?? 0) > 0);
    if (estado) r = r.filter((s) => s.estado === estado);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (s) =>
          String(s.numero).includes(q) ||
          nombreCliente(s.cliente).toLowerCase().includes(q) ||
          s.items.some((i) => i.producto.nombre.toLowerCase().includes(q)),
      );
    }
    return r;
  }, [suscripciones, estado, query, pendientes]);

  // Lo que factura por mes el conjunto visible, normalizando cada periodicidad.
  const mensualizado = useMemo(() => {
    const meses: Record<string, number> = {
      MENSUAL: 1,
      TRIMESTRAL: 3,
      SEMESTRAL: 6,
      ANUAL: 12,
    };
    return filtradas
      .filter((s) => s.estado === "ACTIVO")
      .reduce(
        (acc, s) => acc + (s.totalPeriodo ?? 0) / (meses[s.periodicidad] ?? 1),
        0,
      );
  }, [filtradas]);

  const [page, setPage] = useFiltroUrl("pagina", 1);
  const totalPages = Math.max(
    1,
    Math.ceil(filtradas.length / FILAS_POR_PAGINA),
  );
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    `${query}|${estado ?? ""}|${pendientes}`
  );
  const enLista = filtradas.slice(0, visibles);
  const aqui = useAca();

  return (
    <>
      <PageHeader
        title="Suscripciones"
        actions={[
          {
            label: "Nueva suscripción",
            href: "/dashboard/suscripciones/nueva?from=/dashboard/suscripciones",
            icon: "plus",
            primary: true,
          },
        ]}
      />

      {/* En móvil el equivalente mensual va acá, pegado al título: en la fila
          de acciones se quedaba sin ancho contra el botón de generar órdenes,
          y es el número que resume la pantalla entera. En escritorio sigue a
          la derecha de esa fila, donde hay lugar de sobra. */}
      {verPrecios && mensualizado > 0 && (
        <p className="-mt-2 text-sm text-muted-foreground md:hidden">
          Equivalente mensual:{" "}
          <span className="font-semibold tabular-nums text-foreground">
            {money(mensualizado)}
          </span>
        </p>
      )}

      {/* El buscador a la vista, el resto adentro: es lo que se usa siempre, y
          cuatro controles en fila ocupaban el ancho de la tabla. */}
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
        <BarraFiltros
          escritorio="popover"
          activos={filtrosActivos}
          onLimpiar={limpiarFiltros}
          className="min-w-0 flex-1"
          busqueda={
            <div className="relative min-w-0 flex-1 md:min-w-[220px] md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por cliente o producto..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          }
        >

            <div className="space-y-1">
              <Label className="text-xs">Estado</Label>
              <CustomSelect
                value={estado ?? ""}
                onChange={(v) => setEstado(v || null)}
                options={[
                  { value: "", label: "Todas" },
                  ...ESTADOS.map((e) => ({
                    value: e,
                    label: e.charAt(0) + e.slice(1).toLowerCase(),
                  })),
                ]}
                placeholder="Todas"
              />
            </div>
            {/* Con el cron sano no hay ninguna, y un filtro que nunca encuentra
                nada solo ocupa lugar. Se muestra igual si está prendido, para
                poder apagarlo en vez de quedar con una lista vacía sin
                explicación. */}
            {verPrecios && (conPendientes > 0 || pendientes) && (
              <label className="flex cursor-pointer items-start gap-2 rounded-md border p-2.5">
                <Checkbox
                  checked={pendientes}
                  onCheckedChange={(v) => setPendientes(v === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Con períodos sin orden
                  <span className="block text-xs text-muted-foreground">
                    {conPendientes} esperan que se les cree la orden
                  </span>
                </span>
              </label>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="hidden w-full md:inline-flex"
              onClick={limpiarFiltros}
              disabled={filtrosActivos === 0}
            >
              Limpiar filtros
            </Button>
        </BarraFiltros>
        {verPrecios && (conPendientes > 0 || pendientes) && (
          /* En móvil solo el ícono: al lado del buscador y del botón de
             filtros, la etiqueta se comía el ancho que necesita escribir. En
             escritorio sigue con texto — crea órdenes borrador de verdad, y un
             ícono suelto no dice qué va a pasar cuando hay lugar para decirlo. */
          <Button
            variant="outline"
            size="sm"
            aria-label="Generar órdenes"
            title="Generar órdenes"
            className="h-9 w-9 flex-none p-0 md:w-auto md:px-2.5"
            onClick={generarRenovaciones}
            disabled={generando}
          >
            {generando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            <span className="hidden md:inline">Generar órdenes</span>
          </Button>
        )}
        {verPrecios && mensualizado > 0 && (
          <span className="ml-auto hidden text-sm text-muted-foreground md:inline">
            Equivalente mensual:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {money(mensualizado)}
            </span>
          </span>
        )}
      </div>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtradas.length === 0 ? (
            <EmptyState message="No hay suscripciones que coincidan" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-20">N.º</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Productos</TableHead>
                  {verPrecios && (
                    <TableHead className="text-right">Precio</TableHead>
                  )}
                  <TableHead>Período</TableHead>
                  <TableHead>Desde</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(
                        `/dashboard/suscripciones/${s.id}?from=${aca()}`,
                      )
                    }
                  >
                    <TableCell className="font-bold tabular-nums">
                      #{s.numero}
                    </TableCell>
                    <TableCell className="font-medium">
                      {nombreCliente(s.cliente)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      <div className="flex flex-col gap-0.5">
                        {s.items.map((i) => (
                          <span key={i.id} className="truncate">
                            {i.producto.nombre}
                            {verPrecios && (
                              <span className="ml-2 text-xs tabular-nums">
                                {money(i.precio ?? 0)}
                                {(i.ivaTasa ?? 0) > 0 && ` +${i.ivaTasa}%`}
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    {/* Sin el sufijo: la columna de al lado dice el período,
                        y repetirlo en cada fila era leer dos veces lo mismo. */}
                    {verPrecios && (
                      <TableCell className="text-right font-semibold tabular-nums">
                        {money(s.totalPeriodo ?? 0)}
                      </TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      {PERIODICIDAD_LABEL[s.periodicidad]}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {fecha(s.fechaInicio)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant={estadoVariant[s.estado] ?? "outline"}>
                        {s.estado.charAt(0) + s.estado.slice(1).toLowerCase()}
                      </Badge>
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
          sustantivo="suscripción"
          plural="suscripciones"
        />
      </div>

      {/* Móvil: cliente y estado arriba; debajo, los productos del plan con su
          período. El precio va al final del renglón y solo si esta persona ve
          plata — un PERSONAL_ADMIN ve sus planes sin importes, y eso se decide
          en el servidor, no con CSS. */}
      <ListaMovil
        vacia={filtradas.length === 0}
        mensajeVacio="No hay suscripciones que coincidan"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((s) => (
          <Link
            key={s.id}
            href={`/dashboard/suscripciones/${s.id}?from=${aqui}`}
            className={FILA_MOVIL}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                <span className="tabular-nums">#{s.numero}</span>{" "}
                {nombreCliente(s.cliente)}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {s.items.map((i) => i.producto.nombre).join(", ")}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {PERIODICIDAD_LABEL[s.periodicidad]}
                {verPrecios && (
                  <>
                    {" · "}
                    <span className="tabular-nums">
                      {money(s.totalPeriodo ?? 0)}
                    </span>
                  </>
                )}
                {" · desde "}
                <span className="tabular-nums">{fecha(s.fechaInicio)}</span>
              </span>
            </span>
            <Badge variant={estadoVariant[s.estado] ?? "outline"}>
              {s.estado.charAt(0) + s.estado.slice(1).toLowerCase()}
            </Badge>
          </Link>
        ))}
      </ListaMovil>
    </>
  );
}
