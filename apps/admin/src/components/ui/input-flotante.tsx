"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Un campo con **etiqueta flotante**: adentro cuando está vacío, montada sobre
 * el borde cuando tiene foco o algo escrito.
 *
 * Es la misma forma que el `TextInput` de react-native-paper con el que están
 * hechos los formularios de la app, y las dos son la misma pantalla. Un
 * `Label` arriba y un `Input` abajo ocupan dos renglones para decir lo mismo, y
 * al lado del teléfono se veía otro formulario.
 *
 * La etiqueta es un `<label>` de verdad con su `htmlFor`, así que sigue siendo
 * lo que anuncia el lector de pantalla y tocarla enfoca el campo.
 */
export function InputFlotante({
  label,
  value,
  onChange,
  required,
  maxLength,
  placeholder,
  id,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
  /** Solo se ve con el campo enfocado: con la etiqueta adentro, choca. */
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const propio = useId();
  const idCampo = id ?? propio;
  const [enfocado, setEnfocado] = useState(false);
  const arriba = enfocado || value.length > 0;

  return (
    <div className={cn("relative", className)}>
      <input
        id={idCampo}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        maxLength={maxLength}
        placeholder={enfocado ? placeholder : undefined}
        className={cn(
          "h-14 w-full rounded-xl border bg-card px-3.5 pt-5 pb-1.5 text-sm text-foreground outline-none transition-colors",
          "placeholder:text-muted-foreground/60",
          enfocado ? "border-primary ring-1 ring-primary" : "border-border"
        )}
      />
      <label
        htmlFor={idCampo}
        className={cn(
          "pointer-events-none absolute left-3 origin-left bg-card px-1 transition-all",
          arriba
            ? "top-0 -translate-y-1/2 text-xs"
            : "top-1/2 -translate-y-1/2 text-sm",
          enfocado ? "text-primary" : "text-muted-foreground"
        )}
      >
        {label}
        {required ? " *" : ""}
      </label>
    </div>
  );
}
