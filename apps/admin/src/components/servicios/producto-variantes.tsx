"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAca } from "@/lib/filtros-url";
import { PopoverStock } from "./popover-stock";
import { money } from "@/components/ordenes/formato";
import type { ImagenProducto } from "./producto-imagenes";

/** Cuántos ejes admite un producto. El servicio aplica el mismo tope. */
const MAX_OPCIONES = 3;

/**
 * Con qué nace una combinación que el servidor todavía no creó.
 *
 * El SKU va acá igual que el precio y el stock: son los tres datos de la
 * variante, y separarlos obligaba a crear las seis combinaciones, entrar a cada
 * una y ponerle un código que ya se sabía al armarlas.
 */
export interface VariantePendiente {
  sku: string;
  precio: number;
  stock: number;
}

/** Lo que trae una combinación sin nada cargado. */
export function vacia(p?: VariantePendiente): VariantePendiente {
  return { sku: p?.sku ?? "", precio: p?.precio ?? 0, stock: p?.stock ?? 0 };
}

export interface OpcionEditable {
  id: string | null;
  nombre: string;
  valores: { id: string | null; valor: string }[];
}

export interface MovimientoPendiente {
  motivo: "CONTEO" | "AJUSTE" | "INGRESO";
  valor: number;
  nota: string | null;
}

/**
 * En cuánto queda el stock si se guarda el movimiento pendiente.
 *
 * Es lo que muestra la fila: la pregunta que alguien se hace después de escribir
 * "sumar −3" es "¿en cuánto queda?", no "¿cuánto resté?".
 */
export function stockProyectado(
  stock: number,
  m: MovimientoPendiente | undefined
): number {
  if (!m) return stock;
  if (m.motivo === "CONTEO") return m.valor;
  if (m.motivo === "INGRESO") return stock + Math.abs(m.valor);
  return stock + m.valor;
}

export interface VarianteFila {
  id: string;
  sku: string | null;
  /** Precio de lista. Cero es gratis; lo cobrado vive en la orden. */
  precio: number;
  /** Si se le cobra IVA. La tasa sale del producto. */
  cobraIva: boolean;
  manejaInventario: boolean;
  stock: number;
  permiteNegativo: boolean;
  imagenId: string | null;
  valores: { valorId: string; opcion: string; valor: string }[];
}

/**
 * Cómo se lee un precio. **Cero es gratis**, y decirlo con la palabra en vez de
 * "$0.00" es lo que hace que salte a la vista: casi siempre significa que
 * todavía nadie le puso precio.
 */
function precioTexto(precio: number): string {
  return precio === 0 ? "Gratis" : money(precio);
}

/**
 * El precio de un grupo: uno solo, o el rango que va del más barato al más caro.
 *
 * Es lo que Shopify muestra en la fila del grupo, y es la única respuesta
 * honesta cuando las 19 variantes de abajo no valen lo mismo.
 */
function rangoDePrecios(filas: VarianteFila[]): string {
  if (filas.length === 0) return "—";
  const min = Math.min(...filas.map((v) => v.precio));
  const max = Math.max(...filas.map((v) => v.precio));
  return min === max ? precioTexto(min) : `${money(min)} – ${money(max)}`;
}

/**
 * Una fila de la lista: una combinación de valores.
 *
 * `variante` es `null` en las que **todavía no existen** — las que el servidor
 * va a crear al guardar. Se muestran igual, porque la pregunta que alguien se
 * hace al agregar un eje es "¿en qué queda esto?", y contestarla recién después
 * de guardar obliga a guardar para averiguarlo.
 */
interface FilaPreview {
  clave: string;
  valores: { opcion: string; valor: string }[];
  variante: VarianteFila | null;
}

/**
 * Todas las combinaciones de los ejes, casadas con las variantes que ya hay.
 *
 * El cruce es **por id de valor** y no por su texto: renombrar "Rojo" a "Rojo
 * intenso" tiene que dejar la misma variante en su lugar, no marcarla como
 * nueva. Un valor recién tipeado no tiene id, así que su combinación es nueva
 * por definición.
 */
