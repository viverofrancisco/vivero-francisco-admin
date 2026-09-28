"use client";

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
import Link from "next/link";
import { PopoverStock } from "./popover-stock";
import { PrecioDeLista } from "./precio-de-lista";
import { CostoPorUnidad, GananciaDeVenta } from "./costo-por-unidad";
import { PesoDeVariante } from "./peso-de-variante";
import {
  stockProyectado,
  type MovimientoPendiente,
  type VarianteFila,
} from "./producto-variantes";

/**
 * Lo que se edita de una variante sin guardar: esta card en la variante
 * única, y la tabla de variantes para la foto de cada fila. El stock no
 * está: se mueve por el libro, como un movimiento pendiente aparte.
 */
export type CambiosDeVariante = Pick<
  VarianteFila,
  | "sku"
  | "precio"
  | "cobraIva"
  | "costo"
  | "peso"
  | "pesoUnidad"
  | "manejaInventario"
  | "permiteNegativo"
  | "imagenId"
>;

/**
 * Lo que se vende, cuando hay **una sola variante**.
 *
 * Con una sola —todo servicio, y un bien sin opciones— preguntar "cuál" no
 * tiene sentido: el precio, el SKU y el stock son del producto a los ojos de
 * quien mira, y esta card los pone donde se los espera. Por debajo siguen
 * siendo de la variante única, así que agregar opciones después no cambia nada
 * del modelo — y ahí esta card desaparece, porque cada combinación tiene lo
 * suyo y eso vive en la tabla de variantes.
 *
 * **Nada de esto se guarda solo.** Lo que se toca acá queda en el formulario
 * de la ficha y sale con la barra del header, como el nombre o las fotos.
 * Guardaba cada campo al salir de él, sin avisar, mientras el resto de la
 * pantalla esperaba a *Guardar*: dos formas de guardar en la misma ficha, y
 * la que no avisa deja a alguien buscando un botón que no existe. El stock
 * sigue pasando por el popover porque lo pendiente ahí no es un número sino
 * un **movimiento**, y la card muestra mientras tanto en cuánto va a quedar.
 *
 * **De un servicio, por ahora, solo el SKU.** No lleva inventario —no hay stock
 * de una poda— y ni el precio de lista ni el IVA se muestran todavía: una poda
 * se cotiza cada vez, así que hoy las dos cosas se deciden en la orden o en la
 * suscripción. Las columnas existen igual en la variante, así que mostrarlas es
 * agregar el bloque, no cambiar el modelo.
 */
