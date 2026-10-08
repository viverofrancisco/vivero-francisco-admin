"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { SolicitudItem } from "@vivero/shared";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { PageHeader } from "@/components/shared/page-header";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { useFiltroUrl } from "@/lib/filtros-url";
import { cn } from "@/lib/utils";

type Estado = "pendientes" | "atendidas" | "todas";

const ESTADOS: { clave: Estado; etiqueta: string }[] = [
  { clave: "pendientes", etiqueta: "Pendientes" },
  { clave: "atendidas", etiqueta: "Atendidas" },
  { clave: "todas", etiqueta: "Todas" },
];

/** Un instante, en la hora de Ecuador: lo mismo en el servidor y en el navegador. */
function cuando(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    timeZone: "America/Guayaquil",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

function queEs(s: SolicitudItem): string {
  return s.producto ? `Cotización · ${s.producto.nombre}` : "Solicitud";
}

/**
 * Lo que los clientes pidieron desde la app: visitas y cotizaciones. Llegan
 * como notificación a la app y quedan acá hasta que alguien las marca
 * atendidas. La misma pantalla que *Solicitudes* en la app.
 */
export function SolicitudesTable({ solicitudes }: { solicitudes: SolicitudItem[] }) {
  const router = useRouter();
  const [estado, setEstado] = useFiltroUrl<Estado>("estado", "pendientes");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [abierta, setAbierta] = useState<SolicitudItem | null>(null);
  const [guardando, setGuardando] = useState(false);

  const filtradas = useMemo(
    () =>
      solicitudes.filter((s) =>
        estado === "todas" ? true : estado === "pendientes" ? !s.atendidaEl : !!s.atendidaEl
      ),
    [solicitudes, estado]
  );
  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    estado
  );

  async function marcar(s: SolicitudItem, atendida: boolean) {
    setGuardando(true);
    try {
      const res = await fetch(`/api/solicitudes/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ atendida }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "No se pudo guardar");
      }
      toast.success(atendida ? "Marcada como atendida" : "Volvió a pendiente");
      setAbierta(null);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  }

  const mensajeVacio =
    estado === "pendientes" ? "No hay solicitudes pendientes." : "No hay solicitudes.";

  return (
    <>
      <PageHeader title="Solicitudes" />

      <div className="flex flex-none flex-wrap items-center gap-2">
        {ESTADOS.map((e) => (
          <button
            key={e.clave}
            type="button"
            onClick={() => {
              setEstado(e.clave);
              setPage(1);
            }}
            className={cn(
              "h-9 rounded-full border px-4 text-sm font-medium transition-colors",
              estado === e.clave
                ? "border-primary bg-primary/10 text-primary"
                : "bg-card text-muted-foreground hover:bg-muted"
            )}
          >
            {e.etiqueta}
          </button>
        ))}
      </div>

      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtradas.length === 0 ? (
            <EmptyState message={mensajeVacio} />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-20">N.º</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Qué pide</TableHead>
                  <TableHead>Recibida</TableHead>
                  <TableHead>Estado</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginadas.map((s) => (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer"
                    onClick={() => setAbierta(s)}
                  >
                    <TableCell className="font-bold tabular-nums">#{s.numero}</TableCell>
                    <TableCell className="font-medium">
                      {s.contacto.nombre}
                      <span className="block text-xs font-normal text-muted-foreground">
                        {[s.contacto.telefono, s.cliente ? null : "Sin cuenta"]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md">
                      <span className="block text-sm font-medium text-primary">{queEs(s)}</span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {s.mensaje}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-muted-foreground">
                      {cuando(s.createdAt)}
                    </TableCell>
                    <TableCell>
                      <EstadoSolicitud atendida={!!s.atendidaEl} />
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
          sustantivo="solicitud"
          plural="solicitudes"
        />
      </div>

      <ListaMovil
        vacia={filtradas.length === 0}
        mensajeVacio={mensajeVacio}
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {filtradas.slice(0, visibles).map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setAbierta(s)}
            className={cn(FILA_MOVIL, "w-full text-left")}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {s.contacto.nombre}
                {s.cliente ? null : (
                  <span className="font-normal text-muted-foreground"> · Sin cuenta</span>
                )}
              </span>
              <span className="block truncate text-xs font-medium text-primary">
                {queEs(s)}
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {s.mensaje}
              </span>
            </span>
            <span className="flex flex-none flex-col items-end gap-1">
              <span className="text-xs text-muted-foreground">{cuando(s.createdAt)}</span>
              <EstadoSolicitud atendida={!!s.atendidaEl} />
            </span>
          </button>
        ))}
      </ListaMovil>

      <Dialog open={abierta !== null} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="sm:max-w-lg">
          {abierta ? (
            <>
              <DialogHeader>
                <DialogTitle>
                  Solicitud #{abierta.numero} · {abierta.contacto.nombre}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  {queEs(abierta)} · {cuando(abierta.createdAt)}
                  {abierta.cliente ? "" : " · Sin cuenta: la mandó desde el modo invitado"}
                </p>
                <p className="whitespace-pre-wrap text-base">{abierta.mensaje}</p>
                {abierta.direccion ? (
                  <p>
                    <span className="text-muted-foreground">Dirección: </span>
                    {abierta.direccion}
                  </p>
                ) : null}
                <div className="flex flex-col gap-1">
                  {abierta.contacto.telefono ? (
                    <a
                      href={`tel:${abierta.contacto.telefono}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {abierta.contacto.telefono}
                    </a>
                  ) : null}
                  {abierta.contacto.email ? (
                    <a
                      href={`mailto:${abierta.contacto.email}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {abierta.contacto.email}
                    </a>
                  ) : null}
                </div>
                {abierta.atendidaEl ? (
                  <p className="text-muted-foreground">
                    Atendida {cuando(abierta.atendidaEl)}
                    {abierta.atendidaPorNombre ? ` por ${abierta.atendidaPorNombre}` : ""}
                  </p>
                ) : null}
              </div>
              <DialogFooter className="gap-2">
                {abierta.cliente ? (
                  <Button
                    variant="outline"
                    nativeButton={false}
                    render={<Link href={`/dashboard/clientes/${abierta.cliente.id}`} />}
                  >
                    Ver cliente
                  </Button>
                ) : null}
                <Button
                  disabled={guardando}
                  onClick={() => marcar(abierta, !abierta.atendidaEl)}
                >
                  {abierta.atendidaEl ? "Volver a pendiente" : "Marcar atendida"}
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function EstadoSolicitud({ atendida }: { atendida: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold",
        atendida ? "bg-primary/10 text-primary" : "bg-amber-100 text-amber-800"
      )}
    >
      {atendida ? "Atendida" : "Pendiente"}
    </span>
  );
}
