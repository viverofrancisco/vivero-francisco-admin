"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  CheckCircle,
  MessageSquare,
  Pencil,
  Play,
  Receipt,
} from "lucide-react";
import { CompletarVisitaForm } from "@/components/visitas/completar-visita-form";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { nombreCliente } from "@vivero/shared";
import {
  listaProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";

interface VisitaDetailData {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  media: { id: string; url: string; tipo: string }[];
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
    ciudad: string | null;
    sector: { nombre: string } | null;
  };
  productos: ProductoDeVisita[];
  grupo: {
    id: string;
    nombre: string;
    miembros: { personal: { id: string; nombre: string; apellido?: string | null } }[];
  } | null;
  personal: { personal: { id: string; nombre: string; apellido?: string | null } }[];
}


interface VisitaDetailProps {
  visita: VisitaDetailData;
  userRole?: string;
  hasMessages?: boolean;
}

export function VisitaDetail({
  visita,
  userRole,
  hasMessages = false,
}: VisitaDetailProps) {
  const [completarOpen, setCompletarOpen] = useState(false);
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );

  const isProgramada = visita.estado === "PROGRAMADA";
  const canModify = userRole !== "PERSONAL";

  /**
   * Qué falta cobrar de esta visita.
   *
   * Lo cubierto por un plan no se factura aparte: entra en la orden del período.
   * Lo demás se cobra una vez, y la línea de orden es la prueba de que ya pasó.
   *
   * Se puede facturar por adelantado: alcanza con que la visita exista y no
   * esté cancelada. De una cancelada no hay nada que cobrar, y
   * `listarPendientes` tampoco la ofrece.
   */
  const facturable = visita.estado !== "CANCELADA";
  const porFacturar = visita.productos.filter(
    (vs) => !vs.suscripcionItemId && !vs.ordenLinea
  );
  const facturados = visita.productos.filter((vs) => vs.ordenLinea);
  const ordenes = [
    ...new Map(
      facturados.map((vs) => [vs.ordenLinea!.ordenId, vs.ordenLinea!])
    ).values(),
  ];

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b mb-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/visitas">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                Detalle de Visita
              </h1>
              <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
            </div>
            <p className="text-sm text-muted-foreground truncate">
              {nombreCliente(visita.cliente)} — {listaProductos(visita)}
            </p>
          </div>
          {canModify && (
            <div className="flex flex-none items-center gap-2">
              {/* Editable en cualquier estado: corregir la fecha o el producto
                  de una visita ya hecha no debería obligar a rehacerla. */}
              <Link href={`/dashboard/visitas/${visita.id}/editar`}>
                <Button variant="outline">
                  <Pencil className="mr-2 h-4 w-4" />
                  Editar
                </Button>
              </Link>
              {facturable && porFacturar.length > 0 && (
                <Link
                  href={`/dashboard/ordenes/nueva?cliente=${visita.cliente.id}&visita=${visita.id}`}
                >
                  <Button variant="outline">
                    <Receipt className="mr-2 h-4 w-4" />
                    Crear orden
                  </Button>
                </Link>
              )}
              {isProgramada && (
                <Button onClick={() => setCompletarOpen(true)}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Completar
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Una banda con lo que identifica la visita —cuándo, para quién, qué—
          y debajo casillas chicas con el resto. La lista de etiqueta/valor
          dejaba media pantalla vacía y obligaba a leer en zigzag. */}
      <div className="flex flex-wrap items-start gap-5 rounded-2xl border bg-card p-5">
        <TarjetaFecha iso={visita.fechaProgramada} />

        <div className="min-w-0 flex-1 space-y-2">
          <Link
            href={`/dashboard/clientes/${visita.cliente.id}`}
            className="block truncate text-xl font-bold hover:underline"
          >
            {nombreCliente(visita.cliente)}
          </Link>
          <p className="text-sm text-muted-foreground">
            {[visita.cliente.sector?.nombre, visita.cliente.ciudad]
              .filter(Boolean)
              .join(" · ") || "Sin sector"}
          </p>
          <div className="flex flex-wrap gap-1.5 pt-1">
            {/* Lo cubierto por un plan se marca por visita, que es donde el
                dato existe: el catálogo no sabe qué tiene contratado quién. */}
            {visita.productos.map((vs) => (
              <Badge
                key={vs.productoId}
                variant={vs.suscripcionItemId ? "secondary" : "outline"}
                title={
                  vs.suscripcionItemId
                    ? "Cubierto por la suscripción del cliente"
                    : vs.ordenLinea
                      ? `Facturado en la orden #${vs.ordenLinea.orden.numero}`
                      : "Pendiente de facturar"
                }
              >
                {vs.producto.nombre}
                {!vs.suscripcionItemId && !vs.ordenLinea && (
                  <span className="ml-1 text-amber-700">·</span>
                )}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Dato etiqueta="Realizada">
          {visita.fechaRealizada ? (
            <span className="capitalize">{formatCorta(visita.fechaRealizada)}</span>
          ) : (
            <span className="text-muted-foreground">Todavía no</span>
          )}
        </Dato>
        <Dato etiqueta="Horario">
          {visita.horaEntrada || visita.horaSalida ? (
            `${visita.horaEntrada ?? "—"} a ${visita.horaSalida ?? "—"}`
          ) : (
            <span className="text-muted-foreground">Sin registrar</span>
          )}
        </Dato>
        <Dato etiqueta="Duración">
          {duracion(visita.horaEntrada, visita.horaSalida) ?? (
            <span className="text-muted-foreground">—</span>
          )}
        </Dato>
        <Dato etiqueta="Facturación">
          {porFacturar.length > 0 && !facturable ? (
            <span className="text-muted-foreground">Cancelada</span>
          ) : porFacturar.length > 0 ? (
            <span className="text-amber-700">
              {porFacturar.length === visita.productos.length
                ? "Pendiente"
                : `${porFacturar.length} sin facturar`}
            </span>
          ) : ordenes.length > 0 ? (
            <span className="flex flex-wrap gap-x-2">
              {ordenes.map((o) => (
                <Link
                  key={o.ordenId}
                  href={`/dashboard/ordenes/${o.ordenId}`}
                  className="text-primary hover:underline"
                >
                  Orden #{o.orden.numero}
                </Link>
              ))}
            </span>
          ) : (
            <span className="text-muted-foreground">Cubierta por el plan</span>
          )}
        </Dato>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Notas</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {visita.notas ? (
              <p className="whitespace-pre-wrap text-sm">{visita.notas}</p>
            ) : (
              <p className="text-sm text-muted-foreground">Sin notas</p>
            )}
            {visita.notasIncompleto && (
              <div className="rounded-md bg-destructive/5 p-3">
                <p className="mb-1 text-xs font-bold text-destructive">
                  {visita.estado === "CANCELADA"
                    ? "Razón de cancelación"
                    : "Razón de incompleto"}
                </p>
                <p className="whitespace-pre-wrap text-sm">
                  {visita.notasIncompleto}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Personal</CardTitle>
            <CardAction>
              <span className="text-xs text-muted-foreground">
                {visita.personal.length}
              </span>
            </CardAction>
          </CardHeader>
          <CardContent>
            {visita.personal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin asignar</p>
            ) : (
              <ul className="space-y-2">
                {visita.personal.map((vp) => {
                  const nombre =
                    `${vp.personal.nombre} ${vp.personal.apellido || ""}`.trim();
                  return (
                    <li key={vp.personal.id} className="flex items-center gap-2.5">
                      <InitialsAvatar name={nombre} size={28} />
                      <span className="min-w-0 truncate text-sm">{nombre}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {visita.media.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Archivos</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {visita.media.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setActiveMedia({ url: m.url, tipo: m.tipo })}
                  className="relative rounded-md overflow-hidden border aspect-square bg-muted hover:opacity-80 transition-opacity"
                >
                  {m.tipo === "imagen" ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={m.url}
                      alt="Foto de visita"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <>
                      <video
                        src={m.url}
                        muted
                        className="h-full w-full object-cover"
                      />
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/60">
                          <Play className="h-5 w-5 fill-white text-white" />
                        </span>
                      </span>
                    </>
                  )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {hasMessages ? (
        <Card>
          <CardContent className="flex items-center justify-between py-4">
            <div className="flex items-center gap-3">
              <MessageSquare className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm font-medium">Mensajes con el cliente</p>
                <p className="text-xs text-muted-foreground">
                  Hay una conversación abierta sobre esta visita.
                </p>
              </div>
            </div>
            <Link href={`/dashboard/mensajes/${visita.id}`}>
              <Button variant="outline" size="sm">
                Ver mensajes
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : null}

      <CompletarVisitaForm
        visitaId={visita.id}
        productos={visita.productos}
        open={completarOpen}
        onClose={() => setCompletarOpen(false)}
      />

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </>
  );
}

/** El día de la visita como una hoja de calendario. */
function TarjetaFecha({ iso }: { iso: string }) {
  const d = new Date(iso + "T00:00:00Z");
  const mes = d
    .toLocaleDateString("es-EC", { month: "short", timeZone: "UTC" })
    .replace(".", "");
  const dia = d.toLocaleDateString("es-EC", { weekday: "short", timeZone: "UTC" });

  return (
    <div className="flex w-20 flex-none flex-col items-center overflow-hidden rounded-xl border">
      <span className="w-full bg-primary py-1 text-center text-[11px] font-bold uppercase tracking-wide text-primary-foreground">
        {mes}
      </span>
      <span className="py-1 text-3xl font-bold leading-none">
        {d.getUTCDate()}
      </span>
      <span className="pb-1.5 text-[11px] capitalize text-muted-foreground">
        {dia}
      </span>
    </div>
  );
}

/** Casilla chica: etiqueta arriba, valor abajo. */
function Dato({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{etiqueta}</p>
      <p className="mt-0.5 truncate text-sm font-semibold">{children}</p>
    </div>
  );
}

const formatCorta = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** "3 h 30 min" a partir de las horas cargadas al cerrar la visita. */
function duracion(entrada: string | null, salida: string | null): string | null {
  if (!entrada || !salida) return null;
  const min = (h: string) => {
    const [a, b] = h.split(":").map(Number);
    return a * 60 + (b || 0);
  };
  const total = min(salida) - min(entrada);
  if (total <= 0) return null;
  const horas = Math.floor(total / 60);
  const resto = total % 60;
  return [horas ? `${horas} h` : null, resto ? `${resto} min` : null]
    .filter(Boolean)
    .join(" ");
}
