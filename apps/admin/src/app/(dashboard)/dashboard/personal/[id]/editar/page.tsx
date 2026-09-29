import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { estadoCuentaPersonal } from "@/lib/services/personal-acceso.service";
import { PersonalForm } from "@/components/personal/personal-form";

/**
 * Editar a alguien en su propia pantalla: es lo que abre *Editar* en la ficha
 * del teléfono, como en la app. En escritorio la ficha sigue editando en el
 * lugar; esta página funciona igual ahí, solo que nadie la abre.
 */
export default async function EditarPersonalPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actual = await requireAuth();
  const { id } = await params;
  const personal = await prisma.personal.findUnique({
    where: { id, deletedAt: null },
  });
  if (!personal) notFound();
  const cuenta = await estadoCuentaPersonal(personal.id);

  return (
    <div className="md:p-6">
      <PersonalForm
        initialData={{
          id: personal.id,
          nombre: personal.nombre,
          apellido: personal.apellido,
          telefono: personal.telefono,
          especialidad: personal.especialidad,
          tipo: personal.tipo,
          sueldo: personal.sueldo,
          estado: personal.estado,
          usuario: cuenta?.usuario ?? null,
        }}
        puedeEditarUsuario={actual.role === "ADMIN"}
        volverA={`/dashboard/personal/${personal.id}`}
      />
    </div>
  );
}
