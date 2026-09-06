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
 * Vacío es una respuesta válida y distinta de cero: un bien puede cotizarse por
 * trabajo, y un cero haría que la orden nazca diciendo que algo vale nada.
 */
export function PrecioDeLista({
  precio,
  onGuardar,
}: {
  precio: number | null;
  onGuardar: (precio: number | null) => void;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Precio de lista</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <Input
          type="number"
          min="0"
          step="0.01"
          defaultValue={precio ?? ""}
          placeholder="Se cotiza al vender"
          className="pl-7"
          onBlur={(e) => {
            const texto = e.target.value.trim();
            const nuevo = texto === "" ? null : Number(texto);
            if (nuevo !== null && !Number.isFinite(nuevo)) return;
            if (nuevo !== precio) onGuardar(nuevo);
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Se propone al agregarlo a una orden, y ahí se puede cambiar. Lo que se
        cobró queda guardado en la orden.
      </p>
    </div>
  );
}
