import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import { z } from "zod/v4";
import { crearEnlaceParaUsuario } from "@/lib/services/acceso.service";

/**
 * El admin ya no elige una contraseña por el otro: el usuario se crea **sin**
 * contraseña y recibe un enlace para ponerse la suya.
 *
 * La contraseña temporal obligaba a inventarla, dictarla por algún lado y
 * confiar en que la cambiaran después —cosa que no pasa—, y mientras tanto
 * quedaba una clave conocida por dos personas. Sin contraseña, la cuenta
 * existe pero no entra: los dos caminos de login rechazan a un usuario sin
 * `password`.
 */
const inviteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().optional(),
  email: z.email("Email inválido"),
  role: z.enum(["STAFF"]),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const body = await request.json();
  const result = inviteSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const existingUser = await prisma.user.findUnique({
    where: { email: data.email },
  });

  if (existingUser) {
    return NextResponse.json(
      { error: "Ya existe un usuario con ese email" },
      { status: 409 }
    );
  }

  const newUser = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: data.name,
        apellido: data.apellido,
        email: data.email,
        role: data.role,
      },
    });

    return createdUser;
  });

  const enlace = await crearEnlaceParaUsuario(newUser.id, "invitacion");

  // No se manda sola: el enlace se muestra para copiarlo o compartirlo, como el
  // del personal, y el correo es un botón en ese mismo diálogo
  // (`/enlace-acceso/enviar`). Mandarlo siempre obligaba a tener un correo
  // de verdad para dar de alta a alguien que igual recibe el enlace por
  // WhatsApp.

  return NextResponse.json(
    {
      id: newUser.id,
      name: newUser.name,
      apellido: newUser.apellido,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
      enlace: enlace.url,
      expiraEl: enlace.expiraEl.toISOString(),
      correoEnviado: false,
      correoIntentado: false,
    },
    { status: 201 }
  );
}
