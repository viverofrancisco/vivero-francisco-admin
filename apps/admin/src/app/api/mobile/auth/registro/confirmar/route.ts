import { NextResponse } from "next/server";
import { confirmarRegistroSchema } from "@vivero/shared";
import { issueTokenPair } from "@/lib/mobile/tokens";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { confirmarRegistro } from "@/lib/services/registro-cliente.service";

/**
 * Crear una cuenta de cliente, segundo paso: el código. Si coincide, la
 * cuenta queda creada —o vinculada a la ficha que ya tenía ese correo— y la
 * respuesta es la misma que la del login, con la sesión abierta.
 */
export async function POST(request: Request) {
  const parsed = confirmarRegistroSchema.safeParse(
    await request.json().catch(() => ({}))
  );
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 }
    );
  }

  try {
    const { user, clienteId } = await confirmarRegistro(
      parsed.data.email,
      parsed.data.codigo
    );
    const tokens = await issueTokenPair({
      userId: user.id,
      role: "CLIENTE",
      personalId: null,
      clienteId,
      deviceInfo: request.headers.get("user-agent")?.slice(0, 200) ?? null,
    });
    return NextResponse.json({
      ...tokens,
      user: {
        id: user.id,
        role: "CLIENTE",
        name: user.name,
        apellido: user.apellido,
        email: user.email,
        usuario: user.usuario,
      },
    });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
