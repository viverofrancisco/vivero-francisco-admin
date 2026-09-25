"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { ResumenSuscripcion } from "./resumen-suscripcion";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { ArrowLeft, Loader2, Navigation, Plus, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  direccionDePropiedad,
  enlaceParaLlegar,
  nombreCliente,
  zonaDePropiedad,
} from "@vivero/shared";
import {
  PERIODICIDAD_LABEL,
  PERIODICIDAD_SUFIJO,
  estadoVariant,
  fecha,
  money,
} from "./formato";

/** Una propiedad del cliente, con lo que hace falta para decir dónde queda. */
interface PropiedadOpcion {
  id: string;
  nombre: string;
  ciudad: string | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  lat: number | null;
  lng: number | null;
  sector: { id: string; nombre: string } | null;
}

interface SuscripcionData {
  id: string;
  /** Para nombrarla: "Suscripción #12". Secuencia propia, no la de órdenes. */
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  notas: string | null;
  /** Sin IVA, por período. Cero para quien no ve precios. */
  precio: number;
  ivaTasa: number;
  visitasPorPeriodo: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  /** De qué jardín es el plan. */
  propiedad: PropiedadOpcion;
  /** Entre cuáles se puede mover: las propiedades vivas del cliente. */
  propiedades: PropiedadOpcion[];
}

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
const ESTADOS = ["ACTIVO", "PAUSADO", "CANCELADO"];

/**
 * Dónde queda el jardín del plan: dirección, zona, referencia y cómo llegar.
 *
 * Es el mismo renglón que encabeza la ficha de la visita, sin el mapa: acá se
 * decide de qué jardín es el plan, no se maneja hasta él. La referencia entra
 * porque es lo que distingue dos casas de la misma urbanización.
 */
