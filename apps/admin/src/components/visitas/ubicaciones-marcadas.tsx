import { CloudOff, MapPin, ShieldAlert } from "lucide-react";
import {
  notaSinConexion,
  ubicacionDe,
  type PersonalDeVisita,
} from "@/lib/visita-tareas";
import { fechaYHora } from "@/components/visitas/formato-marca";

/**
 * Una marca hecha **sin señal**: el teléfono la anotó al apretar el botón y
 * la mandó cuando volvió la red, así que la hora es la del teléfono. Lo que
 * se muestra al lado es cuándo llegó de verdad: con esa distancia la oficina
 * decide si le cree. Es la única huella que deja un reloj cambiado a mano; no
 * bloquea nada, igual que la ubicación. Cuando la marca llegó en el momento
 * no se dibuja nada.
 */
export function NotaDeMarcaSinConexion({
  parte,
  cual,
}: {
  parte: PersonalDeVisita;
  cual: "entrada" | "salida";
}) {
  const nota = notaSinConexion(parte, cual);
  if (!nota) return null;
  return (
    <span
      className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700"
      title={`Marcada sin conexión; llegó al servidor el ${fechaYHora(nota.recibidaEl)}`}
    >
      <CloudOff className="h-3 w-3" />
      sin conexión, llegó {fechaYHora(nota.recibidaEl)}
    </span>
  );
}

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
        <MapPin className="h-3.5 w-3.5" />
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
      <MapPin className="h-3.5 w-3.5" />
    </a>
  );
}
