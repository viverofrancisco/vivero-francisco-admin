import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-helpers";
import { NuevaVisitaPage } from "@/components/visitas/nueva-visita-page";

export default async function NuevaVisitaRoute({
  searchParams,
}: {
  searchParams: Promise<{ suscripcion?: string; solicitud?: string }>;
}) {
  await requireAuth();
  // Llegar desde una suscripción deja el plan puesto: "nueva visita de este
  // plan" es una sola acción, no elegir cliente y plan de nuevo. Llegar desde
  // una solicitud deja puestos su cliente y, si eligió una, su propiedad; la
  // de un invitado, o una con otra dirección, los trae escritos para crearlos
  // ahí mismo.
  const { suscripcion, solicitud: solicitudId } = await searchParams;
  const solicitud = solicitudId
    ? await prisma.solicitudCliente.findFirst({
        where: { id: solicitudId },
        select: {
          id: true,
          numero: true,
          mensaje: true,
          direccion: true,
          calle: true,
          numeroCasa: true,
          ciudad: true,
          referencia: true,
          lat: true,
          lng: true,
          contactoNombre: true,
          contactoTelefono: true,
          contactoEmail: true,
          clienteId: true,
          propiedadId: true,
          servicios: { select: { producto: { select: { nombre: true } } } },
          otroServicio: true,
        },
      })
    : null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const clientesWhere: any = {};


  const [clientes, tareas, grupos, personalList] = await Promise.all([
    prisma.cliente.findMany({
      where: { ...clientesWhere, deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        apellido: true,
        empresa: true,
        inactivoDesde: true,
        // Dónde se le trabaja. Con una sola, el formulario la elige solo.
        propiedades: {
          where: { deletedAt: null },
          select: { id: true, nombre: true, direccion: true },
          orderBy: { createdAt: "asc" },
        },
        // Sus planes activos, con su propiedad: elegir el plan elige el
        // jardín, y al revés el jardín acota qué planes se ofrecen.
        suscripciones: {
          where: { estado: "ACTIVO" },
          select: {
            id: true,
            numero: true,
            periodicidad: true,
            visitasPorPeriodo: true,
            propiedad: { select: { id: true, nombre: true } },
          },
          orderBy: { numero: "asc" },
        },
      },
    }),
    // El catálogo de tareas, para poder exigir alguna. Va completo: exigir una
    // tarea no depende de qué tenga contratado el cliente.
    prisma.tarea.findMany({
      where: { deletedAt: null },
      orderBy: [{ orden: "asc" }, { nombre: "asc" }],
      select: { id: true, nombre: true },
    }),
    prisma.grupo.findMany({
      where: { deletedAt: null },
      orderBy: { nombre: "asc" },
      select: {
        id: true,
        nombre: true,
        miembros: {
          select: { personalId: true },
        },
      },
    }),
    prisma.personal.findMany({
      where: { deletedAt: null, estado: "ACTIVO" },
      select: { id: true, nombre: true, apellido: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const clientesSerialized = clientes.map((c) => ({
    inactivoDesde: c.inactivoDesde?.toISOString() ?? null,
    id: c.id,
    nombre: c.nombre,
    apellido: c.apellido,
    empresa: c.empresa,
    propiedades: c.propiedades,
    // Sus planes activos, para elegir de cuál es la visita.
    suscripciones: c.suscripciones.map((sus) => ({
      id: sus.id,
      numero: sus.numero,
      periodicidad: sus.periodicidad as string,
      visitasPorPeriodo: sus.visitasPorPeriodo,
      propiedad: sus.propiedad,
    })),
  }));

  const gruposSerialized = grupos.map((g) => ({
    id: g.id,
    nombre: g.nombre,
    miembrosIds: g.miembros.map((m) => m.personalId),
  }));

  return (
    <NuevaVisitaPage
      suscripcionInicial={suscripcion}
      solicitud={
        solicitud
          ? {
              id: solicitud.id,
              numero: solicitud.numero,
              mensaje: solicitud.mensaje,
              direccion: solicitud.direccion,
              clienteId: solicitud.clienteId,
              propiedadId: solicitud.propiedadId,
              contacto: {
                nombre: solicitud.contactoNombre,
                telefono: solicitud.contactoTelefono,
                email: solicitud.contactoEmail,
              },
              // Las de antes guardaban la dirección en una línea: va a la calle.
              lugar: {
                direccion: solicitud.calle ?? solicitud.direccion ?? "",
                numeroCasa: solicitud.numeroCasa ?? "",
                ciudad: solicitud.ciudad ?? "",
                referencia: solicitud.referencia ?? "",
                lat: solicitud.lat,
                lng: solicitud.lng,
              },
              servicios: [
                ...solicitud.servicios.map((x) => x.producto.nombre),
                ...(solicitud.otroServicio ? ["Otros"] : []),
              ],
            }
          : undefined
      }
      clientes={clientesSerialized}
      tareas={tareas}
      grupos={gruposSerialized}
      personalList={personalList}
    />
  );
}
