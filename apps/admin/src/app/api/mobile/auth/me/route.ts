import { NextResponse } from "next/server";
import { getMobileUser } from "@/lib/mobile/auth";

export async function GET(request: Request) {
  const user = await getMobileUser(request);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  return NextResponse.json({
    id: user.id,
    role: user.role,
    name: user.name,
    apellido: user.apellido,
    email: user.email,
    personalId: user.personalId,
    clienteId: user.clienteId,
  });
}
