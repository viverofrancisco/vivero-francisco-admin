import { requireAuth } from "@/lib/auth-helpers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ClienteForm } from "@/components/clientes/cliente-form";

export default async function NuevoClientePage() {
  const user = await requireAuth();

  if (user.role === "PERSONAL" || user.role === "CLIENTE") {
    redirect("/dashboard/clientes");
  }

  // Para el sector de la primera propiedad: el alta pide la propiedad entera.
  const sectores = await prisma.sector.findMany({
    where: { deletedAt: null },
    select: { id: true, nombre: true },
    orderBy: { nombre: "asc" },
  });

  return (
    // Sin relleno en el teléfono: el formulario trae su encabezado pegado
    // arriba, de borde a borde, y pone el suyo al cuerpo.
    <div className="md:p-6">
      <ClienteForm sectores={sectores} />
    </div>
  );
}
