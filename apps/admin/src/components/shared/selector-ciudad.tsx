"use client";

import { useMemo } from "react";
import { opcionesDeCiudad } from "@vivero/shared";
import { CustomSelect } from "@/components/ui/custom-select";

/**
 * La ciudad de una dirección, de la lista oficial: los 221 cantones del INEC
 * (`CANTONES_DEL_ECUADOR` en `@vivero/shared`, la misma que usa la app), las
 * de todos los días primero y la provincia como pista, porque hay nombres
 * repetidos (Bolívar, Olmedo). Reemplaza la lista corta de "ciudades
 * principales" que tenía el portal, a la que le faltaban cantones donde el
 * vivero trabaja.
 *
 * Por dentro las opciones se identifican por el código del INEC —dos
 * "Bolívar" no pueden tener el mismo valor— y afuera se guarda el nombre,
 * como siempre. Una ciudad escrita antes de la lista se sigue mostrando.
 */
export function SelectorCiudad({
  value,
  onChange,
  clearable = true,
}: {
  value: string | null | undefined;
  onChange: (ciudad: string) => void;
  clearable?: boolean;
}) {
  const opciones = useMemo(() => opcionesDeCiudad(value), [value]);
  const clave = (o: { nombre: string; codigo: string | null }) => o.codigo ?? `manual:${o.nombre}`;
  const actual = opciones.find((o) => o.nombre === value);
  return (
    <CustomSelect
      value={actual ? clave(actual) : ""}
      onChange={(v) => onChange(opciones.find((o) => clave(o) === v)?.nombre ?? "")}
      options={opciones.map((o) => ({
        value: clave(o),
        label: o.nombre,
        hint: o.provincia ?? undefined,
      }))}
      placeholder="Seleccionar ciudad"
      searchable
      searchPlaceholder="Buscar ciudad..."
      clearable={clearable}
    />
  );
}
