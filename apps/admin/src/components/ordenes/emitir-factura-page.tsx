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
import { money, fecha } from "./formato";
import { CobroDialog, type FacturaCobrable } from "./cobro-dialog";
import { nombreCliente } from "@vivero/shared";

export interface ProductoFacturable {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  contificoProductoId: string | null;
}

interface LineaOrden {
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  ivaTasa: number;
  productoId: string;
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
  descripcion: string;
  detalle: string;
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

/**
 * Emite el documento de una orden.
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
  datosFacturacion,
  backHref,
}: {
  orden: OrdenAEmitir;
  productos: ProductoFacturable[];
  datosFacturacion: DatoFacturacionResumen[];
  backHref: string;
}) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"FACTURA" | "NO_AUTORIZADO">("FACTURA");
  const [descripcion, setDescripcion] = useState(`Orden #${orden.numero}`);
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
      descripcion: l.descripcion,
      detalle: "",
      cantidad: String(l.cantidad),
      precioUnitario: String(l.precioUnitario),
      ivaTasa: String(l.ivaTasa),
    }))
  );

  const porId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
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
        descripcion: p.nombre,
        detalle: "",
        cantidad: "1",
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

  const ordenTieneIva = orden.lineas.some((l) => l.ivaTasa > 0);
  const sinVincular = lineas.filter(
    (l) => !porId.get(l.productoId)?.contificoProductoId
  );
  const sinPrecio = lineas.some(
    (l) => l.precioUnitario.trim() === "" || Number(l.precioUnitario) < 0
  );

  const motivoBloqueo =
    lineas.length === 0
      ? "El documento no tiene líneas."
      : sinPrecio
        ? "Hay una línea sin precio."
        : sinVincular.length > 0
          ? `"${porId.get(sinVincular[0].productoId)?.nombre ?? sinVincular[0].descripcion}" no está vinculado con Contífico. Cambiá esa línea por un producto vinculado.`
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
          tipo,
          datoFacturacionId,
          descripcion,
          lineas: lineas.map((l) => ({
            productoId: l.productoId,
            descripcion: l.descripcion.trim(),
            detalle: l.detalle.trim() || null,
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
              {/* El nombre de cada línea lo pone el producto de Contífico y no
                  se puede pisar: lo verificamos contra el XML firmado. Lo que
                  sí viaja es el detalle, que sale al lado como "Detalle: …". */}
              <p className="text-sm text-muted-foreground">
                Las líneas vienen de la orden. Podés juntarlas en una sola —
                &quot;servicio de mantenimiento&quot;— mientras el documento siga
                cuadrando con ella.
              </p>

              <div className="space-y-3">
                {lineas.map((l) => {
                  const i = importes(l);
                  const producto = porId.get(l.productoId);
                  const vinculado = Boolean(producto?.contificoProductoId);
                  return (
                    <div key={l.uid} className="space-y-2 rounded-md border p-3">
                      <div className="flex items-start gap-2">
                        <div className="flex-1 space-y-2">
                          <div className="space-y-1">
                            <Label className="text-xs">Producto de Contífico *</Label>
                            {/* El producto decide el nombre impreso, así que
                                es lo primero que se elige, no un detalle. */}
                            <CustomSelect
                              value={l.productoId}
                              onChange={(id) => {
                                const p = porId.get(id);
                                actualizar(l.uid, {
                                  productoId: id,
                                  descripcion: p?.nombre ?? l.descripcion,
                                });
                              }}
                              options={productos.map((p) => ({
                                value: p.id,
                                label: p.nombre,
                                disabled: !p.contificoProductoId,
                                hint: !p.contificoProductoId
                                  ? "No está vinculado con Contífico: no puede salir impreso."
                                  : undefined,
                              }))}
                              placeholder="Elegir producto..."
                              searchable
                              searchPlaceholder="Buscar producto..."
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">
                              Detalle (sale al lado del nombre)
                            </Label>
                            <Input
                              value={l.detalle}
                              onChange={(e) =>
                                actualizar(l.uid, { detalle: e.target.value })
                              }
                              placeholder="Ej: ÁREAS VERDES"
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

                      {!vinculado && (
                        <p className="flex items-center gap-1.5 text-xs text-amber-700">
                          <TriangleAlert className="h-3.5 w-3.5 flex-none" />
                          Este producto no está vinculado con Contífico. Elegí
                          otro para esta línea, o vinculalo desde su ficha.
                        </p>
                      )}

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
                  options={productos.map((p) => ({
                    value: p.id,
                    label: p.nombre,
                    disabled: !p.contificoProductoId,
                    hint: !p.contificoProductoId
                      ? "No está vinculado con Contífico: no puede salir impreso."
                      : undefined,
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
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo *</Label>
                <CustomSelect
                  value={tipo}
                  onChange={(v) => setTipo(v as typeof tipo)}
                  options={[
                    { value: "FACTURA", label: "Factura electrónica" },
                    {
                      value: "NO_AUTORIZADO",
                      // "Consumidor final" es como se lo nombra en el vivero:
                      // el cliente que no pide comprobante. Por debajo es un
                      // `DNA` de Contífico, que **no** es la factura a
                      // consumidor final del SRI —esa es una FAC con trece
                      // nueves—, y por eso la aclaración de abajo dice que no
                      // va al SRI: es lo que evita confundir las dos.
                      label: "Consumidor final",
                      // Contífico rechaza cualquier impuesto en este documento,
                      // así que la orden tiene que ser toda al 0%.
                      disabled: ordenTieneIva,
                      hint: ordenTieneIva
                        ? "La orden tiene IVA y este documento no puede llevarlo."
                        : "Documento interno: no va al SRI y no lleva IVA.",
                    },
                  ]}
                />
                {tipo === "NO_AUTORIZADO" && (
                  <p className="text-xs text-muted-foreground">
                    No se envía al SRI ni genera factura para el cliente. Se
                    cobra y se anula igual que una.
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs" htmlFor="descripcion-documento">
                  Descripción
                </Label>
                <Input
                  id="descripcion-documento"
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Ej: MANTENIMIENTO AGOSTO 2026"
                />
                {/* Es el único texto libre que sale impreso además del detalle
                    de cada línea. */}
                <p className="text-xs text-muted-foreground">
                  Sale en el papel, bajo «Información Adicional».
                </p>
              </div>
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
