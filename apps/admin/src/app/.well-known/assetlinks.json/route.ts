import { NextResponse } from "next/server";
import { APP_ANDROID_PACKAGE, APP_ANDROID_SHA256 } from "@/lib/enlaces-a-la-app";

/**
 * App Links de Android: al instalar la app, el sistema lee este archivo y
 * comprueba que el certificado con el que viene firmada esté en la lista.
 * Desde entonces un enlace a `/establecer-contrasena` del dominio abre en la
 * app sin preguntar. Con una firma que no esté acá, abre en el navegador.
 */
export function GET() {
  return NextResponse.json(
    [
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: APP_ANDROID_PACKAGE,
          sha256_cert_fingerprints: APP_ANDROID_SHA256,
        },
      },
    ],
    {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=3600",
      },
    }
  );
}
