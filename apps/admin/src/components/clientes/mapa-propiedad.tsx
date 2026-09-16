"use client";

import { useCallback, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
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
 * **Google Maps.** Empezó con Leaflet sobre OpenStreetMap, que no pide clave ni
 * tarjeta, y el callejero alcanzaba para la ciudad pero no para adentro de las
 * urbanizaciones privadas —que es justo donde están casi todas las propiedades
 * de este vivero—. La clave viaja al navegador porque no hay otra forma: lo que
 * la protege es la restricción por dominio en la consola de Google, no
 * esconderla.
 *
 * Tres cosas que lo hacen usable, y las tres son la misma idea —**el mapa va a
 * donde está el pin**, en vez de dejar que uno lo busque—:
 *
 * - Poner el pin con *Usar mi ubicación* mueve el mapa hasta él. Antes el pin
 *   caía en la posición real y el mapa se quedaba donde estaba, así que había
 *   que ir a buscarlo con el dedo.
 * - Se puede **buscar una dirección**. Buscar no pone el pin a propósito: el
 *   resultado de "Blue Bay, Isla Mocolí" es el centro de la urbanización, que
 *   es justo el dato que este campo viene a reemplazar. Deja el mapa en el
 *   barrio y el ajuste fino se hace tocando.
 * - Abrir una propiedad que ya tiene pin arranca sobre él y con zoom de calle.
 */

/** Guayaquil. Desde dónde arranca el mapa cuando la propiedad no tiene pin. */
const CENTRO_POR_DEFECTO = { lat: -2.1709, lng: -79.9224 };
/** El zoom con el que se distingue una casa de la de al lado. */
const ZOOM_DE_CALLE = 19;

interface Punto {
  lat: number;
  lng: number;
}

export function MapaPropiedad({
  lat,
  lng,
  onCambio,
}: {
  lat: number | null;
  lng: number | null;
  onCambio: (punto: Punto | null) => void;
}) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

  /*
   * Sin clave no hay mapa, y decirlo es mejor que dibujar un rectángulo gris.
   *
   * Pasa en un entorno recién clonado y en una preview sin la variable: quien
   * lo vea tiene que saber qué falta, no creer que el mapa se rompió.
   */
  if (!apiKey) {
    return (
      <div className="rounded-xl border border-dashed p-6 text-center">
        <p className="text-sm font-semibold">El mapa no está configurado</p>
        <p className="mt-1 text-xs text-muted-foreground">
          Falta <code>NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</code>. Todo lo demás de
          la propiedad se puede cargar igual.
        </p>
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey} libraries={["places"]}>
      <Mapa lat={lat} lng={lng} onCambio={onCambio} />
    </APIProvider>
  );
}

