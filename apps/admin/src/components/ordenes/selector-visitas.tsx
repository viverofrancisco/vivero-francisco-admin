"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { fecha } from "./formato";

/** Un trabajo pendiente tal como lo devuelve `/api/ordenes/pendientes`. */
export interface Pendiente {
  tipo: "visita" | "suscripcion";
  visitaProductoId?: string;
  visitaId?: string;
  visitaNumero?: number;
  fecha?: string;
  suscripcionItemId?: string;
  suscripcionId?: string;
  productoId: string;
  descripcion: string;
  precio: string;
  ivaTasa: string;
  periodoInicio?: string;
  periodoFin?: string;
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
   * Qué trabajos de visita paga la línea. **Varios** cuando el mismo producto
   * se hizo en más de una visita: eso es una sola línea, porque es un solo
   * producto.
   */
  visitaProductoIds: string[];
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
  if (l.visitaProductoIds.length > 1) {
    return `Trabajo de ${l.visitaProductoIds.length} visitas`;
  }
  if (l.visitaProductoIds.length === 1) return "Trabajo de una visita";
  return null;
}

/** Las visitas del cliente con trabajo por cobrar, cada una con lo que incluye. */
export interface VisitaPendiente {
  id: string;
  numero: number;
  fecha: string;
  productos: string[];
}

export function visitasDePendientes(pendientes: Pendiente[]): VisitaPendiente[] {
  const mapa = new Map<string, VisitaPendiente>();
  for (const p of pendientes) {
    if (p.tipo !== "visita" || !p.visitaId) continue;
    const actual = mapa.get(p.visitaId);
    if (actual) actual.productos.push(p.descripcion);
    else
      mapa.set(p.visitaId, {
        id: p.visitaId,
        numero: p.visitaNumero!,
        fecha: p.fecha!,
        productos: [p.descripcion],
      });
  }
  return [...mapa.values()].sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/**
 * Rearma las líneas que salen de visitas, según cuáles estén marcadas.
 *
 * **El mismo producto de dos visitas es una sola línea.** Dos visitas con
 * "control de plagas" son dos trabajos distintos —cada uno se factura una sola
 * vez— pero un solo producto, y tenerlo dos veces en la orden no le dice nada a
 * nadie y duplica la decisión de precio. Se junta con la cantidad sumada y las
 * dos procedencias.
 *
 * Lo agregado a mano y lo que viene de un plan se quedan como están. Lo de
 * visitas se rearma entero —es lo que permite juntar por producto— pero
 * conserva el precio, el IVA y la cantidad que ya se hubieran tipeado para ese
 * producto: marcar una segunda visita no puede borrar lo que alguien escribió.
 */
export function rearmarPorVisitas(
  actuales: LineaEditable[],
  visitaIds: string[],
  pendientes: Pendiente[]
): LineaEditable[] {
  const aMano = actuales.filter(
    (l) => l.visitaProductoIds.length === 0 && !l.suscripcionItemId
  );
  const dePlan = actuales.filter((l) => l.suscripcionItemId);
  const previas = new Map(
    actuales
      .filter((l) => l.visitaProductoIds.length > 0)
      .map((l) => [l.productoId, l])
  );

  const elegidas = new Set(visitaIds);
  const porProducto = new Map<string, LineaEditable>();
  for (const p of pendientes) {
    if (p.tipo !== "visita" || !p.visitaId || !elegidas.has(p.visitaId)) continue;
    const actual = porProducto.get(p.productoId);
    if (actual) {
      actual.visitaProductoIds = [
        ...actual.visitaProductoIds,
        p.visitaProductoId!,
      ];
      // La cantidad sigue al número de trabajos mientras nadie la haya tocado.
      if (!previas.has(p.productoId)) {
        actual.cantidad = String(actual.visitaProductoIds.length);
      }
      continue;
    }
    const previa = previas.get(p.productoId);
    porProducto.set(p.productoId, {
      uid: previa?.uid ?? nuevoUid(),
      descripcion: p.descripcion,
      cantidad: previa?.cantidad ?? "1",
      precioUnitario: previa?.precioUnitario ?? String(Number(p.precio)),
      ivaTasa: previa?.ivaTasa ?? String(Number(p.ivaTasa)),
      productoId: p.productoId,
      visitaProductoIds: [p.visitaProductoId!],
      suscripcionItemId: null,
      periodoInicio: null,
      periodoFin: null,
    });
  }

  return [...porProducto.values(), ...dePlan, ...aMano];
}

/**
 * De qué visitas es la orden.
 *
 * Marcar no es ponerle una etiqueta: **es cargar el trabajo**. La cabecera de
 * la orden se deduce en el servidor de la procedencia de las líneas, así que
 * marcar sin traer el trabajo sería una asignación que no queda registrada en
 * ningún lado.
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
  visitas: VisitaPendiente[];
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
   * Busca por número, por fecha y por producto, todo en el mismo campo.
   *
   * Son las tres cosas que se ven en cada fila, y con un solo campo no hay que
   * decidir de antemano por cuál se está buscando: "327", "may" y "desmalezado"
   * llegan al mismo lugar.
   */
  const visibles = q
    ? visitas.filter(
        (v) =>
          String(v.numero).includes(q) ||
          fecha(v.fecha).toLowerCase().includes(q) ||
          v.productos.some((p) => p.toLowerCase().includes(q))
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
              Solo las visitas con trabajo sin facturar. Al marcar una entran
              todos sus productos —una visita se factura completa— y el mismo
              producto de varias queda en una sola línea.
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
                  Ninguna visita coincide con «{busqueda.trim()}».
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
                          {v.productos.join(", ")}
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