function UbicacionDelPlan({
  propiedad,
  clienteId,
}: {
  propiedad: PropiedadOpcion;
  clienteId: string;
}) {
  const direccion = direccionDePropiedad(propiedad);
  const zona = zonaDePropiedad(propiedad);
  const tienePunto = propiedad.lat !== null && propiedad.lng !== null;
  return (
    <div className="flex items-start gap-3 rounded-md border bg-muted/30 px-3 py-2.5">
      <div className="min-w-0 flex-1 text-sm">
        <p className="truncate font-medium">
          {direccion || propiedad.nombre}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {zona || (tienePunto ? propiedad.nombre : "Sin ubicación en el mapa")}
        </p>
        {propiedad.referencia && (
          <p className="mt-1 text-xs text-muted-foreground">
            {propiedad.referencia}
          </p>
        )}
        <Link
          href={`/dashboard/clientes/${clienteId}/propiedades/${propiedad.id}`}
          className="mt-1 inline-block text-xs text-primary hover:underline"
        >
          Ver propiedad
        </Link>
      </div>
      {tienePunto && (
        <Button
          variant="outline"
          size="sm"
          className="flex-none"
          render={
            <a
              href={enlaceParaLlegar(propiedad.lat!, propiedad.lng!)}
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <Navigation className="mr-1.5 h-3.5 w-3.5" />
          Llegar
        </Button>
      )}
    </div>
  );
}

export function SuscripcionDetail({
  suscripcion,
  backHref,
  ordenes,
  visitas,
  soloLectura = false,
}: {
  suscripcion: SuscripcionData;
  /** Las que salieron de los períodos de esta suscripción. */
  ordenes: {
    id: string;
    numero: number;
    fecha: string;
    estado: string;
    /** El total de la orden, que puede incluir cosas de otro origen. */
    total: number;
    delPlan: number;
    periodoInicio: string | null;
    periodoFin: string | null;
    periodos: number;
    factura: { numero: string; estado: string; saldo: number | null } | null;
  }[];
  /** Las visitas de este plan. */
  visitas: {
    id: string;
    numero: number;
    fechaProgramada: string;
    fechaRealizada: string | null;
    estado: string;
    tareas: string[];
  }[];
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref: string;
  /**
   * Quien no ve plata entra a ver de qué se trata el plan —de qué propiedad
   * es y cuántas visitas incluye— para agendar. No ve precios ni órdenes, y
   * no puede cambiar nada.
   */
  soloLectura?: boolean;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [generando, setGenerando] = useState(false);

  /**
   * Crea a mano los borradores de los períodos vencidos de este plan.
   *
   * Lo mismo que hace el cron cada noche, acotado a esta suscripción. Es la
   * salida cuando el cron falló o no se quiere esperar hasta mañana.
   */
  const generarOrdenes = async () => {
    setGenerando(true);
    try {
      const res = await fetch(`/api/suscripciones/${suscripcion.id}/renovar`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(
        body.creadas === 0
          ? "No había períodos por generar"
          : `${body.creadas} ${body.creadas === 1 ? "orden creada" : "órdenes creadas"} en borrador`
      );
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos generar");
    } finally {
      setGenerando(false);
    }
  };

  const [propiedadId, setPropiedadId] = useState(suscripcion.propiedad.id);
  const [periodicidad, setPeriodicidad] = useState(suscripcion.periodicidad);
  const [estado, setEstado] = useState(suscripcion.estado);
  const [fechaInicio, setFechaInicio] = useState(
    suscripcion.fechaInicio.slice(0, 10)
  );
  const [notas, setNotas] = useState(suscripcion.notas ?? "");
  const [precio, setPrecio] = useState(String(suscripcion.precio));
  const [ivaTasa, setIvaTasa] = useState(String(suscripcion.ivaTasa));
  const [visitasPorPeriodo, setVisitasPorPeriodo] = useState(
    String(suscripcion.visitasPorPeriodo)
  );

  const guardar = async () => {
    if (precio.trim() === "" || Number(precio) < 0) {
      return toast.error("Pon el precio del período");
    }
    if (!(Number(visitasPorPeriodo) >= 1)) {
      return toast.error("Indica cuántas visitas incluye cada período");
    }

    setGuardando(true);
    try {
      const res = await fetch(`/api/suscripciones/${suscripcion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propiedadId,
          periodicidad,
          estado,
          fechaInicio,
          precio: Number(precio),
          ivaTasa: ivaTasa.trim() ? Number(ivaTasa) : null,
          visitasPorPeriodo: Number(visitasPorPeriodo),
          notas: notas.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Suscripción actualizada");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Si hay algo distinto de lo guardado. Los números se comparan como números:
   * "130.0" tipeado y el 130 que vuelve del servidor son el mismo precio, y
   * como texto seguirían pareciendo un cambio después de guardar.
   */
  const hayCambios =
    !soloLectura &&
    (propiedadId !== suscripcion.propiedad.id ||
      periodicidad !== suscripcion.periodicidad ||
      estado !== suscripcion.estado ||
      fechaInicio !== suscripcion.fechaInicio.slice(0, 10) ||
      notas.trim() !== (suscripcion.notas ?? "").trim() ||
      Number(precio) !== suscripcion.precio ||
      (ivaTasa.trim() ? Number(ivaTasa) : 0) !== suscripcion.ivaTasa ||
      Number(visitasPorPeriodo) !== suscripcion.visitasPorPeriodo);

  /** Vuelve a lo guardado. */
  const descartar = () => {
    setPropiedadId(suscripcion.propiedad.id);
    setPeriodicidad(suscripcion.periodicidad);
    setEstado(suscripcion.estado);
    setFechaInicio(suscripcion.fechaInicio.slice(0, 10));
    setNotas(suscripcion.notas ?? "");
    setPrecio(String(suscripcion.precio));
    setIvaTasa(String(suscripcion.ivaTasa));
    setVisitasPorPeriodo(String(suscripcion.visitasPorPeriodo));
  };

  /** Qué falta para poder guardar, para que el botón gris diga por qué. */
  const falta =
    precio.trim() === "" || Number(precio) < 0
      ? "Pon el precio del período"
      : !(Number(visitasPorPeriodo) >= 1)
        ? "Indica cuántas visitas incluye cada período"
        : null;

  // Guardar y Descartar viven en el header, en lugar del buscador —la barra
  // de Shopify—, y no en un botón al pie de la tarjeta de términos: con dos
  // tarjetas editables, el botón quedaba lejos de la mitad de lo que cambia.
  useRegistrarCambios(hayCambios, guardando, guardar, descartar, falta);

  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";
  const propiedad =
    suscripcion.propiedades.find((p) => p.id === propiedadId) ??
    suscripcion.propiedad;
  const visitasTexto = `${visitasPorPeriodo || "—"} visita${
    Number(visitasPorPeriodo) === 1 ? "" : "s"
  }${sufijo}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">
              {nombreCliente(suscripcion.cliente)}
            </h1>
            <Badge variant={estadoVariant[estado] ?? "outline"}>
              {estado.charAt(0) + estado.slice(1).toLowerCase()}
            </Badge>
          </div>
          <p className="truncate text-sm text-muted-foreground">
            Suscripción #{suscripcion.numero} · {propiedad.nombre} ·{" "}
            {PERIODICIDAD_LABEL[periodicidad]?.toLowerCase() ?? periodicidad}
          </p>
        </div>
        <Link href={`/dashboard/clientes/${suscripcion.cliente.id}`}>
          <Button variant="outline">Ver cliente</Button>
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* El plan: de qué jardín es, cuánto cuesta y cuántas visitas
              incluye. Es lo que se pactó con el cliente, en tres números. */}
          <Card className="overflow-visible">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Plan</CardTitle>
              {!soloLectura && (
                <CardAction>
                  <span className="text-sm font-semibold tabular-nums">
                    {money(
                      (Number(precio) || 0) *
                        (1 + (Number(ivaTasa) || 0) / 100)
                    )}
                    <span className="text-xs font-normal text-muted-foreground">
                      {sufijo}
                    </span>
                  </span>
                </CardAction>
              )}
            </CardHeader>
            {soloLectura ? (
              // Lo único que necesita quien agenda: dónde y cuántas visitas
              // cubre el plan por período. Ni precio ni IVA.
              <CardContent className="space-y-3 text-sm">
                <UbicacionDelPlan
                  propiedad={propiedad}
                  clienteId={suscripcion.cliente.id}
                />
                <div className="flex items-start justify-between gap-3 border-t pt-3">
                  <span className="flex-none text-muted-foreground">
                    Incluye
                  </span>
                  <span>{visitasTexto}</span>
                </div>
              </CardContent>
            ) : (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Propiedad</Label>
                  <CustomSelect
                    value={propiedadId}
                    onChange={setPropiedadId}
                    options={suscripcion.propiedades.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                      hint: direccionDePropiedad(p) || undefined,
                    }))}
                    placeholder="Elegir propiedad"
                    searchable={suscripcion.propiedades.length > 6}
                    searchPlaceholder="Buscar propiedad..."
                  />
                  {/* Dónde queda, debajo del selector: el nombre solo
                      ("Principal") no dice a qué jardín se va, y abrir la
                      ficha de la propiedad para averiguarlo es un viaje. Solo
                      la ubicación —las medidas son de la ficha—. */}
                  <UbicacionDelPlan
                    propiedad={propiedad}
                    clienteId={suscripcion.cliente.id}
                  />
                  <p className="text-xs text-muted-foreground">
                    Las visitas de este plan se agendan en esta propiedad.
                    Cambiarla no mueve las que ya pasaron.
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Precio{sufijo} *</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">IVA %</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={ivaTasa}
                      onChange={(e) => setIvaTasa(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Visitas{sufijo} *</Label>
                    <Input
                      type="number"
                      min="1"
                      value={visitasPorPeriodo}
                      onChange={(e) => setVisitasPorPeriodo(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  Cambiar el precio rige desde el ciclo siguiente: los períodos
                  ya facturados guardan lo que se cobró.
                </p>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Visitas</CardTitle>
              <CardAction>
                {/* Llega con el plan ya puesto: "nueva visita de este plan" es
                    una sola acción, no elegir cliente, propiedad y plan de
                    nuevo. */}
                <Link
                  href={`/dashboard/visitas/nueva?suscripcion=${suscripcion.id}`}
                >
                  <Button size="sm" variant="outline">
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    Crear visita
                  </Button>
                </Link>
              </CardAction>
            </CardHeader>
            <CardContent>
              {visitas.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Todavía no hay visitas de este plan.
                </p>
              ) : (
                <ul className="divide-y">
                  {visitas.map((v) => (
                    <li key={v.id}>
                      <Link
                        href={`/dashboard/visitas/${v.id}?from=/dashboard/suscripciones/${suscripcion.id}`}
                        className="flex items-start justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-medium">
                            Visita #{v.numero}
                            <span className="ml-2 text-xs font-normal text-muted-foreground">
                              {fecha(v.fechaProgramada)}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {v.tareas.length > 0
                              ? v.tareas.join(", ")
                              : "Sin tareas registradas"}
                            {v.fechaRealizada &&
                              ` · realizada ${fecha(v.fechaRealizada)}`}
                          </span>
                        </span>
                        <span className="flex-none text-xs text-muted-foreground">
                          {v.estado.charAt(0) + v.estado.slice(1).toLowerCase()}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {!soloLectura && (
            /* Órdenes y no facturas: el borrador que crea el cron todavía no
               tiene factura, y era justo lo que no se veía desde aquí. */
            <Card>
              <CardHeader className="border-b">
                <CardTitle className="text-base">Órdenes</CardTitle>
                <CardAction>
                  {/* Lo hace el cron todas las noches; esto es la salida de
                      emergencia. Idempotente: apretarlo de más no duplica. */}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={generarOrdenes}
                    disabled={generando}
                  >
                    {generando ? (
                      <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <RefreshCw className="mr-2 h-3.5 w-3.5" />
                    )}
                    Generar órdenes
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {ordenes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Todavía no se generó ninguna orden de este plan.
                  </p>
                ) : (
                  <ul className="divide-y">
                    {ordenes.map((o) => (
                      <li key={o.id}>
                        <Link
                          href={`/dashboard/ordenes/${o.id}?from=/dashboard/suscripciones/${suscripcion.id}`}
                          className="flex items-start justify-between gap-3 rounded-md px-2 py-2.5 text-sm transition-colors hover:bg-muted/50"
                        >
                          <span className="min-w-0">
                            <span className="block font-medium">
                              Orden #{o.numero}
                              {o.factura && (
                                <span className="ml-2 font-normal text-muted-foreground tabular-nums">
                                  {o.factura.numero}
                                </span>
                              )}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {o.periodoInicio
                                ? `${fecha(o.periodoInicio)} → ${fecha(o.periodoFin!)}`
                                : fecha(o.fecha)}
                              {o.periodos > 1 && ` · ${o.periodos} períodos`}
                            </span>
                          </span>
                          <span className="flex-none text-right">
                            <span className="block font-semibold tabular-nums">
                              {money(o.delPlan)}
                            </span>
                            {/* La orden puede llevar productos sueltos
                                agregados a mano encima del período. Sin
                                decirlo, el número de aquí no cuadraba con el
                                de la orden. */}
                            {o.delPlan < o.total - 0.001 && (
                              <span className="block text-xs text-muted-foreground">
                                de {money(o.total)} en total
                              </span>
                            )}
                            <span className="block text-xs text-muted-foreground">
                              {o.estado === "BORRADOR"
                                ? "Borrador"
                                : o.estado === "ANULADA"
                                  ? "Anulada"
                                  : !o.factura || o.factura.saldo === null
                                    ? "Facturada"
                                    : o.factura.saldo <= 0.001
                                      ? "Cobrado"
                                      : "Por cobrar"}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {/* Arriba de los términos: es lo que se mira seguido —cuánto paga el
              cliente— mientras que los términos se tocan una vez. Quien no ve
              plata no lo ve. */}
          {!soloLectura && (
            <ResumenSuscripcion
              precio={precio}
              ivaTasa={ivaTasa}
              visitasPorPeriodo={visitasPorPeriodo}
              sufijo={sufijo}
            />
          )}

          <Card className="overflow-visible">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Términos</CardTitle>
            </CardHeader>
            {soloLectura ? (
              <CardContent className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-none text-muted-foreground">
                    Se cobra
                  </span>
                  <span>{PERIODICIDAD_LABEL[periodicidad]}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-none text-muted-foreground">Estado</span>
                  <span>{estado.charAt(0) + estado.slice(1).toLowerCase()}</span>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <span className="flex-none text-muted-foreground">Desde</span>
                  <span className="tabular-nums">{fechaInicio}</span>
                </div>
                {notas ? (
                  <div className="space-y-1">
                    <span className="text-muted-foreground">Notas</span>
                    <p className="whitespace-pre-wrap">{notas}</p>
                  </div>
                ) : null}
              </CardContent>
            ) : (
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Se cobra</Label>
                  <CustomSelect
                    value={periodicidad}
                    onChange={setPeriodicidad}
                    options={PERIODICIDADES.map((p) => ({
                      value: p,
                      label: PERIODICIDAD_LABEL[p],
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Estado</Label>
                  <CustomSelect
                    value={estado}
                    onChange={setEstado}
                    options={ESTADOS.map((e) => ({
                      value: e,
                      label: e.charAt(0) + e.slice(1).toLowerCase(),
                    }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="inicio">Desde</Label>
                  <Input
                    id="inicio"
                    type="date"
                    value={fechaInicio}
                    onChange={(e) => setFechaInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Opcional"
                  />
                </div>
              </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