function Mapa({
  lat,
  lng,
  onCambio,
}: {
  lat: number | null;
  lng: number | null;
  onCambio: (punto: Punto | null) => void;
}) {
  const map = useMap();
  const [ubicando, setUbicando] = useState(false);
  /*
   * Desde dónde arranca el mapa, calculado una sola vez.
   *
   * En estado y no en una `ref` porque leer una `ref` durante el render es
   * justo lo que el compilador de React no deja: el valor podría cambiar entre
   * el render y lo que se pinta. Acá da igual —es el valor inicial y nada
   * más—, pero el que sí importa es el de al lado: si esto se recalculara en
   * cada render, mover el mapa a mano se desharía solo.
   */
  const [vistaInicial] = useState(() =>
    lat !== null && lng !== null
      ? { centro: { lat, lng }, zoom: ZOOM_DE_CALLE }
      : { centro: CENTRO_POR_DEFECTO, zoom: 12 }
  );

  /** Llevar el mapa a un punto, opcionalmente acercándolo. */
  const irA = useCallback(
    (p: Punto, zoom?: number) => {
      if (!map) return;
      map.panTo(p);
      if (zoom !== undefined) map.setZoom(zoom);
    },
    [map]
  );

  /** Poner el pin **y** llevar el mapa hasta él. */
  const ponerPin = useCallback(
    (p: Punto | null, acercar = false) => {
      onCambio(p);
      if (p) irA(p, acercar ? ZOOM_DE_CALLE : undefined);
    },
    [irA, onCambio]
  );

  return (
    <div className="space-y-2">
      <Buscador onElegir={(p) => irA(p, 18)} />

      <div className="h-80 w-full overflow-hidden rounded-xl border">
        <Map
          defaultCenter={vistaInicial.centro}
          defaultZoom={vistaInicial.zoom}
          gestureHandling="greedy"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          // El satélite es lo que deja reconocer una casa por su techo y su
          // jardín, que es más fácil que leer el número desde el mapa.
          mapTypeId="hybrid"
          onClick={(e) => {
            const p = e.detail.latLng;
            if (p) ponerPin({ lat: p.lat, lng: p.lng });
          }}
          className="h-full w-full"
        >
          {lat !== null && lng !== null && (
            /* El marcador clásico y no `AdvancedMarker`: ese necesita un Map ID
               creado aparte en la consola de Google, un paso más de
               configuración para un pin que se arrastra igual. */
            <Marker
              position={{ lat, lng }}
              draggable
              onDragEnd={(e) => {
                const p = e.latLng;
                // Arrastrando, el mapa no se mueve: el pin ya está donde el
                // dedo lo dejó.
                if (p) onCambio({ lat: p.lat(), lng: p.lng() });
              }}
            />
          )}
        </Map>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          {lat !== null && lng !== null ? (
            <>
              <button
                type="button"
                onClick={() => irA({ lat, lng }, ZOOM_DE_CALLE)}
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

/**
 * Buscar una dirección con Places.
 *
 * Se busca al apretar Enter o el botón y no mientras se escribe: cada consulta
 * a Places se factura, así que una por búsqueda y no una por tecla. Acotado a
 * Ecuador, que es donde están todas las propiedades.
 */
function Buscador({ onElegir }: { onElegir: (p: Punto) => void }) {
  const places = useMapsLibrary("places");
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [resultados, setResultados] = useState<
    { id: string; nombre: string; punto: Punto }[] | null
  >(null);

  // El servicio necesita un nodo del DOM para atribuir el uso; uno suelto
  // alcanza y no se muestra.
  const nodo = useRef<HTMLDivElement>(null);

  async function buscar() {
    const q = texto.trim();
    if (!places || q.length < 3) return;
    setBuscando(true);
    try {
      const servicio = new places.PlacesService(
        nodo.current ?? document.createElement("div")
      );
      const encontrados = await new Promise<google.maps.places.PlaceResult[]>(
        (resolve) => {
          servicio.textSearch(
            { query: q, region: "ec" },
            (res) => resolve(res ?? [])
          );
        }
      );
      setResultados(
        encontrados.slice(0, 5).map((r, i) => ({
          id: r.place_id ?? String(i),
          nombre: [r.name, r.formatted_address].filter(Boolean).join(" · "),
          punto: {
            lat: r.geometry?.location?.lat() ?? 0,
            lng: r.geometry?.location?.lng() ?? 0,
          },
        }))
      );
    } catch {
      setResultados([]);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div className="relative">
      <div ref={nodo} className="hidden" />
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
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
          disabled={buscando || !places || texto.trim().length < 3}
        >
          {buscando ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
        </Button>
      </div>

      {resultados !== null && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
          {resultados.length === 0 ? (
            <p className="px-3 py-2.5 text-sm text-muted-foreground">
              Sin resultados. Acerca el mapa a mano y toca el punto.
            </p>
          ) : (
            resultados.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => {
                  // Solo mueve el mapa: el pin lo pone la persona, porque el
                  // resultado de una urbanización es su centro.
                  onElegir(r.punto);
                  setResultados(null);
                  setTexto("");
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
  );
}
