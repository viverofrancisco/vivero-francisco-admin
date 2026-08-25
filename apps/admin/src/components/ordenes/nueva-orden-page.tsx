"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { SelectorDatosFacturacion } from "@/components/facturacion/selector-datos-facturacion";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
}

interface Producto {
  id: string;
  nombre: string;
  descripcion: string | null;
  tipo: string;
  ivaTasa: number | null;
  /** Sin esto no se puede facturar, así que tampoco se puede vender. */
  contificoProductoId: string | null;
}

/** Trabajo hecho y todavía sin facturar, tal como lo devuelve la API. */
interface Pendiente {
  tipo: "visita" | "suscripcion";
  productoId: string;
  descripcion: string;
  precio: string;
  ivaTasa: string;
  visitaProductoId?: string;
  suscripcionItemId?: string;
  fecha?: string;
  periodoInicio?: string;
  periodoFin?: string;
}

/**
 * Una línea del editor. Los importes se tipean como texto para no pelear con
 * el input mientras se escribe; se convierten a número recién al enviar.
 */
interface Linea {
  uid: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
  productoId: string;
  /** Procedencia. Solo la traen las líneas que salen de un pendiente. */
  visitaProductoId: string | null;
  suscripcionItemId: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
  /** Qué la originó, para mostrarlo debajo del nombre. */
  origen: string | null;
}

let contador = 0;
const nuevoUid = () => `l${contador++}`;

/**
 * Toda línea sale de un producto del catálogo.
 *
 * Contífico exige `producto_id` en cada `detalles[]` y no acepta texto libre,
 * así que una línea suelta sería una orden imposible de cobrar. Si algo no está
 * en el catálogo, hay que crearlo como producto primero.
 */
function lineaBase(): Omit<Linea, "descripcion" | "productoId"> {
  return {
    uid: nuevoUid(),
    cantidad: "1",
    precioUnitario: "",
    ivaTasa: "0",
    visitaProductoId: null,
    suscripcionItemId: null,
    periodoInicio: null,
    periodoFin: null,
    origen: null,
  };
}

/** Un pendiente convertido en línea de la orden. */
function lineaDesde(p: Pendiente): Linea {
  return {
    ...lineaBase(),
    descripcion: p.descripcion,
    precioUnitario: String(Number(p.precio)),
    ivaTasa: String(Number(p.ivaTasa)),
    productoId: p.productoId,
    visitaProductoId: p.visitaProductoId ?? null,
    suscripcionItemId: p.suscripcionItemId ?? null,
    periodoInicio: p.periodoInicio ?? null,
    periodoFin: p.periodoFin ?? null,
    origen:
      p.tipo === "visita"
        ? `Visita del ${fecha(p.fecha!)}`
        : `Suscripción · ${fecha(p.periodoInicio!)} → ${fecha(p.periodoFin!)}`,
  };
}

/** Clave estable de un pendiente, para no ofrecer dos veces lo mismo. */
function clavePendiente(p: Pendiente): string {
  return p.visitaProductoId ?? `${p.suscripcionItemId}:${p.periodoInicio}`;
}

function importes(l: Linea) {
  const subtotal = (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0);
  const iva = (subtotal * (Number(l.ivaTasa) || 0)) / 100;
  return { subtotal, iva, total: subtotal + iva };
}

