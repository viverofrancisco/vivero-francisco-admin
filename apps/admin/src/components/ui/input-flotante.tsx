"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Un campo con **etiqueta flotante**: adentro cuando está vacío, montada sobre
 * el borde cuando tiene foco o algo escrito. Es la forma del `TextInput`
 * `outlined` de react-native-paper, con el que están hechos los formularios de
 * la app, y las dos son la misma pantalla.
 *
 * El borde lo dibuja un `fieldset` y el hueco por donde asoma la etiqueta lo
 * abre su `legend`. La versión obvia —un `<span>` con fondo del color de la
 * tarjeta, tapando la línea— falla en cuanto el campo está sobre otra
 * superficie: el parche queda de un blanco distinto al de atrás y se ve el
 * recorte. Con la muesca no hay color que adivinar, que es justamente cómo lo
 * resuelven Material y paper.
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
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  maxLength?: number;
  /** `password` para las contraseñas; el resto es texto. */
  type?: "text" | "password" | "email";
  /** Solo se ve con el campo enfocado: con la etiqueta adentro, choca. */
  placeholder?: string;
  id?: string;
  className?: string;
}) {
  const propio = useId();
  const idCampo = id ?? propio;
  const [enfocado, setEnfocado] = useState(false);
  const arriba = enfocado || value.length > 0;
  const texto = required ? `${label} *` : label;

  return (
    // `pt-2`: la etiqueta se monta sobre el borde, así que el renglón de arriba
    // tiene que dejarle ese lugar o la recorta lo que venga antes —un contenedor
    // con scroll, por ejemplo—.
    <div className={cn("relative pt-2", className)}>
      <input
        id={idCampo}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setEnfocado(true)}
        onBlur={() => setEnfocado(false)}
        maxLength={maxLength}
        placeholder={enfocado ? placeholder : undefined}
        // 48 y no 56: al lado de un buscador de 40 y de filas de 44, el campo
        // de 56 se veía de otra escala. Con `pt-1` el texto baja lo justo para
        // dejarle aire a la etiqueta de arriba sin descentrarse.
        className="relative h-12 w-full rounded-xl bg-transparent px-3.5 pt-1 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
      />

      {/* El borde y su muesca. `aria-hidden`: es dibujo, no estructura. */}
      <fieldset
        aria-hidden
        className={cn(
          // El borde arranca **a la altura del centro de la etiqueta** (el
          // `pt-2` del contenedor), para que la línea la corte por la mitad
          // como hace paper. Un píxel más abajo y el texto queda colgando.
          "pointer-events-none absolute inset-x-0 bottom-0 top-2 rounded-xl border px-2.5 transition-colors",
          enfocado ? "border-primary" : "border-border"
        )}
      >
        <legend
          className={cn(
            // Alto cero: lo que hace falta es el hueco en la línea, no una
            // caja. El ancho —lo que de verdad abre la muesca— lo da el texto
            // invisible de adentro.
            "ml-0.5 h-0 p-0 text-xs leading-none transition-all duration-150",
            // `px-1.5` y no `px-1`: con menos, los muñones de la línea tocan
            // la primera y la última letra.
            arriba ? "max-w-full px-1.5" : "max-w-0 px-0"
          )}
        >
          {/* Invisible pero medible: lo que abre el hueco del tamaño exacto. */}
          <span className="invisible whitespace-nowrap">{texto}</span>
        </legend>
      </fieldset>

      <label
        htmlFor={idCampo}
        className={cn(
          "pointer-events-none absolute left-3.5 transition-all duration-150",
          arriba ? "top-0 text-xs" : "top-1/2 -translate-y-1/2 text-sm",
          enfocado ? "text-primary" : "text-muted-foreground"
        )}
      >
        {texto}
      </label>
    </div>
  );
}
