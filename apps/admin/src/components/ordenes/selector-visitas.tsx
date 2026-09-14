"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { fecha } from "./formato";

/**
 * Un período de suscripción por facturar, tal como lo devuelve
 * `/api/ordenes/pendientes`.
 *
 * **Las visitas ya no entran acá.** Salían cuando la visita llevaba productos;
 * hoy lleva tareas, que no tienen precio, así que una visita no deja nada
 * "pendiente de facturar". Marcarla en una orden es decir de qué es la orden,
 * no cargarle trabajo.
 */
export interface Pendiente {
  tipo: "suscripcion";
  suscripcionItemId: string;
  suscripcionId: string;
  productoId: string;
  descripcion: string;
  precio: string;
  ivaTasa: string;
  periodoInicio: string;
  periodoFin: string;
}

/**
 * Una línea de orden mientras se la edita. Los importes van como texto para no
 * pelear con el input mientras se escribe.
 *
 * Lo comparten la orden nueva y la edición de un borrador: son el mismo
 * formulario en dos momentos, y dos copias se habrían separado a la primera
 * corrección.
 */
export interface LineaEditable {
  uid: string;
  descripcion: string;
  cantidad: string;
  precioUnitario: string;
  ivaTasa: string;
  productoId: string;
  /**
   * Qué variante se vende. Solo en un bien: un servicio no tiene ninguna, y un
   * bien con una sola la trae elegida — preguntar por una decisión que no
   * existe es ruido.
   */
  varianteId: string | null;
  suscripcionItemId: string | null;
  periodoInicio: string | null;
  periodoFin: string | null;
}

let contador = 0;
export const nuevoUid = () => `l${contador++}`;

/** De dónde salió la línea, dicho como lo leería una persona. */
export function origenDeLinea(l: LineaEditable): string | null {
  if (l.periodoInicio && l.periodoFin) {
    return `Suscripción · ${fecha(l.periodoInicio)} → ${fecha(l.periodoFin)}`;
  }
  return null;
}

/** Una visita del cliente que la orden puede decir que cubre. */
export interface VisitaVinculable {
  id: string;
  numero: number;
  fecha: string;
  /** Lo que se hizo en ella, para reconocerla en la lista. */
  tareas: string[];
}

/**
 * De qué visitas es la orden.
 *
 * **Marcar es ponerle una etiqueta, y nada más.** Antes marcar *cargaba el
 * trabajo*: la visita llevaba productos y de ahí salían líneas con precio por
 * poner. Hoy lo que se hace en una visita son tareas, que no se venden, así que
 * los productos que se le cobran al cliente se eligen a mano y esto solo deja
 * dicho por qué existe la orden — y permite ir de una a la otra.
 *
 * Lista con casillas y no un desplegable porque se eligen **varias** —cobrarle
 * a alguien el mes entero en una orden es lo normal— y hay que ver de un
 * vistazo cuáles están marcadas.
 */
export function SelectorVisitas({
  visitas,
  marcadas,
  onCambiar,
  /** Se entró desde esta visita: desmarcarla sería no ser esa orden. */
  fija,
  deshabilitado,
  motivoDeshabilitado,
}: {
  visitas: VisitaVinculable[];
  marcadas: string[];
  /**
   * Recibe la selección **entera**, no un id: "marcar todas" cambia muchas de
   * una, y encadenar N alternancias sobre el mismo estado deja solo la última.
   */
  onCambiar: (visitaIds: string[]) => void;
  fija?: string | null;
  deshabilitado?: boolean;
  motivoDeshabilitado?: string;
}) {
  const [busqueda, setBusqueda] = useState("");

  const q = busqueda.trim().toLowerCase();
  /**
   * Busca por número, por fecha y por tarea, todo en el mismo campo.
   *
   * Son las tres cosas que se ven en cada fila, y con un solo campo no hay que
   * decidir de antemano por cuál se está buscando: "327", "may" y "poda"
   * llegan al mismo lugar.
   */
  const visibles = q
    ? visitas.filter(
        (v) =>
          String(v.numero).includes(q) ||
          fecha(v.fecha).toLowerCase().includes(q) ||
          v.tareas.some((t) => t.toLowerCase().includes(q))
      )
    : visitas;

  const alternar = (id: string) =>
    onCambiar(
      marcadas.includes(id)
        ? marcadas.filter((v) => v !== id)
        : [...marcadas, id]
    );

  /**
   * Marcar de a una lo que se ve, no todo el universo: con un filtro puesto,
   * "todas" tiene que querer decir "las que estoy mirando".
   */
  const idsVisibles = visibles
    .filter((v) => !(fija === v.id && marcadas.includes(v.id)))
    .map((v) => v.id);
  const todasMarcadas =
    idsVisibles.length > 0 && idsVisibles.every((id) => marcadas.includes(id));
  const alternarTodas = () =>
    onCambiar(
      todasMarcadas
        ? marcadas.filter((id) => !idsVisibles.includes(id))
        : [...new Set([...marcadas, ...idsVisibles])]
    );

  return (
    <Card className="overflow-visible">
      <CardHeader className="border-b py-3">
        <CardTitle className="text-base">Visitas</CardTitle>
        {marcadas.length > 0 && (
          <CardAction>
            <span className="text-sm text-muted-foreground">
              {marcadas.length} marcada{marcadas.length === 1 ? "" : "s"}
            </span>
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {deshabilitado ? (
          <p className="text-sm text-muted-foreground">{motivoDeshabilitado}</p>
        ) : (
          <>
            {/* Arriba de la lista: explica cómo funciona lo que se está por
                hacer, y abajo llegaba después de haberlo hecho. */}
            <p className="text-xs text-muted-foreground">
              Deja dicho por qué existe esta orden y permite ir de una a la
              otra. No carga productos: lo que se le cobra al cliente se elige
              abajo.
            </p>

            {/* Con una sola visita no hay nada que buscar ni que marcar en
                bloque. Con dos ya sí: el umbral tiene que ser bajo y no "unas
                cuantas", porque la misma orden muestra distinta cantidad al
                crearla que al editarla —editando se suman sus propias
                visitas— y un corte alto hacía aparecer y desaparecer los
                controles sin que se entienda por qué. */}
            {visitas.length > 1 && (
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={busqueda}
                    onChange={(e) => setBusqueda(e.target.value)}
                    placeholder="Buscar por número, fecha o producto..."
                    className="pl-9"
                  />
                </div>
                {idsVisibles.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="flex-none"
                    onClick={alternarTodas}
                  >
                    {todasMarcadas ? "Quitar todas" : "Marcar todas"}
                  </Button>
                )}
              </div>
            )}

            <div className="max-h-72 divide-y overflow-y-auto">
              {visibles.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Ninguna visita coincide con{" "}
                  <span className="font-medium">{busqueda.trim()}</span>.
                </p>
              ) : (
                visibles.map((v) => {
                  const marcada = marcadas.includes(v.id);
                  const trabada = fija === v.id && marcada;
                  return (
                    <label
                      key={v.id}
                      className={`flex items-start gap-3 py-2.5 ${
                        trabada ? "opacity-60" : "cursor-pointer"
                      }`}
                    >
                      <Checkbox
                        checked={marcada}
                        onCheckedChange={() => alternar(v.id)}
                        disabled={trabada}
                        className="mt-0.5"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium">
                          Visita #{v.numero} · {fecha(v.fecha)}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {v.tareas.length > 0
                            ? v.tareas.join(", ")
                            : "Sin tareas registradas"}
                        </span>
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