export function ProductoInventario({
  variante,
  productoId,
  ivaTasa,
  esBien,
  cambios,
  onCambios,
  movimiento,
  onMovimiento,
}: {
  productoId: string;
  /** Lo **guardado**. Lo pendiente va aparte, en `cambios`. */
  variante: VarianteFila;
  /** La tasa del producto: el *cuánto*. Acá solo se decide el *si*. */
  ivaTasa: number | null;
  /** Un servicio no lleva inventario: se le oculta ese bloque entero. */
  esBien: boolean;
  /** Lo tocado y sin guardar de esta variante. */
  cambios: Partial<CambiosDeVariante>;
  onCambios: (c: Partial<CambiosDeVariante>) => void;
  /** El movimiento de stock sin guardar, si lo hay. Uno solo. */
  movimiento: MovimientoPendiente | undefined;
  onMovimiento: (m: MovimientoPendiente | undefined) => void;
}) {
  /** Lo que se ve: lo guardado con lo pendiente encima. */
  const v = { ...variante, ...cambios };

  /**
   * Anota un cambio, o lo borra si vuelve a lo guardado: escribir 12 y
   * después 12.5 de nuevo no tiene que dejar la barra prendida.
   */
  const poner = <K extends keyof CambiosDeVariante>(
    campo: K,
    valor: CambiosDeVariante[K]
  ) => {
    const siguiente = { ...cambios };
    if (valor === variante[campo]) delete siguiente[campo];
    else siguiente[campo] = valor;
    onCambios(siguiente);
  };

  return (
    <>
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">
            {esBien ? "Precio e inventario" : "SKU"}
          </CardTitle>
          {esBien && (
            <CardAction>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                Se cuenta
                <Switch
                  checked={v.manejaInventario}
                  onCheckedChange={(on) => poner("manejaInventario", on)}
                />
              </label>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!esBien ? null : v.manejaInventario ? (
            <>
              {/* El número grande y clickeable: es el dato que se viene a ver,
                  y tocarlo es lo que se viene a hacer. Con un movimiento
                  pendiente muestra **en cuánto va a quedar**, en ámbar. */}
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
                    {stockProyectado(variante.stock, movimiento)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {/* El libro vive en la ficha de la variante: aquí está el
                      número y cómo moverlo, allá el porqué de cada cambio. */}
                  <Link
                    href={`/dashboard/productos/${productoId}/variantes/${variante.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    Movimientos
                  </Link>
                  <PopoverStock
                    stock={variante.stock}
                    permiteNegativo={v.permiteNegativo}
                    pendiente={movimiento}
                    onMover={async (m) => onMovimiento(m)}
                  >
                    <Button type="button" variant="outline">
                      Ajustar
                    </Button>
                  </PopoverStock>
                </div>
              </div>

              <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                <span>
                  Vender sin stock
                  <span className="block text-xs text-muted-foreground">
                    Contra pedido: deja que la cantidad quede en negativo.
                  </span>
                </span>
                <Switch
                  checked={v.permiteNegativo}
                  onCheckedChange={(on) => poner("permiteNegativo", on)}
                />
              </label>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              Este producto no lleva conteo de stock: se puede vender siempre.
            </p>
          )}

          {/* El precio de lista es **una propuesta**: se ofrece al armar la
              orden y se puede cambiar ahí, y lo cobrado queda en la línea.
              En un servicio todavía no se muestra —se cotiza cada vez— y el
              IVA lo acompaña, porque decidir si cobra IVA sin ver el precio es
              media pregunta. */}
          {esBien && (
            <div className="space-y-4 border-t pt-3">
              {/* El costo al lado del precio, y debajo lo que deja la venta,
                  como en Shopify: la ganancia y el margen se calculan de los
                  dos y no se guardan. */}
              <div className="grid gap-4 sm:grid-cols-2">
                <PrecioDeLista
                  precio={v.precio}
                  onCambio={(precio) => poner("precio", precio)}
                />
                <CostoPorUnidad
                  costo={v.costo}
                  onCambio={(costo) => poner("costo", costo)}
                />
              </div>
              <GananciaDeVenta precio={v.precio} costo={v.costo} />
              <label className="flex items-center justify-between gap-3 text-sm">
                <span>
                  Cobrar IVA
                  <span className="block text-xs text-muted-foreground">
                    {ivaTasa
                      ? `Al ${ivaTasa}%, la tasa del producto.`
                      : "El producto no tiene tasa cargada, así que se propone 0%."}
                  </span>
                </span>
                <Switch
                  checked={v.cobraIva}
                  onCheckedChange={(on) => poner("cobraIva", on)}
                />
              </label>
            </div>
          )}

          <div className={esBien ? "space-y-1.5 border-t pt-3" : "space-y-1.5"}>
            {esBien && (
              <Label className="text-xs" htmlFor="sku">
                SKU
              </Label>
            )}
            {/* Vacío es "sin SKU": se manda como `null` al guardar. */}
            <Input
              id="sku"
              value={v.sku ?? ""}
              placeholder="—"
              className="font-mono text-sm"
              onChange={(e) => poner("sku", e.target.value || null)}
            />
            {/* Es lo que se imprime como `codigoPrincipal` en la factura, por
                encima del código del producto. */}
            <p className="text-xs text-muted-foreground">
              Sale impreso en la factura y es lo que va en la etiqueta.
            </p>
          </div>

          {/* El peso va con el SKU: es un dato de la mercadería, lo que dice
              la bolsa. Un servicio no pesa nada. */}
          {esBien && (
            <div className="border-t pt-3">
              <PesoDeVariante
                peso={v.peso}
                unidad={v.pesoUnidad}
                onCambio={(peso, pesoUnidad) => {
                  const siguiente = { ...cambios };
                  if (peso === variante.peso) delete siguiente.peso;
                  else siguiente.peso = peso;
                  if (pesoUnidad === variante.pesoUnidad) delete siguiente.pesoUnidad;
                  else siguiente.pesoUnidad = pesoUnidad;
                  onCambios(siguiente);
                }}
              />
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