function combinar(
  opciones: OpcionEditable[],
  variantes: VarianteFila[]
): FilaPreview[] {
  if (opciones.length === 0) {
    return variantes.map((v) => ({ clave: v.id, valores: [], variante: v }));
  }

  const ejes = opciones
    .filter((o) => o.valores.length > 0)
    .map((o) => ({
      nombre: o.nombre,
      valores: o.valores.filter((v) => v.valor.trim() !== ""),
    }))
    .filter((o) => o.valores.length > 0);
  if (ejes.length === 0) return [];

  const combos = ejes.reduce<{ id: string | null; opcion: string; valor: string }[][]>(
    (acc, eje) =>
      acc.flatMap((previa) =>
        eje.valores.map((v) => [
          ...previa,
          { id: v.id, opcion: eje.nombre, valor: v.valor },
        ])
      ),
    [[]]
  );

  /** Las que hay, indexadas por el conjunto de ids de sus valores. */
  const porIds = new Map(
    variantes.map((v) => [
      [...v.valores.map((x) => x.valorId)].sort().join("|"),
      v,
    ])
  );

  return combos.map((combo) => {
    const ids = combo.map((c) => c.id);
    const clave = ids.every((id) => id !== null)
      ? [...(ids as string[])].sort().join("|")
      : null;
    return {
      clave: combo.map((c) => `${c.opcion}=${c.valor}`).join(" · "),
      valores: combo.map((c) => ({ opcion: c.opcion, valor: c.valor })),
      variante: (clave && porIds.get(clave)) || null,
    };
  });
}

/**
 * La clave de una combinación: sus valores unidos, en el orden de los ejes.
 *
 * Es lo único que la pantalla tiene antes de guardar —los ids recién existen
 * después— y alcanza porque dentro de un producto los valores de un eje son
 * únicos.
 */
function nombreDeFila(f: FilaPreview): string {
  return f.valores.map((v) => v.valor).join(" · ");
}

/** Cómo se lee una variante: "Rojo · Grande", o el producto si no tiene ejes. */
export function nombreVariante(
  v: { valores: { valor: string }[] },
  productoNombre: string
): string {
  return v.valores.length === 0
    ? productoNombre
    : v.valores.map((x) => x.valor).join(" · ");
}

/**
 * Opciones y variantes de un bien.
 *
 * El modelo es el de Shopify: se definen **ejes** (Color, Tamaño) con sus
 * valores, y de ahí sale una variante por cada combinación. Con 3 colores y 2
 * tamaños hay seis, y cada una es lo que se cuenta y lo que lleva su SKU.
 *
 * **Sin opciones esta card solo ofrece agregarlas.** El bien tiene una variante
 * igual —la única— pero su stock se muestra en la card de Inventario, donde
 * quien mira lo espera: una tabla de una fila para decir "hay 12" es una tabla
 * de más.
 */
