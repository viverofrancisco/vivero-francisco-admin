"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Crosshair, Trash2 } from "lucide-react";

/**
 * El punto exacto de una propiedad, elegido en el mapa.
 *
 * La dirección escrita no alcanza para encontrar una casa adentro de una
 * urbanización —"Blue Bay" son doscientas—, y es lo que va a permitir comparar
 * contra dónde se marcó la entrada: hasta ahora la marca traía coordenadas y no
 * había contra qué medirlas.
 *
 * **OpenStreetMap y no Google Maps**: no necesita clave ni facturación, que
 * para un portal de oficina es la diferencia entre funcionar y esperar a que
 * alguien saque una cuenta. Si algún día hace falta el callejero de Google, lo
 * único que cambia es la URL de los tiles.
 *
 * Se toca el mapa para poner el pin y se arrastra para corregirlo, como en
 * cualquier app de delivery. No hay buscador de direcciones: geocodificar
 * "Blue Bay, Isla Mocolí" devuelve el centro de la urbanización, que es
 * exactamente el dato que este campo viene a reemplazar.
 */

/** Guayaquil. Desde dónde arranca el mapa cuando la propiedad no tiene pin. */
const CENTRO_POR_DEFECTO: [number, number] = [-2.1709, -79.9224];

/**
 * El ícono por defecto de Leaflet busca sus PNG por ruta relativa y con un
 * bundler no los encuentra: sale un marcador roto. Este es un pin dibujado en
 * SVG, con el verde del sistema, y de paso no pesa nada.
 */
const PIN = L.divIcon({
  className: "",
  html: `<svg width="30" height="40" viewBox="0 0 24 32" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 20 12 20s12-11 12-20c0-6.6-5.4-12-12-12z" fill="#2d7b48"/>
    <circle cx="12" cy="12" r="4.5" fill="#fff"/>
  </svg>`,
  iconSize: [30, 40],
  iconAnchor: [15, 40],
});

function AlTocar({ onElegir }: { onElegir: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onElegir(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export function MapaPropiedad({
  lat,
  lng,
  onCambio,
}: {
  lat: number | null;
  lng: number | null;
  onCambio: (punto: { lat: number; lng: number } | null) => void;
}) {
  const [montado, setMontado] = useState(false);
  const marcador = useRef<L.Marker>(null);

  // Leaflet mide el contenedor al montarse y necesita el DOM: dentro de un
  // diálogo que todavía se está abriendo, mide cero y el mapa sale gris.
  useEffect(() => {
    const t = setTimeout(() => setMontado(true), 0);
    return () => clearTimeout(t);
  }, []);

  const centro = useMemo<[number, number]>(
    () => (lat !== null && lng !== null ? [lat, lng] : CENTRO_POR_DEFECTO),
    [lat, lng]
  );

  if (!montado) {
    return <div className="h-64 w-full animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-2">
      <div className="h-64 w-full overflow-hidden rounded-xl border">
        <MapContainer
          center={centro}
          zoom={lat !== null ? 17 : 12}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <AlTocar onElegir={(la, ln) => onCambio({ lat: la, lng: ln })} />
          {lat !== null && lng !== null && (
            <Marker
              position={[lat, lng]}
              icon={PIN}
              draggable
              ref={marcador}
              eventHandlers={{
                dragend: () => {
                  const p = marcador.current?.getLatLng();
                  if (p) onCambio({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {lat !== null && lng !== null ? (
            <span className="tabular-nums">
              {lat.toFixed(6)}, {lng.toFixed(6)}
            </span>
          ) : (
            "Toca el mapa para poner el pin en la entrada de la casa."
          )}
        </p>
        <div className="flex flex-none gap-2">
          {/* La ubicación de quien carga la propiedad, que muchas veces está
              parado en la puerta cuando la carga. */}
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              navigator.geolocation?.getCurrentPosition((pos) =>
                onCambio({
                  lat: pos.coords.latitude,
                  lng: pos.coords.longitude,
                })
              )
            }
          >
            <Crosshair className="mr-1.5 h-3.5 w-3.5" />
            Usar mi ubicación
          </Button>
          {lat !== null && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={() => onCambio(null)}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" />
              Quitar
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
