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
import {
  SelectorVisitas,
  origenDeLinea,
  rearmarPorVisitas,
  visitasDePendientes,
  nuevoUid,
  type LineaEditable,
  type Pendiente,
} from "./selector-visitas";
import { ArrowLeft, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { money, fecha } from "./formato";
import { SelectorDatosFacturacion } from "@/components/facturacion/selector-datos-facturacion";
import { AvisoSinVincular } from "./aviso-sin-vincular";

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

/**
 * El tipo de línea, el de pendiente y el rearmado por visitas viven en
 * `selector-visitas`: los comparte con la edición de un borrador, que es el
 * mismo formulario en otro momento.
 */
type Linea = LineaEditable;

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
    visitaProductoIds: [],
    suscripcionItemId: null,
    periodoInicio: null,
    periodoFin: null,
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
    visitaProductoIds: p.visitaProductoId ? [p.visitaProductoId] : [],
    suscripcionItemId: p.suscripcionItemId ?? null,
    periodoInicio: p.periodoInicio ?? null,
    periodoFin: p.periodoFin ?? null,
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
   * Productos que este cliente ya tiene en un plan. Se pueden agregar igual
   * —sería un extra sobre lo que el plan cubre—, pero se avisa, porque agregar
   * sin querer lo que el plan ya cubre es cobrarlo dos veces. Depende del
   * cliente, así que se recarga con él.
   */
  const [suscritos, setSuscritos] = useState<string[]>(suscritosIniciales ?? []);

  /**
   * Se llegó desde una visita: la orden **es** de esa visita.
   *
   * Cambia dos cosas. Sus productos no se pueden sacar —una visita se factura
   * completa y el servidor rechazaría la orden a medias, así que ofrecer el
   * tacho es ofrecer un botón que falla—, y el panel de pendientes desaparece:
   * quien entró por acá viene a cobrar esta visita, no a revisar todo lo que el
   * cliente debe. Lo que sí se puede es sumar productos del catálogo.
   */
  /**
   * De qué visitas es esta orden. Vacío = de ninguna todavía.
   *
   * **Pueden ser varias**: cobrarle a alguien el mes entero en una sola orden
   * es lo normal. Se llega con una puesta al entrar desde la ficha de una
   * visita, y las demás se marcan acá. En todos los casos manda lo mismo: los
   * productos de cada visita entran completos —una visita se factura entera— y
   * no se sacan de a uno.
   */
  const [visitaIds, setVisitaIds] = useState<string[]>(
    desdeVisita && (preseleccion?.length ?? 0) > 0 ? [desdeVisita.id] : []
  );
  /** Se entró desde la visita: sacarla sería no ser esa orden. */
  const bloqueada = desdeVisita != null && (preseleccion?.length ?? 0) > 0;
  const fijada = (l: Linea) => l.visitaProductoIds.length > 0;
  const nombreDelCliente = (() => {
    const c = clientes.find((x) => x.id === clienteId);
    return c ? nombreCliente(c) : "El cliente";
  })();
  const [pendientes, setPendientes] = useState<Pendiente[]>(
    pendientesIniciales ?? []
  );
  const [cargandoPendientes, setCargandoPendientes] = useState(false);
  const [guardando, setGuardando] = useState(false);
  /** La orden recién creada, mientras se le registra el cobro. */
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
    setLineas((prev) =>
      prev.filter(
        (l) => l.visitaProductoIds.length === 0 && !l.suscripcionItemId
      )
    );
    setPendientes([]);
    setSuscritos([]);
    setDatoFacturacionId(null);
    if (!id) return;
    await cargarPendientes(id);
  };

  const agregarProducto = (productoId: string) => {
    const p = productos.find((x) => x.id === productoId);
    if (!p) return;
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
    lineas.flatMap((l) => [
      ...l.visitaProductoIds,
      ...(l.suscripcionItemId
        ? [`${l.suscripcionItemId}:${l.periodoInicio}`]
        : []),
    ])
  );
  const pendientesDisponibles = pendientes.filter(
    (p) => !yaEnLaOrden.has(clavePendiente(p))
  );

  /**
   * Lo pendiente que **no** entra por el selector de visita.
   *
   * El trabajo de visitas se carga eligiendo la visita, que trae sus productos
   * enteros —una visita se factura completa—, así que listarlos también acá,
   * producto por producto y con su propio botón, era la misma acción escrita
   * dos veces y una lista larguísima: cuatro filas por visita, veinte por
   * cliente. Lo que sí necesita una puerta propia son los períodos de plan, que
   * no tienen selector.
   */
  const periodosPendientes = pendientesDisponibles.filter(
    (p) => p.tipo === "suscripcion"
  );

  /**
   * Un período, no un producto suelto.
   *
   * Un período se factura entero igual que una visita —agregar uno arrastra a
   * sus hermanos—, así que una fila por producto mostraba tres veces la misma
   * acción y hacía la lista larga sin decir nada nuevo. Una fila por período,
   * con lo que incluye debajo.
   */
  const periodosAgrupados = [
    ...periodosPendientes
      .reduce((mapa, p) => {
        const clave = `${p.suscripcionId}:${p.periodoInicio}`;
        const actual = mapa.get(clave);
        if (actual) {
          actual.productos.push(p.descripcion);
          actual.total += Number(p.precio);
        } else {
          mapa.set(clave, {
            clave,
            muestra: p,
            productos: [p.descripcion],
            total: Number(p.precio),
          });
        }
        return mapa;
      }, new Map<string, { clave: string; muestra: Pendiente; productos: string[]; total: number }>())
      .values(),
  ].sort((a, b) =>
    (a.muestra.periodoInicio ?? "").localeCompare(b.muestra.periodoInicio ?? "")
  );

  /**
   * Las visitas del cliente que todavía no están facturadas, para elegir una.
   *
   * Salen de lo mismo que el panel de pendientes: una visita aparece acá
   * mientras le quede algún producto sin línea de orden. Las que ya se
   * facturaron no están, que es justo lo que se pidió.
   */
  const visitasPendientes = visitasDePendientes(pendientes);

  /**
   * Qué origen tiene ya esta orden. Una orden no mezcla períodos de plan con
   * trabajo de visitas —el servicio lo rechaza— así que el primero que entra
   * define de qué es. Lo agregado a mano no cuenta: es el extra de cualquiera.
   */
  const origen: "PLAN" | "VISITAS" | null = lineas.some(
    (l) => l.suscripcionItemId
  )
    ? "PLAN"
    : lineas.some((l) => l.visitaProductoIds.length > 0)
      ? "VISITAS"
      : null;

  const chocaConElOrigen = (p: Pendiente) =>
    origen !== null &&
    origen !== (p.tipo === "suscripcion" ? "PLAN" : "VISITAS");

  /**
   * Qué otros pendientes tienen que entrar con este.
   *
   * Una visita se factura completa y un período de un plan también: agregar uno
   * arrastra a sus hermanos. Es la misma regla que valida el servidor, pero acá
   * se cumple sola en vez de rebotar recién al guardar.
   */
  const grupoDe = (p: Pendiente) =>
    pendientesDisponibles.filter((otro) =>
      p.tipo === "visita"
        ? otro.tipo === "visita" && otro.visitaId === p.visitaId
        : otro.tipo === "suscripcion" &&
          otro.suscripcionId === p.suscripcionId &&
          otro.periodoInicio === p.periodoInicio
    );

  /**
   * Marcar o desmarcar una visita, y con eso cargar o sacar su trabajo.
   *
   * No es una etiqueta: es cargar el trabajo. La cabecera de la orden se deduce
   * en el servidor de la procedencia de las líneas, así que una asignación que
   * no las traiga sería una que no queda registrada en ningún lado.
   *
   * **El mismo producto de dos visitas es una sola línea.** Dos visitas con
   * "Control de plagas" son dos trabajos distintos —cada uno se factura una
   * sola vez— pero un solo producto, y tenerlo dos veces en la orden no le dice
   * nada a nadie y duplica la decisión de precio. Se junta en una línea con la
   * cantidad sumada y las dos procedencias.
   */
  const cambiarVisitas = (ids: string[]) => {
    setVisitaIds(ids);
    setLineas((prev) => rearmarPorVisitas(prev, ids, pendientes));
  };


  const agregarPendiente = (p: Pendiente) => {
    if (chocaConElOrigen(p)) {
      toast.error(
        origen === "PLAN"
          ? "Esta orden es de una suscripción. El trabajo de visitas va en otra."
          : "Esta orden es de visitas. Los períodos de suscripción van en otra."
      );
      return;
    }
    const grupo = grupoDe(p);
    setLineas((prev) => [...prev, ...grupo.map(lineaDesde)]);
    if (grupo.length > 1) {
      toast.info(
        p.tipo === "visita"
          ? `Se agregó la visita completa (${grupo.length} productos)`
          : `Se agregó el período completo (${grupo.length} productos)`
      );
    }
  };

  /** Solo lo que combina con lo que ya hay: agregar todo no rompe la regla. */
  const agregarTodosLosPeriodos = () =>
    periodosPendientes
      .filter((p) => !chocaConElOrigen(p))
      .forEach((p) => setLineas((prev) => [...prev, lineaDesde(p)]));

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

  /**
   * Crear la orden, y de ahí a facturarla o a dejarla en borrador.
   *
   * Las dos escriben lo mismo: `crearOrden` abre siempre un `BORRADOR`, que es
   * el único estado editable. La diferencia es qué pasa después —seguir al
   * armador del documento o irse al detalle— y qué se exige antes: un borrador
   * puede quedar sin precios, porque existe justamente para que alguien los
   * ponga; para emitir no.
   *
   * Antes esta acción cobraba de una. Ya no: **qué sale impreso es una
   * decisión** —varios trabajos pueden ir como una sola línea— y tomarla por
   * omisión desde un botón de cobro era tomarla a ciegas. El cobro sigue a un
   * paso: el armador termina en "Emitir y cobrar".
   */
  const crear = async ({ cobrar }: { cobrar: boolean }) => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (lineas.length === 0) return toast.error("Agregá al menos un producto");
    const sinDescripcion = lineas.find((l) => !l.descripcion.trim());
    if (sinDescripcion) return toast.error("Hay un producto sin descripción");
    const negativo = lineas.find((l) => Number(l.precioUnitario) < 0);
    if (negativo)
      return toast.error(`El precio de "${negativo.descripcion}" es negativo`);
    if (cobrar) {
      const sinPrecio = lineas.find((l) => l.precioUnitario.trim() === "");
      if (sinPrecio)
        return toast.error(`Falta el precio de "${sinPrecio.descripcion}"`);
    }

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
            visitaProductoIds: l.visitaProductoIds,
            suscripcionItemId: l.suscripcionItemId,
            periodoInicio: l.periodoInicio,
            periodoFin: l.periodoFin,
          })),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      const orden = await res.json();
      if (!cobrar) {
        toast.success(`Borrador #${orden.numero} guardado`);
        router.push(`/dashboard/ordenes/${orden.id}`);
        return;
      }
      toast.success(`Orden #${orden.numero} creada`);
      router.push(`/dashboard/ordenes/${orden.id}/facturar`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crear la orden");
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Los productos de la orden que todavía no están en Contífico.
   *
   * Entran igual —la orden registra lo que se vendió, y lo que tiene que
   * existir allá es lo que sale impreso— pero sin vínculo no hay `producto_id`
   * que mandar, así que facturar no es una opción todavía. Se dice acá, con la
   * orden todavía sin crear, en vez de rebotar adentro del armador.
   */
  const sinVincular = (() => {
    const mapa = new Map<string, { id: string; nombre: string }>();
    for (const l of lineas) {
      const p = productos.find((x) => x.id === l.productoId);
      if (p && !p.contificoProductoId) mapa.set(p.id, { id: p.id, nombre: p.nombre });
    }
    return [...mapa.values()];
  })();

  const noSePuedeGuardar = guardando || !clienteId || lineas.length === 0;
  /** El borrador se guarda igual: es justamente donde se arregla esto. */
  const motivoSinFacturar =
    sinVincular.length > 0
      ? `${sinVincular.map((p) => `"${p.nombre}"`).join(", ")} ${
          sinVincular.length === 1 ? "no está vinculado" : "no están vinculados"
        } con Contífico.`
      : null;

  return (
    <div className="space-y-6 pb-6">
      {/* Pegado arriba, con las acciones: una orden puede tener quince líneas y
          guardar no puede quedar a un scroll de distancia de lo que se edita.
          Los márgenes negativos lo hacen sangrar hasta los bordes. */}
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        {/* Vuelve de donde vino: si se entró desde una visita, cancelar tiene
            que devolver a esa visita y no a la lista de órdenes. */}
        <Link
          href={
            desdeVisita
              ? `/dashboard/visitas/${desdeVisita.id}`
              : "/dashboard/ordenes"
          }
        >
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
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
              Armá la orden con lo que se vendió. Cobrala ahora o guardala como
              borrador para terminarla después.
            </p>
          )}
        </div>
        <div className="flex flex-none items-center gap-2">
          {/* Las dos abren un borrador: `crearOrden` es el único escritor. La
              diferencia es adónde va después —al armador del documento o al
              detalle— y qué exige antes: un borrador puede quedar sin precios,
              para emitir no. */}
          <Button
            variant="outline"
            onClick={() => crear({ cobrar: false })}
            disabled={noSePuedeGuardar}
          >
            Guardar borrador
          </Button>
          <Button
            onClick={() => crear({ cobrar: true })}
            disabled={noSePuedeGuardar || motivoSinFacturar !== null}
            title={motivoSinFacturar ?? undefined}
          >
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Crear y facturar
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 md:px-6 lg:grid-cols-[1fr_360px]">
        {/* ── Líneas ─────────────────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Productos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Arriba de las líneas: explica por qué "Crear y facturar" está
                  apagado, y con quince productos abajo quedaba a un scroll del
                  botón que apaga. Es también donde lo pone la ficha de la
                  orden, que muestra lo mismo. */}
              <AvisoSinVincular productos={sinVincular} bloquea />

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
                          {/* El nombre no se edita acá. La orden registra
                              **lo que se hizo**, y renombrarlo es una decisión
                              de qué sale impreso: eso se toma al emitir, donde
                              además se puede juntar todo en una sola línea. */}
                          <div className="flex flex-1 flex-wrap items-baseline gap-x-2">
                            <p className="text-sm font-medium">
                              {l.descripcion}
                            </p>
                            {origenDeLinea(l) && (
                              <span className="text-xs text-muted-foreground">
                                {origenDeLinea(l)}
                              </span>
                            )}
                          </div>
                          {!fijada(l) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => quitar(l.uid)}
                              aria-label="Quitar producto"
                            >
                              <Trash2 className="h-4 w-4 text-muted-foreground" />
                            </Button>
                          )}
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
                    // Lo que está en un plan del cliente **sí** se puede
                    // agregar: es un extra sobre lo que el plan cubre, y quien
                    // arma la orden es quien decide si se cobra. Y uno sin
                    // vincular a Contífico también entra: la orden es interna,
                    // y lo que necesita estar allá es lo que sale impreso.
                    options={productos.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                      hint: !p.contificoProductoId
                        ? "No está vinculado con Contífico: al emitir vas a tener que facturarlo con otro producto."
                        : suscritos.includes(p.id)
                          ? `${nombreDelCliente} tiene este producto en una suscripción.`
                          : undefined,
                    }))}
                    placeholder="Buscar producto..."
                    searchable
                    searchPlaceholder="Buscar producto..."
                  />
                </div>
              </div>

              {/* Los totales al pie de las líneas, que es de donde salen. En la
                  columna de al lado obligaban a mirar a otro lado para ver el
                  efecto de lo que se acaba de tipear. */}
              {lineas.length > 0 && (
                <div className="space-y-1.5 border-t pt-4 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="tabular-nums">
                      {money(totales.subtotal)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IVA</span>
                    <span className="tabular-nums">{money(totales.iva)}</span>
                  </div>
                  <div className="flex justify-between border-t pt-1.5 text-base font-bold">
                    <span>Total</span>
                    <span className="tabular-nums">{money(totales.total)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Debajo de los productos porque **es** la forma de cargarlos: se
              marcan las visitas y entra su trabajo entero. Marcar no es una
              etiqueta —la cabecera de la orden sale de la procedencia de las
              líneas—, así que marcar sin traer el trabajo sería una asignación
              que no queda registrada en ningún lado.

              Lista con casillas y no un desplegable: se eligen **varias**, y
              hay que ver de un vistazo cuáles están marcadas. */}
          {clienteId &&
            (visitasPendientes.length > 0 || visitaIds.length > 0) && (
              <SelectorVisitas
                visitas={visitasPendientes}
                marcadas={visitaIds}
                onCambiar={cambiarVisitas}
                fija={bloqueada ? desdeVisita?.id : null}
                deshabilitado={origen === "PLAN"}
                motivoDeshabilitado="Esta orden es de un período de suscripción. El trabajo de una visita va en otra orden."
              />
            )}

          {/* ── Períodos de suscripción por facturar ─────────────── */}
          {clienteId &&
            visitaIds.length === 0 &&
            periodosPendientes.length > 0 && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">
                  Períodos por facturar
                </CardTitle>
                <CardAction>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={agregarTodosLosPeriodos}
                  >
                    Agregar todos
                  </Button>
                </CardAction>
              </CardHeader>
              <CardContent>
                {cargandoPendientes ? (
                  <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Buscando…

        </div>
                ) : (
                  <div className="divide-y">
                    {periodosAgrupados.map((g) => (
                      <div
                        key={g.clave}
                        className={`flex items-center justify-between gap-3 py-2.5 ${
                          chocaConElOrigen(g.muestra) ? "opacity-50" : ""
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium">
                            {fecha(g.muestra.periodoInicio!)} →{" "}
                            {fecha(g.muestra.periodoFin!)}
                          </p>
                          <p className="truncate text-xs text-muted-foreground">
                            {g.productos.join(", ")}
                          </p>
                          {chocaConElOrigen(g.muestra) && (
                            <p className="text-xs text-amber-700">
                              Va en otra orden: esta es de visitas.
                            </p>
                          )}
                        </div>
                        <div className="flex flex-none items-center gap-3">
                          <span className="font-semibold tabular-nums">
                            {money(g.total)}
                          </span>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => agregarPendiente(g.muestra)}
                            disabled={chocaConElOrigen(g.muestra)}
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

        {/* ── Cliente, facturación y notas ───────────────────────── */}
        <div className="space-y-6">
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

          {/* Notas en la columna derecha, con lo demás que describe la orden y
              no lo que se vendió. Entre las líneas y el catálogo interrumpía
              el armado. */}
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                id="notas"
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
