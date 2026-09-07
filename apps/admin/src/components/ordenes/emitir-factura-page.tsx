"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  SelectorDatosFacturacion,
  type DatoFacturacionResumen,
} from "@/components/facturacion/selector-datos-facturacion";
import { ArrowLeft, Loader2, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { useCatalogo } from "./use-catalogo";
import { money, fecha } from "./formato";
import { CobroDialog, type FacturaCobrable } from "./cobro-dialog";
import {
  SelectorVariante,
  type VarianteVendible,
} from "@/components/ordenes/selector-variante";
import { nombreCliente } from "@vivero/shared";

export interface ProductoFacturable {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  /** Vacío en un servicio; una sola en un bien sin opciones. */
  variantes: VarianteVendible[];
}

interface LineaOrden {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
  productoId: string;
  varianteId: string | null;
}

export interface OrdenAEmitir {
  id: string;
  numero: number;
  fecha: string;
  subtotal: number;
  iva: number;
  total: number;
  cliente: {
    id: string;
    nombre: string;
    apellido: string | null;
    empresa: string | null;
  };
  lineas: LineaOrden[];
}

/** Una línea del documento mientras se la arma. Los montos van como texto. */
interface LineaDocumento {
  uid: string;
  productoId: string;
  varianteId: string | null;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
}

let contador = 0;

const centavos = (n: number) => Math.round(n * 100) / 100;

function importes(l: LineaDocumento) {
  const subtotal = centavos(
    (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0)
  );
  const iva = centavos((subtotal * (Number(l.ivaTasa) || 0)) / 100);
  return { subtotal, iva, total: centavos(subtotal + iva) };
}

/** Base imponible acumulada por tasa. Es la unidad en la que se compara. */
function basesPorTasa(
  filas: { tasa: number; base: number }[]
): Map<number, number> {
  const m = new Map<number, number>();
  for (const f of filas) m.set(f.tasa, centavos((m.get(f.tasa) ?? 0) + f.base));
  return m;
}

export interface EmisorOpcion {
  id: string;
  ruc: string;
  razonSocial: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  predeterminado: boolean;
}

/**
 * Emite la factura de una orden.
 *
 * **La factura no tiene por qué tener la forma de la orden.** Acá se cobran
 * varios trabajos de un período como una sola línea de "servicio de
 * mantenimiento", que es como se factura el mantenimiento en Ecuador. Por eso
 * las líneas arrancan precargadas una a una desde la orden —el caso común sigue
 * siendo un clic— y agruparlas es una decisión de quien emite.
 *
 * Lo que no se negocia es que **cuadre**: misma base imponible por cada tasa.
 * Que coincida el total no alcanza, porque juntar una línea al 0% con una al
 * 15% cierra el total y miente el IVA. El servidor lo vuelve a validar; acá
 * está para que nadie llegue al botón con un documento que no puede salir.
 */
export function EmitirFacturaPage({
  orden,
  productos,
  hayMasProductos = false,
  datosFacturacion,
  emisores = [],
  backHref,
}: {
  /** Con qué RUC se puede emitir. Sin ninguno no hay factura posible. */
  emisores?: EmisorOpcion[];
  orden: OrdenAEmitir;
  /** La primera tanda del catálogo. El resto llega al buscar o al bajar. */
  productos: ProductoFacturable[];
  hayMasProductos?: boolean;
  datosFacturacion: DatoFacturacionResumen[];
  backHref: string;
}) {
  const router = useRouter();
  const [emisorId, setEmisorId] = useState(
    emisores.find((e) => e.predeterminado)?.id ?? emisores[0]?.id ?? ""
  );
  const emisor = emisores.find((e) => e.id === emisorId) ?? null;
  const [datoFacturacionId, setDatoFacturacionId] = useState<string | null>(
    datosFacturacion.find((d) => d.esPredeterminado)?.id ??
      datosFacturacion[0]?.id ??
      null
  );
  const [emitiendo, setEmitiendo] = useState<null | "solo" | "cobrar">(null);
  const [cobrando, setCobrando] = useState<FacturaCobrable | null>(null);

  const [lineas, setLineas] = useState<LineaDocumento[]>(() =>
    orden.lineas.map((l) => ({
      uid: `linea-${contador++}`,
      productoId: l.productoId,
      varianteId: l.varianteId,
      descripcion: l.descripcion,
      cantidad: String(l.cantidad),
      precioUnitario: String(l.precioUnitario),
      ivaTasa: String(l.ivaTasa),
    }))
  );

  /**
   * El catálogo, de a tandas. Las búsquedas por id van contra **lo conocido**
   * —todo lo que se vio— y no contra la página que muestra el desplegable: una
   * línea ya cargada no puede quedarse sin su producto porque alguien buscó
   * otra cosa.
   */
  const catalogo = useCatalogo(productos, hayMasProductos);
  const porId = useMemo(
    () => new Map(catalogo.conocidos.map((p) => [p.id, p])),
    [catalogo.conocidos]
  );

  const actualizar = (uid: string, patch: Partial<LineaDocumento>) =>
    setLineas((prev) =>
      prev.map((l) => (l.uid === uid ? { ...l, ...patch } : l))
    );

  const quitar = (uid: string) =>
    setLineas((prev) => prev.filter((l) => l.uid !== uid));

  const agregar = (productoId: string) => {
    const p = porId.get(productoId);
    if (!p) return;
    setLineas((prev) => [
      ...prev,
      {
        uid: `linea-${contador++}`,
        productoId: p.id,
        // Con una sola no hay nada que preguntar; con varias, el selector.
        varianteId: p.variantes.length === 1 ? p.variantes[0].id : null,
        descripcion: p.nombre,
        cantidad: "1",
        // **Sin precio de lista acá, a diferencia de la orden.** Una línea del
        // documento existe para repartir lo que la orden ya dice; proponerle
        // un precio de catálogo la haría nacer descuadrada, y el cuadre es lo
        // único que esta pantalla no negocia.
        precioUnitario: "",
        ivaTasa: p.ivaTasa != null ? String(p.ivaTasa) : "0",
      },
    ]);
  };

  const totales = lineas.reduce(
    (acc, l) => {
      const i = importes(l);
      return {
        subtotal: centavos(acc.subtotal + i.subtotal),
        iva: centavos(acc.iva + i.iva),
        total: centavos(acc.total + i.total),
      };
    },
    { subtotal: 0, iva: 0, total: 0 }
  );

  /** En qué tasas el documento y la orden no dicen lo mismo. */
  const descuadres = useMemo(() => {
    const doc = basesPorTasa(
      lineas.map((l) => ({ tasa: Number(l.ivaTasa) || 0, base: importes(l).subtotal }))
    );
    const ord = basesPorTasa(
      orden.lineas.map((l) => ({
        tasa: l.ivaTasa,
        base: centavos(l.cantidad * l.precioUnitario),
      }))
    );
    const filas: { tasa: number; documento: number; orden: number }[] = [];
    for (const tasa of new Set([...doc.keys(), ...ord.keys()])) {
      const a = doc.get(tasa) ?? 0;
      const b = ord.get(tasa) ?? 0;
      if (Math.abs(a - b) > 0.005) filas.push({ tasa, documento: a, orden: b });
    }
    return filas.sort((a, b) => b.tasa - a.tasa);
  }, [lineas, orden.lineas]);

  const sinPrecio = lineas.some(
    (l) => l.precioUnitario.trim() === "" || Number(l.precioUnitario) < 0
  );
  const sinDescripcion = lineas.some((l) => l.descripcion.trim() === "");
  /** Un bien con varias variantes necesita que alguien diga cuál salió. */
  const sinVariante = lineas.some(
    (l) => (porId.get(l.productoId)?.variantes.length ?? 0) > 1 && !l.varianteId
  );

  const motivoBloqueo =
    emisores.length === 0
      ? "No hay ningún emisor configurado."
      : lineas.length === 0
        ? "El documento no tiene líneas."
        : sinDescripcion
          ? "Hay una línea sin descripción."
          : sinVariante
            ? "Hay una línea sin variante elegida."
            : sinPrecio
            ? "Hay una línea sin precio."
            : descuadres.length > 0
              ? "El documento no cuadra con la orden."
              : !datoFacturacionId
                ? "Falta elegir a nombre de quién se emite."
                : null;

  const emitir = async (yCobrar: boolean) => {
    setEmitiendo(yCobrar ? "cobrar" : "solo");
    try {
      const res = await fetch(`/api/ordenes/${orden.id}/facturar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datoFacturacionId,
          emisorId,
          lineas: lineas.map((l) => ({
            productoId: l.productoId,
            varianteId: l.varianteId,
            descripcion: l.descripcion.trim(),
            cantidad: Number(l.cantidad),
            precioUnitario: Number(l.precioUnitario),
            ivaTasa: Number(l.ivaTasa),
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      // La emisión puede fallar sin que falle el pedido: la orden se queda en
      // borrador y el motivo viene acá. Es el estado en el que se arregla.
      if (!body.factura) {
        toast.warning(`No se pudo emitir: ${body.errorFactura}`);
        return;
      }
      toast.success(`${body.factura.numero} emitida`);
      if (yCobrar) {
        setCobrando({
          id: body.factura.facturaId,
          numero: body.factura.numero,
          total: totales.total,
          saldo: totales.total,
        });
        return;
      }
      router.push(`/dashboard/ordenes/${orden.id}`);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setEmitiendo(null);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href={backHref}>
          <Button type="button" variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-2xl font-bold">
            Emitir orden #{orden.numero}
          </h1>
          <p className="truncate text-sm text-muted-foreground">
            {nombreCliente(orden.cliente)} · {fecha(orden.fecha)}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link href={backHref}>
            <Button type="button" variant="outline" disabled={emitiendo !== null}>
              Cancelar
            </Button>
          </Link>
          <Button
            type="button"
            variant="outline"
            onClick={() => emitir(false)}
            disabled={emitiendo !== null || motivoBloqueo !== null}
            title={motivoBloqueo ?? undefined}
          >
            {emitiendo === "solo" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Emitir
          </Button>
          <Button
            type="button"
            onClick={() => emitir(true)}
            disabled={emitiendo !== null || motivoBloqueo !== null}
            title={motivoBloqueo ?? undefined}
          >
            {emitiendo === "cobrar" && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            Emitir y cobrar
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 md:px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Qué se imprime</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Las líneas vienen de la orden. Podés juntarlas en una sola —
                &quot;servicio de mantenimiento&quot;— mientras el documento siga
                cuadrando con ella.
              </p>

              <div className="space-y-3">
                {lineas.map((l) => {
                  const i = importes(l);
                  return (
                    <div key={l.uid} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">
                              Descripción (sale impresa) *
                            </Label>
                            {/* Es lo que va al XML tal cual: el nombre lo
                                decidimos nosotros, no un catálogo ajeno. */}
                            <Input
                              value={l.descripcion}
                              onChange={(e) =>
                                actualizar(l.uid, { descripcion: e.target.value })
                              }
                              placeholder="Ej: SERVICIO DE MANTENIMIENTO"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Producto *</Label>
                            {/* Es de dónde sale el `codigoPrincipal` de la
                                línea, y con qué queda asociada la venta. */}
                            <CustomSelect
                              value={l.productoId}
                              onChange={(id) => {
                                const p = porId.get(id);
                                actualizar(l.uid, {
                                  productoId: id,
                                  descripcion: p?.nombre ?? l.descripcion,
                                  varianteId:
                                    p?.variantes.length === 1
                                      ? p.variantes[0].id
                                      : null,
                                });
                              }}
                              onBuscar={catalogo.onBuscar}
                              onMas={catalogo.onMas}
                              hayMas={catalogo.hayMas}
                              cargando={catalogo.cargando}
                              options={catalogo.pagina.map((p) => ({
                                value: p.id,
                                label: p.nombre,
                              }))}
                              placeholder="Elegir producto..."
                              searchable
                              searchPlaceholder="Buscar producto..."
                            />
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => quitar(l.uid)}
                          aria-label="Quitar línea"
                        >
                          <Trash2 className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </div>

                      <div className="flex flex-wrap items-end gap-3">
                        {/* De la variante sale el SKU que se imprime y el
                            stock que baja al autorizar. */}
                        <SelectorVariante
                          variantes={porId.get(l.productoId)?.variantes ?? []}
                          value={l.varianteId}
                          onChange={(varianteId) =>
                            actualizar(l.uid, { varianteId })
                          }
                        />
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
                          <p className="text-xs text-muted-foreground">Total</p>
                          <p className="font-semibold tabular-nums">
                            {money(i.total)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-1 border-t pt-3">
                <Label className="text-xs">Agregar línea</Label>
                <CustomSelect
                  value=""
                  onChange={agregar}
                  options={catalogo.pagina.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                  }))}
                  placeholder="Buscar producto..."
                  searchable
                  searchPlaceholder="Buscar producto..."
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6 lg:sticky lg:top-24">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Documento</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {emisores.length === 0 ? (
                <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-snug text-amber-900">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
                  <span>
                    No hay ningún emisor configurado.{" "}
                    <Link
                      href="/dashboard/configuracion/emisores"
                      className="font-medium underline underline-offset-2"
                    >
                      Configurá uno
                    </Link>{" "}
                    con su RUC y su firma electrónica para poder facturar.
                  </span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-xs">Emitir con *</Label>
                  {/* Se puede facturar con más de un RUC, y cuál se usa se
                      decide aquí y no en una configuración global. */}
                  <CustomSelect
                    value={emisorId}
                    onChange={setEmisorId}
                    options={emisores.map((e) => ({
                      value: e.id,
                      label: `${e.razonSocial} · ${e.ruc}`,
                      hint:
                        e.ambiente === "PRUEBAS"
                          ? "Ambiente de pruebas: no es un comprobante válido."
                          : undefined,
                    }))}
                  />
                  {/* Lo emitido en pruebas se ve igual que lo real en el
                      portal, así que hay que decirlo fuerte y aquí.

                      El texto va dentro de un `span`: en un contenedor flex
                      cada hijo es un ítem, así que un `<b>` suelto se plantaba
                      en su propio renglón en vez de seguir la frase. */}
                  {emisor?.ambiente === "PRUEBAS" && (
                    <div className="flex items-start gap-1.5 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs leading-snug text-amber-900">
                      <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
                      <span>
                        Este emisor está en el ambiente de <b>pruebas</b> del
                        SRI: la factura se va a autorizar, pero no vale como
                        comprobante ni le sirve al cliente.
                      </span>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Datos de facturación</CardTitle>
            </CardHeader>
            <CardContent>
              <SelectorDatosFacturacion
                clienteId={orden.cliente.id}
                value={datoFacturacionId}
                onChange={setDatoFacturacionId}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cuadre</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Orden</span>
                <span className="tabular-nums">{money(orden.total)}</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Documento</span>
                <span className="tabular-nums">{money(totales.total)}</span>
              </div>

              {descuadres.length === 0 ? (
                <p className="border-t pt-2 text-xs text-muted-foreground">
                  Coinciden, base por base.
                </p>
              ) : (
                <div className="space-y-1 border-t pt-2">
                  <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                    <TriangleAlert className="h-3.5 w-3.5 flex-none" />
                    No cuadra con la orden
                  </p>
                  {/* Por tasa y no solo por total: juntar una línea al 0% con
                      una al 15% cierra el total y miente el IVA. */}
                  {descuadres.map((d) => (
                    <p key={d.tasa} className="text-xs text-muted-foreground">
                      Al {d.tasa}%: documento {money(d.documento)} · orden{" "}
                      {money(d.orden)}
                    </p>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Emitir y cobrar es un solo movimiento para quien cobra, pero por debajo
          son dos: el cobro se registra contra el documento que acaba de nacer. */}
      <CobroDialog
        factura={cobrando}
        onClose={() => {
          setCobrando(null);
          router.push(`/dashboard/ordenes/${orden.id}`);
          router.refresh();
        }}
      />
    </div>
  );
}
