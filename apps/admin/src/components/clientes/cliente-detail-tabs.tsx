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
import {
  PropiedadesCard,
  type PropiedadData,
} from "@/components/clientes/propiedades-card";
import { EmptyState } from "@/components/shared/empty-state";
import {
  DatosFacturacionCard,
  type DatoFacturacion,
} from "@/components/clientes/datos-facturacion-card";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { resumenTareas, type VisitaConTareas } from "@/lib/visita-tareas";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Loader2,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
} from "lucide-react";
import {
  BOTON_REDONDO_MOVIL,
  ICONO_BOTON_REDONDO,
  VolverRedondo,
} from "@/components/shared/boton-redondo-movil";

/** Un plan, tal como lo ve la ficha del cliente: jardín, precio y visitas. */
interface SuscripcionResumen {
  id: string;
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  visitasPorPeriodo: number;
  propiedad: { id: string; nombre: string };
  /** Sin IVA. Ausentes para quien no ve plata. */
  precio?: number;
  ivaTasa?: number;
}

interface VisitaRow {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: { id: string; nombre: string; apellido?: string | null };
  tareas: VisitaConTareas;
  grupo: { id: string; nombre: string } | null;
}

interface ClienteData {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  notas: string | null;
  recibirRecordatorios: boolean;
  recibirConfirmaciones: boolean;
  createdAt: string;
  /** Marcado como inactivo desde cuándo; `null` = activo. */
  inactivoDesde: string | null;
}

/**
 * Activo o inactivo, siempre al lado del nombre: mostrar solo el inactivo
 * dejaba al activo sin decir nada, y una insignia que a veces está y a veces
 * no se lee como un dato que falta.
 */
export function EstadoDelCliente({ inactivo }: { inactivo: boolean }) {
  return inactivo ? (
    <Badge variant="secondary" className="flex-none">
      Inactivo
    </Badge>
  ) : (
    <Badge variant="secondary" className="flex-none border-transparent bg-success/12 text-green-700">
      Activo
    </Badge>
  );
}

