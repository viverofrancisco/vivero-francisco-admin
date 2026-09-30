import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireMobileRole, isMobileUser } from "@/lib/mobile/auth";
import { serviceErrorResponse, viewerFromMobileUser } from "@/lib/mobile/route-helpers";
import { guardarCertificado } from "@/lib/services/emisor.service";

/**
 * Carga el `.p12` desde la app. El portal lo manda como `multipart`; acá va
 * en base64 dentro del JSON, que es lo que `apiRequest` sabe mandar con el
 * token —un `.p12` pesa unos pocos KB—. Lo demás es `guardarCertificado`:
 * verifica la contraseña y lo guarda cifrado.
 */
const schema = z.object({
  certificado: z.string().min(10).max(200_000),
  password: z.string(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const u = await requireMobileRole(request, "ADMIN");
  if (!isMobileUser(u)) return u;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Falta el archivo del certificado." }, { status: 400 });
  }
  const { id } = await params;
  try {
    const datos = await guardarCertificado(
      viewerFromMobileUser(u),
      id,
      Buffer.from(parsed.data.certificado, "base64"),
      parsed.data.password
    );
    return NextResponse.json({
      sujeto: datos.sujeto,
      emisor: datos.emisor,
      vence: datos.vence.toISOString(),
    });
  } catch (error) {
    // Lo mismo que el portal: un archivo o una contraseña mal es un 400 con
    // su motivo, no un "Error interno".
    if (error instanceof Error && !("codigo" in error)) {
      const esDeArchivo =
        error.message.includes("certificado") || error.message.includes("contraseña");
      if (esDeArchivo) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
    }
    return serviceErrorResponse(error);
  }
}
