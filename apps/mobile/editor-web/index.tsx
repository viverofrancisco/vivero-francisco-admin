import React from "react";
import { createRoot } from "react-dom/client";
import { Editor } from "./Editor";

declare global {
  interface Window {
    contentInjected: boolean | undefined;
  }
}

/**
 * El arranque del editor simple de TenTap, tal cual: en Android el WebView a
 * veces inyecta el contenido después de cargar la ventana, así que se espera
 * a que esté antes de pintar.
 */
const reloj = setInterval(() => {
  if (!window.contentInjected) return;
  const raiz = document.getElementById("root");
  createRoot(raiz!).render(<Editor />);
  clearInterval(reloj);
}, 1);
