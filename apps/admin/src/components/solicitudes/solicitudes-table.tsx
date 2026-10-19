"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  ExternalLink,
  MapPin,
  MessageSquareText,
  Paperclip,
  Phone,
  Search,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import {
  coincideSolicitud,
  fechaSola,
  nombresDeServicios,
  serviciosEnUnaLinea,
  type SolicitudItem,
} from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { BarraFiltros } from "@/components/shared/barra-filtros";
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
import { useAca } from "@/lib/filtros-url";
import { useEsMovil } from "@/lib/use-es-movil";
import {
  EstadoSolicitud,
  MiniaturasDeSolicitud,
  cuandoSolicitud,
} from "@/components/solicitudes/ficha-solicitud";

type Estado = "pendientes" | "atendidas" | "todas";

const ESTADOS: { clave: Estado; etiqueta: string }[] = [
  { clave: "pendientes", etiqueta: "Pendientes" },
  { clave: "atendidas", etiqueta: "Atendidas" },
  { clave: "todas", etiqueta: "Todas" },
];

const cuando = cuandoSolicitud;

function queEs(s: SolicitudItem): string {
  return serviciosEnUnaLinea(s) ?? "Solicitud";
}

/**
 * Lo que los clientes pidieron desde la app: visitas y cotizaciones. Llegan
 * como notificación a la app y quedan acá hasta que alguien las marca
 * atendidas. La misma pantalla que *Solicitudes* en la app.
 */
