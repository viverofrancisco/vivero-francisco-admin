import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * La raíz del monorepo, no `apps/admin`.
   *
   * Las dependencias se instalan arriba (npm workspaces las sube), así que
   * rastreando desde acá quedaban afuera del lambda. Vercel lo deduce solo,
   * pero decirlo hace que el build local se comporte igual que el de allá.
   */
  outputFileTracingRoot: path.join(import.meta.dirname, "..", ".."),

  /**
   * La librería nativa de `sharp`, que hay que pedir a mano.
   *
   * `sharp` abre `libvips-cpp.so` con `dlopen` en tiempo de ejecución, y eso no
   * es un `import` que el rastreo pueda ver: se copiaba el binario de sharp
   * pero no la librería que necesita, y el lambda moría con
   * `ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.6: cannot open shared object file`.
   * Pasó en producción, en `/dashboard/informes`.
   *
   * Va para todas las rutas porque cualquiera puede terminar tocando una
   * imagen — el informe las achica al generarse, el catálogo las recorta.
   */
  outputFileTracingIncludes: {
    // `@img`: la libvips que `sharp` abre con dlopen. `ffmpeg-static`: el
    // binario que transcodifica los videos del chat; se resuelve por ruta,
    // así que el trazado tampoco lo ve solo.
    "/**": ["node_modules/@img/**", "node_modules/ffmpeg-static/**"],
  },

  /**
   * Paquetes que el servidor carga tal cual, sin pasarlos por el bundler.
   *
   * `xmllint-wasm` trae un `.wasm` y toca `fs`, y al intentar empaquetarlo
   * Turbopack se cae con "NftJsonAsset: cannot handle filepath fs". Lo mismo
   * vale para lo que lo usa: son dependencias de servidor —firmar y validar
   * comprobantes del SRI— que nunca tienen que llegar al navegador.
   */
  serverExternalPackages: [
    "facturacion-electronica-ec",
    "xmllint-wasm",
    "node-forge",
    // Binario nativo: empaquetarlo rompe la resolución de su `.node`.
    "sharp",
  ],
};

export default nextConfig;
