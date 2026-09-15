import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { estadoCuentaPersonal } from "@/lib/services/personal-acceso.service";
import { PersonalDetail } from "@/components/personal/personal-detail";

export default async function EditarPersonalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const actual = await requireAuth();
  const { id } = await params;
  const { from } = await searchParams;
  const backHref = hrefDeVuelta(from, "/dashboard/personal");

  const personal = await prisma.personal.findUnique({
    where: { id, deletedAt: null },
    include: {
      grupos: {
        include: {
          grupo: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!personal) {
    notFound();
  }

  const cuenta = await estadoCuentaPersonal(personal.id);

  const grupos = personal.grupos.map((g) => ({
    id: g.grupo.id,
    nombre: g.grupo.nombre,
  }));

  return (
    <div>
      <PersonalDetail
        backHref={backHref}
        personal={{
          id: personal.id,
          nombre: personal.nombre,
          apellido: personal.apellido,
          telefono: personal.telefono,
          especialidad: personal.especialidad,
          sueldo: personal.sueldo,
          estado: personal.estado,
          tipo: personal.tipo,
          createdAt: personal.createdAt.toISOString(),
        }}
        grupos={grupos}
        cuenta={cuenta}
        puedeAdministrarAcceso={actual.role === "ADMIN"}
      />
    </div>
  );
}
