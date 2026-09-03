"use client";

import { CustomSelect } from "@/components/ui/custom-select";
import { Label } from "@/components/ui/label";

export interface VarianteVendible {
  id: string;
  /** "Rojo · Grande", o vacío en la variante única de un bien sin opciones. */
  nombre: string;
  sku: string | null;
  manejaInventario: boolean;
  stock: number;
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
          hint: v.manejaInventario
            ? v.stock > 0
              ? `Hay ${v.stock}`
              : "Sin stock"
            : undefined,
        }))}
        placeholder="Elegir variante..."
        searchable
        searchPlaceholder="Buscar variante..."
      />
    </div>
  );
}
