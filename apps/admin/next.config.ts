import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
  ],
};

export default nextConfig;
