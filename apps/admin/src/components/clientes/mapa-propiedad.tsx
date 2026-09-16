"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, Search, Trash2 } from "lucide-react";

/**
 * El punto exacto de una propiedad, elegido en el mapa.
 *
 * La dirección escrita no alcanza para encontrar una casa adentro de una
 * urbanización —"Blue Bay" son doscientas—, y es lo que va a permitir comparar
 * contra dónde se marcó la entrada: hasta ahora la marca traía coordenadas y no
 * había contra qué medirlas.
 *
 * **OpenStreetMap y no Google Maps**: no necesita clave ni cuenta de
 * facturación, que para un portal de oficina es la diferencia entre funcionar y
 * esperar a que alguien saque una cuenta. Si algún día hace falta el callejero
 * de Google, lo que cambia es la URL de las teselas y la clave.
 *
 * Tres cosas que lo hacen usable, y las tres son la misma idea —**el mapa va a
 * donde está el pin**, en vez de dejar que uno lo busque—:
 *
 * - Poner el pin con *Usar mi ubicación* mueve el mapa hasta él. Antes el pin
 *   caía en la posición real y el mapa se quedaba donde estaba, así que había
 *   que ir a buscarlo con el dedo.
 * - Se puede **buscar una dirección**: eso deja el mapa en el barrio, y el
 *   ajuste fino se hace tocando. Buscar no pone el pin a propósito —el
 *   resultado de "Blue Bay, Isla Mocolí" es el centro de la urbanización, que
 *   es justo el dato que este campo viene a reemplazar—.
 * - Abrir una propiedad que ya tiene pin arranca sobre él y con zoom de calle.
 */

/** Guayaquil. Desde dónde arranca el mapa cuando la propiedad no tiene pin. */
const CENTRO_POR_DEFECTO: [number, number] = [-2.1709, -79.9224];
/** El zoom con el que se distingue una casa de la de al lado. */
const ZOOM_DE_CALLE = 18;

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

interface Lugar {
  nombre: string;
  lat: number;
  lng: number;
}

