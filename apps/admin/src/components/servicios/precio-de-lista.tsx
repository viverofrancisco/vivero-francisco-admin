"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * El precio de lista de una variante.
 *
 * **No es lo que se cobró.** Es lo que se propone al armar una orden, donde se
 * puede cambiar; lo cobrado queda congelado en `OrdenLinea.precioUnitario`.
 * Separarlos es lo que permite subir la lista sin reescribir lo ya vendido.
 *
 * Es obligatorio y **cero quiere decir gratis**. Por eso vaciar el campo no
 * guarda cero: vuelve a lo que decía. Marcar algo como gratis es una decisión,
 * y borrar un número mientras se lo reescribe no lo es.
 */
export function PrecioDeLista({
  precio,
  onGuardar,
}: {
  precio: number;
  onGuardar: (precio: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Precio de lista *</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          type="number"
          min="0"
          step="0.01"
          defaultValue={precio}
          className="pl-7"
          onBlur={(e) => {
            const texto = e.target.value.trim();
            const nuevo = Number(texto);
            if (texto === "" || !Number.isFinite(nuevo) || nuevo < 0) {
              // Se repone lo que había: un campo vacío no es "gratis".
              e.target.value = String(precio);
              return;
            }
            if (nuevo !== precio) onGuardar(nuevo);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Se propone al agregarlo a una orden, y ahí se puede cambiar. Lo que se
        cobró queda guardado en la orden. En cero, se ofrece gratis.
      </p>
    </div>
  );
}
