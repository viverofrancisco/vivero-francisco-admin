import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";

const inviteSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  apellido: z.string().optional(),
  email: z.email("Email inválido"),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres"),
  role: z.enum(["STAFF", "PERSONAL_ADMIN"]),
  sectorIds: z.array(z.string()).optional(),
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

  const hashedPassword = await bcrypt.hash(data.password, 12);
  const newUser = await prisma.$transaction(async (tx) => {
    const createdUser = await tx.user.create({
      data: {
        name: data.name,
        apellido: data.apellido,
        email: data.email,
        password: hashedPassword,
        role: data.role,
      },
    });

    if (data.role === "PERSONAL_ADMIN" && data.sectorIds?.length) {
      await tx.sectorAdmin.createMany({
        data: data.sectorIds.map((sectorId) => ({
          sectorId,
          userId: createdUser.id,
        })),
      });
    }

    return createdUser;
  });

  return NextResponse.json(
    {
      id: newUser.id,
      name: newUser.name,
      apellido: newUser.apellido,
      email: newUser.email,
      role: newUser.role,
      createdAt: newUser.createdAt,
    },
    { status: 201 }
  );
}