function AlTocar({ onElegir }: { onElegir: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onElegir(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/**
 * Lleva el mapa a donde le digan.
 *
 * Es un componente y no una `ref` porque `useMap` solo existe adentro del
 * `MapContainer`; desde afuera no hay instancia a la cual pedirle nada.
 */
function IrA({ destino }: { destino: { lat: number; lng: number; zoom?: number } | null }) {
  const map = useMap();
  const ultimo = useRef<string>("");

  useEffect(() => {
    if (!destino) return;
    // Sin esta guarda, cada render repetiría el vuelo y el mapa quedaría
    // peleando con quien esté arrastrándolo.
    const clave = `${destino.lat},${destino.lng},${destino.zoom ?? ""}`;
    if (clave === ultimo.current) return;
    ultimo.current = clave;
    map.flyTo([destino.lat, destino.lng], destino.zoom ?? map.getZoom(), {
      duration: 0.6,
    });
  }, [destino, map]);

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
  const [destino, setDestino] = useState<{
    lat: number;
    lng: number;
    zoom?: number;
  } | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [resultados, setResultados] = useState<Lugar[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [ubicando, setUbicando] = useState(false);
  const marcador = useRef<L.Marker>(null);

  // Leaflet mide el contenedor al montarse y necesita el DOM: dentro de un
  // contenedor que todavía se está abriendo, mide cero y el mapa sale gris.
  useEffect(() => {
    const t = setTimeout(() => setMontado(true), 0);
    return () => clearTimeout(t);
  }, []);

  const centro = useMemo<[number, number]>(
    () => (lat !== null && lng !== null ? [lat, lng] : CENTRO_POR_DEFECTO),
    // Solo el inicial: después manda `IrA`, o arrastrar el mapa se desharía
    // en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  /** Poner el pin **y** llevar el mapa hasta él. */
  const ponerPin = useCallback(
    (punto: { lat: number; lng: number } | null, acercar = false) => {
      onCambio(punto);
      if (punto) {
        setDestino({ ...punto, zoom: acercar ? ZOOM_DE_CALLE : undefined });
      }
    },
    [onCambio]
  );

  /**
   * Buscar una dirección con Nominatim, el buscador de OpenStreetMap.
   *
   * Gratis y sin clave, a cambio de un límite de una consulta por segundo: por
   * eso se busca al apretar Enter o el botón, y no mientras se escribe.
   * Acotado a Ecuador, que es donde están todas las propiedades.
   */
  async function buscar() {
    const q = busqueda.trim();
    if (q.length < 3) return;
    setBuscando(true);
    try {
      const url = new URL("https://nominatim.openstreetmap.org/search");
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("q", q);
      url.searchParams.set("countrycodes", "ec");
      url.searchParams.set("limit", "5");
      const res = await fetch(url);
      const datos = (await res.json()) as {
        display_name: string;
        lat: string;
        lon: string;
      }[];
      setResultados(
        datos.map((d) => ({
          nombre: d.display_name,
          lat: Number(d.lat),
          lng: Number(d.lon),
        }))
      );
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  if (!montado) {
    return <div className="h-80 w-full animate-pulse rounded-xl bg-muted" />;
  }

  return (
    <div className="space-y-2">
      {/* Buscar deja el mapa en el barrio; el punto exacto se toca. */}
      <div className="relative">
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // Adentro de un formulario, Enter lo enviaría.
                  e.preventDefault();
                  void buscar();
                }
                if (e.key === "Escape") setResultados(null);
              }}
              placeholder="Buscar una dirección o urbanización…"
              className="pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void buscar()}
            disabled={buscando || busqueda.trim().length < 3}
          >
            {buscando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              "Buscar"
            )}
          </Button>
        </div>

        {resultados !== null && (
          <div className="absolute z-1000 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
            {resultados.length === 0 ? (
              <p className="px-3 py-2.5 text-sm text-muted-foreground">
                Sin resultados. Acerca el mapa a mano y toca el punto.
              </p>
            ) : (
              resultados.map((r) => (
                <button
                  key={`${r.lat},${r.lng}`}
                  type="button"
                  onClick={() => {
                    // Solo mueve el mapa: el pin lo pone la persona, porque el
                    // resultado de una urbanización es su centro.
                    setDestino({ lat: r.lat, lng: r.lng, zoom: 17 });
                    setResultados(null);
                    setBusqueda("");
                  }}
                  className="block w-full px-3 py-2.5 text-left text-sm transition-colors hover:bg-muted"
                >
                  {r.nombre}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="h-80 w-full overflow-hidden rounded-xl border">
        <MapContainer
          center={centro}
          zoom={lat !== null ? ZOOM_DE_CALLE : 12}
          className="h-full w-full"
          scrollWheelZoom
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <IrA destino={destino} />
          <AlTocar onElegir={(la, ln) => ponerPin({ lat: la, lng: ln })} />
          {lat !== null && lng !== null && (
            <Marker
              position={[lat, lng]}
              icon={PIN}
              draggable
              ref={marcador}
              eventHandlers={{
                dragend: () => {
                  const p = marcador.current?.getLatLng();
                  // Arrastrando, el mapa no se mueve: el pin ya está donde el
                  // dedo lo dejó.
                  if (p) onCambio({ lat: p.lat, lng: p.lng });
                },
              }}
            />
          )}
        </MapContainer>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {lat !== null && lng !== null ? (
            <>
              <button
                type="button"
                onClick={() => setDestino({ lat, lng, zoom: ZOOM_DE_CALLE })}
                className="font-semibold text-primary hover:underline"
              >
                Centrar en el pin
              </button>
              <span className="ml-2 tabular-nums">
                {lat.toFixed(6)}, {lng.toFixed(6)}
              </span>
            </>
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
            disabled={ubicando}
            onClick={() => {
              if (!navigator.geolocation) return;
              setUbicando(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  ponerPin(
                    { lat: pos.coords.latitude, lng: pos.coords.longitude },
                    true
                  );
                  setUbicando(false);
                },
                () => setUbicando(false),
                { enableHighAccuracy: true, timeout: 10000 }
              );
            }}
          >
            {ubicando ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <Crosshair className="mr-1.5 h-3.5 w-3.5" />
            )}
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
