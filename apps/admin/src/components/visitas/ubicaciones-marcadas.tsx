import { MapPin, MapPinOff, ShieldAlert } from "lucide-react";
import { ubicacionDe, type PersonalDeVisita } from "@/lib/visita-tareas";

/**
 * Dónde estaba cada marca, para la oficina.
 *
 * No dice "estuvo" ni "no estuvo": dice dónde estaba el teléfono cuando se
 * apretó el botón, que es lo único que el sistema sabe. Todavía no hay
 * coordenadas del sitio contra las cuales comparar —`Cliente` solo tiene la
 * dirección como texto—, así que por ahora el punto se muestra y se abre en un
 * mapa; el aviso de "a 3 km" llega cuando exista el pin del cliente.
 *
 * Lo que sí se señala es lo que se puede afirmar: que una marca vino **sin**
 * ubicación, y que Android dijo que venía de una app de mock.
 */
export function Ubicaciones({ parte }: { parte: PersonalDeVisita }) {
  const marcas = [
    { etiqueta: "Entrada", marcada: parte.entradaEl, ubi: ubicacionDe(parte, "entrada") },
    { etiqueta: "Salida", marcada: parte.salidaEl, ubi: ubicacionDe(parte, "salida") },
  ].filter((m) => m.marcada);

  if (marcas.length === 0) return null;

  return (
    <span className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
      {marcas.map(({ etiqueta, ubi }) => (
        <span
          key={etiqueta}
          className={`flex items-center gap-1 text-[11px] font-semibold ${
            ubi?.simulada
              ? "text-destructive"
              : ubi
                ? "text-muted-foreground"
                : "text-warning-foreground"
          }`}
        >
          {ubi?.simulada ? (
            <ShieldAlert className="h-3 w-3 flex-none" />
          ) : ubi ? (
            <MapPin className="h-3 w-3 flex-none" />
          ) : (
            <MapPinOff className="h-3 w-3 flex-none" />
          )}
          {etiqueta}:{" "}
          {ubi?.simulada ? (
            "ubicación simulada"
          ) : ubi ? (
            <a
              href={`https://www.google.com/maps?q=${ubi.lat},${ubi.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:text-foreground"
            >
              ver en el mapa
              {ubi.precision !== null && ` (±${Math.round(ubi.precision)} m)`}
            </a>
          ) : (
            "sin ubicación"
          )}
        </span>
      ))}
    </span>
  );
}
