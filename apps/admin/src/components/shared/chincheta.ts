/**
 * El pin del sistema: una chincheta roja con la punta en el punto.
 *
 * Vive acá porque lo dibujan **tres** pantallas —la ficha de la visita, el
 * editor de la propiedad y la app— y un marcador que se ve distinto en cada una
 * es una pantalla que parece de otro producto. En el teléfono es el mismo
 * dibujo hecho con vistas (`components/UbicacionPropiedad.tsx`); acá es el SVG
 * equivalente, con las mismas medidas: bola de 18 con dos píxeles de aro, aguja
 * de 2 con un píxel de filo blanco a cada lado, y el punto de luz que la hace
 * leer como una esfera y no como un círculo plano.
 *
 * Reemplaza al marcador de Google, que es una gota rellena: sobre los techos de
 * teja —que en media Samborondón son casi de ese rojo— se apoyaba sin
 * despegarse, y tapaba con su cuerpo justo la casa que uno quiere mirar.
 *
 * **Se arma recién cuando la API terminó de cargar**: `google.maps.Size` y
 * `google.maps.Point` no existen antes, y sin esperar el marcador sale con el
 * pin de Google. `useApiIsLoaded()` es la guarda.
 */
const ANCHO = 20;
const ALTO = 30;

const SVG = `<svg xmlns="http://www.w3.org/2000/svg" width="${ANCHO}" height="${ALTO}" viewBox="0 0 ${ANCHO} ${ALTO}">
  <rect x="8" y="9" width="4" height="21" rx="2" fill="#ffffff"/>
  <rect x="9" y="10" width="2" height="19" rx="1" fill="#2f3330"/>
  <circle cx="10" cy="9" r="9" fill="#ffffff"/>
  <circle cx="10" cy="9" r="7" fill="#c8393a"/>
  <circle cx="7.2" cy="6.2" r="2" fill="#ffffff" fill-opacity="0.8"/>
</svg>`;

export function chincheta(): google.maps.Icon {
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(SVG)}`,
    scaledSize: new google.maps.Size(ANCHO, ALTO),
    // El ancla en la punta, que es lo que señala: sin esto Google centra la
    // imagen sobre el punto y la casa queda a media bola de distancia.
    anchor: new google.maps.Point(ANCHO / 2, ALTO),
  };
}
