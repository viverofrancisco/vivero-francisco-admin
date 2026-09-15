import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { personalSchema } from "@/lib/validations/personal";
import { crearCuentaPersonal } from "@/lib/services/personal-acceso.service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const personal = await prisma.personal.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(personal);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const body = await request.json();
  const result = personalSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  // La ficha y su cuenta, juntas. Crear la cuenta aparte era un paso que
  // alguien se salteaba, y quedaba gente cargada que no podía entrar a la app;
  // nadie se enteraba hasta que había que cargar un parte. Una cuenta sin
  // contraseña no entra a ningún lado, así que crearla siempre no abre nada: al
  // que no deba entrar se le revoca el acceso desde su ficha.
  const personal = await prisma.$transaction(async (tx) => {
    const creado = await tx.personal.create({
      data: {
        nombre: data.nombre,
        apellido: data.apellido || null,
        telefono: data.telefono || null,

        especialidad: data.especialidad || null,
        sueldo: data.sueldo || null,
        estado: data.estado,
        tipo: data.tipo || null,
        createdById: user.id,
        updatedById: user.id,
      },
    });
    await crearCuentaPersonal(tx, creado);
    return creado;
  });

  return NextResponse.json(personal, { status: 201 });
}
