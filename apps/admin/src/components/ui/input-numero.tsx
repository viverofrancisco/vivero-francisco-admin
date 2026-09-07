"use client";

import { Input } from "@/components/ui/input";

/**
 * Un campo que solo acepta números, sin ser `type="number"`.
 *
 * El nativo trae tres cosas que estorban en una tabla de precios: las flechitas
 * que se comen ancho, la rueda del mouse que cambia el valor al scrollear por
 * encima —se cambian precios sin querer— y que igual deja escribir `e`, `+` y
 * `-` porque acepta notación científica. Encima, cuando lo escrito no es un
 * número válido el navegador devuelve cadena vacía y no hay forma de saber qué
 * se tipeó.
 *
 * Este filtra al escribir: entra lo que se puede escribir, y nada más.
 */
export function InputNumero({
  value,
  onChange,
  decimales = false,
  className,
  ...props
}: {
  /** Lo escrito, tal cual. Se maneja como texto: "12." es un estado válido. */
  value: string;
  onChange: (texto: string) => void;
  /** Con decimales (precios) o solo enteros (cantidades). */
  decimales?: boolean;
  className?: string;
} & Omit<
  React.ComponentProps<typeof Input>,
  "value" | "onChange" | "type" | "className"
>) {
  return (
    <Input
      {...props}
      // `decimal` levanta el teclado numérico en el teléfono; `text` evita
      // todo lo del `number` nativo.
      type="text"
      inputMode={decimales ? "decimal" : "numeric"}
      value={value}
      className={className}
      onChange={(e) => {
        const texto = e.target.value;
        // Se acepta lo **vacío** para poder borrar y reescribir, y una coma se
        // toma como punto: en un teclado en español es la tecla que está a
        // mano y nadie espera que no funcione.
        const normalizado = texto.replace(",", ".");
        const valido = decimales
          ? /^\d*\.?\d{0,2}$/.test(normalizado)
          : /^\d*$/.test(normalizado);
        if (valido) onChange(normalizado);
      }}
    />
  );
}

/** Lo escrito, como número. Vacío o a medio escribir vale `null`. */
export function comoNumero(texto: string): number | null {
  if (texto.trim() === "" || texto === ".") return null;
  const n = Number(texto);
  return Number.isFinite(n) ? n : null;
}