interface ClienteDetailTabsProps {
  cliente: ClienteData;
  /** Dónde se trabaja. La dirección y el sector viven acá. */
  propiedades: PropiedadData[];
  suscripciones: SuscripcionResumen[];
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
  propiedades,
  suscripciones,
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
  const [cambiandoActividad, setCambiandoActividad] = useState(false);
  /**
   * Inactivo: no se le agendan visitas y sale atenuado en los selectores,
   * con todo su historial en su lugar. Reactivar es lo mismo al revés.
   */
  async function cambiarActividad(inactivo: boolean) {
    setCambiandoActividad(true);
    try {
      const res = await fetch(`/api/clientes/${cliente.id}/inactivo`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inactivo }),
      });
      if (!res.ok) {
        const cuerpo = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(cuerpo?.error ?? "No se pudo guardar");
      }
      toast.success(inactivo ? "Cliente marcado como inactivo" : "Cliente reactivado");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setCambiandoActividad(false);
    }
  }
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
  const topVisitas = visitas.slice(0, 3);
  // El sector es de cada propiedad: con dos casas en dos sectores se nombran
  // los dos, porque uno solo sería mentira la mitad del tiempo.
  const sectores = Array.from(
    new Set(propiedades.map((p) => p.sector?.nombre).filter(Boolean))
  ).join(", ");

  return (
    <div>
      {/* ══ Teléfono: el encabezado de la ficha en la app ════════════════
          La flecha al lado del nombre, fija arriba, y el ⋯ a la derecha con
          Editar y lo que se hace una vez por cliente. Editando, pasa a ser la
          barra del formulario: Cancelar, el nombre, Guardar. El avatar, la
          pastilla y el "cliente desde" bajan al cuerpo: a 375 px el nombre
          es lo que tiene que caber. Es el encabezado de la orden. */}
      <div className="sticky top-0 z-20 flex items-center gap-1.5 bg-card px-4 pt-1.5 pb-2 md:hidden">
        {cardsEditing ? (
          <>
            <button
              type="button"
              onClick={() => setCardsEditing(false)}
              className="min-w-[76px] rounded-lg px-1.5 py-1.5 text-left text-base font-semibold text-muted-foreground active:bg-muted"
            >
              Cancelar
            </button>
            <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
              {nombreCompleto}
            </h1>
            <button
              type="submit"
              form="cliente-cards-form"
              className="flex min-w-[76px] items-center justify-end rounded-lg px-1.5 py-1.5 text-base font-bold text-primary active:bg-muted disabled:text-muted-foreground"
            >
              Guardar
            </button>
          </>
        ) : (
          <>
            <VolverRedondo href={backHref} />
            <h1 className="min-w-0 flex-1 text-[22px] font-extrabold tracking-[-0.4px]">
              {nombreCompleto}
            </h1>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    aria-label="Acciones"
                    disabled={cambiandoActividad}
                    className={BOTON_REDONDO_MOVIL}
                  >
                    {cambiandoActividad ? (
                      <Loader2 className={`${ICONO_BOTON_REDONDO} animate-spin`} />
                    ) : (
                      <MoreHorizontal className={ICONO_BOTON_REDONDO} />
                    )}
                  </button>
                }
              />
              <DropdownMenuContent align="end" className="min-w-52">
                <DropdownMenuItem onClick={() => setCardsEditing(true)}>
                  Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => cambiarActividad(!cliente.inactivoDesde)}>
                  {cliente.inactivoDesde ? "Reactivar cliente" : "Marcar como inactivo"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        )}
      </div>

      {/* Escritorio: el encabezado de siempre. */}
      <div className="sticky top-0 z-20 hidden px-4 md:px-6 py-3 bg-card/95 backdrop-blur-sm border-b md:block">
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
              <EstadoDelCliente inactivo={cliente.inactivoDesde !== null} />
              {/* El sector es de cada propiedad: con dos casas en dos sectores,
                  uno solo al lado del nombre sería mentira la mitad del
                  tiempo. Se lee en la tarjeta de Propiedades. */}
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
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCardsEditing(true)}
              >
                <Pencil className="mr-1.5 h-3.5 w-3.5" />
                Editar
              </Button>
              {/* Lo que se hace una vez por cliente va detrás del ⋯, como en
                  la ficha del personal. */}
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="outline" size="icon-sm" aria-label="Acciones" disabled={cambiandoActividad} />
                  }
                >
                  <MoreVertical className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-48">
                  <DropdownMenuItem onClick={() => cambiarActividad(!cliente.inactivoDesde)}>
                    {cliente.inactivoDesde ? "Reactivar cliente" : "Marcar como inactivo"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </div>

      {/* Content below header */}
      <div className="px-4 md:px-6 pt-3 md:pt-6 pb-6">
      <ClienteForm
        /* Teléfono: lo que el encabezado de escritorio pone al lado del
           nombre —el estado, el sector, desde cuándo— va como filas de
           Información General, junto al teléfono, como en la app. */
        filasSoloMovil={[
          {
            label: "Estado",
            value: <EstadoDelCliente inactivo={cliente.inactivoDesde !== null} />,
          },
          { label: "Sector", value: sectores },
          { label: "Cliente desde", value: formatDate(cliente.createdAt) },
        ]}
        initialData={{
          id: cliente.id,
          nombre: cliente.nombre,
          apellido: cliente.apellido,
          empresa: cliente.empresa,
          email: cliente.email,
          telefono: cliente.telefono,
          notas: cliente.notas,
        }}
        cards
        cardsEditing={cardsEditing}
        onEditDone={() => setCardsEditing(false)}
        actividadContent={<>
            {/* Dónde se trabaja, primero: es lo que se busca al abrir un
                cliente, y desde que la dirección es de cada propiedad no hay
                ninguna otra tarjeta que la diga. Estaba en la columna angosta,
                con los datos de referencia, y ahí quedaba debajo de las notas
                y fuera de la vista. */}
            <PropiedadesCard
              clienteId={cliente.id}
              propiedades={propiedades}
              puedeEditar={verPlata}
            />

            {/* Órdenes después: es lo que se factura, y lo que más se
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
                  {/* A la pantalla completa con el cliente ya elegido. */}
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
                {suscripciones.length === 0 ? (
                  <EmptyState message="Sin suscripciones" />
                ) : (
                  <div className="divide-y">
                    {suscripciones.slice(0, 3).map((sus) => (
                      <div key={sus.id} className="py-3 first:pt-0 last:pb-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className="min-w-0 truncate text-xs font-bold">
                            #{sus.numero} ·{" "}
                            {PERIODICIDAD_LABEL[sus.periodicidad] ??
                              sus.periodicidad}
                            {verPlata && sus.precio !== undefined && (
                              <span className="ml-1.5 font-semibold text-muted-foreground">
                                ·{" "}
                                {formatPrice(
                                  sus.precio * (1 + (sus.ivaTasa ?? 0) / 100)
                                )}
                                {PERIODICIDAD_SUFIJO[sus.periodicidad] ?? ""}
                              </span>
                            )}
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
                        {/* De qué jardín es y qué incluye: lo que hace falta
                            para agendar contra él. */}
                        <div className="mt-1.5 flex items-center justify-between gap-2">
                          <p className="min-w-0 flex-1 truncate text-sm">
                            {sus.propiedad.nombre}
                          </p>
                          <p className="flex-none text-xs font-semibold text-muted-foreground tabular-nums">
                            {sus.visitasPorPeriodo} visita
                            {sus.visitasPorPeriodo === 1 ? "" : "s"}
                            {PERIODICIDAD_SUFIJO[sus.periodicidad] ?? ""}
                          </p>
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
                            {resumenTareas(v.tareas)}
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
