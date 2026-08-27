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
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import {
  ArrowLeft,
  CheckCircle,
  MessageSquare,
  Pencil,
  Plus,
} from "lucide-react";
import { EmptyState } from "@/components/shared/empty-state";
import {
  MediaViewer,
  type MediaViewerSource,
} from "@/components/ui/media-viewer";
import { ArchivosVisita } from "@/components/visitas/archivos-visita";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Badge } from "@/components/ui/badge";
import {
  estadoLabel as estadoOrdenLabel,
  estadoVariant as estadoOrdenVariant,
} from "@/components/ordenes/formato";
import {
  PERIODICIDAD_LABEL,
  estadoVariant as estadoSuscripcionVariant,
} from "@/components/suscripciones/formato";
import { nombreCliente } from "@vivero/shared";
import {
  listaProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";

interface VisitaDetailData {
  id: string;
  numero: number;
  fechaProgramada: string;
  fechaRealizada: string | null;
  /** Cuándo se la marcó como completada, en ISO. */
  completadaEl?: string | null;
  completadaPor?: { name: string | null; apellido: string | null } | null;
  /** Última modificación, sea del tipo que sea. */
  actualizadaEl?: string | null;
  actualizadaPor?: { name: string | null; apellido: string | null } | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  notasIncompleto: string | null;
  media: { id: string; url: string; tipo: string; productoId: string | null }[];
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
  /** Catálogo activo, para etiquetar una foto con algo que no se agendó. */
  catalogo?: { productoId: string; nombre: string }[];
  visita: VisitaDetailData;
  userRole?: string;
  hasMessages?: boolean;
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref?: string;
}

export function VisitaDetail({
  visita,
  userRole,
  backHref = "/dashboard/visitas",
  hasMessages = false,
  catalogo = [],
}: VisitaDetailProps) {
  const [activeMedia, setActiveMedia] = useState<MediaViewerSource | null>(
    null
  );

  const isProgramada = visita.estado === "PROGRAMADA";
  const canModify = userRole !== "PERSONAL";
  /**
   * Las órdenes de la visita son plata: solo la oficina. Un admin de sector
   * agenda y cierra la visita; lo que se cobra por ella no es asunto suyo.
   */
  const vePlata = userRole === "ADMIN" || userRole === "STAFF";

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
  /** Algo que no cubre ningún plan, así que en algún momento va a una orden. */
  const hayTrabajoSuelto = visita.productos.some((vs) => !vs.suscripcionItemId);
  const porFacturar = visita.productos.filter(
    (vs) => !vs.suscripcionItemId && !vs.ordenLinea
  );

  /**
   * Los planes que cubren algo de esta visita, uno por suscripción.
   *
   * Ninguno genera orden: lo que se cobra es el **período** del plan, en su
   * propia orden, que no sabe nada de esta visita. Por eso van en su propia
   * tarjeta y no como una fila de Órdenes.
   */
  const planes = [
    ...visita.productos
      .filter((vs) => vs.suscripcionItem)
      .reduce((mapa, vs) => {
        const si = vs.suscripcionItem!;
        const actual = mapa.get(si.suscripcionId);
        if (actual) actual.productos.push(vs.producto.nombre);
        else
          mapa.set(si.suscripcionId, {
            id: si.suscripcionId,
            numero: si.suscripcion.numero,
            cliente: nombreCliente(si.suscripcion.cliente),
            periodicidad: si.suscripcion.periodicidad,
            estado: si.suscripcion.estado,
            productos: [vs.producto.nombre],
          });
        return mapa;
      }, new Map<string, { id: string; numero: number; cliente: string; periodicidad: string; estado: string; productos: string[] }>())
      .values(),
  ];

  /**
   * Las órdenes donde cayó el trabajo de esta visita, una fila por orden.
   *
   * Dos productos de la misma visita pueden ir en la misma orden, así que se
   * agrupan: si no, la orden salía repetida.
   */
  const ordenes = [
    ...visita.productos
      .filter((vs) => vs.ordenLinea)
      .reduce((mapa, vs) => {
        const l = vs.ordenLinea!;
        const actual = mapa.get(l.ordenId);
        if (actual) actual.productos.push(vs.producto.nombre);
        else
          mapa.set(l.ordenId, {
            id: l.ordenId,
            numero: l.orden.numero,
            estado: l.orden.estado,
            productos: [vs.producto.nombre],
          });
        return mapa;
      }, new Map<string, { id: string; numero: number; estado: string; productos: string[] }>())
      .values(),
  ];

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 md:-mx-6 -mt-4 md:-mt-6 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b mb-6">
        <div className="flex items-center gap-3">
          {/* Vuelve de donde vino: llegar desde una suscripción y salir a la
              lista de visitas es perder el lugar donde uno estaba. */}
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                Visita #{visita.numero}
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
              {isProgramada && (
                <Link href={`/dashboard/visitas/${visita.id}/completar`}>
                  <Button>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Completar
                  </Button>
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
        {/* Qué se hizo, y cómo se cobra cada cosa. Es la pregunta que se
            responde producto por producto: uno puede estar en el plan y otro
            cobrarse aparte en la misma visita. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Productos y servicios</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="divide-y">
              {visita.productos.map((vs) => (
                // Qué se hizo, y nada más. Ni el plan que lo cubre ni la
                // orden donde se cobró: las dos cosas tienen su propia tarjeta
                // más abajo, y repetirlas acá era decirlo dos veces.
                <li key={vs.productoId} className="py-2.5">
                  <span className="block truncate text-sm font-medium">
                    {vs.producto.nombre}
                  </span>
                  {vs.producto.descripcion && (
                    <span className="block truncate text-xs text-muted-foreground">
                      {vs.producto.descripcion}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {planes.length > 0 && (
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                {planes.length === 1 ? "Suscripción" : "Suscripciones"}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1">
                {planes.map((p) => (
                  <li key={p.id}>
                    <Link
                      href={`/dashboard/suscripciones/${p.id}?from=/dashboard/visitas/${visita.id}`}
                      className="flex items-start justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-bold">
                          Suscripción #{p.numero}
                        </span>
                        <span className="block truncate text-xs font-semibold text-muted-foreground">
                          {p.cliente} ·{" "}
                          {PERIODICIDAD_LABEL[p.periodicidad] ?? p.periodicidad}
                        </span>
                        {/* Qué cubre de **esta** visita: el plan puede tener
                            más productos que los que se hicieron hoy. */}
                        <span className="block truncate text-xs text-muted-foreground">
                          Cubre: {p.productos.join(", ")}
                        </span>
                      </span>
                      <Badge
                        variant={estadoSuscripcionVariant[p.estado] ?? "outline"}
                        className="flex-none"
                      >
                        {p.estado.charAt(0) + p.estado.slice(1).toLowerCase()}
                      </Badge>
                    </Link>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {/* Solo si hay trabajo suelto. Con todo cubierto por un plan no va a
            haber ninguna orden nunca —se cobra el período, no la visita— y una
            tarjeta vacía sugiere que falta algo por hacer. */}
        {vePlata && hayTrabajoSuelto && (
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Órdenes</CardTitle>
            {canModify && facturable && porFacturar.length > 0 && (
              <CardAction>
                <Link
                  href={`/dashboard/ordenes/nueva?cliente=${visita.cliente.id}&visita=${visita.id}`}
                >
                  <Button size="sm" variant="ghost" title="Crear orden">
                    <Plus className="h-4 w-4" />
                  </Button>
                </Link>
              </CardAction>
            )}
          </CardHeader>
          <CardContent className="space-y-3">
            {ordenes.length === 0 ? (
              <EmptyState
                message={
                  !facturable
                    ? "La visita está cancelada"
                    : porFacturar.length > 0
                      ? "Sin órdenes"
                      : "No hace falta: el plan lo cubre"
                }
              />
            ) : (
              <div className="space-y-1">
                {ordenes.map((o) => (
                  <Link
                    key={o.id}
                    href={`/dashboard/ordenes/${o.id}?from=/dashboard/visitas/${visita.id}`}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold">Orden #{o.numero}</p>
                      <p className="text-xs font-semibold text-muted-foreground">
                        {o.productos.join(", ")}
                      </p>
                    </div>
                    <Badge
                      variant={estadoOrdenVariant[o.estado] ?? "outline"}
                      className="flex-none"
                    >
                      {estadoOrdenLabel[o.estado] ?? o.estado}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}

          </CardContent>
        </Card>
        )}

        {/* Editable acá y no en el formulario de edición: las fotos se sacan
            mientras se hace el trabajo, y quien las sube no tiene por qué
            pasar por otra pantalla ni esperar a completar la visita. */}
        <ArchivosVisita
          visitaId={visita.id}
          archivos={visita.media}
          productos={visita.productos.map((vp) => ({
            productoId: vp.productoId,
            nombre: vp.producto.nombre,
          }))}
          catalogo={catalogo}
          puedeEditar={canModify}
        />

        <Card>
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
        </div>

        <div className="space-y-6">
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Cliente</CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              href={`/dashboard/clientes/${visita.cliente.id}`}
              className="block truncate font-bold hover:underline"
            >
              {nombreCliente(visita.cliente)}
            </Link>
            <p className="text-xs text-muted-foreground">
              {[visita.cliente.sector?.nombre, visita.cliente.ciudad]
                .filter(Boolean)
                .join(" · ") || "Sin sector"}
            </p>
          </CardContent>
        </Card>

        {/* Las dos fechas juntas: para cuándo se agendó y cuándo se hizo. Verlas
            una al lado de la otra es la forma de notar que se corrió. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Detalles</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="space-y-1.5 text-sm">
              <Fila etiqueta="Programada">
                <span className="capitalize">
                  {formatCorta(visita.fechaProgramada)}
                </span>
              </Fila>
              <Fila etiqueta="Realizada">
                {visita.fechaRealizada ? (
                  <span className="capitalize">
                    {formatCorta(visita.fechaRealizada)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Todavía no</span>
                )}
              </Fila>
              <Fila etiqueta="Horario">
                {visita.horaEntrada || visita.horaSalida ? (
                  `${visita.horaEntrada ?? "—"} a ${visita.horaSalida ?? "—"}`
                ) : (
                  <span className="text-muted-foreground">Sin registrar</span>
                )}
              </Fila>
              <Fila etiqueta="Duración">
                {duracion(visita.horaEntrada, visita.horaSalida) ?? (
                  <span className="text-muted-foreground">—</span>
                )}
              </Fila>
              {/* "Realizada" es el día del trabajo; esto es cuándo y quién la
                  cerró en el sistema, que no tiene por qué ser el mismo día ni
                  la misma persona. */}
              {visita.completadaEl && (
                <Fila etiqueta="Completada">
                  <span className="block">{momento(visita.completadaEl)}</span>
                  {nombreDe(visita.completadaPor) && (
                    <span className="block text-xs text-muted-foreground">
                      por {nombreDe(visita.completadaPor)}
                    </span>
                  )}
                </Fila>
              )}
              {visita.actualizadaEl && (
                <Fila etiqueta="Última edición">
                  <span className="block">{momento(visita.actualizadaEl)}</span>
                  {nombreDe(visita.actualizadaPor) && (
                    <span className="block text-xs text-muted-foreground">
                      por {nombreDe(visita.actualizadaPor)}
                    </span>
                  )}
                </Fila>
              )}
            </dl>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Personal</CardTitle>
            {/* El grupo nombra a este conjunto de gente: va con ellos y no con
                las fechas, que es donde estaba. */}
            {visita.grupo && (
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {visita.grupo.nombre}
                </span>
              </CardAction>
            )}
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
      </div>

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

      <MediaViewer
        media={activeMedia}
        onClose={() => setActiveMedia(null)}
      />
    </>
  );
}


/** Casilla chica: etiqueta arriba, valor abajo. */
/** Etiqueta a la izquierda, valor a la derecha. */
function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right">{children}</dd>
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
/** "27 ago 2026, 2:11 p. m." — el instante en que alguien apretó el botón. */
function momento(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** El nombre de quien hizo algo, o null si el usuario ya no existe. */
function nombreDe(
  u: { name: string | null; apellido: string | null } | null | undefined
): string | null {
  if (!u) return null;
  return [u.name, u.apellido].filter(Boolean).join(" ") || null;
}

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
