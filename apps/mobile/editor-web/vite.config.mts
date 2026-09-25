import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";

/**
 * Compila `editor-web/` a un solo HTML. Es la configuración que documenta
 * TenTap: en el bundle web solo entra su lado web, y `@tiptap/pm` se toma del
 * que ese lado ya trae adentro, o ProseMirror queda dos veces y las
 * extensiones no se entienden.
 */
export default defineConfig({
  root: import.meta.dirname,
  build: {
    outDir: "build",
    emptyOutDir: true,
    // El lado web de TenTap hace `require("expo-constants")` dentro de un
    // try/catch para saber si corre en Expo. En un proyecto sin Expo no
    // resuelve y queda como está; acá sí resuelve, y arrastra React Native
    // entero al bundle (y Vite no sabe leer Flow). Externo, el `require`
    // falla en el WebView y el catch lo atiende, que es lo que se espera.
    rollupOptions: { external: ["expo-constants"] },
  },
  resolve: {
    // Expresiones exactas y no prefijos: con el prefijo, el propio
    // `@10play/tentap-editor/web` se reescribía a `/web/web` y el bundle
    // terminaba cargando el lado nativo, que trae React Native adentro.
    alias: [
      { find: /^@10play\/tentap-editor$/, replacement: "@10play/tentap-editor/web" },
      { find: /^@tiptap\/pm\/(view|state)$/, replacement: "@10play/tentap-editor/web" },
    ],
  },
  plugins: [react(), viteSingleFile()],
  server: { port: 3000 },
});