export function ProductoVariantes({
  productoId,
  productoNombre,
  opciones,
  onOpcionesChange,
  nuevas,
  onNuevasChange,
  precios,
  onPreciosChange,
  skus,
  onSkusChange,
  movimientos,
  onMovimientosChange,
  variantes: variantesIniciales,
  imagenes,
}: {
  /**
   * Nulo mientras el producto no existe.
   *
   * En el alta este editor arma las opciones y lo que cada combinación va a
   * traer puesto, todo en estado: no hay variantes guardadas, así que tampoco
   * hay ficha a la que enlazar. El servidor las genera al guardar.
   */
  productoId: string | null;
  productoNombre: string;
  /**
   * Las opciones **del formulario**, no las guardadas: editarlas es un cambio
   * del producto como cualquier otro, y se guarda con la barra del header.
   */
  opciones: OpcionEditable[];
  onOpcionesChange: (o: OpcionEditable[]) => void;
  /**
   * El precio y el stock con los que van a nacer las combinaciones nuevas, por
   * su nombre. Se aplican al guardar, cuando el servidor ya les dio un id.
   */
  nuevas: Record<string, VariantePendiente>;
  onNuevasChange: (n: Record<string, VariantePendiente>) => void;
  /** Precios cambiados y todavía sin guardar, por variante. */
  precios: Record<string, number>;
  onPreciosChange: (p: Record<string, number>) => void;
  /** SKU cambiados y todavía sin guardar, por variante. */
  skus: Record<string, string>;
  onSkusChange: (s: Record<string, string>) => void;
  /** Movimientos de stock sin guardar, uno por variante. */
  movimientos: Record<string, MovimientoPendiente>;
  onMovimientosChange: (m: Record<string, MovimientoPendiente>) => void;
  variantes: VarianteFila[];
  imagenes: ImagenProducto[];
}) {
  /** Qué opción está desplegada. `null` = todas plegadas. */
  const [abierta, setAbierta] = useState<number | null>(null);
  /** Por qué eje se agrupa. Solo con dos o más: con uno no hay nada que juntar. */
  const [agruparPor, setAgruparPor] = useState(0);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());
  // Las variantes vienen del servidor y ya no se tocan desde acá: lo que se
  // escribe queda pendiente en el formulario hasta que alguien guarda.
  const variantes = variantesIniciales;

  const hayEjes = opciones.length > 0;

  /**
   * Las combinaciones que van a existir, con las que ya existen adentro.
   *
   * Sale de las **opciones del formulario**, así que agregar un eje muestra el
   * resultado antes de guardar: la pregunta al tocar esto es "¿en qué queda?",
   * y contestarla recién después de guardar obliga a guardar para averiguarlo.
   */
  const filas = useMemo(
    () => combinar(opciones, variantes),
    [opciones, variantes]
  );

  /** Cuántas van a nacer al guardar. */
  const porNacer = filas.filter((f) => f.variante === null).length;

  /** El total, contando solo lo que se cuenta. `null` = nada lleva inventario. */
  const total = useMemo(() => {
    const cuentan = variantes.filter((v) => v.manejaInventario);
    return cuentan.length === 0
      ? null
      : cuentan.reduce((n, v) => n + v.stock, 0);
  }, [variantes]);

  /**
   * Las variantes juntadas por el valor de un eje.
   *
   * Con dos ejes de 3 y 6 valores son dieciocho filas y ninguna se encuentra;
   * agrupadas por el primero son tres, y se abre la que interesa.
   */
  const grupos = useMemo(() => {
    if (opciones.length < 2) return null;
    const eje = opciones[Math.min(agruparPor, opciones.length - 1)]?.nombre;
    const mapa = new Map<string, FilaPreview[]>();
    for (const f of filas) {
      const clave = f.valores.find((x) => x.opcion === eje)?.valor ?? "—";
      mapa.set(clave, [...(mapa.get(clave) ?? []), f]);
    }
    return [...mapa.entries()].map(([valor, filas]) => ({ valor, filas }));
  }, [opciones, agruparPor, filas]);

  const alternar = (clave: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });

  return (
    <>
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Variantes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Los ejes, cada uno plegado a su resumen. Se abre el que se toca y
              se edita **ahí mismo**: un diálogo para cambiar una palabra tapaba
              la lista de variantes, que es justo lo que hay que mirar para
              saber si el cambio es el que se quería. */}
          <div className="divide-y rounded-md border">
            {opciones.map((o, i) =>
              abierta === i ? (
                <EditorOpcion
                  key={`op-${i}`}
                  opcion={o}
                  onChange={(nueva) =>
                    onOpcionesChange(
                      opciones.map((x, j) => (j === i ? nueva : x))
                    )
                  }
                  onListo={() => setAbierta(null)}
                  onBorrar={() => {
                    onOpcionesChange(opciones.filter((_, j) => j !== i));
                    setAbierta(null);
                  }}
                />
              ) : (
                <button
                  key={`op-${i}`}
                  type="button"
                  onClick={() => setAbierta(i)}
                  className="block w-full space-y-1.5 p-3 text-left hover:bg-muted/40"
                >
                  <p className="text-sm font-medium">{o.nombre || "Sin nombre"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.valores.map((v) => (
                      <span
                        key={v.id ?? v.valor}
                        className="rounded bg-muted px-2 py-0.5 text-xs"
                      >
                        {v.valor}
                      </span>
                    ))}
                  </div>
                </button>
              )
            )}

            {opciones.length < MAX_OPCIONES && abierta === null && (
              <button
                type="button"
                onClick={() => {
                  onOpcionesChange([
                    ...opciones,
                    { id: null, nombre: "", valores: [] },
                  ]);
                  setAbierta(opciones.length);
                }}
                className="flex w-full items-center gap-1.5 p-3 text-left text-sm text-primary hover:bg-muted/40"
              >
                <Plus className="h-4 w-4" />
                {hayEjes
                  ? "Agregar otra opción"
                  : "Agregar opciones como color o tamaño"}
              </button>
            )}
          </div>

          {hayEjes && (
            <>

              {grupos && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Agrupar por
                  </Label>
                  <div className="w-40">
                    <CustomSelect
                      value={String(agruparPor)}
                      onChange={(v) => {
                        setAgruparPor(Number(v));
                        setAbiertos(new Set());
                      }}
                      options={opciones.map((o, i) => ({
                        value: String(i),
                        label: o.nombre,
                      }))}
                    />
                  </div>
                </div>
              )}

              <div className="divide-y rounded-md border">
                {/* Un encabezado y no una `<table>`: las filas se pliegan en
                    grupos y sangran, que es lo que una tabla no sabe hacer. */}
                <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className="min-w-0 flex-1">Variante</span>
                  <span className="w-24 flex-none text-right">Precio</span>
                  <span className="w-20 flex-none text-right">Stock</span>
                  <span className="w-7 flex-none" />
                </div>
                {grupos
                  ? grupos.map((g) => {
                      const abierto = abiertos.has(g.valor);
                      const cuentan = g.filas
                        .map((f) => f.variante)
                        .filter((v) => v?.manejaInventario);
                      return (
                        <div key={g.valor}>
                          <button
                            type="button"
                            onClick={() => alternar(g.valor)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                          >
                            {abierto ? (
                              <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {g.valor}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {g.filas.length}{" "}
                                {g.filas.length === 1 ? "variante" : "variantes"}
                              </span>
                            </span>
                            <span className="w-24 flex-none text-right text-sm tabular-nums text-muted-foreground">
                              {rangoDePrecios(
                                g.filas
                                  .map((f) => f.variante)
                                  .filter((v): v is VarianteFila => v !== null)
                              )}
                            </span>
                            <span className="w-20 flex-none text-right text-sm tabular-nums text-muted-foreground">
                              {cuentan.length === 0
                                ? "—"
                                : cuentan.reduce((n, v) => n + (v?.stock ?? 0), 0)}
                            </span>
                            <span className="w-7 flex-none" />
                          </button>
                          {abierto && (
                            <div className="divide-y border-t bg-muted/20">
                              {g.filas.map((f) => (
                                <FilaVariante
                                  key={f.clave}
                                  fila={f}
                                  productoId={productoId}
                                  productoNombre={productoNombre}
                                  imagenes={imagenes}
                                  sangrada
                                  pendiente={nuevas[nombreDeFila(f)]}
                                  onPendiente={(v) =>
                                    onNuevasChange({
                                      ...nuevas,
                                      [nombreDeFila(f)]: v,
                                    })
                                  }
                                  precioPendiente={
                                    f.variante ? precios[f.variante.id] : undefined
                                  }
                                  skuPendiente={
                                    f.variante ? skus[f.variante.id] : undefined
                                  }
                                  movimientoPendiente={
                                    f.variante
                                      ? movimientos[f.variante.id]
                                      : undefined
                                  }
                                  onPrecio={(precio) =>
                                    f.variante &&
                                    onPreciosChange({
                                      ...precios,
                                      [f.variante.id]: precio,
                                    })
                                  }
                                  onSku={(sku) =>
                                    f.variante &&
                                    onSkusChange({
                                      ...skus,
                                      [f.variante.id]: sku,
                                    })
                                  }
                                  onMover={(m) =>
                                    f.variante &&
                                    onMovimientosChange({
                                      ...movimientos,
                                      [f.variante.id]: m,
                                    })
                                  }
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  : filas.map((f) => (
                      <FilaVariante
                        key={f.clave}
                        fila={f}
                        productoId={productoId}
                        productoNombre={productoNombre}
                        imagenes={imagenes}
                        pendiente={nuevas[nombreDeFila(f)]}
                        onPendiente={(v) =>
                          onNuevasChange({ ...nuevas, [nombreDeFila(f)]: v })
                        }
                        precioPendiente={
                          f.variante ? precios[f.variante.id] : undefined
                        }
                        skuPendiente={
                          f.variante ? skus[f.variante.id] : undefined
                        }
                        movimientoPendiente={
                          f.variante ? movimientos[f.variante.id] : undefined
                        }
                        onPrecio={(precio) =>
                          f.variante &&
                          onPreciosChange({ ...precios, [f.variante.id]: precio })
                        }
                        onSku={(sku) =>
                          f.variante &&
                          onSkusChange({ ...skus, [f.variante.id]: sku })
                        }
                        onMover={(m) =>
                          f.variante &&
                          onMovimientosChange({
                            ...movimientos,
                            [f.variante.id]: m,
                          })
                        }
                      />
                    ))}
              </div>

              {/* El total al pie, como en Shopify: es la pregunta que alguien
                  se hace mirando la lista entera. */}
              <p className="text-sm text-muted-foreground">
                {total === null
                  ? "Ninguna de estas variantes lleva inventario."
                  : `Inventario total: ${total} disponible${total === 1 ? "" : "s"}.`}
                {porNacer > 0 &&
                  ` ${porNacer} ${porNacer === 1 ? "variante nueva se crea" : "variantes nuevas se crean"} al guardar.`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

    </>
  );
}

/**
 * Una combinación en la lista: cómo se llama, su SKU y cuánto hay.
 *
 * Si todavía no existe —se agregó un valor y no se guardó— se muestra igual,
 * marcada como **Nueva** y sin campos que tocar: no hay a qué variante
 * mandarle un precio ni un movimiento hasta que el servidor la cree.
 */
function FilaVariante({
  fila,
  productoId,
  productoNombre,
  imagenes,
  sangrada,
  pendiente,
  onPendiente,
  precioPendiente,
  skuPendiente,
  movimientoPendiente,
  onPrecio,
  onSku,
  onMover,
}: {
  fila: FilaPreview;
  productoId: string | null;
  productoNombre: string;
  imagenes: ImagenProducto[];
  sangrada?: boolean;
  /** Con qué SKU, precio y stock nace, si todavía no existe. */
  pendiente?: VariantePendiente;
  onPendiente: (v: VariantePendiente) => void;
  /** Lo escrito sobre una variante que sí existe, todavía sin guardar. */
  precioPendiente?: number;
  skuPendiente?: string;
  movimientoPendiente?: MovimientoPendiente;
  onPrecio: (precio: number) => void;
  onSku: (sku: string) => void;
  onMover: (m: MovimientoPendiente) => void;
}) {
  const from = useAca();
  const variante = fila.variante;
  const nombre = nombreVariante(
    variante ?? { valores: fila.valores },
    productoNombre
  );
  const foto =
    imagenes.find((i) => i.id === variante?.imagenId) ?? imagenes[0] ?? null;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${sangrada ? "pl-10" : ""}`}
    >
      {foto && (
        <div className="relative h-9 w-9 flex-none overflow-hidden rounded border">
          <Image
            src={foto.url}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}

      {variante && productoId ? (
        /* El nombre lleva a la ficha de la variante; el número abre el
           movimiento. Son las dos cosas que se hacen sobre una fila y cada una
           tiene su blanco, en vez de un menú que las esconda a las dos. */
        <span className="min-w-0 flex-1">
          <Link
            href={`/dashboard/productos/${productoId}/variantes/${variante.id}?from=${from}`}
            className="block truncate text-sm font-medium hover:underline"
          >
            {nombre}
          </Link>
          {/* El SKU se escribe acá y no solo en la ficha de la variante: al
              armar una tabla de seis combinaciones, entrar y salir seis veces
              para poner seis códigos es el camino largo del mismo trabajo. */}
          <Input
            value={skuPendiente ?? variante.sku ?? ""}
            aria-label={`SKU de ${nombre}`}
            placeholder="Sin SKU"
            className={`h-6 border-0 bg-transparent px-0 font-mono text-xs shadow-none focus-visible:ring-0 ${
              skuPendiente !== undefined ? "text-amber-700" : "text-muted-foreground"
            }`}
            onChange={(e) => onSku(e.target.value)}
          />
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-sm font-medium">{nombre}</span>
            <span className="flex-none rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
              Nueva
            </span>
          </span>
          <Input
            value={pendiente?.sku ?? ""}
            aria-label={`SKU de ${nombre}`}
            placeholder="Sin SKU"
            className="h-6 border-0 bg-transparent px-0 font-mono text-xs text-muted-foreground shadow-none focus-visible:ring-0"
            onChange={(e) =>
              onPendiente({ ...vacia(pendiente), sku: e.target.value })
            }
          />
        </span>
      )}

      {/* Precio y stock se escriben aquí mismo, pero solo de lo que existe: una
          combinación sin guardar no tiene dónde anotarlos. */}
      {variante ? (
        <>
          <div className="relative w-24 flex-none">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            {/* Lo escrito no se guarda solo: va a la barra del header con el
                resto de la ficha. */}
            <Input
              type="number"
              min="0"
              step="0.01"
              value={precioPendiente ?? variante.precio}
              aria-label={`Precio de ${nombre}`}
              className={`h-8 pl-5 text-right text-sm tabular-nums ${
                precioPendiente !== undefined
                  ? "border-amber-400"
                  : variante.precio === 0
                    ? "text-amber-700"
                    : ""
              }`}
              onChange={(e) => {
                const texto = e.target.value.trim();
                const nuevo = Number(texto);
                if (texto === "" || !Number.isFinite(nuevo) || nuevo < 0) return;
                onPrecio(nuevo);
              }}
            />
          </div>
          {variante.manejaInventario ? (
            <PopoverStock
              stock={variante.stock}
              permiteNegativo={variante.permiteNegativo}
              pendiente={movimientoPendiente}
              onMover={async (m) => onMover(m)}
            >
              {/* El número que se ve es **el que va a quedar**: la pregunta
                  después de escribir "sumar −3" es en cuánto queda, no cuánto
                  se restó. En ámbar mientras no esté guardado. */}
              <button
                type="button"
                aria-label={`Stock de ${nombre}`}
                className={`w-20 flex-none rounded-md border px-2 py-1 text-right text-sm tabular-nums hover:bg-muted ${
                  movimientoPendiente
                    ? "border-amber-400 font-medium text-amber-700"
                    : variante.stock <= 0
                      ? "font-medium text-amber-700"
                      : ""
                }`}
              >
                {stockProyectado(variante.stock, movimientoPendiente)}
              </button>
            </PopoverStock>
          ) : (
            <span
              className="w-20 flex-none text-right text-sm text-muted-foreground"
              title="No lleva conteo de stock"
            >
              —
            </span>
          )}
        </>
      ) : (
        /* Todavía no existe, pero su precio y su stock se pueden dejar
           escritos: se aplican en cuanto el servidor la crea. Lo contrario
           obligaba a guardar, buscarla y volver a entrar para ponerle un
           número que ya se sabía. */
        <>
          <div className="relative w-24 flex-none">
            <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
              $
            </span>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={pendiente?.precio ?? 0}
              aria-label={`Precio de ${nombre}`}
              className="h-8 pl-5 text-right text-sm tabular-nums"
              onChange={(e) =>
                onPendiente({
                  ...vacia(pendiente),
                  precio: Math.max(0, Number(e.target.value) || 0),
                })
              }
            />
          </div>
          <Input
            type="number"
            min="0"
            step="1"
            value={pendiente?.stock ?? 0}
            aria-label={`Stock inicial de ${nombre}`}
            className="h-8 w-20 flex-none text-right text-sm tabular-nums"
            onChange={(e) =>
              onPendiente({
                ...vacia(pendiente),
                stock: Math.max(0, Math.trunc(Number(e.target.value) || 0)),
              })
            }
          />
        </>
      )}
    </div>
  );
}

/**
 * Un eje desplegado: su nombre y sus valores.
 *
 * Se edita **en el lugar**, como en Shopify: un diálogo para cambiar una
 * palabra tapaba la lista de variantes, que es justo lo que hay que mirar para
 * saber si el cambio es el que se quería.
 *
 * *Listo* solo pliega. Lo que se escribe acá es un cambio del producto como
 * cualquier otro y se guarda con la barra del header — un botón que guardara
 * solo esta parte convivía con otro que guarda todo, y nadie sabría cuál de los
 * dos hace falta.
 */
function EditorOpcion({
  opcion,
  onChange,
  onListo,
  onBorrar,
}: {
  opcion: OpcionEditable;
  onChange: (o: OpcionEditable) => void;
  onListo: () => void;
  onBorrar: () => void;
}) {
  /**
   * Los valores más uno vacío al final.
   *
   * Escribir en ese último lo convierte en un valor y abre otro debajo, así que
   * cargar cinco talles es tipear cinco veces. Antes había que confirmar cada
   * uno con Enter, que es un paso que nadie descubre solo.
   */
  const filas = [...opcion.valores, { id: null, valor: "" }];

  const escribir = (k: number, valor: string) => {
    // La fila del final: escribir en ella la convierte en un valor, y el render
    // abre otra debajo. La conversión es **solo acá**: filtrar los vacíos en
    // todas haría que borrar el texto de un valor del medio para reescribirlo
    // lo hiciera desaparecer bajo el cursor.
    if (k === opcion.valores.length) {
      if (valor === "") return;
      onChange({
        ...opcion,
        valores: [...opcion.valores, { id: null, valor }],
      });
      return;
    }
    onChange({
      ...opcion,
      valores: opcion.valores.map((v, j) => (j === k ? { ...v, valor } : v)),
    });
  };

  // Un valor que quedó en blanco no cuenta: el servidor los descarta al
  // guardar, así que decir que está listo sería prometer algo que no queda.
  const listo =
    opcion.nombre.trim() !== "" &&
    opcion.valores.some((v) => v.valor.trim() !== "");

  return (
    <div className="space-y-3 bg-muted/20 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre de la opción</Label>
        <Input
          value={opcion.nombre}
          onChange={(e) => onChange({ ...opcion, nombre: e.target.value })}
          placeholder="Color"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Valores</Label>
        {filas.map((v, k) => {
          const ultima = k === filas.length - 1;
          return (
            <div key={k} className="flex items-center gap-1.5">
              <Input
                value={v.valor}
                onChange={(e) => escribir(k, e.target.value)}
                placeholder={ultima ? "Agregar otro valor" : undefined}
              />
              {/* El campo vacío del final no tiene qué borrar, pero ocupa el
                  lugar del botón: sin eso los inputs bailan de ancho al tipear
                  la primera letra. */}
              {ultima ? (
                <span className="h-8 w-8 flex-none" />
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="flex-none"
                  aria-label={`Sacar ${v.valor}`}
                  onClick={() =>
                    onChange({
                      ...opcion,
                      valores: opcion.valores.filter((_, j) => j !== k),
                    })
                  }
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          onClick={onBorrar}
        >
          Borrar
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={!listo}
          title={listo ? undefined : "La opción necesita un nombre y algún valor."}
          onClick={onListo}
        >
          Listo
        </Button>
      </div>
    </div>
  );
}
