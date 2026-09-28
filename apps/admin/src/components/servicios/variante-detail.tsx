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
import { ArrowLeft, ImagePlus } from "lucide-react";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { PopoverStock } from "./popover-stock";
import { PrecioDeLista } from "./precio-de-lista";
import { CostoPorUnidad, GananciaDeVenta } from "./costo-por-unidad";
import { PesoDeVariante } from "./peso-de-variante";
import { SelectorFotoDeVariante } from "./selector-foto-de-variante";
import type { MediaItem } from "./media-library";
import {
  stockProyectado,
  type MovimientoPendiente,
} from "./producto-variantes";
import type { TipoProducto, UnidadPeso } from "@vivero/shared";
import type { ImagenProducto } from "./producto-imagenes";

export interface MovimientoFila {
  id: string;
  cantidad: number;
  saldo: number;
  motivo: string;
  nota: string | null;
  createdAt: string;
  createdByNombre: string | null;
}

export interface VarianteDetalle {
  id: string;
  sku: string | null;
  precio: number;
  cobraIva: boolean;
  /** Costo por unidad. Nulo es "no se sabe". Solo un bien. */
  costo: number | null;
  /** Cuánto pesa una unidad, en `pesoUnidad`. Solo un bien. */
  peso: number | null;
  pesoUnidad: UnidadPeso;
  stock: number;
  manejaInventario: boolean;
  permiteNegativo: boolean;
  imagenId: string | null;
  valores: { opcion: string; valor: string }[];
  producto: {
    id: string;
    nombre: string;
    /** Costo y peso son de un bien; la ficha de un servicio no los ofrece. */
    tipo: TipoProducto;
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

/**
 * Lo que la ficha edita. El stock no está: se mueve por el libro, como un
 * movimiento pendiente aparte. El SKU va como texto —lo que hay en el
 * campo— y se manda como `null` cuando queda vacío.
 */
interface Editable {
  sku: string;
  precio: number;
  cobraIva: boolean;
  costo: number | null;
  peso: number | null;
  pesoUnidad: UnidadPeso;
  manejaInventario: boolean;
  permiteNegativo: boolean;
  imagenId: string | null;
}

function editable(v: VarianteDetalle): Editable {
  return {
    sku: v.sku ?? "",
    precio: v.precio,
    cobraIva: v.cobraIva,
    costo: v.costo,
    peso: v.peso,
    pesoUnidad: v.pesoUnidad,
    manejaInventario: v.manejaInventario,
    permiteNegativo: v.permiteNegativo,
    imagenId: v.imagenId,
  };
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
 *
 * **Se guarda desde la barra del header**, como la ficha del producto: lo que
 * se toca queda pendiente y sale junto con *Guardar*, o vuelve atrás con
 * *Descartar*. Guardaba cada campo al salir de él, sin decir nada, y quien
 * escribía un costo se quedaba buscando el botón para confirmarlo. El stock
 * también espera: el popover deja un **movimiento** pendiente y el número
 * muestra en cuánto va a quedar, en ámbar, como en la tabla de variantes.
 */
export function VarianteDetail({
  variante,
  imagenes: imagenesIniciales,
  movimientos,
  backHref,
}: {
  variante: VarianteDetalle;
  imagenes: ImagenProducto[];
  movimientos: MovimientoFila[];
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  /**
   * La galería del producto, en estado: subir una foto desde el diálogo la
   * agrega al producto en el acto, y la miniatura tiene que mostrarla sin
   * esperar al refresh.
   */
  const [imagenes, setImagenes] = useState(imagenesIniciales);
  const [eligiendoFoto, setEligiendoFoto] = useState(false);

  const guardado = editable(variante);
  const [form, setForm] = useState(guardado);
  const [movimiento, setMovimiento] = useState<MovimientoPendiente | null>(null);

  /**
   * Re-sincroniza cuando el servidor manda otra cosa (después de guardar, el
   * `refresh` trae la variante de nuevo). Se compara por forma y se resetea en
   * el render, que es lo que React recomienda para derivar estado de props.
   */
  const [ultimo, setUltimo] = useState(() => JSON.stringify(guardado));
  const actual = JSON.stringify(guardado);
  if (actual !== ultimo) {
    setUltimo(actual);
    setForm(guardado);
    setMovimiento(null);
    setImagenes(imagenesIniciales);
  }

  /**
   * Lo que salió del diálogo, como fila del producto. Un archivo que ya es
   * foto del producto tiene su fila; uno que no, se le suma en el acto —acá
   * no hay galería pendiente— y se usa la fila que el servidor le dio.
   */
  const elegirFoto = async (media: MediaItem | null) => {
    setEligiendoFoto(false);
    if (media === null) {
      setForm((f) => ({ ...f, imagenId: null }));
      return;
    }
    const enElProducto = imagenes.find((i) => i.mediaId === media.id);
    if (enElProducto) {
      setForm((f) => ({ ...f, imagenId: enElProducto.id }));
      return;
    }
    try {
      const res = await fetch(`/api/servicios/${variante.producto.id}/imagenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mediaIds: [media.id] }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "No pudimos agregar la foto");
      const galeria = body.imagenes as ImagenProducto[];
      setImagenes(galeria);
      const fila = galeria.find((i) => i.mediaId === media.id);
      if (fila) setForm((f) => ({ ...f, imagenId: fila.id }));
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos agregar la foto");
    }
  };

  const campos = Object.keys(form) as (keyof Editable)[];
  const cambiados = campos.filter((k) => form[k] !== guardado[k]);
  const hayCambios = cambiados.length > 0 || movimiento !== null;

  const guardar = async () => {
    setGuardando(true);
    try {
      if (cambiados.length > 0) {
        const patch: Record<string, unknown> = {};
        for (const k of cambiados) patch[k] = form[k];
        // Vacío es "sin SKU", no cadena vacía: el índice único no admite dos
        // cadenas vacías, y "sin código" es un estado válido.
        if (patch.sku !== undefined) patch.sku = form.sku.trim() || null;
        const res = await fetch(`/api/variantes/${variante.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        if (!res.ok) {
          throw new Error((await res.json()).error ?? "No pudimos guardar");
        }
      }
      // El stock va por el libro, con su motivo: nunca escribiéndole encima.
      if (movimiento) {
        const res = await fetch(`/api/variantes/${variante.id}/movimientos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            movimiento.motivo === "CONTEO"
              ? { motivo: movimiento.motivo, contado: movimiento.valor, nota: movimiento.nota }
              : {
                  motivo: movimiento.motivo,
                  cantidad:
                    movimiento.motivo === "INGRESO"
                      ? Math.abs(movimiento.valor)
                      : movimiento.valor,
                  nota: movimiento.nota,
                }
          ),
        });
        if (!res.ok) {
          throw new Error((await res.json()).error ?? "Error con el stock");
        }
      }
      toast.success("Variante actualizada");
      // El servidor es el que dice qué quedó: el refresh trae la variante de
      // nuevo y `guardado` vuelve a coincidir con el formulario.
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  // La barra de guardar vive en el header, en lugar del buscador.
  useRegistrarCambios(hayCambios, guardando, guardar, () => {
    setForm(guardado);
    setMovimiento(null);
  });

  const nombre =
    variante.valores.map((v) => v.valor).join(" · ") || variante.producto.nombre;

  const foto =
    imagenes.find((i) => i.id === form.imagenId) ?? imagenes[0] ?? null;
  const esBien = variante.producto.tipo === "BIEN";

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
                  producto si no eligió ninguna. Se toca para elegirla, como
                  el + de Shopify. */}
              <button
                type="button"
                onClick={() => setEligiendoFoto(true)}
                aria-label="Elegir la foto de la variante"
                className="group relative h-20 w-20 flex-none overflow-hidden rounded-md border bg-muted hover:border-primary"
              >
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
                  <span className="flex h-full items-center justify-center text-muted-foreground group-hover:text-primary">
                    <ImagePlus className="h-5 w-5" />
                  </span>
                )}
              </button>
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
                {/* Los valores no se editan desde aquí: cambiarlos en una sola
                    variante rompería la grilla —cada combinación tiene que
                    existir exactamente una vez— así que se editan en las
                    opciones del producto, que las regenera todas juntas. */}
                {variante.valores.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Los valores se cambian en las opciones del producto.
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Toca la foto para elegir cuál de las del producto es la de
                  esta variante.
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Precio</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* El costo al lado del precio, y debajo lo que deja la venta,
                  como en Shopify: la ganancia y el margen se calculan de los
                  dos y no se guardan. Solo en un bien: un servicio no se
                  compra. */}
              {esBien ? (
                <>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <PrecioDeLista
                      precio={form.precio}
                      onCambio={(precio) => setForm({ ...form, precio })}
                    />
                    <CostoPorUnidad
                      costo={form.costo}
                      onCambio={(costo) => setForm({ ...form, costo })}
                    />
                  </div>
                  <GananciaDeVenta precio={form.precio} costo={form.costo} />
                </>
              ) : (
                <PrecioDeLista
                  precio={form.precio}
                  onCambio={(precio) => setForm({ ...form, precio })}
                />
              )}

              {/* El *si*, aquí; el *cuánto* es del producto: la tasa es del bien
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
                  checked={form.cobraIva}
                  onCheckedChange={(on) => setForm({ ...form, cobraIva: on })}
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
                    checked={form.manejaInventario}
                    onCheckedChange={(on) =>
                      setForm({ ...form, manejaInventario: on })
                    }
                  />
                </label>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-4">
              {form.manejaInventario ? (
                <>
                  {/* Con un movimiento pendiente el número es **el que va a
                      quedar**, en ámbar: la pregunta después de escribir
                      "sumar −3" es en cuánto queda, no cuánto se restó. */}
                  <div className="flex items-end justify-between gap-4">
                    <div>
                      <p className="text-xs text-muted-foreground">
                        {movimiento ? "Va a quedar en" : "Disponible"}
                      </p>
                      <p
                        className={`text-3xl font-semibold tabular-nums ${
                          movimiento || variante.stock <= 0 ? "text-amber-700" : ""
                        }`}
                      >
                        {stockProyectado(variante.stock, movimiento ?? undefined)}
                      </p>
                    </div>
                    <PopoverStock
                      stock={variante.stock}
                      permiteNegativo={form.permiteNegativo}
                      pendiente={movimiento ?? undefined}
                      onMover={async (m) => setMovimiento(m)}
                    >
                      <Button type="button" variant="outline">
                        Ajustar
                      </Button>
                    </PopoverStock>
                  </div>

                  <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                    <span>
                      Vender sin stock
                      <span className="block text-xs text-muted-foreground">
                        Contra pedido: deja que la cantidad quede en negativo.
                      </span>
                    </span>
                    <Switch
                      checked={form.permiteNegativo}
                      onCheckedChange={(on) =>
                        setForm({ ...form, permiteNegativo: on })
                      }
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
                  value={form.sku}
                  placeholder="—"
                  className="font-mono text-sm"
                  onChange={(e) => setForm({ ...form, sku: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Sale impreso en la factura y es lo que va en la etiqueta.
                </p>
              </div>

              {/* El peso va con el SKU: es un dato de la mercadería, lo que
                  dice la bolsa. Un servicio no pesa nada. */}
              {esBien && (
                <div className="border-t pt-3">
                  <PesoDeVariante
                    peso={form.peso}
                    unidad={form.pesoUnidad}
                    onCambio={(peso, pesoUnidad) =>
                      setForm({ ...form, peso, pesoUnidad })
                    }
                  />
                </div>
              )}
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

      {eligiendoFoto && (
        <SelectorFotoDeVariante
          imagenes={imagenes}
          imagenId={form.imagenId}
          onListo={(media) => void elegirFoto(media)}
          onCerrar={() => setEligiendoFoto(false)}
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
