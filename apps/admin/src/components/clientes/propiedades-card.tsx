"use client";

import Link from "next/link";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronRight, MapPin, Plus } from "lucide-react";

export interface PropiedadData {
  id: string;
  nombre: string;
  ciudad: string | null;
  sectorId: string | null;
  sector: { id: string; nombre: string } | null;
  direccion: string | null;
  numeroCasa: string | null;
  referencia: string | null;
  notas: string | null;
  lat: number | null;
  lng: number | null;
  m2Total: number | null;
  jardinerasPlantaAlta: boolean;
  numeroArboles: number | null;
  mlVegetacionBaja: number | null;
  mlVegetacionMedia: number | null;
  mlVegetacionAlta: number | null;
  m2Cesped: number | null;
  /** Cuántas visitas pasaron ahí. Una con visitas no se borra. */
  visitas: number;
}

/**
 * Las propiedades de un cliente: dónde se trabaja.
 *
 * La dirección era del cliente y se mudó acá, junto con el sector y los metros:
 * un cliente con dos casas tiene dos direcciones y ninguna es "la suya", y el
 * sector es geográfico —del lugar, no de la persona—.
 *
 * Los números de cada una son **lo que hay que mantener**, que es con lo que se
 * cotiza: cuántos metros de césped cortar, cuántos metros lineales de seto
 * podar y a qué altura, cuántos árboles. Todos opcionales, porque se van
 * midiendo con el tiempo y una propiedad recién cargada ya sirve para agendar.
 */
export function PropiedadesCard({
  clienteId,
  propiedades,
  puedeEditar,
}: {
  clienteId: string;
  propiedades: PropiedadData[];
  puedeEditar: boolean;
}) {
  /*
   * Cada propiedad abre su propia página, no un diálogo.
   *
   * Empezó como diálogo y no entraba: el mapa pide alto de verdad —no se elige
   * un punto en una tira de 200 px— y detrás vienen la dirección, siete
   * medidas y las notas. Un diálogo con scroll adentro de una página que
   * también scrollea es dos scrolls compitiendo, con el mapa comiéndose la
   * rueda del mouse en el medio.
   */
  const href = (id: string) =>
    `/dashboard/clientes/${clienteId}/propiedades/${id}`;

  return (
    <>
      <Card>
        <CardHeader className="border-b">
          <CardTitle>Propiedades</CardTitle>
          {puedeEditar && (
            <CardAction>
              <Link href={`/dashboard/clientes/${clienteId}/propiedades/nueva`}>
                <Button size="sm" variant="outline">
                  <Plus className="mr-2 h-3.5 w-3.5" />
                  Agregar
                </Button>
              </Link>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="space-y-3">
          {propiedades.length === 0 ? (
            <p className="py-2 text-sm text-muted-foreground">
              Sin propiedades. Agrega una para poder agendarle visitas.
            </p>
          ) : (
            <ul className="divide-y">
              {propiedades.map((p) => (
                <li key={p.id}>
                  <Link
                    href={puedeEditar ? href(p.id) : "#"}
                    className={`flex items-start gap-3 py-3 ${
                      puedeEditar
                        ? "-mx-2 rounded-md px-2 transition-colors hover:bg-muted/50"
                        : "pointer-events-none"
                    }`}
                  >
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-secondary text-green-700">
                    <MapPin className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{p.nombre}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.direccion, p.numeroCasa].filter(Boolean).join(" ") ||
                        "Sin dirección"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {[p.sector?.nombre, p.ciudad].filter(Boolean).join(" · ") ||
                        "Sin sector"}
                      {p.m2Total ? ` · ${p.m2Total} m²` : ""}
                      {p.lat !== null ? " · con pin" : ""}
                    </p>
                  </div>
                  {puedeEditar && (
                    <ChevronRight className="mt-2 h-4 w-4 flex-none text-muted-foreground" />
                  )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

    </>
  );
}