export function SolicitudesTable({ solicitudes }: { solicitudes: SolicitudItem[] }) {
  const router = useRouter();
  const [estado, setEstado] = useFiltroUrl<Estado>("estado", "pendientes");
  const [q, setQ] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  // La abierta va en la URL (`?abrir=`): así la búsqueda global puede llevar
  // directo a una, que no tiene página propia.
  const [abiertaId, setAbiertaId] = useFiltroUrl("abrir", "");
  const abierta = solicitudes.find((s) => s.id === abiertaId) ?? null;
  const setAbierta = (s: SolicitudItem | null) => setAbiertaId(s?.id ?? "");
  const [guardando, setGuardando] = useState(false);
  const esMovil = useEsMovil();
  const desde = useAca();

  // En el teléfono una solicitud se abre en su página, como en la app: la que
  // llega por `?abrir=` (la búsqueda global) va a esa página en vez de al diálogo.
  useEffect(() => {
    if (esMovil && abiertaId) {
      router.replace(`/dashboard/solicitudes/${abiertaId}?from=%2Fdashboard%2Fsolicitudes`);
    }
  }, [esMovil, abiertaId, router]);

  const filtradas = useMemo(
    () =>
      solicitudes.filter(
        (s) =>
          (estado === "todas" ? true : estado === "pendientes" ? !s.atendidaEl : !!s.atendidaEl) &&
          coincideSolicitud(s, q)
      ),
    [solicitudes, estado, q]
  );
  const totalPages = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    `${estado}|${q}`
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

  const mensajeVacio = q.trim()
    ? "Ninguna solicitud coincide con la búsqueda."
    : estado === "pendientes"
      ? "No hay solicitudes pendientes."
      : "No hay solicitudes.";

  return (
    <>
      <PageHeader title="Solicitudes" />

      <BarraFiltros
        activos={estado === "pendientes" ? 0 : 1}
        onLimpiar={() => {
          setEstado("pendientes");
          setPage(1);
        }}
        busqueda={
          <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por cliente o por lo que pide..."
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        }
      >
        <CustomSelect
          value={estado}
          onChange={(v) => {
            setEstado((v || "pendientes") as Estado);
            setPage(1);
          }}
          options={ESTADOS.map((e) => ({ value: e.clave, label: e.etiqueta }))}
          placeholder="Pendientes"
          className="w-44"
        />
      </BarraFiltros>

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
                  <TableHead>Servicios</TableHead>
                  <TableHead>Detalles</TableHead>
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
                    <TableCell className="max-w-xs">
                      <span className="line-clamp-2 text-sm font-medium text-primary">
                        {serviciosEnUnaLinea(s) ?? "—"}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-sm">
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
          <Link
            key={s.id}
            href={`/dashboard/solicitudes/${s.id}?from=${desde}`}
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
          </Link>
        ))}
      </ListaMovil>

      <Dialog open={abierta !== null && !esMovil} onOpenChange={(o) => !o && setAbierta(null)}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg" pantallaCompletaEnMovil>
          {abierta ? (
            <>
              {/* La ficha de la app en el portal: quién y en qué estado arriba,
                  y debajo un renglón por cosa —servicios, detalles, dónde,
                  contacto, visitas— con su rótulo, en vez de un párrafo
                  corrido donde cada dato había que buscarlo. */}
              <DialogHeader className="gap-1 border-b px-5 pb-4 pt-5">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="font-semibold tabular-nums">Solicitud #{abierta.numero}</span>
                  <span>·</span>
                  <span>{cuando(abierta.createdAt)}</span>
                  <EstadoSolicitud atendida={!!abierta.atendidaEl} />
                </div>
                <DialogTitle className="text-lg">
                  {abierta.contacto.nombre}
                  {abierta.cliente ? null : (
                    <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">
                      Sin cuenta
                    </span>
                  )}
                </DialogTitle>
              </DialogHeader>

              <div className="min-h-0 flex-1 divide-y overflow-y-auto">
                {nombresDeServicios(abierta).length ? (
                  <Renglon icono={Wrench} rotulo="Servicios">
                    <div className="flex flex-wrap gap-1.5">
                      {nombresDeServicios(abierta).map((nombre) => (
                        <span
                          key={nombre}
                          className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                        >
                          {nombre}
                        </span>
                      ))}
                    </div>
                  </Renglon>
                ) : null}

                {abierta.contacto.telefono || abierta.contacto.email ? (
                  <Renglon icono={Phone} rotulo="Contacto">
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
                        className="block text-muted-foreground hover:underline"
                      >
                        {abierta.contacto.email}
                      </a>
                    ) : null}
                  </Renglon>
                ) : null}

                <Renglon icono={MessageSquareText} rotulo="Detalles">
                  <p className="whitespace-pre-wrap">{abierta.mensaje}</p>
                </Renglon>

                {abierta.adjuntos.length ? (
                  <Renglon icono={Paperclip} rotulo="Fotos o videos">
                    <MiniaturasDeSolicitud adjuntos={abierta.adjuntos} />
                  </Renglon>
                ) : null}

                {abierta.direccion || abierta.propiedad ? (
                  <Renglon icono={MapPin} rotulo="Dónde">
                    {abierta.propiedad ? (
                      <p className="font-medium">{abierta.propiedad.nombre}</p>
                    ) : null}
                    {abierta.direccion ? (
                      <p className="text-muted-foreground">{abierta.direccion}</p>
                    ) : null}
                    {abierta.lat !== null && abierta.lng !== null ? (
                      <a
                        href={`https://www.google.com/maps/search/?api=1&query=${abierta.lat},${abierta.lng}`}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex items-center gap-1 font-medium text-primary hover:underline"
                      >
                        Ver en el mapa
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </Renglon>
                ) : null}

                {abierta.visitas.length > 0 ? (
                  <Renglon
                    icono={CalendarDays}
                    rotulo={abierta.visitas.length === 1 ? "Visita" : "Visitas"}
                  >
                    {abierta.visitas.map((v) => (
                      <Link
                        key={v.id}
                        href={`/dashboard/visitas/${v.id}`}
                        className="block font-medium text-primary hover:underline"
                      >
                        #{v.numero} · {fechaSola(v.fechaProgramada)}
                      </Link>
                    ))}
                  </Renglon>
                ) : null}

                {abierta.cliente ? null : (
                  <p className="px-5 py-3 text-sm text-muted-foreground">
                    La mandó sin cuenta: al crear la visita se le crea su ficha con
                    estos datos.
                  </p>
                )}
              </div>

              <DialogFooter className="mx-0 mb-0 items-stretch gap-2 px-5 py-3 sm:items-center sm:justify-between">
                <p className="text-xs text-muted-foreground">
                  {abierta.atendidaEl
                    ? `Atendida ${cuando(abierta.atendidaEl)}${
                        abierta.atendidaPorNombre ? ` por ${abierta.atendidaPorNombre}` : ""
                      }`
                    : null}
                </p>
                <div className="flex flex-wrap justify-end gap-2">
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
                    variant="outline"
                    nativeButton={false}
                    render={
                      <Link href={`/dashboard/visitas/nueva?solicitud=${abierta.id}`} />
                    }
                  >
                    Crear visita
                  </Button>
                  <Button
                    disabled={guardando}
                    onClick={() => marcar(abierta, !abierta.atendidaEl)}
                  >
                    {abierta.atendidaEl ? "Volver a pendiente" : "Marcar atendida"}
                  </Button>
                </div>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Un dato de la solicitud: su ícono y su rótulo a la izquierda, el valor debajo. */
function Renglon({
  icono: Icono,
  rotulo,
  children,
}: {
  icono: LucideIcon;
  rotulo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-5 py-3 text-sm">
      <Icono className="mt-0.5 h-4 w-4 flex-none text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {rotulo}
        </p>
        {children}
      </div>
    </div>
  );
}
