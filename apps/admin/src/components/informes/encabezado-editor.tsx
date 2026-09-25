"use client";

import { EditorDeTextoRico } from "./editor-de-texto";

/**
 * El encabezado del informe: lo que sale impreso arriba de todo.
 *
 * Antes era un campo de una línea —el título— y una segunda línea que el PDF
 * armaba solo. Un nombre largo se partía a mitad de palabra y no había dónde
 * meter el corte. Acá se escribe entero: Enter corta la línea, y cada pedazo
 * lleva su tamaño, su color, su alineación y sus marcas.
 *
 * Es `EditorDeTextoRico` centrado y con lugar para unas cinco líneas: el
 * mismo editor con el que se escriben el título y la descripción de cada
 * sección.
 */
export function EncabezadoEditor({
  value,
  onChange,
  className,
  // Alto para unas cinco líneas: un encabezado de tres renglones entraba
  // justo y no quedaba lugar para ver lo que se escribe.
  alto = "min-h-44",
  altoMaximo = "max-h-80",
  llenar = false,
}: {
  value: string;
  onChange: (html: string) => void;
  className?: string;
  alto?: string;
  altoMaximo?: string;
  /** Todo el alto del contenedor, en el panel. */
  llenar?: boolean;
}) {
  return (
    <EditorDeTextoRico
      value={value}
      onChange={onChange}
      className={className}
      alineacion="center"
      alto={alto}
      altoMaximo={altoMaximo}
      llenar={llenar}
      listas
    />
  );
}
