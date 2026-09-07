"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import { ArrowLeft, ImageOff } from "lucide-react";
import { MovimientoDialog, type MovimientoFila } from "./movimiento-dialog";
import { PrecioDeLista } from "./precio-de-lista";
import type { ImagenProducto } from "./producto-imagenes";

export interface VarianteDetalle {
  id: string;
  sku: string | null;
  precio: number;
  cobraIva: boolean;
  stock: number;
  manejaInventario: boolean;
  permiteNegativo: boolean;
  imagenId: string | null;
  valores: { opcion: string; valor: string }[];
  producto: {
    id: string;
    nombre: string;
    archivado: boolean;
    /** La tasa del producto: el *cuánto*. Acá solo se decide el *si*. */
    ivaTasa: number | null;
  };
  hermanas: {
    id: string;
    nombre: string;
    sku: string | null;
    stock: number;
    manejaInventario: boolean;
  }[];
}

const MOTIVO_LABEL: Record<string, string> = {
  INGRESO: "Entró mercadería",
  AJUSTE: "Corrección",
  CONTEO: "Conteo",
  VENTA: "Venta",
  DEVOLUCION: "Devolución",
};

/**
 * La ficha de una variante.
 *
 * Existe porque una variante es la unidad real de lo que se vende: tiene su
 * precio, su SKU y su stock, y cargarlos de a seis en una tabla es incómodo. La
 * columna izquierda lista a sus hermanas para poder saltar de una a otra sin
 * volver al producto — que es lo que se hace al cargar precios o al contar el
 * estante.
 */
