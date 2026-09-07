"use client";

import { CustomSelect } from "@/components/ui/custom-select";
import { Label } from "@/components/ui/label";
import { money } from "./formato";

export interface VarianteVendible {
  id: string;
  /** "Rojo · Grande", o vacío en la variante única de un bien sin opciones. */
  nombre: string;
  sku: string | null;
  /** Precio de lista: lo que se propone acá. Lo cobrado queda en la línea. */
  precio: number;
  /** Si se le cobra IVA. La tasa es del producto; esto es el interruptor. */
  cobraIva: boolean;
  manejaInventario: boolean;
  stock: number;
}

/** El precio de lista como texto para el campo. */
export function precioDeLista(v: VarianteVendible | undefined): string {
  return v ? String(v.precio) : "";
}

/**
 * La tasa de IVA que corresponde a una variante: la del producto, o 0 si esta
 * variante no cobra IVA. El *cuánto* es del bien; el *si*, de la variante.
 */
export function ivaDeLista(
  v: VarianteVendible | undefined,
  ivaTasaProducto: number | null
): string {
  if (!v) return ivaTasaProducto != null ? String(ivaTasaProducto) : "0";
  return v.cobraIva && ivaTasaProducto != null ? String(ivaTasaProducto) : "0";
}

/**
 * Qué tasa corresponde al cambiar de variante, con la misma regla que el
 * precio: sigue a la propuesta mientras nadie la haya tocado.
 */
export function ivaAlCambiarVariante(
  actual: string,
  anterior: VarianteVendible | undefined,
  nueva: VarianteVendible | undefined,
  ivaTasaProducto: number | null
): string {
  const sinTocar =
    actual.trim() === "" || actual === ivaDeLista(anterior, ivaTasaProducto);
  return sinTocar ? ivaDeLista(nueva, ivaTasaProducto) : actual;
}

/**
 * Qué precio corresponde al cambiar de variante.
 *
 * Sigue a la lista **mientras nadie lo haya tocado**: si el campo está vacío o
 * todavía dice el precio de la variante anterior, pasa al de la nueva. Si
 * alguien escribió otro número, ese manda — pisarlo sería tirar lo que la
 * persona acaba de decidir, que es justamente lo que el precio de lista no
 * puede hacer.
 */
export function precioAlCambiarVariante(
  actual: string,
  anterior: VarianteVendible | undefined,
  nueva: VarianteVendible | undefined
): string {
  const sinTocar = actual.trim() === "" || actual === precioDeLista(anterior);
  return sinTocar ? precioDeLista(nueva) : actual;
}

/**
 * Cuál de las variantes de un bien se vende.
 *
 * **No se muestra con una sola.** Un bien sin opciones tiene exactamente una,
 * así que preguntar cuál sería preguntar por una decisión que no existe; el
 * servidor la completa. Con varias sí hace falta: nadie puede adivinar cuál de
 * las seis macetas salió, y de ahí sale el SKU impreso y el stock que baja.
 *
 * El stock va en el `hint` y no bloquea: quien arma la orden tiene que verlo,
 * pero si la variante admite vender sin stock la decisión ya está tomada, y si
 * no, el freno es al emitir — que es cuando la mercadería sale de verdad.
 */
export function SelectorVariante({
  variantes,
  value,
  onChange,
}: {
  variantes: VarianteVendible[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  if (variantes.length < 2) return null;

  return (
    <div className="w-56 space-y-1">
      <Label className="text-xs">Variante *</Label>
      <CustomSelect
        value={value ?? ""}
        onChange={onChange}
        options={variantes.map((v) => ({
          value: v.id,
          label: v.sku ? `${v.nombre} · ${v.sku}` : v.nombre,
          hint: [
            v.precio === 0 ? "Gratis" : money(v.precio),
            v.cobraIva ? null : "sin IVA",
            v.manejaInventario
              ? v.stock > 0
                ? `hay ${v.stock}`
                : "sin stock"
              : null,
          ]
            .filter(Boolean)
            .join(" · "),
        }))}
        placeholder="Elegir variante..."
        searchable
        searchPlaceholder="Buscar variante..."
      />
    </div>
  );
}
