import { nombreCliente } from "@vivero/shared";
import type { listInformesYBorradores } from "@/lib/services/informe.service";

type Fila = Awaited<ReturnType<typeof listInformesYBorradores>>["items"][number];

/** Una fila del listado de informes, ya lista para el cliente. */
export interface InformeListItem {
  id: string;
  /** Un borrador todavía no es un informe: no tiene número ni PDF. */
  tipo: "emitido" | "borrador";
  numero: number | null;
  titulo: string;
  pdfUrl: string | null;
  /** Generado, para un informe; última edición, para un borrador. */
  fecha: string;
  version: number;
  /** Si es el borrador de una **edición**, el número del informe que corrige. */
  deInforme: number | null;
  cliente: { id: string; nombre: string } | null;
}

/**
 * De fila de la base a fila de la lista.
 *
 * Vive acá y no en la página porque la primera tanda la arma el servidor al
 * renderizar y las siguientes salen por la API cuando se scrollea: dos lugares
 * armando la misma fila terminan armándola distinto.
 */
export function serializarInformeItem(x: Fila): InformeListItem {
  if (x.tipo === "emitido") {
    const i = x.informe!;
    return {
      id: i.id,
      tipo: "emitido",
      numero: i.numero,
      titulo: i.titulo,
      pdfUrl: i.pdfUrl,
      fecha: i.generatedAt.toISOString(),
      version: i.versionActual,
      deInforme: null,
      cliente: { id: i.cliente.id, nombre: nombreCliente(i.cliente) },
    };
  }
  const b = x.borrador!;
  return {
    id: b.id,
    tipo: "borrador",
    // El suyo, que es el que va a heredar el informe cuando se genere.
    numero: b.numero,
    deInforme: b.informe?.numero ?? null,
    titulo: b.titulo ?? "Sin título",
    pdfUrl: null,
    fecha: b.updatedAt.toISOString(),
    version: 1,
    cliente: b.cliente
      ? { id: b.cliente.id, nombre: nombreCliente(b.cliente) }
      : null,
  };
}
