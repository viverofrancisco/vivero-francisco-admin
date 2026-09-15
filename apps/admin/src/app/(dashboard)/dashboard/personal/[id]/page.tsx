import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { hrefDeVuelta } from "@/lib/navegacion";
import { estadoCuentaPersonal } from "@/lib/services/personal-acceso.service";
import { PersonalDetail } from "@/components/personal/personal-detail";
import { nombreCliente } from "@vivero/shared";

/**
 * Cuántas visitas por página.
 *
 * Menos que las 25 de un listado: esto es una tarjeta dentro de una ficha, no
 * la pantalla de visitas. Con 25 el resto de la ficha quedaba abajo del todo, y
 * quien entra acá viene a ver a la persona, no su año completo.
 */
const VISITAS_POR_PAGINA = 8;

export default async function EditarPersonalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; vpag?: string }>;
}) {
  const actual = await requireAuth();
  const { id } = await params;
  const { from, vpag } = await searchParams;
  const pagina = Math.max(1, Number.parseInt(vpag ?? "1", 10) || 1);
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

  // Las visitas donde **está asignado**, no las de su grupo: el grupo dice con
  // quién suele trabajar, la asignación dice dónde fue de verdad. `removedAt`
  // afuera, o seguirían contando las que le sacaron.
  const dondeVa = {
    deletedAt: null,
    personal: { some: { personalId: personal.id, removedAt: null } },
  } as const;

  const [visitasTotal, visitas] = await Promise.all([
    prisma.visita.count({ where: dondeVa }),
    prisma.visita.findMany({
      where: dondeVa,
      orderBy: [{ fechaProgramada: "desc" }, { id: "desc" }],
      skip: (pagina - 1) * VISITAS_POR_PAGINA,
      take: VISITAS_POR_PAGINA,
      select: {
        id: true,
        numero: true,
        fechaProgramada: true,
        estado: true,
        cliente: {
          select: { nombre: true, apellido: true, empresa: true },
        },
      },
    }),
  ]);

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
        visitas={visitas.map((v) => ({
          id: v.id,
          numero: v.numero,
          fechaProgramada: v.fechaProgramada.toISOString(),
          estado: v.estado,
          cliente: nombreCliente(v.cliente),
        }))}
        visitasTotal={visitasTotal}
        visitasPagina={pagina}
        visitasPorPagina={VISITAS_POR_PAGINA}
      />
    </div>
  );
}
