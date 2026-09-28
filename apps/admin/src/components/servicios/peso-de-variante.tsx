"use client";

import {
  UNIDADES_DE_PESO,
  UNIDAD_PESO_LABEL,
  type UnidadPeso,
} from "@vivero/shared";
import { Label } from "@/components/ui/label";
import {
  InputNumero,
  comoNumero,
  useTextoNumerico,
} from "@/components/ui/input-numero";
import { CustomSelect } from "@/components/ui/custom-select";

/**
 * Cuánto pesa una unidad, con su unidad al lado.
 *
 * Es el *Weight* de la card de envío de Shopify, sin la card: acá nada se
 * despacha por correo, así que el peso es un dato de la mercadería —lo que
 * dice la bolsa— y va junto al SKU, no en una sección de envíos que
 * prometería algo que no existe. Se guarda como se escribió, con su unidad,
 * para que "25 kg" vuelva a leerse "25 kg"; nulo es que nadie lo cargó.
 *
 * Publica en cada tecla, no al salir del campo, y cambiar la unidad publica
 * en el acto con el número que haya: la unidad sin el número no dice nada,
 * y al revés tampoco.
 */
export function PesoDeVariante({
  peso,
  unidad,
  onCambio,
}: {
  peso: number | null;
  unidad: UnidadPeso;
  onCambio: (peso: number | null, unidad: UnidadPeso) => void;
}) {
  const [texto, setTexto] = useTextoNumerico(peso);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs" htmlFor="peso">
        Peso
      </Label>
      <div className="flex gap-2">
        <InputNumero
          id="peso"
          // Tres decimales y no dos: en kilos, el tercero son los gramos.
          decimales={3}
          value={texto}
          onChange={(t) => {
            setTexto(t);
            const nuevo = comoNumero(t);
            if (nuevo !== peso) onCambio(nuevo, unidad);
          }}
          placeholder="—"
          className="flex-1 tabular-nums"
        />
        <CustomSelect
          className="w-24 flex-none"
          value={unidad}
          onChange={(u) => onCambio(comoNumero(texto), u as UnidadPeso)}
          options={UNIDADES_DE_PESO.map((u) => ({
            value: u,
            label: UNIDAD_PESO_LABEL[u],
          }))}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Lo que pesa una unidad, como lo dice la bolsa o la etiqueta.
      </p>
    </div>
  );
}
