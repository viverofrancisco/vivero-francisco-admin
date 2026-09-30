import { NextResponse } from "next/server";
import { APP_IOS_APP_ID, RUTA_ENLACE_DE_ACCESO } from "@/lib/enlaces-a-la-app";

/**
 * Universal Links de iOS: Apple lee este archivo (a través de su CDN, al
 * instalar la app) y desde entonces un enlace a `/establecer-contrasena` del
 * dominio abre en la app en vez de en Safari. Tiene que servirse por HTTPS,
 * sin redirecciones y como JSON; el nombre no lleva extensión, por eso es una
 * ruta y no un archivo en `public/`, que saldría como binario.
 */
export function GET() {
  return NextResponse.json(
    {
      applinks: {
        details: [
          {
            appIDs: [APP_IOS_APP_ID],
            components: [
              {
                "/": RUTA_ENLACE_DE_ACCESO,
                "?": { token: "?*" },
                comment: "Invitación y restablecer contraseña",
              },
            ],
          },
        ],
      },
    },
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
