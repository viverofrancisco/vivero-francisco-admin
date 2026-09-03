"use client";

import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CustomSelect } from "@/components/ui/custom-select";

/**
 * Las categorías de un producto: **varias**.
 *
 * Chips de lo elegido más un selector con lo que falta, en vez de una lista de
 * casillas: el catálogo puede tener treinta categorías y un producto está en
 * dos, así que lo que importa ver es lo elegido, no todo lo posible.
 */
export function SelectorCategorias({
  categorias,
  value,
  onChange,
  disabled,
}: {
  categorias: { id: string; nombre: string }[];
  value: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
}) {
  const elegidas = value
    .map((id) => categorias.find((c) => c.id === id))
    .filter((c): c is { id: string; nombre: string } => Boolean(c));
  const disponibles = categorias.filter((c) => !value.includes(c.id));

  return (
    <div className="space-y-2">
      {elegidas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {elegidas.map((c) => (
            <span
              key={c.id}
              className="flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-0.5 text-sm"
            >
              {c.nombre}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                disabled={disabled}
                aria-label={`Sacar de ${c.nombre}`}
                onClick={() => onChange(value.filter((id) => id !== c.id))}
              >
                <X className="h-3 w-3" />
              </Button>
            </span>
          ))}
        </div>
      )}

      {disponibles.length > 0 ? (
        <CustomSelect
          value=""
          onChange={(id) => id && onChange([...value, id])}
          disabled={disabled}
          options={disponibles.map((c) => ({ value: c.id, label: c.nombre }))}
          placeholder={
            elegidas.length === 0 ? "Sin categoría" : "Agregar categoría"
          }
          searchable
          searchPlaceholder="Buscar categoría..."
        />
      ) : (
        elegidas.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Todavía no hay categorías creadas.
          </p>
        )
      )}
    </div>
  );
}
