import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import {
  guardarCertificado,
  quitarCertificado,
} from "@/lib/services/emisor.service";

/**
 * Carga el `.p12` de un emisor.
 *
 * Va por `multipart` y no por JSON porque es un archivo binario, y **no hay GET
 * acá a propósito**: el certificado entra y no vuelve a salir nunca. Lo que la
 * pantalla necesita saber —a nombre de quién está, hasta cuándo sirve— viaja en
 * la respuesta de esta misma llamada y queda guardado en el emisor.
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;

  const form = await request.formData();
  const archivo = form.get("certificado");
  const password = String(form.get("password") ?? "");
  if (!(archivo instanceof File)) {
    return NextResponse.json(
      { error: "Falta el archivo del certificado." },
      { status: 400 }
    );
  }

  try {
    const datos = await guardarCertificado(
      viewer,
      id,
      Buffer.from(await archivo.arrayBuffer()),
      password
    );
    return NextResponse.json({
      sujeto: datos.sujeto,
      emisor: datos.emisor,
      vence: datos.vence.toISOString(),
    });
  } catch (error) {
    // Un archivo que no es, o una contraseña equivocada, no son un 500: son
    // algo que la persona puede arreglar y el mensaje lo dice.
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

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    await quitarCertificado(viewer, id);
    return NextResponse.json({ message: "Certificado quitado" });
  } catch (error) {
    return serviceErrorResponse(error);
  }
}
