"use client";

import {
  APIProvider,
  Map,
  Marker,
  useApiIsLoaded,
} from "@vis.gl/react-google-maps";

/**
 * Un punto en el mapa, para mirar y nada más.
 *
 * El hermano de `MapaPropiedad`, que es el editor: ahí se arrastra el pin, se
 * busca una dirección y se usa la ubicación del navegador. Acá no hay nada que
 * decidir —la propiedad ya tiene su punto— así que no se comparte componente:
 * lo único en común es el `<Map>`, y un `soloLectura` en el editor significaría
 * apagar cinco comportamientos con un `if` cada uno.
 *
 * `gestureHandling="none"` a propósito: es una estampa dentro de una columna
 * que scrollea, y un mapa que se queda con la rueda del mouse convierte bajar
 * por la ficha en alejar el mapa. Para explorar está *Llegar*, que lo abre en
 * Google Maps.
 */
export function MapaUbicacion({
  lat,
  lng,
  className = "h-[150px]",
}: {
  lat: number;
  lng: number;
  /** El alto lo pone quien lo usa: no mide lo mismo en una ficha que en una lista. */
  className?: string;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return null;

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <APIProvider apiKey={apiKey}>
        <Lienzo lat={lat} lng={lng} />
      </APIProvider>
    </div>
  );
}

function Lienzo({ lat, lng }: { lat: number; lng: number }) {
  // El icono se arma con `google.maps.Point`, que existe recién cuando la API
  // terminó de cargar. Sin esperar, el marcador sale con el pin de Google.
  const cargada = useApiIsLoaded();

  return (
    <Map
      defaultCenter={{ lat, lng }}
      // 17, el mismo que la estampa de la app: es donde se leen el nombre
      // de la urbanización y el de la calle de entrada sin perder de vista
      // la casa. Dos pantallas que muestran lo mismo tienen que mostrar lo
      // mismo.
      defaultZoom={17}
      gestureHandling="none"
      disableDefaultUI
      keyboardShortcuts={false}
      // Satélite con etiquetas: adentro de una urbanización privada el
      // callejero no dice nada y el techo con su jardín sí.
      mapTypeId="hybrid"
      className="h-full w-full"
    >
      {cargada ? <Marker position={{ lat, lng }} icon={chincheta()} /> : null}
    </Map>
  );
}

/**
 * La chincheta, la misma que dibuja la app.
 *
 * Va como SVG en el `icon` del marcador y no como el pin de Google, para que la
 * ficha de una visita se vea igual en el portal y en el teléfono. Las medidas
 * son las de `UbicacionPropiedad`: bola de 18 con dos píxeles de aro, aguja de
 * 2 con un píxel de filo blanco a cada lado, y el punto de luz que la hace leer
 * como una esfera.
 *
 * `anchor` en la punta, que es lo que señala: sin eso Google centra la imagen
 * sobre el punto y la casa queda a media bola de distancia.
 */
function chincheta(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="30" viewBox="0 0 20 30">
    <rect x="8" y="9" width="4" height="21" rx="2" fill="#ffffff"/>
    <rect x="9" y="10" width="2" height="19" rx="1" fill="#2f3330"/>
    <circle cx="10" cy="9" r="9" fill="#ffffff"/>
    <circle cx="10" cy="9" r="7" fill="#c8393a"/>
    <circle cx="7.2" cy="6.2" r="2" fill="#ffffff" fill-opacity="0.8"/>
  </svg>`;
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
    scaledSize: new google.maps.Size(20, 30),
    anchor: new google.maps.Point(10, 30),
  };
}
