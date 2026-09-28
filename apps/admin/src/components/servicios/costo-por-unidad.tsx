"use client";

import { gananciaDeVenta } from "@vivero/shared";
import { Label } from "@/components/ui/label";
import {
  InputNumero,
  comoNumero,
  useTextoNumerico,
} from "@/components/ui/input-numero";
import { money } from "@/components/ordenes/formato";

/**
 * El costo por unidad de una variante: lo que costó tenerla.
 *
 * Es lo que Shopify pone al lado del precio, y con los dos números calcula la
 * ganancia y el margen (`GananciaDeVenta`, abajo). **Nulo es "no se sabe"**,
 * que no es cero: un precio en cero es gratis y es una decisión; un costo que
 * nadie cargó es exactamente eso. Por eso vaciar el campo **sí** publica nulo,
 * al revés del precio, donde vaciarlo repone lo que había.
 *
 * Publica en cada tecla, no al salir del campo: la barra de guardar tiene
 * que aparecer con el primer dígito. Solo un bien lo tiene: un servicio no
 * se compra, y el servidor lo rechaza.
 */
export function CostoPorUnidad({
  costo,
  onCambio,
}: {
  costo: number | null;
  onCambio: (costo: number | null) => void;
}) {
  const [texto, setTexto] = useTextoNumerico(costo);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs">Costo por unidad</Label>
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
            if (nuevo !== costo) onCambio(nuevo);
          }}
          placeholder="—"
          className="pl-7"
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Lo que costó tenerla. No se imprime en ningún lado.
      </p>
    </div>
  );
}

/**
 * Lo que deja vender una unidad al precio de lista: la ganancia y el margen,
 * como las dos pastillas que Shopify dibuja al lado del costo.
 *
 * Calculado, nunca guardado. Sin costo no dibuja nada: no hay nada que decir.
 * Si se vende por debajo del costo, los dos números salen en ámbar — es lo
 * que la pantalla existe para hacer notar.
 */
export function GananciaDeVenta({
  precio,
  costo,
}: {
  precio: number;
  costo: number | null;
}) {
  const cuenta = gananciaDeVenta(precio, costo);
  if (!cuenta) return null;
  const pierde = cuenta.ganancia < 0;
  const signo = (n: number) => (n > 0 ? "+" : "");
  return (
    <div className="flex flex-wrap gap-2 text-xs">
      <Pastilla
        nombre="Ganancia"
        valor={`${signo(cuenta.ganancia)}${money(cuenta.ganancia)}`}
        pierde={pierde}
      />
      <Pastilla
        nombre="Margen"
        valor={
          cuenta.margen === null ? "—" : `${signo(cuenta.margen)}${cuenta.margen}%`
        }
        pierde={pierde}
      />
    </div>
  );
}

function Pastilla({
  nombre,
  valor,
  pierde,
}: {
  nombre: string;
  valor: string;
  pierde: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1">
      <span className="text-muted-foreground">{nombre}</span>
      <span
        className={`font-medium tabular-nums ${pierde ? "text-amber-700" : ""}`}
      >
        {valor}
      </span>
    </span>
  );
}
