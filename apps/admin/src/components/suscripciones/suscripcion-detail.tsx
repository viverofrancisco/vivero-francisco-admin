"use client";

import { useEffect, useState } from "react";
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
import { ArrowLeft, Loader2, Plus, RefreshCw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import {
  PERIODICIDAD_LABEL,
  PERIODICIDAD_SUFIJO,
  estadoVariant,
  fecha,
  money,
} from "./formato";

interface ItemData {
  id: string;
  productoId: string;
  nombre: string;
  precio: number;
  ivaTasa: number;
  visitasPorPeriodo: number | null;
}

interface SuscripcionData {
  id: string;
  /** Para nombrarla: "Suscripción #12". Secuencia propia, no la de órdenes. */
  numero: number;
  estado: string;
  periodicidad: string;
  fechaInicio: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  items: ItemData[];
}

interface ProductoSuscribible {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  sincronizado: boolean;
}

/** Un ítem mientras se edita: los importes van como texto para no pelear con el input. */
interface ItemDraft {
  productoId: string;
  nombre: string;
  precio: string;
  ivaTasa: string;
  visitasPorPeriodo: string;
}

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];
const ESTADOS = ["ACTIVO", "PAUSADO", "CANCELADO"];

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
  /** Visitas donde este plan cubrió al menos un producto. */
  visitas: {
    id: string;
    numero: number;
    fechaProgramada: string;
    fechaRealizada: string | null;
    estado: string;
    productos: string[];
  }[];
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref: string;
  /**
   * Un admin de sector entra a ver de qué se trata el plan —qué productos
   * cubre y cuántas visitas por período— para agendar. No ve precios ni
   * órdenes, y no puede cambiar nada.
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
      for (const o of body.omitidas ?? []) toast.warning(o.motivo);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos generar");
    } finally {
      setGenerando(false);
    }
  };
  const [disponibles, setDisponibles] = useState<ProductoSuscribible[]>([]);

  const [periodicidad, setPeriodicidad] = useState(suscripcion.periodicidad);
  const [estado, setEstado] = useState(suscripcion.estado);
  const [fechaInicio, setFechaInicio] = useState(
    suscripcion.fechaInicio.slice(0, 10)
  );
  const [notas, setNotas] = useState(suscripcion.notas ?? "");
  const [items, setItems] = useState<ItemDraft[]>(
    suscripcion.items.map((i) => ({
      productoId: i.productoId,
      nombre: i.nombre,
      precio: String(i.precio),
      ivaTasa: String(i.ivaTasa),
      visitasPorPeriodo: i.visitasPorPeriodo ? String(i.visitasPorPeriodo) : "",
    }))
  );

  useEffect(() => {
    fetch(
      `/api/suscripciones/productos?clienteId=${suscripcion.cliente.id}&exceptoSuscripcionId=${suscripcion.id}`,
      { cache: "no-store" }
    )
      .then((r) => r.json())
      .then((d) => setDisponibles(d.items ?? []))
      .catch(() => setDisponibles([]));
  }, [suscripcion.cliente.id, suscripcion.id]);

  const sinAgregar = disponibles.filter(
    (p) => !items.some((i) => i.productoId === p.id)
  );

  const agregar = (productoId: string) => {
    const p = disponibles.find((x) => x.id === productoId);
    if (!p) return;
    setItems((prev) => [
      ...prev,
      {
        productoId: p.id,
        nombre: p.nombre,
        precio: "",
        ivaTasa: p.ivaTasa != null ? String(p.ivaTasa) : "",
        visitasPorPeriodo: "",
      },
    ]);
  };

  const actualizar = (productoId: string, patch: Partial<ItemDraft>) =>
    setItems((prev) =>
      prev.map((i) => (i.productoId === productoId ? { ...i, ...patch } : i))
    );

  const quitar = (productoId: string) =>
    setItems((prev) => prev.filter((i) => i.productoId !== productoId));

  const totalPeriodo = items.reduce((acc, i) => {
    const precio = Number(i.precio) || 0;
    return acc + precio + (precio * (Number(i.ivaTasa) || 0)) / 100;
  }, 0);

  const guardar = async () => {
    if (items.length === 0) return toast.error("Agregá al menos un producto");
    for (const i of items) {
      if (!i.precio.trim() || Number(i.precio) < 0) {
        return toast.error(`Ingresá el precio de "${i.nombre}"`);
      }
      if (Number(i.visitasPorPeriodo) < 1) {
        return toast.error(
          `Ingresá las visitas por período de "${i.nombre}"`
        );
      }
    }

    setGuardando(true);
    try {
      const res = await fetch(`/api/suscripciones/${suscripcion.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          periodicidad,
          estado,
          fechaInicio,
          notas: notas.trim() || null,
          items: items.map((i) => ({
            productoId: i.productoId,
            precio: Number(i.precio),
            ivaTasa: i.ivaTasa.trim() ? Number(i.ivaTasa) : null,
            visitasPorPeriodo: Number(i.visitasPorPeriodo),
          })),
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

  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";

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
          <p className="text-sm text-muted-foreground">
            Suscripción #{suscripcion.numero} · todos sus productos se cobran
            juntos, en una factura.
          </p>
        </div>
        <Link href={`/dashboard/clientes/${suscripcion.cliente.id}`}>
          <Button variant="outline">Ver cliente</Button>
        </Link>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-visible">
            <CardHeader className="border-b">
              <CardTitle className="text-base">Productos</CardTitle>
              {!soloLectura && (
                <CardAction>
                  <span className="text-sm font-semibold tabular-nums">
                    {money(totalPeriodo)}
                    <span className="text-xs font-normal text-muted-foreground">
                      {sufijo}
                    </span>
                  </span>
                </CardAction>
              )}
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Sin productos. Una suscripción necesita al menos uno.
                </p>
              ) : (
                items.map((i) => (
                  <div
                    key={i.productoId}
                    className="space-y-2 rounded-md border p-3"
                  >
                    <div className="flex items-center gap-2">
                      <span className="flex-1 text-sm font-medium">
                        {i.nombre}
                      </span>
                      {!soloLectura && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => quitar(i.productoId)}
                          aria-label={`Quitar ${i.nombre}`}
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      )}
                    </div>
                    {soloLectura ? (
                      // Lo único que necesita quien agenda: cuántas visitas
                      // cubre el plan por período. Ni precio ni IVA.
                      <p className="text-sm text-muted-foreground">
                        {i.visitasPorPeriodo || "—"} visita
                        {Number(i.visitasPorPeriodo) === 1 ? "" : "s"}
                        {sufijo}
                      </p>
                    ) : (
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="space-y-1">
                        <Label className="text-xs">Precio{sufijo} *</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          value={i.precio}
                          onChange={(e) =>
                            actualizar(i.productoId, { precio: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">IVA %</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={i.ivaTasa}
                          onChange={(e) =>
                            actualizar(i.productoId, { ivaTasa: e.target.value })
                          }
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Visitas{sufijo} *</Label>
                        <Input
                          type="number"
                          min="1"
                          value={i.visitasPorPeriodo}
                          onChange={(e) =>
                            actualizar(i.productoId, {
                              visitasPorPeriodo: e.target.value,
                            })
                          }
                        />
                      </div>
                    </div>
                    )}
                  </div>
                ))
              )}

              {!soloLectura && sinAgregar.length > 0 && (
                <CustomSelect
                  value=""
                  onChange={agregar}
                  // Sin vincular **entra igual**: el plan es el acuerdo
                  // con el cliente, y el vínculo hace falta recién sobre lo que
                  // sale impreso, que se decide al emitir.
                  options={sinAgregar.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                    hint: p.sincronizado
                      ? undefined
                      : "No está vinculado con Contífico: al emitir vas a tener que facturarlo con otro producto.",
                  }))}
                  placeholder="Agregar producto recurrente"
                  searchable
                  searchPlaceholder="Buscar producto..."
                />
              )}
            </CardContent>
          </Card>
          {/* Las visitas que este plan cubrió. La relación no es directa: va
              por `VisitaProducto.suscripcionItemId`, o sea por lo que se marcó
              como cubierto al agendar. */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle className="text-base">Visitas cubiertas</CardTitle>
              <CardAction>
                {/* Llega con el plan ya puesto: "nueva visita de este plan" es
                    una sola acción, no elegir cliente y plan de nuevo. */}
                <Link
                  href={`/dashboard/visitas/nueva?suscripcion=${suscripcion.id}`}
                >
                  {/* Con su nombre y no un "+": es la acción de la card, igual
                      que "Generar órdenes" en la de abajo, y un ícono solo
                      obliga a adivinar o a esperar el tooltip. */}
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
                  Todavía ninguna visita quedó cubierta por este plan.
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
                            {v.productos.join(", ")}
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
          <>
          {/* Órdenes y no facturas: el borrador que crea el cron todavía no
              tiene factura, y era justo lo que no se veía desde acá. */}
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
                          {/* La orden puede llevar productos sueltos agregados
                              a mano encima del período. Sin decirlo, el número
                              de acá no cuadraba con el de la orden. */}
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
          </>
          )}
        </div>

        <div className="space-y-6">
          {/* Arriba de los términos: es lo que se mira seguido —cuánto paga el
              cliente por cada cosa— mientras que los términos se tocan una vez.
              Un `PERSONAL_ADMIN` no ve plata, así que para él no existe. */}
          {!soloLectura && (
            <ResumenSuscripcion items={items} sufijo={sufijo} />
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
                <p className="text-xs text-muted-foreground">
                  Cambiar el precio rige desde el ciclo siguiente: los períodos
                  ya facturados guardan lo que se cobró.
                </p>
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
              <Button
                className="w-full"
                onClick={guardar}
                disabled={guardando || items.length === 0}
              >
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Guardar cambios
              </Button>
            </CardContent>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
