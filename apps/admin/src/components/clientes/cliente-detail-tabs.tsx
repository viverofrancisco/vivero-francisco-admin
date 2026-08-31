"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardAction,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ClienteForm } from "@/components/clientes/cliente-form";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DatosFacturacionCard,
  type DatoFacturacion,
} from "@/components/clientes/datos-facturacion-card";
import { Badge } from "@/components/ui/badge";
import {
  estadoLabel as estadoOrdenLabel,
  estadoVariant as estadoOrdenVariant,
} from "@/components/ordenes/formato";

/** Lo mínimo de una orden para listarla en la ficha. */
export interface OrdenResumen {
  id: string;
  numero: number;
  fecha: string;
  estado: string;
  total: number;
  lineas: number;
  facturas: number;
}
import {
  PERIODICIDAD_LABEL,
  PERIODICIDAD_SUFIJO,
} from "@/components/suscripciones/formato";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { nombreCliente, nombrePersona } from "@vivero/shared";
import {
  resumenProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";
import {
  Plus,
  ArrowLeft,
  ArrowRight,
  Pencil,
  Eye,
} from "lucide-react";

interface ProductoCatalogo {
  id: string;
  nombre: string;
  tipo: string;
}

/** Un ítem de suscripción, tal como lo ve la ficha del cliente. */
interface Asignacion {
  id: string;
  suscripcionId: string;
  productoId: string;
  precio?: number;
  ivaTasa?: number;
  visitasPorPeriodo: number | null;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  producto: ProductoCatalogo;
}

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: { id: string; nombre: string; apellido?: string | null };
  productos: ProductoDeVisita[];
  grupo: { id: string; nombre: string } | null;
}

interface ClienteData {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  sectorId: string | null;
  sector: { id: string; nombre: string } | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  metrosCuadrados: number | null;
  recibirRecordatorios: boolean;
  recibirConfirmaciones: boolean;
  createdAt: string;
}

interface ClienteDetailTabsProps {
  cliente: ClienteData;
  asignaciones: Asignacion[];
  datosFacturacion: DatoFacturacion[];
  ordenes: OrdenResumen[];
  /**
   * Si se muestran órdenes, precios y datos de facturación. Un admin de sector
   * ve la ficha para trabajar el jardín, no para cobrarlo.
   */
  verPlata?: boolean;
  visitas: VisitaRow[];
  /** A dónde vuelve el botón "atrás" (depende de dónde se llegó). */
  backHref?: string;
}