export function NuevaOrdenPage({
  clientes,
  productos,
  clienteInicial,
  pendientesIniciales,
  suscritosIniciales,
  preseleccion,
  desdeVisita,
}: {
  clientes: Cliente[];
  productos: Producto[];
  /** Preseleccionado al venir desde "Por facturar". */
  clienteInicial?: string;
  /**
   * Pendientes del cliente preseleccionado, resueltos en el servidor. Traerlos
   * acá evita un efecto que dispare un fetch al montar, y la pantalla aparece
   * ya completa en vez de con un spinner.
   */
  pendientesIniciales?: Pendiente[];
  suscritosIniciales?: string[];
  /**
   * `visitaProductoId`s que entran ya cargados como líneas. Es lo que permite
   * "facturar esta visita" desde su ficha: se llega con el trabajo puesto y
   * solo queda ponerle precio o sumarle algo más.
   */
  preseleccion?: string[];
  /** De qué visita se llegó, para decirlo en pantalla. */
  desdeVisita?: { id: string; fecha: string } | null;
}) {
  const router = useRouter();
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  const [notas, setNotas] = useState("");
  // La preselección se resuelve en el estado inicial y no en un efecto: así no
  // hay un render con la orden vacía ni un `setState` después de pintar.
  const [lineas, setLineas] = useState<Linea[]>(() =>
    (pendientesIniciales ?? [])
      .filter((p) => p.visitaProductoId && preseleccion?.includes(p.visitaProductoId))
      .map(lineaDesde)
  );
  /**
   * Productos que este cliente ya tiene en un plan. No se pueden agregar a mano:
   * entran por el período o por la visita, o se le cobraría dos veces. Depende
   * del cliente, así que se recarga con él.
   */
  const [suscritos, setSuscritos] = useState<string[]>(suscritosIniciales ?? []);
  const [pendientes, setPendientes] = useState<Pendiente[]>(
    pendientesIniciales ?? []
  );
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [productoAAgregar, setProductoAAgregar] = useState("");
  // Con qué se va a facturar. Se elige acá, con el cliente delante.
  const [datoFacturacionId, setDatoFacturacionId] = useState<string | null>(null);

  async function cargarPendientes(id: string) {
    setCargandoPendientes(true);
    try {
      const res = await fetch(`/api/ordenes/pendientes?clienteId=${id}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const datos = await res.json();
      setPendientes(datos.items);
      setSuscritos(datos.suscritos ?? []);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos ver lo pendiente");
    } finally {
      setCargandoPendientes(false);
    }
  }

  const seleccionarCliente = async (id: string) => {
    setClienteId(id);
    // Las líneas que venían de pendientes eran de otro cliente: no valen más.
    setLineas((prev) => prev.filter((l) => l.origen === null));
    setPendientes([]);
    setSuscritos([]);
    setDatoFacturacionId(null);
    if (!id) return;
    await cargarPendientes(id);
  };

  const agregarProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
    if (!p.contificoProductoId) {
      toast.error(`"${p.nombre}" no está sincronizado con Contífico`);
      return;
    }
    if (suscritos.includes(p.id)) {
      toast.error(
        `"${p.nombre}" está en un plan de este cliente: entra desde "Pendiente de facturar"`
      );
      return;
    }
    setLineas((prev) => [
      ...prev,
      {
        ...lineaBase(),
        descripcion: p.nombre,
        ivaTasa: p.ivaTasa != null ? String(p.ivaTasa) : "0",
        productoId: p.id,
      },
    ]);
    setProductoAAgregar("");
  };

  // Lo que ya está en la orden no vuelve a ofrecerse. La misma clave que usa
  // el índice único de OrdenLinea, así que coincide con lo que rechaza la BD.
  const yaEnLaOrden = new Set(
    lineas
      .map((l) =>
        l.visitaProductoId ??
        (l.suscripcionItemId
          ? `${l.suscripcionItemId}:${l.periodoInicio}`
          : null)
      )
      .filter((k): k is string => k !== null)
  );
  const pendientesDisponibles = pendientes.filter(
    (p) => !yaEnLaOrden.has(clavePendiente(p))
  );

  const agregarPendiente = (p: Pendiente) => {
    setLineas((prev) => [...prev, lineaDesde(p)]);
  };

  const agregarTodosLosPendientes = () =>
    pendientesDisponibles.forEach((p) => agregarPendiente(p));

  const actualizar = (uid: string, patch: Partial<Linea>) =>
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );

  const quitar = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const totales = lineas.reduce(
    (acc, l) => {
      const i = importes(l);
      return {
        subtotal: acc.subtotal + i.subtotal,
        iva: acc.iva + i.iva,
        total: acc.total + i.total,
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  const crear = async () => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (lineas.length === 0) return toast.error("Agregá al menos un producto");
    const sinDescripcion = lineas.find((l) => !l.descripcion.trim());
    if (sinDescripcion) return toast.error("Hay un producto sin descripción");
    const sinPrecio = lineas.find(
      (l) => l.precioUnitario.trim() === "" || Number(l.precioUnitario) < 0
    );
    if (sinPrecio)
      return toast.error(`Falta el precio de "${sinPrecio.descripcion}"`);

    setGuardando(true);
    try {
      const res = await fetch("/api/ordenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          datoFacturacionId,
          notas: notas.trim() || undefined,
          lineas: lineas.map((l) => ({
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad) || 1,
            precioUnitario: Number(l.precioUnitario),
            ivaTasa: Number(l.ivaTasa) || 0,
            productoId: l.productoId,
            visitaProductoId: l.visitaProductoId,
            suscripcionItemId: l.suscripcionItemId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const orden = await res.json();
      toast.success(`Orden #${orden.numero} creada`);
      router.push(`/dashboard/ordenes/${orden.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crear la orden");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/ordenes">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nueva orden</h1>
          {/* Llegando desde una visita hay que decirlo: si no, la línea ya
              cargada parece salida de la nada. */}
          {desdeVisita ? (
            <p className="text-sm text-muted-foreground">
              Con el trabajo de la{" "}
              <Link
                href={`/dashboard/visitas/${desdeVisita.id}`}
                className="text-primary hover:underline"
              >
                visita del {fecha(desdeVisita.fecha)}
              </Link>{" "}
              ya cargado. Podés sumarle más productos antes de guardar.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">
              Armá la orden con lo que se vendió. La factura se emite después,
              desde el detalle.
            </p>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px] items-start">
        {/* ── Líneas ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lineas.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Todavía no hay nada en la orden.
                </p>
              ) : (
                <div className="space-y-3">
                  {lineas.map((l) => {
                    const i = importes(l);
                    return (
                      <div
                        key={l.uid}
                        className="rounded-md border p-3 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-1">
                            <Input
                              value={l.descripcion}
                              onChange={(e) =>
                                actualizar(l.uid, { descripcion: e.target.value })
                              }
                              placeholder="Descripción"
                              className="font-medium"
                            />
                            {l.origen && (
                              <p className="text-xs text-muted-foreground">
                                {l.origen}
                              </p>
                            )}
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => quitar(l.uid)}
                            aria-label="Quitar producto"
                          >
                            <Trash2 className="h-4 w-4 text-muted-foreground" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap items-end gap-3">
                          <div className="w-20 space-y-1">
                            <Label className="text-xs">Cant.</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.cantidad}
                              onChange={(e) =>
                                actualizar(l.uid, { cantidad: e.target.value })
                              }
                            />
                          </div>
                          <div className="w-28 space-y-1">
                            <Label className="text-xs">Precio *</Label>
                            <Input
                              type="number"
                              min="0"
                              step="0.01"
                              value={l.precioUnitario}
                              onChange={(e) =>
                                actualizar(l.uid, {
                                  precioUnitario: e.target.value,
                                })
                              }
                              placeholder="0.00"
                            />
                          </div>
                          <div className="w-24 space-y-1">
                            <Label className="text-xs">IVA %</Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              step="0.01"
                              value={l.ivaTasa}
                              onChange={(e) =>
                                actualizar(l.uid, { ivaTasa: e.target.value })
                              }
                            />
                          </div>
                          <div className="ml-auto text-right">
                            <p className="text-xs text-muted-foreground">
                              Total
                            </p>
                            <p className="font-semibold tabular-nums">
                              {money(i.total)}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex flex-wrap items-end gap-3 border-t pt-3">
                <div className="min-w-[220px] flex-1 space-y-1">
                  <Label className="text-xs">Agregar del catálogo</Label>
                  <CustomSelect
                    value={productoAAgregar}
                    onChange={agregarProducto}
                    // Lo que ya cubre un plan de este cliente no se elige a
                    // mano: entra por el panel de pendientes, que es lo que
                    // trae el período y evita cobrar dos veces el mismo mes.
                    options={productos.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                      disabled:
                        !p.contificoProductoId || suscritos.includes(p.id),
                      hint: !p.contificoProductoId
                        ? "No está vinculado con Contífico, así que no se puede facturar. Vinculalo desde la ficha del producto."
                        : suscritos.includes(p.id)
                          ? "Este cliente lo tiene en un plan: se cobra por período, desde “Pendiente de facturar”."
                          : undefined,
                    }))}
                    placeholder="Buscar producto..."
                    searchable
                    searchPlaceholder="Buscar producto..."
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ── Pendientes de facturar ───────────────────────────── */}
          {clienteId && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">
                  Pendiente de facturar
                </CardTitle>
                {pendientesDisponibles.length > 0 && (
                  <CardAction>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={agregarTodosLosPendientes}
                    >
                      Agregar todo
                    </Button>
                  </CardAction>
                )}
              </CardHeader>
              <CardContent>
                {cargandoPendientes ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando…
                  </div>
                ) : pendientesDisponibles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    {pendientes.length === 0
                      ? "Este cliente no tiene trabajo sin facturar."
                      : "Ya agregaste todo lo pendiente a la orden."}
                  </p>
                ) : (
                  <div className="divide-y">
                    {pendientesDisponibles.map((p) => (
                      <div
                        key={clavePendiente(p)}
                        className="flex items-center justify-between gap-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {p.descripcion}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {p.tipo === "visita"
                              ? `Visita · ${fecha(p.fecha!)}`
                              : `${fecha(p.periodoInicio!)} → ${fecha(p.periodoFin!)}`}
                          </p>
                        </div>
                        <div className="flex flex-none items-center gap-3">
                          <Badge
                            variant={
                              p.tipo === "visita" ? "outline" : "secondary"
                            }
                            className="text-xs"
                          >
                            {p.tipo === "visita" ? "Visita" : "Suscripción"}
                          </Badge>
                          <span className="font-semibold tabular-nums">
                            {money(p.precio)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => agregarPendiente(p)}
                          >
                            Agregar
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* ── Cliente y totales ──────────────────────────────────── */}
        <div className="space-y-6 lg:sticky lg:top-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                value={clienteId}
                onChange={seleccionarCliente}
                options={clientes.map((c) => ({
                  value: c.id,
                  label: nombreCliente(c),
                }))}
                placeholder="Seleccionar cliente"
                searchable
                searchPlaceholder="Buscar cliente..."
              />
              <div className="space-y-2">
                <Label htmlFor="notas">Notas</Label>
                <Textarea
                  id="notas"
                  value={notas}
                  onChange={(e) => setNotas(e.target.value)}
                  placeholder="Opcional"
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* A nombre de quién sale la factura. Se pregunta acá y no al emitir:
              en ese momento quien vende tiene al cliente delante. */}
          {clienteId && (
            <Card className="overflow-visible">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Datos de facturación</CardTitle>
              </CardHeader>
              <CardContent>
                <SelectorDatosFacturacion
                  key={clienteId}
                  clienteId={clienteId}
                  value={datoFacturacionId}
                  onChange={setDatoFacturacionId}
                />
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Resumen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="tabular-nums">{money(totales.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">IVA</span>
                <span className="tabular-nums">{money(totales.iva)}</span>
              </div>
              <div className="flex justify-between border-t pt-2 font-bold">
                <span>Total</span>
                <span className="tabular-nums">{money(totales.total)}</span>
              </div>
              <Button
                className="mt-3 w-full"
                onClick={crear}
                disabled={guardando || !clienteId || lineas.length === 0}
              >
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear orden
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
