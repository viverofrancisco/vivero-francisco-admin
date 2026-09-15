import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Star } from "lucide-react";

export interface CalificacionData {
  estrellas: number;
  comentario: string | null;
  createdAt: string;
  fotos: { id: string; url: string }[];
}

/**
 * Lo que el cliente dijo de la visita. **Solo para la oficina.**
 *
 * Al jardinero asignado no se le muestra, aunque la visita sea suya: una mala
 * calificación se conversa, no se lee sola en un teléfono.
 *
 * Si nadie calificó, esto no existe. Una tarjeta que dice "sin calificar" en
 * casi todas las visitas —la mayoría no califica— es una tarjeta que se aprende
 * a saltear, y con ella se saltean las que sí tienen algo.
 */
export function CalificacionVisita({
  calificacion,
}: {
  calificacion: CalificacionData;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between gap-2 border-b py-3">
        <CardTitle className="text-base">Lo que dijo el cliente</CardTitle>
        <Estrellas cantidad={calificacion.estrellas} />
      </CardHeader>
      <CardContent className="space-y-3 pt-4">
        {calificacion.comentario ? (
          <p className="text-sm">{calificacion.comentario}</p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Calificó sin escribir nada.
          </p>
        )}

        {calificacion.fotos.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {calificacion.fotos.map((f) => (
              // Se abren en una pestaña y no en el visor de la visita: son
              // fotos del cliente, no del trabajo, y mezclarlas en la misma
              // galería es lo que las haría terminar en un informe.
              <a
                key={f.id}
                href={f.url}
                target="_blank"
                rel="noopener noreferrer"
                className="block h-20 w-20 overflow-hidden rounded-md border border-border"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={f.url}
                  alt="Foto del cliente"
                  className="h-full w-full object-cover"
                />
              </a>
            ))}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          {new Date(calificacion.createdAt).toLocaleDateString("es-EC", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </p>
      </CardContent>
    </Card>
  );
}

/** Cinco siempre, rellenas hasta donde llegue: así se lee el número sin contarlo. */
function Estrellas({ cantidad }: { cantidad: number }) {
  return (
    <span className="flex flex-none items-center gap-0.5" aria-label={`${cantidad} de 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={`h-4 w-4 ${
            n <= cantidad
              ? "fill-warning text-warning"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </span>
  );
}