const formatPrice = (price: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(price);

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Service-status pill (botanical): activo green, pausado amber, cancelado red. */
const servicioEstado = (estado: string) => {
  switch (estado) {
    case "ACTIVO":
      return { label: "Activo", className: "bg-secondary text-green-700" };
    case "PAUSADO":
      return { label: "Pausado", className: "bg-warning/15 text-warning-foreground" };
    case "CANCELADO":
      return { label: "Cancelado", className: "bg-destructive/10 text-destructive" };
    default:
      return { label: estado, className: "bg-muted text-muted-foreground" };
  }
};

export function ClienteDetailTabs({
  cliente,
  asignaciones,
  datosFacturacion,
  ordenes,
  verPlata = true,
  visitas,
  backHref = "/dashboard/clientes",
}: ClienteDetailTabsProps) {
  const router = useRouter();
  // Las pantallas de suscripción vuelven acá, no siempre a su propia lista.
  const volverAca = encodeURIComponent(usePathname());
  const [cardsEditing, setCardsEditing] = useState(false);
  const [recibirRecordatorios, setRecibirRecordatorios] = useState(
    cliente.recibirRecordatorios
  );
  const [recibirConfirmaciones, setRecibirConfirmaciones] = useState(
    cliente.recibirConfirmaciones
  );
  const [invitando, setInvitando] = useState(false);

  const handleEnviarInvitacion = async () => {
    setInvitando(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}/invitar`, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data.error);
      toast.success(data.message ?? "Invitación enviada al cliente");
    } catch (e) {
      toast.error(
        e instanceof Error && e.message
          ? e.message
          : "Error al enviar la invitación"
      );
    } finally {
      setInvitando(false);
    }
  };

  const handleNotifToggle = async (
    field: "recibirRecordatorios" | "recibirConfirmaciones",
    value: boolean
  ) => {
    if (field === "recibirRecordatorios") setRecibirRecordatorios(value);
    else setRecibirConfirmaciones(value);

    try {
      const res = await fetch(`/api/clientes/${cliente.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: cliente.nombre,
          [field]: value,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success("Preferencia actualizada");
    } catch {
      // Revert on error
      if (field === "recibirRecordatorios") setRecibirRecordatorios(!value);
      else setRecibirConfirmaciones(!value);
      toast.error("Error al actualizar preferencia");
    }
  };

  const nombreCompleto = nombreCliente(cliente);
  // Si el cliente es persona Y empresa, mostramos la empresa como complemento.
  const empresaExtra =
    nombrePersona(cliente) && cliente.empresa ? cliente.empresa : null;
  // Aplanar los ítems hacía parecer que cada producto era una suscripción
  // aparte. Se agrupan: una suscripción es UN contrato con N productos que se
  // cobran juntos, en una sola factura.
  const suscripciones = [
    ...asignaciones
      .reduce((mapa, a) => {
        const grupo = mapa.get(a.suscripcionId) ?? {
          id: a.suscripcionId,
          estado: a.estado,
          periodicidad: a.periodicidad,
          items: [] as typeof asignaciones,
          total: 0,
        };
        grupo.items.push(a);
        grupo.total += a.precio ?? 0;
        mapa.set(a.suscripcionId, grupo);
        return mapa;
      }, new Map<string, {
        id: string;
        estado: string;
        periodicidad: string;
        items: typeof asignaciones;
        total: number;
      }>())
      .values(),
  ];
  const topVisitas = visitas.slice(0, 3);

  return (
    <div>
      {/* Sticky header */}
      <div className="sticky top-0 z-20 px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(backHref)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <InitialsAvatar name={nombreCompleto} size={44} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5">
              <h1 className="text-xl font-extrabold tracking-tight truncate">
                {nombreCompleto}
              </h1>
              {cliente.sector && (
                <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-bold text-green-700">
                  {cliente.sector.nombre}
                </span>
              )}
            </div>
            <p className="text-sm font-medium text-muted-foreground">
              {empresaExtra ? `${empresaExtra} · ` : ""}Cliente desde{" "}
              {formatDate(cliente.createdAt)}
            </p>
          </div>
          {cardsEditing ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCardsEditing(false)}
              >
                Cancelar
              </Button>
              <Button
                size="sm"
                type="submit"
                form="cliente-cards-form"
              >
                Guardar cambios
              </Button>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCardsEditing(true)}
            >
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Content below header */}
      <div className="px-4 md:px-6 pt-6 pb-6">
      <ClienteForm
        initialData={{
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          empresa: cliente.empresa,
          email: cliente.email,
          telefono: cliente.telefono,
          ciudad: cliente.ciudad,
          direccion: cliente.direccion,
          numeroCasa: cliente.numeroCasa,
          referencia: cliente.referencia,
          notas: cliente.notas,
          metrosCuadrados: cliente.metrosCuadrados,
        }}
        cards
        cardsEditing={cardsEditing}
        onEditDone={() => setCardsEditing(false)}
        actividadContent={<>            {/* Órdenes primero: es lo que se factura, y lo que más se
                consulta al entrar a un cliente. */}
            {verPlata && (
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Órdenes</CardTitle>
                <CardAction>
                  <Link href={`/dashboard/ordenes/nueva?cliente=${cliente.id}`}>
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Nueva orden
                    </Button>
                  </Link>
                </CardAction>
              </CardHeader>
              <CardContent>
                {ordenes.length === 0 ? (
                  <EmptyState message="Sin órdenes" />
                ) : (
                  <div className="space-y-1">
                    {ordenes.slice(0, 3).map((o) => (
                      <Link
                        key={o.id}
                        href={`/dashboard/ordenes/${o.id}?from=/dashboard/clientes/${cliente.id}`}
                        className="flex items-center justify-between gap-3 rounded-md px-2 py-2 transition-colors hover:bg-muted/50"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-bold">
                            Orden #{o.numero}
                            <span className="ml-2 text-xs font-semibold text-muted-foreground">
                              {formatDate(o.fecha)}
                            </span>
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {o.lineas} {o.lineas === 1 ? "producto" : "productos"}
                            {o.facturas > 0 &&
                              ` · ${o.facturas} ${o.facturas === 1 ? "factura" : "facturas"}`}
                          </p>
                        </div>
                        <div className="flex flex-none items-center gap-2">
                          <span className="text-sm font-semibold tabular-nums">
                            {formatPrice(o.total)}
                          </span>
                          <Badge variant={estadoOrdenVariant[o.estado] ?? "outline"}>
                            {estadoOrdenLabel[o.estado] ?? o.estado}
                          </Badge>
                        </div>
                      </Link>
                    ))}
                    {ordenes.length > 3 && (
                      <Link
                        href={`/dashboard/ordenes?cliente=${cliente.id}`}
                        className="flex items-center justify-center gap-1 pt-1 text-sm text-primary hover:underline"
                      >
                        Ver todas ({ordenes.length})
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
            )}

            {/* Services Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Suscripciones</CardTitle>
                <CardAction>
                  {/* A la pantalla completa con el cliente ya elegido: armar una
                      suscripción con varios productos no entra cómodo en un
                      diálogo. */}
                  <Link
                    href={`/dashboard/suscripciones/nueva?cliente=${cliente.id}&from=${volverAca}`}
                  >
                    <Button size="sm" variant="outline">
                      <Plus className="mr-2 h-3.5 w-3.5" />
                      Nueva suscripción
                    </Button>
                  </Link>
                </CardAction>
              </CardHeader>
              {/* Sin tarjeta adentro de otra: cada suscripción es un bloque
                  separado por una línea. */}
              <CardContent>
                {asignaciones.length === 0 ? (
                  <EmptyState message="Sin servicios" />
                ) : (
                  <div className="divide-y">
                    {suscripciones.slice(0, 3).map((sus) => (
                      <div key={sus.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 text-xs font-bold">
                            {PERIODICIDAD_LABEL[sus.periodicidad] ??
                              sus.periodicidad}
                            <span className="ml-1.5 font-semibold text-muted-foreground">
                              · {formatPrice(sus.total)} por período
                            </span>
                          </p>
                          <div className="flex flex-none items-center gap-1.5">
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${servicioEstado(sus.estado).className}`}
                            >
                              {servicioEstado(sus.estado).label}
                            </span>
                            <Link
                              href={`/dashboard/suscripciones/${sus.id}?from=${volverAca}`}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                title="Editar suscripción"
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                        <div className="mt-1.5 space-y-1">
                          {sus.items.map((a) => (
                            <div
                              key={a.id}
                              className="flex items-center justify-between gap-2"
                            >
                              <p className="min-w-0 flex-1 truncate text-sm">
                                {a.producto.nombre}
                              </p>
                              <p className="flex-none text-xs font-semibold text-muted-foreground tabular-nums">
                                {verPlata ? formatPrice(a.precio ?? 0) : ""}
                                {a.visitasPorPeriodo
                                  ? ` · ${a.visitasPorPeriodo}${PERIODICIDAD_SUFIJO[sus.periodicidad] ?? ""}`
                                  : ""}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                {suscripciones.length > 3 && (
                  <Link
                    href={`/dashboard/suscripciones?cliente=${cliente.id}`}
                    className="flex items-center justify-center gap-1 pt-3 text-sm text-primary hover:underline"
                  >
                    Ver todas ({suscripciones.length})
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                )}
              </CardContent>
            </Card>

            {/* Al final: es lo que menos se toca, pero vive con la actividad
                porque su razón de ser es facturar. */}
            {/* Visits Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Visitas</CardTitle>
              </CardHeader>
              <CardContent>
                {visitas.length === 0 ? (
                  <EmptyState message="Sin visitas" />
                ) : (
                  <div className="space-y-3">
                    {topVisitas.map((v) => (
                      <div
                        key={v.id}
                        className="flex items-center justify-between py-2 border-b border-border last:border-0"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold truncate">
                            {resumenProductos(v)}
                          </p>
                          <p className="text-xs font-semibold text-muted-foreground">
                            {formatDate(v.fechaProgramada)}
                            {v.grupo ? ` · ${v.grupo.nombre}` : ""}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          <StatusBadge
                            estado={v.estado as EstadoVisitaUI}
                            size="sm"
                          />
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7"
                            onClick={() =>
                              router.push(
                                `/dashboard/visitas/${v.id}?from=/dashboard/clientes/${cliente.id}`
                              )
                            }
                          >
                            <Eye className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                    {visitas.length > 3 && (
                      <Link
                        href={`/dashboard/clientes/${cliente.id}/visitas`}
                        className="flex items-center justify-center gap-1 text-sm text-primary hover:underline pt-1"
                      >
                        Ver todas ({visitas.length})
                        <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {verPlata && (
              <DatosFacturacionCard
                clienteId={cliente.id}
                datos={datosFacturacion}
              />
            )}
</>}
        rightColumnContent={
          <>



            {/* Notifications Card */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Notificaciones WhatsApp</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="recibir-recordatorios" className="cursor-pointer">
                    Recibir recordatorios de visita
                  </Label>
                  <Switch
                    id="recibir-recordatorios"
                    checked={recibirRecordatorios}
                    onCheckedChange={(val) =>
                      handleNotifToggle("recibirRecordatorios", val)
                    }
                    size="sm"
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="recibir-confirmaciones" className="cursor-pointer">
                    Recibir confirmaciones de visita
                  </Label>
                  <Switch
                    id="recibir-confirmaciones"
                    checked={recibirConfirmaciones}
                    onCheckedChange={(val) =>
                      handleNotifToggle("recibirConfirmaciones", val)
                    }
                    size="sm"
                  />
                </div>
                {!cliente.telefono && (
                  <p className="text-xs text-muted-foreground">
                    Este cliente no tiene teléfono registrado. Las notificaciones
                    no se enviarán hasta que se agregue uno.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Account / set-password invite */}
            <Card>
              <CardHeader className="border-b">
                <CardTitle>Acceso a la app</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Envía un enlace al correo del cliente para que cree su
                  contraseña y acceda a la app.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleEnviarInvitacion}
                  disabled={invitando || !cliente.email}
                >
                  {invitando ? "Enviando…" : "Enviar invitación"}
                </Button>
                {!cliente.email && (
                  <p className="text-xs text-muted-foreground">
                    Agrega un correo al cliente para poder enviar la invitación.
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        }
      />

      </div>
    </div>
  );
}
