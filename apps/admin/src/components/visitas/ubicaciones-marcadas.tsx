import { MapPinned, ShieldAlert } from "lucide-react";
import { ubicacionDe, type PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Dónde estaba una marca, para la oficina.
 *
 * No dice "estuvo" ni "no estuvo": dice dónde estaba el teléfono cuando se
 * apretó el botón, que es lo único que el sistema sabe. Todavía no hay
 * coordenadas del sitio contra las cuales comparar —`Cliente` solo tiene la
 * dirección como texto—, así que por ahora el punto se muestra y se abre en un
 * mapa; el aviso de "a 3 km" llega cuando exista el pin del cliente.
 *
 * Lo que sí se señala es lo que se puede afirmar: que una marca vino **sin**
 * ubicación, y que Android dijo que venía de una app de mock.
 *
 * Va por marca y no por persona, y **pegada a su hora**: la entrada y la salida
 * son dos momentos distintos, y juntas en un renglón aparte había que volver a
 * emparejarlas con la hora de arriba para saber cuál era cuál. Por eso es un
 * `<span>` en línea con un "·" adelante y no un bloque.
 */
export function UbicacionDeMarca({
  parte,
  cual,
}: {
  parte: PersonalDeVisita;
  cual: "entrada" | "salida";
}) {
  const marcada = cual === "entrada" ? parte.entradaEl : parte.salidaEl;
  if (!marcada) return null;
  const ubi = ubicacionDe(parte, cual);

  /* Solo el ícono. El texto "ver en el mapa (±5 m)" era la mitad del renglón
     para algo que se toca de vez en cuando, y el nombre del enlace ya lo dice
     el pin. Lo que el texto sí decía —la precisión— vive en el `title`, que es
     donde se va a buscar cuando importa.

     Va adentro de un botón redondo del alto del renglón para que quede
     centrado con el texto por flexbox y no por alineación de línea, que con
     un ícono al lado de texto siempre queda un píxel corrido. */
  // 20 px de caja con el ícono a 16: `MapPinned` dibuja un pin encima de un
  // mapa plegado, así que a 14 los trazos se tocan. Dos píxeles más y se
  // distingue lo que es.
  const caja =
    "inline-flex h-5 w-5 flex-none items-center justify-center rounded-full";

  if (ubi?.simulada) {
    return (
      <span
        className={`${caja} text-destructive`}
        title="Android dijo que esta ubicación viene de una app de mock"
        aria-label="Ubicación simulada"
      >
        <ShieldAlert className="h-3.5 w-3.5" />
      </span>
    );
  }

  /* El mismo ícono, en rojo, y no uno tachado: los dos estados son el
     mismo dato —dónde se marcó— así que lo que cambia tiene que ser el color,
     que se ve de reojo, y no el dibujo, que hay que mirar de cerca para notar
     que tiene una rayita encima. Lo que falta se marca; lo que está, no grita. */
  if (!ubi) {
    return (
      <span
        className={`${caja} text-warning-strong`}
        title="Esta marca vino sin ubicación"
        aria-label="Sin ubicación"
      >
        <MapPinned className="h-4 w-4" />
      </span>
    );
  }

  return (
    <a
      href={`https://www.google.com/maps?q=${ubi.lat},${ubi.lng}`}
      target="_blank"
      rel="noopener noreferrer"
      className={`${caja} text-muted-foreground transition-colors hover:bg-muted hover:text-foreground`}
      title={`Ver en el mapa${
        ubi.precision !== null ? ` (±${Math.round(ubi.precision)} m)` : ""
      }`}
      aria-label="Ver en el mapa dónde se marcó"
    >
      <MapPinned className="h-4 w-4" />
    </a>
  );
}
