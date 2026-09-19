"use client";

import { CustomSelect } from "@/components/ui/custom-select";
import { OPCIONES_ORDEN_TAREAS, type ModoOrdenTareas } from "@vivero/shared";

/**
 * Cómo se elige el orden **en escritorio**: un desplegable con el nombre del
 * orden puesto, que ahí hay espacio de sobra para leerlo.
 *
 * En el teléfono no existe: ese control se comía una línea entera para algo que
 * casi nunca se cambia, y además el orden allá no es una sola decisión —se
 * elige el tipo, se acomodan las filas, se marca de a varias—, así que vive en
 * su propia pantalla (`OrdenarTareasMovil`), que abre el botón de al lado del
 * buscador.
 *
 * No tiene estado deshabilitado: elegir un orden no guarda nada por sí solo
 * —queda pendiente, con Cancelar y Guardar arriba, igual que arrastrar—, así
 * que no hay momento en que haya que apagarlo.
 */
export function SelectorOrden({
  value,
  onChange,
}: {
  value: ModoOrdenTareas;
  onChange: (modo: ModoOrdenTareas) => void;
}) {
  return (
    // El corte es `md`, el mismo que decide tabla o lista.
    <div className="hidden md:block md:w-56">
      <CustomSelect
        value={value}
        onChange={(v) => onChange(v as ModoOrdenTareas)}
        options={OPCIONES_ORDEN_TAREAS}
        anchoMinimo={220}
      />
    </div>
  );
}
