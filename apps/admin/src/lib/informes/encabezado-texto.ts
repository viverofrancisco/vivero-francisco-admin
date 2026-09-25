/**
 * El texto plano del encabezado y las secciones, sin un DOM.
 *
 * Vive en `@vivero/shared` (`informe.ts`): la app escribe el encabezado por
 * renglones y las secciones con su propio editor, y parte y simplifica lo que
 * devuelve con estas mismas reglas. Este módulo queda como la puerta por la
 * que el portal siempre entró, para no tocar a quien lo importa. Aparte de
 * `encabezado.ts` a propósito: aquel usa `htmlparser2` para traducir el
 * formato al PDF, y esto corre también en el navegador.
 */
export {
  AZUL_INFORME,
  VERDE_INFORME,
  aHtml,
  encabezadoPorDefecto,
  esHtml,
  partirPrimerBloque,
  primeraLineaPlana,
  simplificarHtml,
  textoPlanoDeHtml,
} from "@vivero/shared";
