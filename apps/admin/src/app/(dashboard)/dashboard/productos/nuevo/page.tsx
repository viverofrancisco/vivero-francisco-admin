import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServicioForm } from "@/components/servicios/servicio-form";

export default async function NuevoServicioPage() {
  await requireAuth();

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  return (
    <div className="p-4 md:p-6 space-y-6">
      <ServicioForm categorias={categorias} />
    </div>
  );
}
