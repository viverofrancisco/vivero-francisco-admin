import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, isReadOnly } from "@/lib/auth-helpers";
import { clienteConPropiedadSchema } from "@/lib/validations/cliente";
import { createCliente, PROPIEDADES_DEL_CLIENTE } from "@/lib/services/cliente.service";
import { viewerFromSession } from "@/lib/auth-helpers";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (user.role === "PERSONAL") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const clientes = await prisma.cliente.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
    include: { propiedades: PROPIEDADES_DEL_CLIENTE },
  });

  return NextResponse.json(clientes);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  if (isReadOnly(user.role)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = clienteConPropiedadSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;
  const p = data.propiedad;

  // Por el servicio y no con un `create` suelto: es el que crea al cliente con
  // su primera propiedad adentro de la misma transacción.
  const cliente = await createCliente(await viewerFromSession(), {
    nombre: data.nombre || "",
    apellido: data.apellido || null,
    empresa: data.empresa || null,
    email: data.email || null,
    telefono: data.telefono || null,
    notas: data.notas || null,
    propiedad: {
      nombre: p?.nombre || null,
      ciudad: p?.ciudad || null,
      sectorId: p?.sectorId || null,
      direccion: p?.direccion || null,
      numeroCasa: p?.numeroCasa || null,
      referencia: p?.referencia || null,
      notas: p?.notas || null,
      lat: p?.lat ?? null,
      lng: p?.lng ?? null,
      m2Total: p?.m2Total ?? null,
      jardinerasPlantaAlta: p?.jardinerasPlantaAlta ?? false,
      numeroArboles: p?.numeroArboles ?? null,
      mlVegetacionBaja: p?.mlVegetacionBaja ?? null,
      mlVegetacionMedia: p?.mlVegetacionMedia ?? null,
      mlVegetacionAlta: p?.mlVegetacionAlta ?? null,
      m2Cesped: p?.m2Cesped ?? null,
    },
  });

  return NextResponse.json(cliente, { status: 201 });
}
