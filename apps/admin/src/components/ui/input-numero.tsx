"use client";

import { useState } from "react";
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
  /**
   * Con decimales (precios) o solo enteros (cantidades). `true` son dos, los
   * de la plata; un número dice cuántos, para un peso en kilos con gramos.
   */
  decimales?: boolean | number;
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
        const cuantos = typeof decimales === "number" ? decimales : 2;
        const valido = decimales
          ? new RegExp(`^\\d*\\.?\\d{0,${cuantos}}$`).test(normalizado)
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

/**
 * El texto de un campo numérico que publica **en cada tecla**.
 *
 * Lo escrito vive como texto y el número sale apenas se puede leer uno, para
 * que la barra de *Cambios sin guardar* aparezca al primer dígito y no al
 * salir del campo. El texto se repone desde afuera —se guardó, se descartó—
 * solo cuando el número ya no es el que dice el campo: sin esa condición,
 * "12." publica 12, el padre devuelve 12, y `String(12)` le borra el punto
 * que se acaba de escribir. Nulo es un campo vacío.
 */
export function useTextoNumerico(
  valor: number | null
): [string, (texto: string) => void] {
  const [texto, setTexto] = useState(valor === null ? "" : String(valor));
  const [ultimo, setUltimo] = useState(valor);
  if (ultimo !== valor) {
    setUltimo(valor);
    if (comoNumero(texto) !== valor) {
      setTexto(valor === null ? "" : String(valor));
    }
  }
  return [texto, setTexto];
}
