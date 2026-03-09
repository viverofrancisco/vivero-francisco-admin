import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { ServicioForm } from "@/components/servicios/servicio-form";

export default async function EditarServicioPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireAuth();
  const { id } = await params;

  const servicio = await prisma.servicio.findUnique({ where: { id } });

  if (!servicio) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <ServicioForm initialData={servicio} />
    </div>
  );
}
