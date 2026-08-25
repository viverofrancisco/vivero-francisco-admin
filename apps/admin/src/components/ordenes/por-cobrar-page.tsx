"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { ArrowRight, Plus } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { ESTADO_FACTURA_LABEL } from "@/components/facturas/estado";

interface OrdenRow {
  id: string;
  numero: number;
  fecha: string;
  total: number;
  productos: number;
  factura: {
    numero: string;
    estado: string;
    fechaEmision: string;
    saldo: number;
    sincronizada: boolean;
  };
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
}

/**
 * Lo que falta cobrar: una fila por factura con saldo.
 *
 * Antes esta página listaba lo que faltaba **facturar**. Dejó de tener sentido
 * cuando confirmar pasó a emitir: lo que queda sin factura es un borrador, y un
 * borrador es trabajo por aprobar, no plata por entrar. Lo que sí queda abierto
 * después de facturar es el cobro.
 */
export function PorCobrarPage({
  ordenes,
  borradores = 0,
}: {
  ordenes: OrdenRow[];
  /** Borradores esperando revisión. Los crea el cron de renovaciones. */
  borradores?: number;
}) {
  const router = useRouter();

  const total = ordenes.reduce((a, o) => a + o.factura.saldo, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Por cobrar</h1>
          <p className="text-sm text-muted-foreground">
            Facturas emitidas con saldo pendiente.
          </p>
        </div>
        <Link href="/dashboard/ordenes/nueva">
          <Button variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            Nueva orden
          </Button>
        </Link>
      </div>

      {/* Lo que todavía no se decidió cobrar no es deuda, pero tampoco puede
          quedar invisible: el cron crea borradores todos los días. */}
      {borradores > 0 && (
        <Link
          href="/dashboard/ordenes/borradores"
          className="flex items-center justify-between gap-3 rounded-lg border bg-card px-4 py-3 text-sm transition-colors hover:bg-muted/40"
        >
          <span>
            <span className="font-medium">
              {borradores} {borradores === 1 ? "orden" : "órdenes"} en borrador
            </span>
            <span className="text-muted-foreground">
              {" "}
              · esperan revisión antes de cobrarse
            </span>
          </span>
          <span className="flex-none text-primary">Ver borradores</span>
        </Link>
      )}

      <div className="rounded-lg border bg-muted/30 px-4 py-3">
        <p className="text-xs text-muted-foreground">Total por cobrar</p>
        <p className="text-2xl font-bold tabular-nums">{money(total)}</p>
        <p className="text-xs text-muted-foreground">
          {ordenes.length} {ordenes.length === 1 ? "factura" : "facturas"} con
          saldo
        </p>
      </div>

      {ordenes.length === 0 ? (
        <EmptyState message="No hay nada pendiente de cobro." />
      ) : (
        <div className="overflow-hidden rounded-md border bg-card">
          <Table>
            <TableHeader sticky>
              <TableRow>
                <TableHead>Factura</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Emitida</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Falta cobrar</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {ordenes.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/dashboard/ordenes/${o.id}`)}
                >
                  <TableCell>
                    <span className="block font-medium tabular-nums">
                      {o.factura.numero}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      Orden #{o.numero} ·{" "}
                      {ESTADO_FACTURA_LABEL[o.factura.estado] ??
                        o.factura.estado}
                    </span>
                  </TableCell>
                  <TableCell>{nombreCliente(o.cliente)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fecha(o.factura.fechaEmision)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-muted-foreground">
                    {money(o.total)}
                  </TableCell>
                  <TableCell className="text-right font-semibold tabular-nums text-amber-700">
                    {money(o.factura.saldo)}
                    {/* Sin sincronizar el saldo es el total, no un dato. */}
                    {!o.factura.sincronizada && (
                      <span
                        className="ml-1 text-xs font-normal text-muted-foreground"
                        title="La factura nunca se sincronizó con Contífico: puede tener cobros que el portal no vio."
                      >
                        ?
                      </span>
                    )}
                  </TableCell>
                  <TableCell>
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
