import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireStaff } from "@/lib/auth-helpers";
import { nombreCliente } from "@vivero/shared";
import { PropiedadPage } from "@/components/clientes/propiedad-page";

export default async function EditarPropiedad({
  params,
}: {
  params: Promise<{ id: string; propiedadId: string }>;
}) {
  await requireStaff();
  const { id, propiedadId } = await params;

  const [propiedad, sectores] = await Promise.all([
    // Acotada al cliente de la URL: un id de otro no abre acá.
    prisma.propiedad.findFirst({
      where: { id: propiedadId, clienteId: id, deletedAt: null },
      include: {
        cliente: { select: { id: true, nombre: true, apellido: true, empresa: true } },
        _count: { select: { visitas: true } },
      },
    }),
    prisma.sector.findMany({
      where: { deletedAt: null },
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);
  if (!propiedad) notFound();

  return (
    <PropiedadPage
      clienteId={propiedad.cliente.id}
      clienteNombre={nombreCliente(propiedad.cliente)}
      propiedad={{
        id: propiedad.id,
        nombre: propiedad.nombre,
        ciudad: propiedad.ciudad,
        sectorId: propiedad.sectorId,
        direccion: propiedad.direccion,
        numeroCasa: propiedad.numeroCasa,
        referencia: propiedad.referencia,
        notas: propiedad.notas,
        lat: propiedad.lat,
        lng: propiedad.lng,
        m2Total: propiedad.m2Total,
        jardinerasPlantaAlta: propiedad.jardinerasPlantaAlta,
        numeroArboles: propiedad.numeroArboles,
        mlVegetacionBaja: propiedad.mlVegetacionBaja,
        mlVegetacionMedia: propiedad.mlVegetacionMedia,
        mlVegetacionAlta: propiedad.mlVegetacionAlta,
        m2Cesped: propiedad.m2Cesped,
        visitas: propiedad._count.visitas,
      }}
      sectores={sectores}
      backHref={`/dashboard/clientes/${propiedad.cliente.id}`}
    />
  );
}
