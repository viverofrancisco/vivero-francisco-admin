import { MapPin, MapPinOff, ShieldAlert } from "lucide-react";
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
 * Va por marca y no por persona: la entrada y la salida son dos momentos
 * distintos, con dos horas distintas, y cada una se lee al lado de la suya.
 * Juntas en un renglón aparte había que volver a emparejarlas con la hora de
 * arriba para saber cuál era cuál.
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

  if (ubi?.simulada) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-destructive">
        <ShieldAlert className="h-3 w-3 flex-none" />
        ubicación simulada
      </span>
    );
  }

  if (!ubi) {
    return (
      <span className="flex items-center gap-1 text-[11px] font-semibold text-warning-foreground">
        <MapPinOff className="h-3 w-3 flex-none" />
        sin ubicación
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
      <MapPin className="h-3 w-3 flex-none" />
      <a
        href={`https://www.google.com/maps?q=${ubi.lat},${ubi.lng}`}
        target="_blank"
        rel="noopener noreferrer"
        className="underline underline-offset-2 hover:text-foreground"
      >
        ver en el mapa
        {ubi.precision !== null && ` (±${Math.round(ubi.precision)} m)`}
      </a>
    </span>
  );
}
