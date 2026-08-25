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
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { Loader2, Plus, RefreshCw, Search } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
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
  totalPeriodo: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  items: {
    id: string;
    precio: number;
    ivaTasa: number;
    visitasPorPeriodo: number | null;
    producto: { id: string; nombre: string };
  }[];
  /** Períodos vencidos que todavía no tienen orden. Con el cron sano, 0. */
  periodosPendientes: number;
}

const ESTADOS = ["ACTIVO", "PAUSADO", "CANCELADO"] as const;

export function SuscripcionesTable({
  suscripciones,
  soloPendientes = false,
}: {
  suscripciones: SuscripcionRow[];
  /** Se llega así desde el aviso de "Por facturar". */
  soloPendientes?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState<string | null>("ACTIVO");
  const [pendientes, setPendientes] = useState(soloPendientes);
  const [generando, setGenerando] = useState(false);

  /** Cuántas suscripciones esperan que se les cree la orden del período. */
  const conPendientes = suscripciones.filter(
    (s) => s.periodosPendientes > 0
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
    if (pendientes) r = r.filter((s) => s.periodosPendientes > 0);
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
        (acc, s) => acc + s.totalPeriodo / (meses[s.periodicidad] ?? 1),
        0,
      );
  }, [filtradas]);

  const [page, setPage] = useState(1);
  const totalPages = Math.max(
    1,
    Math.ceil(filtradas.length / FILAS_POR_PAGINA),
  );
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Suscripciones</h1>
          <p className="text-sm text-muted-foreground">
            Productos recurrentes contratados. Cada período genera una línea de
            orden.
          </p>
        </div>
        <Link href="/dashboard/suscripciones/nueva?from=/dashboard/suscripciones">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Nueva suscripción
          </Button>
        </Link>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o producto..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="w-40">
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
        {/* Con el cron sano no hay ninguna, y un filtro que nunca encuentra nada
            solo ocupa lugar. Se muestra igual si está prendido, para poder
            apagarlo en vez de quedar con una lista vacía sin explicación. */}
        {(conPendientes > 0 || pendientes) && (
          <>
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <Checkbox
                checked={pendientes}
                onCheckedChange={(v) => setPendientes(v === true)}
              />
              Con períodos sin orden ({conPendientes})
            </label>
            <Button
              variant="outline"
              size="sm"
              onClick={generarRenovaciones}
              disabled={generando}
            >
              {generando ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Generar órdenes
            </Button>
          </>
        )}
        {mensualizado > 0 && (
          <span className="ml-auto text-sm text-muted-foreground">
            Equivalente mensual:{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {money(mensualizado)}
            </span>
          </span>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
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
                  <TableHead className="text-right">Precio</TableHead>
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
                        `/dashboard/suscripciones/${s.id}?from=/dashboard/suscripciones`,
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
                            <span className="ml-2 text-xs tabular-nums">
                              {money(i.precio)}
                              {i.ivaTasa > 0 && ` +${i.ivaTasa}%`}
                            </span>
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    {/* Sin el sufijo: la columna de al lado dice el período,
                        y repetirlo en cada fila era leer dos veces lo mismo. */}
                    <TableCell className="text-right font-semibold tabular-nums">
                      {money(s.totalPeriodo)}
                    </TableCell>
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
    </>
  );
}
