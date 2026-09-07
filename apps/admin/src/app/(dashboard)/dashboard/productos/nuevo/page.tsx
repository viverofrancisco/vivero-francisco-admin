import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServicioForm } from "@/components/servicios/servicio-form";

export default async function NuevoServicioPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  await requireAuth();
  const { tipo } = await searchParams;

  const categorias = await prisma.categoria.findMany({
    orderBy: [{ orden: "asc" }, { nombre: "asc" }],
    select: { id: true, nombre: true },
  });

  return (
    <div className="p-4 md:p-6">
      {/* El tipo lo elige el diálogo del listado. Si alguien entra por la URL
          sin él, la pantalla lo pregunta antes de mostrar la ficha. */}
      <ServicioForm
        categorias={categorias}
        tipoInicial={tipo === "BIEN" || tipo === "SERVICIO" ? tipo : undefined}
      />
    </div>
  );
}