export function VarianteDetail({
  variante: inicial,
  imagenes,
  movimientos,
  backHref,
}: {
  variante: VarianteDetalle;
  imagenes: ImagenProducto[];
  movimientos: MovimientoFila[];
  backHref: string;
}) {
  const router = useRouter();
  const [variante, setVariante] = useState(inicial);
  const [ajustando, setAjustando] = useState(false);

  const nombre =
    variante.valores.map((v) => v.valor).join(" · ") || variante.producto.nombre;

  const guardar = async (patch: Partial<VarianteDetalle>) => {
    const previa = variante;
    setVariante({ ...variante, ...patch });
    try {
      const res = await fetch(`/api/variantes/${variante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      router.refresh();
    } catch (e) {
      setVariante(previa);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
  };

  const foto =
    imagenes.find((i) => i.id === variante.imagenId) ?? imagenes[0] ?? null;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold tracking-tight">{nombre}</h1>
          <p className="truncate text-muted-foreground">
            <Link href={backHref} className="hover:underline">
              {variante.producto.nombre}
            </Link>
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[280px_1fr]">
        {/* Las hermanas, para saltar de una a otra sin volver al producto: es
            lo que se hace cargando precios o contando el estante. */}
        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-sm">
              {variante.hermanas.length}{" "}
              {variante.hermanas.length === 1 ? "variante" : "variantes"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <ul className="divide-y">
              {variante.hermanas.map((h) => {
                const actual = h.id === variante.id;
                return (
                  <li key={h.id}>
                    <Link
                      href={`/dashboard/productos/${variante.producto.id}/variantes/${h.id}`}
                      className={`flex items-center gap-3 px-3 py-2.5 text-sm ${
                        actual ? "bg-muted font-medium" : "hover:bg-muted/50"
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate">{h.nombre}</span>
                        {h.sku && (
                          <span className="block truncate font-mono text-xs text-muted-foreground">
                            {h.sku}
                          </span>
                        )}
                      </span>
                      <span className="flex-none text-xs tabular-nums text-muted-foreground">
                        {h.manejaInventario ? h.stock : "—"}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardContent className="flex items-start gap-4">
              {/* La foto de la variante: la que eligió, o la principal del
                  producto si no eligió ninguna. */}
              <div className="relative h-20 w-20 flex-none overflow-hidden rounded-md border bg-muted">
                {foto ? (
                  <Image
                    src={foto.url}
                    alt=""
                    fill
                    sizes="80px"
                    className="object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-5 w-5" />
                  </span>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                {variante.valores.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Este producto no tiene opciones, así que tiene una sola
                    variante.
                  </p>
                ) : (
                  <dl className="grid gap-2 sm:grid-cols-2">
                    {variante.valores.map((v) => (
                      <div key={v.opcion}>
                        <dt className="text-xs text-muted-foreground">
                          {v.opcion}
                        </dt>
                        <dd className="text-sm font-medium">{v.valor}</dd>
                      </div>
                    ))}
                  </dl>
                )}
                {/* Los valores no se editan desde acá: cambiarlos en una sola
                    variante rompería la grilla —cada combinación tiene que
                    existir exactamente una vez— así que se editan en las
                    opciones del producto, que las regenera todas juntas. */}
                {variante.valores.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Los valores se cambian en las opciones del producto.
                  </p>
                )}
                {imagenes.length > 0 && (
                  <div className="w-48 space-y-1">
                    <Label className="text-xs">Foto</Label>
                    <CustomSelect
                      value={variante.imagenId ?? ""}
                      onChange={(id) => guardar({ imagenId: id || null })}
                      options={[
                        { value: "", label: "La principal" },
                        ...imagenes.map((img, i) => ({
                          value: img.id,
                          label: `Foto ${i + 1}`,
                        })),
                      ]}
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Precio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <PrecioDeLista
                precio={variante.precio}
                onGuardar={(precio) => guardar({ precio })}
              />

              {/* El *si*, acá; el *cuánto* es del producto: la tasa es del bien
                  y no de su color. Existe por variante porque hay bienes cuyo
                  gravamen depende de la presentación. */}
              <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span>
                  Cobrar IVA
                  <span className="block text-xs text-muted-foreground">
                    {variante.producto.ivaTasa
                      ? `Al ${variante.producto.ivaTasa}%, la tasa del producto.`
                      : "El producto no tiene tasa cargada, así que se propone 0%."}
                  </span>
                </span>
                <Switch
                  checked={variante.cobraIva}
                  onCheckedChange={(on) => guardar({ cobraIva: on })}
                />
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Inventario</CardTitle>
              <CardAction>
                <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                  Se cuenta
                  <Switch
                    checked={variante.manejaInventario}
                    onCheckedChange={(on) => guardar({ manejaInventario: on })}
                  />
                </label>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {variante.manejaInventario ? (
                <>
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">Disponible</p>
                      <p
                        className={`text-3xl font-semibold tabular-nums ${
                          variante.stock <= 0 ? "text-amber-700" : ""
                        }`}
                      >
                        {variante.stock}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAjustando(true)}
                    >
                      Ajustar
                    </Button>
                  </div>

                  <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                    <span>
                      Vender sin stock
                      <span className="block text-xs text-muted-foreground">
                        Contra pedido: deja que la cantidad quede en negativo.
                      </span>
                    </span>
                    <Switch
                      checked={variante.permiteNegativo}
                      onCheckedChange={(on) => guardar({ permiteNegativo: on })}
                    />
                  </label>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Esta variante no lleva conteo de stock: se puede vender
                  siempre.
                </p>
              )}

              <div className="space-y-1.5 border-t pt-3">
                <Label className="text-xs" htmlFor="sku">
                  SKU
                </Label>
                <Input
                  id="sku"
                  defaultValue={variante.sku ?? ""}
                  placeholder="—"
                  className="font-mono text-sm"
                  onBlur={(e) => {
                    const sku = e.target.value.trim() || null;
                    if (sku !== variante.sku) guardar({ sku });
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  Sale impreso en la factura y es lo que va en la etiqueta.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* El libro, entero y a la vista: es lo que contesta por qué el
              número es el que es, y en su propia pantalla nadie lo miraría. */}
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Movimientos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {movimientos.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Todavía no se movió el stock de esta variante.
                </p>
              ) : (
                <ul className="divide-y">
                  {movimientos.map((m) => (
                    <li
                      key={m.id}
                      className="flex items-baseline justify-between gap-4 px-4 py-2.5 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="font-medium">
                          {MOTIVO_LABEL[m.motivo] ?? m.motivo}
                        </span>
                        {m.nota && (
                          <span className="text-muted-foreground"> · {m.nota}</span>
                        )}
                        <span className="block text-xs text-muted-foreground">
                          {fechaLarga(m.createdAt)}
                          {m.createdByNombre ? ` · ${m.createdByNombre}` : ""}
                        </span>
                      </span>
                      <span className="flex-none tabular-nums">
                        <span
                          className={
                            m.cantidad > 0 ? "text-primary" : "text-amber-700"
                          }
                        >
                          {m.cantidad > 0 ? "+" : ""}
                          {m.cantidad}
                        </span>
                        <span className="ml-2 text-muted-foreground">
                          → {m.saldo}
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {ajustando && (
        <MovimientoDialog
          varianteId={variante.id}
          nombre={nombre}
          stock={variante.stock}
          permiteNegativo={variante.permiteNegativo}
          onCerrar={() => setAjustando(false)}
          onHecho={(stock) => {
            setVariante({ ...variante, stock });
            setAjustando(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function fechaLarga(iso: string): string {
  return new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
