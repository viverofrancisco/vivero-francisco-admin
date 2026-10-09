import { prisma } from "@/lib/prisma";
import type { CentroParaObra, ClienteParaObra } from "@/components/obras/obra-form";

/** Los clientes con sus propiedades, para elegir de quién es la obra. */
export async function clientesParaObra(): Promise<ClienteParaObra[]> {
  return prisma.cliente.findMany({
    where: { deletedAt: null },
    orderBy: [{ nombre: "asc" }, { apellido: "asc" }],
    select: {
      id: true,
      nombre: true,
      apellido: true,
      empresa: true,
      propiedades: {
        where: { deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true, nombre: true, direccion: true },
      },
    },
  });
}

/** Los centros de costo, para elegir a cuál pertenece la obra. */
export async function centrosParaObra(): Promise<CentroParaObra[]> {
  return prisma.centroCosto.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true, activo: true },
  });
}
