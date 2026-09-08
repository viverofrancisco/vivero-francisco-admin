"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { ArrowRight, Search } from "lucide-react";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { ESTADO_FACTURA_LABEL } from "@/components/facturas/estado";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

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
export function PorCobrarPage({ ordenes }: { ordenes: OrdenRow[] }) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return ordenes;
    return ordenes.filter(
      (o) =>
        nombreCliente(o.cliente).toLowerCase().includes(q) ||
        o.factura.numero.toLowerCase().includes(q) ||
        String(o.numero).includes(q)
    );
  }, [ordenes, busqueda]);

  // El total es el de la deuda entera, no el de lo que quedó a la vista:
  // buscar un cliente no cambia cuánto se debe.
  const total = ordenes.reduce((a, o) => a + o.factura.saldo, 0);

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    busqueda
  );
  const enLista = filtradas.slice(0, visibles);
  const aqui = useAca();

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 md:block md:h-auto md:space-y-5">
      <PageHeader
        title="Por cobrar"
        actions={[
          {
            label: "Nueva orden",
            href: "/dashboard/ordenes/nueva",
            icon: "plus",
          },
        ]}
      />

      <div className="flex flex-none flex-wrap items-center gap-2 [&_input]:h-9 md:gap-3">
        <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente o factura..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* En móvil un solo renglón: los tres del escritorio —rótulo, monto y
          cuántas facturas— se comían 80 px antes de mostrar una sola fila, y
          es un número de referencia, no la pantalla. */}
      <div className="flex flex-none items-center justify-between gap-3 rounded-lg border bg-muted/30 px-4 py-2.5 md:block md:py-3">
        <p className="min-w-0 text-xs text-muted-foreground">
          Total por cobrar
          <span className="md:hidden">
            {" · "}
            {ordenes.length} {ordenes.length === 1 ? "factura" : "facturas"}
          </span>
        </p>
        <p className="flex-none text-lg font-bold tabular-nums md:text-2xl">
          {money(total)}
        </p>
        <p className="hidden text-xs text-muted-foreground md:block">
          {ordenes.length} {ordenes.length === 1 ? "factura" : "facturas"} con
          saldo
        </p>
      </div>

      {filtradas.length === 0 ? (
        <EmptyState
          message={
            ordenes.length === 0
              ? "No hay nada pendiente de cobro."
              : "Ninguna factura coincide con la búsqueda."
          }
        />
      ) : (
        <div className="hidden overflow-hidden rounded-md border bg-card md:block">
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
              {filtradas.map((o) => (
                <TableRow
                  key={o.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(
                      `/dashboard/ordenes/${o.id}?from=${aca()}`
                    )
                  }
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
                        title="Esta factura no tiene saldo calculado, así que no sabemos cuánto falta cobrar."
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

      {/* Móvil: la factura y su cliente arriba, la fecha abajo, y lo que falta
          cobrar a la derecha — que es la columna por la que se entra acá. */}
      {filtradas.length > 0 && (
        <ListaMovil
          vacia={false}
          mensajeVacio=""
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
                  {nombreCliente(o.cliente)}
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  <span className="tabular-nums">{o.factura.numero}</span> ·{" "}
                  <span className="tabular-nums">
                    {fecha(o.factura.fechaEmision)}
                  </span>
                </span>
              </span>
              <span className="flex-none text-sm font-semibold tabular-nums text-amber-700">
                {money(o.factura.saldo)}
                {/* Sin sincronizar el saldo es el total, no un dato. */}
                {!o.factura.sincronizada && (
                  <span className="ml-0.5 text-xs font-normal text-muted-foreground">
                    ?
                  </span>
                )}
              </span>
            </Link>
          ))}
        </ListaMovil>
      )}
    </div>
  );
}
