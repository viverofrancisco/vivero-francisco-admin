/**
 * El logo de la empresa, para los comprobantes.
 *
 * Vive en `EmpresaConfig` y se baja de R2 en el momento de renderizar. **Que
 * falte no rompe nada**: el RIDE sale sin logo y sigue siendo válido, así que
 * un problema para bajarlo no puede tumbar una emisión. Queda avisado en el
 * log, porque si no, el PDF se ve "bien" hasta que alguien lo compara con uno
 * viejo.
 */
import { prisma } from "@/lib/prisma";

export interface LogoEmpresa {
  bytes: Uint8Array;
  format: "png" | "jpg";
}

export async function logoDeLaEmpresa(): Promise<LogoEmpresa | null> {
  const config = await prisma.empresaConfig.findUnique({
    where: { id: "default" },
    select: { logoUrl: true },
  });
  if (!config?.logoUrl) return null;

  try {
    const res = await fetch(config.logoUrl);
    if (!res.ok) {
      console.warn(
        `Logo de la empresa: ${res.status} al bajar ${config.logoUrl}. ` +
          `El comprobante sale sin logo; volvé a subirlo en Configuración → Empresa.`
      );
      return null;
    }
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    return {
      bytes: new Uint8Array(await res.arrayBuffer()),
      // `@react-pdf/renderer` acepta png y jpg por el API de buffer.
      format: contentType.includes("png") ? "png" : "jpg",
    };
  } catch (error) {
    console.warn("No se pudo bajar el logo de la empresa para el PDF", error);
    return null;
  }
}
