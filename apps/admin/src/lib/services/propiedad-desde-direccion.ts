import type { Prisma } from "@/generated/prisma/client";

/** Una dirección escrita a mano, con los campos de una propiedad. */
export interface DireccionEscrita {
  direccion?: string | null;
  numeroCasa?: string | null;
  ciudad?: string | null;
  referencia?: string | null;
  lat?: number | null;
  lng?: number | null;
}

/**
 * **La otra dirección que escribió el cliente, guardada como propiedad suya**,
 * cuando marcó *Guardar esta dirección en mi cuenta* (viene marcado). Es su
 * decisión: la casa de un pariente a la que se manda un regalo no tiene por
 * qué quedar en su cuenta, y la de la playa sí. Va dentro de la transacción
 * del pedido o la solicitud, así no queda una propiedad suelta si lo otro
 * falla. Se nombra con la calle, que es lo que la distingue en sus listas, y
 * la puede renombrar después.
 */
export async function guardarDireccionComoPropiedad(
  tx: Prisma.TransactionClient,
  clienteId: string,
  d: DireccionEscrita,
  userId: string | null
): Promise<string> {
  const calle = d.direccion?.trim() || null;
  const p = await tx.propiedad.create({
    data: {
      clienteId,
      nombre: (calle ?? "Otra dirección").slice(0, 60),
      direccion: calle,
      numeroCasa: d.numeroCasa?.trim() || null,
      ciudad: d.ciudad?.trim() || null,
      referencia: d.referencia?.trim() || null,
      lat: d.lat ?? null,
      lng: d.lng ?? null,
      createdById: userId,
      updatedById: userId,
    },
    select: { id: true },
  });
  return p.id;
}
