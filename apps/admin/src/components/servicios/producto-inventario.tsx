"use client";

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
import Link from "next/link";
import { PopoverStock } from "./popover-stock";
import { PrecioDeLista } from "./precio-de-lista";
import type { VarianteFila } from "./producto-variantes";

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
  onCambio,
}: {
  productoId: string;
  variante: VarianteFila;
  /** La tasa del producto: el *cuánto*. Acá solo se decide el *si*. */
  ivaTasa: number | null;
  /** Un servicio no lleva inventario: se le oculta ese bloque entero. */
  esBien: boolean;
  onCambio: (v: VarianteFila) => void;
}) {
  const router = useRouter();

  /** Un movimiento de stock. El libro es el que manda; acá se lo alimenta. */
  const mover = async (m: {
    motivo: "CONTEO" | "AJUSTE" | "INGRESO";
    valor: number;
    nota: string | null;
  }) => {
    const res = await fetch(`/api/variantes/${variante.id}/movimientos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(
        m.motivo === "CONTEO"
          ? { motivo: m.motivo, contado: m.valor, nota: m.nota }
          : {
              motivo: m.motivo,
              cantidad: m.motivo === "INGRESO" ? Math.abs(m.valor) : m.valor,
              nota: m.nota,
            }
      ),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error ?? "Error");
    const saldo = body.movimiento?.saldo;
    if (saldo !== undefined) onCambio({ ...variante, stock: saldo });
    router.refresh();
  };

  const guardar = async (patch: Partial<VarianteFila>) => {
    const previa = variante;
    onCambio({ ...variante, ...patch });
    try {
      const res = await fetch(`/api/variantes/${variante.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
    } catch (e) {
      onCambio(previa);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
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
                  checked={variante.manejaInventario}
                  onCheckedChange={(on) => guardar({ manejaInventario: on })}
                />
              </label>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          {!esBien ? null : variante.manejaInventario ? (
            <>
              {/* El número grande y clickeable: es el dato que se viene a ver,
                  y tocarlo es lo que se viene a hacer. */}
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
                    permiteNegativo={variante.permiteNegativo}
                    onMover={mover}
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
                  checked={variante.permiteNegativo}
                  onCheckedChange={(on) => guardar({ permiteNegativo: on })}
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
              <PrecioDeLista
                precio={variante.precio}
                onGuardar={(precio) => guardar({ precio })}
              />
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
                  checked={variante.cobraIva}
                  onCheckedChange={(on) => guardar({ cobraIva: on })}
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
            {/* Es lo que se imprime como `codigoPrincipal` en la factura, por
                encima del código del producto. */}
            <p className="text-xs text-muted-foreground">
              Sale impreso en la factura y es lo que va en la etiqueta.
            </p>
          </div>
        </CardContent>
      </Card>

    </>
  );
}
