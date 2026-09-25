/**
 * Las fuentes que el informe embarca, además de las tres que el PDF trae.
 *
 * `@react-pdf/renderer` solo conoce Helvetica, Times y Courier por sí mismo;
 * cualquier otra familia hay que registrarla con sus archivos antes de
 * dibujar. Van por ruta absoluta desde la raíz del proyecto, y por eso la
 * carpeta está en `outputFileTracingIncludes`: el rastreo de Vercel no ve un
 * archivo que se abre por ruta, igual que con la libvips de `sharp`.
 *
 * El registro es idempotente: react-pdf guarda las familias registradas en
 * un módulo, y volver a registrarlas en cada render es un no-op barato.
 */
import { existsSync } from "node:fs";
import path from "node:path";
import { Font } from "@react-pdf/renderer";
import type { FuenteDelInforme } from "./encabezado";

/** Las familias embarcadas: la carpeta bajo `fuentes/` y su nombre en react-pdf. */
export const FUENTES_EMBARCADAS: Partial<
  Record<FuenteDelInforme, { carpeta: string; familia: string }>
> = {
  ROBOTO: { carpeta: "roboto", familia: "Roboto" },
  OPEN_SANS: { carpeta: "opensans", familia: "Open Sans" },
  LATO: { carpeta: "lato", familia: "Lato" },
  MONTSERRAT: { carpeta: "montserrat", familia: "Montserrat" },
  POPPINS: { carpeta: "poppins", familia: "Poppins" },
  MERRIWEATHER: { carpeta: "merriweather", familia: "Merriweather" },
  PLAYFAIR: { carpeta: "playfairdisplay", familia: "Playfair Display" },
};

/**
 * Dónde están los archivos. En desarrollo el cwd es `apps/admin`; en Vercel
 * con `outputFileTracingRoot` en la raíz del monorepo puede ser esa raíz, así
 * que se prueban las dos.
 */
function carpetaDeFuentes(): string | null {
  const candidatas = [
    path.join(process.cwd(), "src", "lib", "informes", "fuentes"),
    path.join(process.cwd(), "apps", "admin", "src", "lib", "informes", "fuentes"),
  ];
  return candidatas.find((c) => existsSync(c)) ?? null;
}

let registradas = false;

/** Registra las familias embarcadas en react-pdf. Una vez por proceso. */
export function registrarFuentes(): void {
  if (registradas) return;
  const base = carpetaDeFuentes();
  if (!base) {
    // Sin la carpeta —un despliegue que no la trazó— el PDF sale igual, en
    // Helvetica: `estiloDelTrozo` cae a la familia estándar si esta no está.
    console.warn("[informes] no se encontró la carpeta de fuentes; se imprime en Helvetica");
    registradas = true;
    return;
  }
  for (const { carpeta, familia } of Object.values(FUENTES_EMBARCADAS)) {
    const archivo = (cara: string) => path.join(base, carpeta, `${carpeta}-${cara}.ttf`);
    if (!existsSync(archivo("Regular"))) continue;
    Font.register({
      family: familia,
      fonts: [
        { src: archivo("Regular"), fontWeight: 400, fontStyle: "normal" },
        { src: archivo("Bold"), fontWeight: 700, fontStyle: "normal" },
        { src: archivo("Italic"), fontWeight: 400, fontStyle: "italic" },
        { src: archivo("BoldItalic"), fontWeight: 700, fontStyle: "italic" },
      ],
    });
  }
  registradas = true;
}

/** Si la familia quedó registrada, para caer a Helvetica cuando no. */
export function fuenteRegistrada(fuente: FuenteDelInforme): boolean {
  const def = FUENTES_EMBARCADAS[fuente];
  if (!def) return false;
  const base = carpetaDeFuentes();
  return base !== null && existsSync(path.join(base, def.carpeta, `${def.carpeta}-Regular.ttf`));
}
