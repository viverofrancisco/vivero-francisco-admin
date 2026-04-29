import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth-helpers";
import bcrypt from "bcryptjs";
import { z } from "zod/v4";

const updateSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio").optional(),
  apellido: z.string().optional(),
  email: z.email("Email inválido").optional(),
  password: z.string().min(6, "La contraseña debe tener al menos 6 caracteres").optional(),
  sectorIds: z.array(z.string()).optional(),
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const found = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      apellido: true,
      email: true,
      role: true,
      createdAt: true,
      sectorAdmins: {
        select: {
          sector: { select: { id: true, nombre: true } },
        },
      },
    },
  });

  if (!found) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  return NextResponse.json(found);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getCurrentUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const body = await request.json();
  const result = updateSchema.safeParse(body);

  if (!result.success) {
    return NextResponse.json(
      { error: "Datos inválidos", details: result.error.issues },
      { status: 400 }
    );
  }

  const data = result.data;

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Usuario no encontrado" }, { status: 404 });
  }

  if (data.email && data.email !== existing.email) {
    const emailTaken = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailTaken) {
      return NextResponse.json(
        { error: "Ya existe un usuario con ese email" },
        { status: 409 }
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.apellido !== undefined) updateData.apellido = data.apellido || null;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.password) updateData.password = await bcrypt.hash(data.password, 12);

    const updatedUser = await tx.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        apellido: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (data.sectorIds !== undefined) {
      await tx.sectorAdmin.deleteMany({ where: { userId: id } });
      if (data.sectorIds.length > 0) {
        await tx.sectorAdmin.createMany({
          data: data.sectorIds.map((sectorId) => ({
            sectorId,
            userId: id,
          })),
        });
      }
    }

    return updatedUser;
  });

  return NextResponse.json(updated);
}
