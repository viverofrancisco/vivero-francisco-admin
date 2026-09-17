"use client";

import { APIProvider, Map, Marker } from "@vis.gl/react-google-maps";

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
          {/* El marcador de Google, que ya es el pin rojo de siempre: el que
              había que cambiar era el de la app, que estaba en el verde de la
              marca y se perdía entre los árboles de la foto satelital. */}
          <Marker position={{ lat, lng }} />
        </Map>
      </APIProvider>
    </div>
  );
}
