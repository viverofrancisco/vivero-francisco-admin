import { NextResponse } from "next/server";
import { viewerFromSession } from "@/lib/auth-helpers";
import { getInforme } from "@/lib/services/informe.service";
import { serviceErrorResponse } from "@/lib/mobile/route-helpers";
import { getDownloadUrl } from "@/lib/s3";

/**
 * Baja el PDF del informe, guardándolo en la computadora.
 *
 * Existe porque el PDF vive en R2, en otro dominio, y ahí el atributo
 * `download` de un `<a>` no hace nada: el navegador lo ignora entre dominios y
 * termina abriendo el archivo. Redirigir a una URL firmada que trae
 * `Content-Disposition: attachment` sí lo guarda, y con el nombre del informe
 * en vez del uuid de la key.
 *
 * Redirige en vez de reenviar los bytes: el archivo va del navegador a R2
 * directo, sin pasar por acá.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const viewer = await viewerFromSession();
  const { id } = await params;
  try {
    const informe = await getInforme(viewer, id);
    const url = await getDownloadUrl(informe.pdfKey, nombreArchivo(informe));
    return NextResponse.redirect(url);
  } catch (error) {
    return serviceErrorResponse(error);
  }
}

/** El título del informe, sin lo que rompa un nombre de archivo. */
function nombreArchivo(informe: { titulo: string; numero: number }): string {
  const base = informe.titulo.trim() || `informe-${informe.numero}`;
  return `${base}.pdf`.replace(/[\\/:*?"<>|]+/g, "_");
}
