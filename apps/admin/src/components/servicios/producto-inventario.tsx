"use client";

import { useState } from "react";
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
import { MovimientoDialog } from "./movimiento-dialog";
import type { VarianteFila } from "./producto-variantes";

/**
 * El inventario de un bien **sin opciones**.
 *
 * Un bien así tiene una sola variante, así que preguntar "cuál" no tiene
 * sentido: el stock, el SKU y los dos interruptores son del producto a los
 * ojos de quien mira, y esta card los pone donde se los espera. Por debajo
 * siguen siendo de la variante única — la misma fila que cuenta el resto del
 * sistema— así que agregar opciones después no cambia nada del modelo.
 *
 * Con opciones esta card desaparece: ahí el stock es por combinación y vive en
 * la tabla de variantes.
 */
export function ProductoInventario({
  variante,
  onCambio,
}: {
  variante: VarianteFila;
  onCambio: (v: VarianteFila) => void;
}) {
  const router = useRouter();
  const [ajustando, setAjustando] = useState(false);

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
              Este producto no lleva conteo de stock: se puede vender siempre.
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
            {/* Es lo que se imprime como `codigoPrincipal` en la factura, por
                encima del código del producto. */}
            <p className="text-xs text-muted-foreground">
              Sale impreso en la factura y es lo que va en la etiqueta.
            </p>
          </div>
        </CardContent>
      </Card>

      {ajustando && (
        <MovimientoDialog
          varianteId={variante.id}
          nombre="Ajustar inventario"
          stock={variante.stock}
          permiteNegativo={variante.permiteNegativo}
          onCerrar={() => setAjustando(false)}
          onHecho={(stock) => {
            onCambio({ ...variante, stock });
            setAjustando(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
