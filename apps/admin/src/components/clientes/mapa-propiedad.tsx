"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  Marker,
  useApiIsLoaded,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import { Button } from "@/components/ui/button";
import { chincheta } from "@/components/shared/chincheta";
import { Input } from "@/components/ui/input";
import { Crosshair, Loader2, Search, Trash2, X } from "lucide-react";

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
 * donde está el pin**, en vez de dejar que uno lo busque—. Poner el pin a mano
 * es la excepción, y por el mismo motivo: tocando o arrastrando el mapa se
 * queda quieto, porque el punto ya está donde el dedo lo puso.
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

/**
 * Cuánto acercar según lo que el navegador dice que sabe.
 *
 * Una lectura de ±20 m es un GPS y aguanta el zoom de casa; una de ±2 km es la
 * antena de la operadora, y mostrarla de cerca haría creer que el pin está
 * bien puesto.
 */
function zoomSegunPrecision(metros: number): number {
  if (metros <= 30) return ZOOM_DE_CALLE;
  if (metros <= 150) return 17;
  if (metros <= 1000) return 15;
  return 13;
}

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
  // El icono del pin se arma con `google.maps.Point`, que no existe hasta que
  // la API terminó de cargar.
  const apiLista = useApiIsLoaded();
  const [ubicando, setUbicando] = useState(false);
  /**
   * Con cuántos metros de error llegó la última lectura del navegador.
   *
   * En una computadora la posición sale del WiFi o de la IP, no de un GPS:
   * puede errarle cien metros o dos kilómetros, y `enableHighAccuracy` no lo
   * arregla porque no hay GPS del cual sacar algo mejor. Decir el número es lo
   * único honesto —el pin cae en el centro de esa nube, no en la puerta— y es
   * lo que le dice a quien lo usa si tiene que corregirlo a mano.
   */
  const [precision, setPrecision] = useState<number | null>(null);
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

  return (
    <div className="space-y-2">
      <Buscador onElegir={(p) => irA(p, 18)} />

      {/* 450 px: con el mapa más alto, la franja de atribución de Google —que
          los términos de Maps Platform obligan a dejar visible— pesa menos en
          proporción, y el pin no queda contra un borde apenas uno se mueve. */}
      <div className="h-[450px] w-full overflow-hidden rounded-xl border">
        <Map
          defaultCenter={vistaInicial.centro}
          defaultZoom={vistaInicial.zoom}
          /*
           * `cooperative` y no `greedy`: con `greedy` el mapa se queda con la
           * rueda del mouse, así que bajar por el formulario se convertía en
           * alejar el mapa apenas el cursor lo cruzaba. Así la rueda scrollea
           * la página —que es lo que uno estaba haciendo— y para hacer zoom se
           * usa ⌘/Ctrl + rueda, que el propio mapa avisa cuando hace falta.
           */
          gestureHandling="cooperative"
          disableDefaultUI={false}
          mapTypeControl={false}
          streetViewControl={false}
          fullscreenControl={false}
          // El satélite es lo que deja reconocer una casa por su techo y su
          // jardín, que es más fácil que leer el número desde el mapa.
          mapTypeId="hybrid"
          onClick={(e) => {
            /*
             * Tocar pone el pin y **no** mueve el mapa, igual que arrastrarlo:
             * el punto ya está donde el dedo lo puso, y centrarlo ahí corre
             * todo lo que se estaba mirando para ubicarlo —la esquina, el
             * techo de al lado— justo cuando se lo está por corregir.
             */
            const p = e.detail.latLng;
            if (p) onCambio({ lat: p.lat, lng: p.lng });
          }}
          className="h-full w-full"
        >
          {lat !== null && lng !== null && apiLista && (
            /* El marcador clásico y no `AdvancedMarker`: ese necesita un Map ID
               creado aparte en la consola de Google, un paso más de
               configuración para un pin que se arrastra igual.

               Con la chincheta del sistema, la misma que muestran la ficha de
               la visita y la app: el punto que se elige acá es el que se ve
               allá, y con dos dibujos distintos no se reconoce que es el
               mismo. */
            <Marker
              position={{ lat, lng }}
              icon={chincheta()}
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
              {precision !== null && (
                <span
                  className={`ml-2 ${
                    precision > 150 ? "text-warning-foreground" : ""
                  }`}
                >
                  {precision > 150
                    ? `Tu ubicación llegó con ±${Math.round(
                        precision
                      )} m: arrastrá el pin hasta la puerta.`
                    : `±${Math.round(precision)} m`}
                </span>
              )}
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
                  const metros = pos.coords.accuracy;
                  setPrecision(metros);
                  onCambio({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                  });
                  // El zoom sigue a la precisión: acercar a nivel de casa una
                  // lectura de ±2 km dibuja una certeza que no existe.
                  irA(
                    { lat: pos.coords.latitude, lng: pos.coords.longitude },
                    zoomSegunPrecision(metros)
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
 * Buscar una dirección mientras se escribe, con Places Autocomplete.
 *
 * Empezó con un botón de *Buscar* por una razón concreta: cada consulta a
 * Places se factura, y buscar por tecla convierte "ribera del buijo" en
 * dieciséis llamadas. Lo que resuelve eso es el **token de sesión**: todas las
 * teclas de una misma búsqueda viajan con el mismo token y Google las cobra
 * como una, cerrando la sesión cuando se elige un resultado y se piden sus
 * datos. Por eso el token se renueva después de cada elección — reusarlo hace
 * que cada consulta vuelva a cobrarse por separado.
 *
 * Nació antes con `PlacesService`, que es la Places clásica, y con la nueva
 * habilitada y la vieja no, Google devolvía `REQUEST_DENIED`: la pantalla decía
 * "Sin resultados" y uno desconfiaba del buscador en vez de enterarse de que
 * faltaba una casilla en la consola. Por eso el error se muestra tal cual
 * viene.
 *
 * Elegir un resultado **mueve el mapa pero no pone el pin**, a propósito: lo
 * que devuelve "Blue Bay, Isla Mocolí" es el centro de la urbanización, que es
 * justo el dato que este campo viene a reemplazar.
 */
function Buscador({ onElegir }: { onElegir: (p: Punto) => void }) {
  const places = useMapsLibrary("places");
  const [texto, setTexto] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sugerencias, setSugerencias] = useState<
    { id: string; principal: string; secundario: string; pedir: () => Promise<Punto | null> }[] | null
  >(null);
  const caja = useRef<HTMLDivElement>(null);
  /** El token de la búsqueda en curso. Se renueva al elegir. */
  const sesion = useRef<google.maps.places.AutocompleteSessionToken | null>(null);

  /*
   * Cerrar la lista tocando afuera.
   *
   * Sin esto, la única salida era elegir una sugerencia: el desplegable quedaba
   * tapando el mapa y no había forma de decir "ninguna de estas".
   */
  useEffect(() => {
    if (sugerencias === null) return;
    const afuera = (e: MouseEvent) => {
      if (!caja.current?.contains(e.target as Node)) setSugerencias(null);
    };
    document.addEventListener("mousedown", afuera);
    return () => document.removeEventListener("mousedown", afuera);
  }, [sugerencias]);

  /*
   * Se consulta ~300 ms después de dejar de escribir.
   *
   * Aun con la sesión cobrando una sola vez, mandar una consulta por tecla es
   * ruido: el usuario todavía no terminó de escribir y las respuestas llegan
   * desordenadas.
   */
  useEffect(() => {
    const q = texto.trim();
    // Con menos de tres letras no se consulta; la lista la cierra quien
    // escribe (más abajo), no este efecto: limpiar estado acá de forma
    // síncrona dispara un render en cascada.
    if (!places || q.length < 3) return;

    let vigente = true;
    const t = setTimeout(async () => {
      setBuscando(true);
      setError(null);
      try {
        sesion.current ??= new places.AutocompleteSessionToken();
        const { suggestions } =
          await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: q,
            sessionToken: sesion.current,
            // Sesgado a Ecuador, que es donde están todas las propiedades.
            includedRegionCodes: ["ec"],
            language: "es",
          });
        if (!vigente) return;
        setSugerencias(
          suggestions.flatMap((s) => {
            const p = s.placePrediction;
            if (!p) return [];
            return [
              {
                id: p.placeId ?? String(p.text),
                principal: p.mainText?.toString() ?? p.text.toString(),
                secundario: p.secondaryText?.toString() ?? "",
                pedir: async () => {
                  // Pedir los datos es lo que **cierra** la sesión: de ahí en
                  // más el token ya no vale y hace falta uno nuevo.
                  const lugar = p.toPlace();
                  await lugar.fetchFields({ fields: ["location"] });
                  sesion.current = null;
                  const loc = lugar.location;
                  return loc ? { lat: loc.lat(), lng: loc.lng() } : null;
                },
              },
            ];
          })
        );
      } catch (e) {
        if (!vigente) return;
        // El error de Google dice exactamente qué falta —la API sin habilitar,
        // la clave sin facturación— y esconderlo detrás de "Sin resultados" es
        // lo que hace que se pierda una tarde.
        setError(e instanceof Error ? e.message : "No pudimos buscar");
        setSugerencias(null);
      } finally {
        if (vigente) setBuscando(false);
      }
    }, 300);

    return () => {
      vigente = false;
      clearTimeout(t);
    };
  }, [texto, places]);

  function limpiar() {
    setTexto("");
    setSugerencias(null);
    setError(null);
  }

  return (
    <div ref={caja} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={texto}
          onChange={(e) => {
            const v = e.target.value;
            setTexto(v);
            if (v.trim().length < 3) {
              setSugerencias(null);
              setError(null);
            }
          }}
          onKeyDown={(e) => {
            // Adentro de un formulario, Enter lo enviaría.
            if (e.key === "Enter") e.preventDefault();
            if (e.key === "Escape") setSugerencias(null);
          }}
          placeholder="Buscar una dirección o urbanización…"
          className="pl-9 pr-9"
        />
        {buscando ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        ) : (
          texto && (
            <button
              type="button"
              aria-label="Limpiar la búsqueda"
              onClick={limpiar}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )
        )}
      </div>

      {error && <p className="mt-1.5 text-xs text-destructive">{error}</p>}

      {sugerencias !== null && sugerencias.length > 0 && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-popover shadow-md">
          {sugerencias.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={async () => {
                const punto = await s.pedir();
                if (punto) onElegir(punto);
                limpiar();
              }}
              className="block w-full px-3 py-2.5 text-left transition-colors hover:bg-muted"
            >
              <span className="block truncate text-sm font-medium">
                {s.principal}
              </span>
              {s.secundario && (
                <span className="block truncate text-xs text-muted-foreground">
                  {s.secundario}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
