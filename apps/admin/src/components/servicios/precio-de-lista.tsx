"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { InputNumero, comoNumero } from "@/components/ui/input-numero";

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
  const [texto, setTexto] = useState(String(precio));
  // Si el precio cambia desde afuera (se guardó, se descartó), el campo sigue.
  const [ultimo, setUltimo] = useState(precio);
  if (ultimo !== precio) {
    setUltimo(precio);
    setTexto(String(precio));
  }

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
          onChange={setTexto}
          className="pl-7"
          onBlur={() => {
            const nuevo = comoNumero(texto);
            if (nuevo === null) {
              // Se repone lo que había: un campo vacío no es "gratis".
              setTexto(String(precio));
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
