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
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { ExternalLink, Search } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "@/components/ordenes/formato";
import {
  ESTADO_FACTURA_AYUDA,
  ESTADO_FACTURA_LABEL,
  ESTADO_FACTURA_VARIANT,
} from "./estado";

export interface FacturaRow {
  id: string;
  numero: string;
  fechaEmision: string;
  estado: string;
  total: number;
  /** Lo que falta cobrar, espejado de Contífico. */
  saldo: number | null;
  urlRide: string | null;
  anulada: boolean;
  razonSocial: string | null;
  identificacion: string | null;
  orden: {
    id: string;
    numero: number;
    cliente: {
      id: string;
      nombre: string;
      apellido: string | null;
      empresa: string | null;
    };
  };
}

export function FacturasTable({
  facturas,
  /** Con el contexto ya fijado (un cliente, una suscripción) sobra la columna. */
  mostrarCliente = true,
  compacta = false,
}: {
  facturas: FacturaRow[];
  mostrarCliente?: boolean;
  compacta?: boolean;
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [estado, setEstado] = useState("");

  const filtradas = useMemo(() => {
    let r = facturas;
    if (estado) r = r.filter((f) => f.estado === estado);
    if (query.trim()) {
      const q = query.toLowerCase();
      r = r.filter(
        (f) =>
          f.numero.toLowerCase().includes(q) ||
          (f.razonSocial ?? "").toLowerCase().includes(q) ||
          (f.identificacion ?? "").includes(q) ||
          nombreCliente(f.orden.cliente).toLowerCase().includes(q),
      );
    }
    return r;
  }, [facturas, query, estado]);

  // Las anuladas no suman: el total tiene que ser lo efectivamente facturado.
  const total = filtradas.reduce((a, f) => a + (f.anulada ? 0 : f.total), 0);

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
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      {!compacta && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[220px] max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por número, razón social o cliente..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="w-48">
            <CustomSelect
              value={estado}
              onChange={setEstado}
              options={[
                { value: "", label: "Todos los estados" },
                ...Object.entries(ESTADO_FACTURA_LABEL).map(([value, label]) => ({
                  value,
                  label,
                })),
              ]}
              placeholder="Todos los estados"
            />
          </div>
          <span className="ml-auto text-sm text-muted-foreground">
            {filtradas.length} {filtradas.length === 1 ? "factura" : "facturas"}{" "}
            ·{" "}
            <span className="font-semibold text-foreground tabular-nums">
              {money(total)}
            </span>
          </span>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtradas.length === 0 ? (
            <EmptyState message="No hay facturas" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Número</TableHead>
                  {mostrarCliente && <TableHead>Cliente</TableHead>}
                  <TableHead>Facturado a</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((f) => (
                  <TableRow
                    key={f.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/ordenes/${f.orden.id}`)
                    }
                  >
                    <TableCell className="font-mono text-xs font-medium">
                      {f.numero}
                      <span className="ml-2 font-sans text-xs text-muted-foreground">
                        Orden #{f.orden.numero}
                      </span>
                    </TableCell>
                    {mostrarCliente && (
                      <TableCell>{nombreCliente(f.orden.cliente)}</TableCell>
                    )}
                    <TableCell className="text-muted-foreground">
                      <div className="text-sm">{f.razonSocial ?? "—"}</div>
                      {f.identificacion && (
                        <div className="text-xs">{f.identificacion}</div>
                      )}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {fecha(f.fechaEmision)}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      <span
                        className={f.anulada ? "line-through opacity-60" : ""}
                      >
                        {money(f.total)}
                      </span>
                      {/* El cobro lo lleva Contífico; acá solo se espeja lo que
                          falta, y solo cuando falta algo. */}
                      {!f.anulada && f.saldo !== null && f.saldo > 0 && (
                        <div className="text-xs font-normal text-amber-700">
                          falta {money(f.saldo)}
                        </div>
                      )}
                      {!f.anulada && f.saldo === 0 && (
                        <div className="text-xs font-normal text-muted-foreground">
                          cobrada
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {f.anulada ? (
                        <Badge variant="destructive">Anulada</Badge>
                      ) : (
                        <Badge
                          variant={ESTADO_FACTURA_VARIANT[f.estado] ?? "outline"}
                          title={ESTADO_FACTURA_AYUDA[f.estado]}
                        >
                          {ESTADO_FACTURA_LABEL[f.estado] ?? f.estado}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {/* Sin firma no hay RIDE, aunque la URL exista desde que
                          se emite: el enlace llevaría a un error de Contífico. */}
                      {f.urlRide && f.estado !== "PENDIENTE" && (
                        <Link
                          href={f.urlRide}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            title="Ver el RIDE"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </Link>
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
          sustantivo="factura"
        />
      </div>
    </div>
  );
}
