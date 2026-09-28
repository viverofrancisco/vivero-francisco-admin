import { UNIDAD_PESO_LABEL, type UnidadPeso } from "@vivero/shared";

/** "$12,50", con el signo adelante del símbolo cuando es negativo. */
export function dinero(n: number): string {
  const signo = n < 0 ? "-" : "";
  return `${signo}$${Math.abs(n).toLocaleString("es-EC", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

/** Cero es gratis, y decirlo con la palabra es lo que hace que se note. */
export function precioTexto(precio: number): string {
  return precio === 0 ? "Gratis" : dinero(precio);
}

/** "0,25 kg", o "—" si nadie lo cargó. */
export function pesoTexto(v: { peso: number | null; pesoUnidad: UnidadPeso }): string {
  if (v.peso === null) return "—";
  return `${v.peso.toLocaleString("es-EC", { maximumFractionDigits: 3 })} ${
    UNIDAD_PESO_LABEL[v.pesoUnidad]
  }`;
}

/** "$16,00 • 578 disponibles", el renglón de la lista de variantes. */
export function resumenDeVariante(v: {
  precio: number;
  manejaInventario: boolean;
  stock: number;
}): string {
  const partes = [precioTexto(v.precio)];
  partes.push(v.manejaInventario ? `${v.stock} disponibles` : "No se cuenta");
  return partes.join(" • ");
}
