"use client";

import { Label } from "@/components/ui/label";
import {
  InputNumero,
  comoNumero,
  useTextoNumerico,
} from "@/components/ui/input-numero";

/**
 * El precio de lista de una variante.
 *
 * **No es lo que se cobró.** Es lo que se propone al armar una orden, donde se
 * puede cambiar; lo cobrado queda congelado en `OrdenLinea.precioUnitario`.
 * Separarlos es lo que permite subir la lista sin reescribir lo ya vendido.
 *
 * Es obligatorio y **cero quiere decir gratis**. Por eso vaciar el campo no
 * publica cero: al salir, vuelve a lo que decía. Marcar algo como gratis es
 * una decisión, y borrar un número mientras se lo reescribe no lo es.
 *
 * Publica en cada tecla, no al salir del campo: la barra de guardar tiene
 * que aparecer con el primer dígito, que es cuando se empezó a cambiar algo.
 */
export function PrecioDeLista({
  precio,
  onCambio,
}: {
  precio: number;
  onCambio: (precio: number) => void;
}) {
  const [texto, setTexto] = useTextoNumerico(precio);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Precio de lista *</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
          $
        </span>
        <InputNumero
          decimales
          value={texto}
          onChange={(t) => {
            setTexto(t);
            const nuevo = comoNumero(t);
            if (nuevo !== null && nuevo !== precio) onCambio(nuevo);
          }}
          className="pl-7"
          onBlur={() => {
            // Se repone lo que había: un campo vacío no es "gratis".
            if (comoNumero(texto) === null) setTexto(String(precio));
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
