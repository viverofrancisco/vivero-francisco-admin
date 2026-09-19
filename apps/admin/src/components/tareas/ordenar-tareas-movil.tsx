"use client";

import { useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  OPCIONES_ORDEN_TAREAS,
  moverEnOrden,
  ordenarTareas,
  type DestinoDeOrden,
  type ModoOrdenTareas,
} from "@vivero/shared";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  ACCION_BARRA_MOVIL,
  BarraSeleccionMovil,
} from "@/components/shared/barra-seleccion-movil";
import { Check, ChevronDown, GripVertical, X } from "lucide-react";
import { toast } from "sonner";
import { MoverSeleccionMovil } from "./mover-seleccion";
import type { TareaRow } from "./tareas-page-client";

const mismosIds = (a: TareaRow[], b: TareaRow[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

/**
 * Ordenar el catálogo en el teléfono: **una pantalla propia**, no un modo de la
 * lista. Es la misma que la app, con la misma forma de Shopify.
 *
 * El tipo de orden arriba —siempre a la vista, para poder volver a cambiarlo—,
 * abajo las tareas con su manija y su casilla mientras el orden es
 * Personalizado, y la barra de selección flotando cuando hay algo marcado.
 *
 * Estaba todo metido en la lista y ahí cada cosa le pisaba el lugar a otra: la
 * barra de Cancelar/Guardar ocupaba el encabezado, que es donde vivía el menú
 * para marcar, así que había que guardar para poder seguir acomodando.
 *
 * **Nada se guarda solo** y todo sale en un request: el servidor guarda el
 * acomodo y el modo en la misma transacción. Acomodar a mano y después mostrar
 * A–Z no se contradice —`Tarea.orden` guarda el acomodo igual, y volver a
 * Personalizado lo muestra intacto—.
 */
export function OrdenarTareasMovil({
  abierto,
  onCerrar,
  tareas,
  modo: modoGuardado,
  onGuardado,
}: {
  abierto: boolean;
  onCerrar: () => void;
  /** Las tareas como están guardadas, en su acomodo a mano. */
  tareas: TareaRow[];
  modo: ModoOrdenTareas;
  onGuardado: () => void;
}) {
  const ordenGuardado = useMemo(
    () => ordenarTareas(tareas, "PERSONALIZADO"),
    [tareas]
  );
  const [personalizado, setPersonalizado] = useState(ordenGuardado);
  const [modo, setModo] = useState(modoGuardado);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [eligiendoModo, setEligiendoModo] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const lista = useMemo(
    () =>
      modo === "PERSONALIZADO" ? personalizado : ordenarTareas(tareas, modo),
    [modo, personalizado, tareas]
  );
  const cambioDeOrden = !mismosIds(personalizado, ordenGuardado);
  const hayCambios = modo !== modoGuardado || cambioDeOrden;
  const acomodable = modo === "PERSONALIZADO";
  const nombreDelModo =
    OPCIONES_ORDEN_TAREAS.find((m) => m.value === modo)?.label ?? "Orden";

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // Mantener apretado para agarrar la fila, que es como reordena el teléfono.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function alSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const desde = personalizado.findIndex((t) => t.id === active.id);
    const hasta = personalizado.findIndex((t) => t.id === over.id);
    if (desde < 0 || hasta < 0) return;
    setPersonalizado(arrayMove(personalizado, desde, hasta));
  }

  function moverMarcadas(destino: DestinoDeOrden) {
    setPersonalizado(moverEnOrden(personalizado, marcadas, destino));
  }

  function elegirModo(nuevo: ModoOrdenTareas) {
    setEligiendoModo(false);
    setModo(nuevo);
    // Marcar sirve para mover, y mover solo existe en Personalizado.
    if (nuevo !== "PERSONALIZADO") setMarcadas([]);
  }

  async function guardar() {
    setGuardando(true);
    try {
      // Un solo request con las dos cosas. Si lo único que cambió es el tipo de
      // orden no hace falta mandar la lista entera.
      const res = cambioDeOrden
        ? await fetch("/api/tareas/reordenar", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ids: personalizado.map((t) => t.id),
              modo,
            }),
          })
        : await fetch("/api/tareas/orden", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ modo }),
          });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No pudimos guardar el orden");
      }
      toast.success("Orden guardado");
      onGuardado();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  }

  return (
    <Sheet open={abierto} onOpenChange={(v) => (v ? null : onCerrar())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        // `h-dvh` y no `h-screen`: `100vh` cuenta la barra de direcciones
        // aunque se esté viendo, y el pie quedaba abajo del borde.
        className="h-dvh gap-0 p-0"
      >
        <div className="flex h-14 flex-none items-center gap-2 border-b border-border px-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onCerrar}
            disabled={guardando}
            aria-label="Cerrar"
          >
            <X className="h-5 w-5" />
          </Button>
          <SheetTitle className="flex-1">Ordenar tareas</SheetTitle>
          <Button onClick={guardar} disabled={!hayCambios || guardando}>
            {guardando ? "Guardando..." : "Guardar"}
          </Button>
        </div>

        {/* El tipo de orden, arriba y siempre a la vista: se cambia, se mira
            cómo queda y se vuelve a cambiar sin salir de acá. */}
        <button
          type="button"
          onClick={() => setEligiendoModo(true)}
          className="flex flex-none items-center gap-3 border-b border-border bg-muted/40 px-4 py-3 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="block text-xs text-muted-foreground">
              Orden de la lista
            </span>
            <span className="block text-sm font-semibold text-foreground">
              {nombreDelModo}
            </span>
          </span>
          <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <DndContext
            sensors={sensores}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragEnd={alSoltar}
          >
            <SortableContext
              items={lista.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {lista.map((t, i) => (
                <Fila
                  key={t.id}
                  tarea={t}
                  posicion={i + 1}
                  acomodable={acomodable}
                  marcada={marcadas.includes(t.id)}
                  onMarcar={(marcar) =>
                    setMarcadas((actuales) =>
                      marcar
                        ? [...actuales, t.id]
                        : actuales.filter((id) => id !== t.id)
                    )
                  }
                />
              ))}
            </SortableContext>
          </DndContext>
          {/* La barra flota sobre la lista: sin esto tapa la última fila, que
              es justo la que alguien acaba de mandar al final. */}
          {marcadas.length > 0 ? <div className="h-16" aria-hidden /> : null}
        </div>

        {marcadas.length > 0 ? (
          <BarraSeleccionMovil
            cuantas={marcadas.length}
            onSalir={() => setMarcadas([])}
            // Acá no hay barra de pestañas abajo de la que correrse.
            className="bottom-3 z-50"
          >
            <MoverSeleccionMovil
              cuantas={marcadas.length}
              total={lista.length}
              onMover={moverMarcadas}
              className={ACCION_BARRA_MOVIL}
            />
          </BarraSeleccionMovil>
        ) : null}

        <HojaDeModo
          abierta={eligiendoModo}
          onCerrar={() => setEligiendoModo(false)}
          valor={modo}
          onElegir={elegirModo}
        />
      </SheetContent>
    </Sheet>
  );
}

/**
 * Las tres opciones, en un cajón desde abajo —donde está el pulgar, y con
 * renglones grandes de tocar—. Es el mismo cajón que la app.
 */
function HojaDeModo({
  abierta,
  onCerrar,
  valor,
  onElegir,
}: {
  abierta: boolean;
  onCerrar: () => void;
  valor: ModoOrdenTareas;
  onElegir: (modo: ModoOrdenTareas) => void;
}) {
  return (
    <Sheet open={abierta} onOpenChange={(v) => (v ? null : onCerrar())}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="gap-0 rounded-t-2xl p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      >
        <SheetTitle className="px-1 pb-3 text-lg font-bold">
          Ordenar por
        </SheetTitle>
        <div className="space-y-2">
          {OPCIONES_ORDEN_TAREAS.map((o) => {
            const elegida = o.value === valor;
            return (
              <button
                key={o.value}
                type="button"
                onClick={() => onElegir(o.value)}
                aria-pressed={elegida}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-3 text-left ${
                  elegida ? "bg-primary/10" : "bg-muted/50"
                }`}
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-foreground">
                    {o.label}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {o.detalle}
                  </span>
                </span>
                {elegida ? (
                  <Check className="h-4 w-4 flex-none text-primary" />
                ) : null}
              </button>
            );
          })}
        </div>
        <p className="px-1 pt-3 text-xs text-muted-foreground">
          Es el orden en que se ven las tareas en todo el sistema, también al
          marcarlas en una visita.
        </p>
      </SheetContent>
    </Sheet>
  );
}

/**
 * Una fila de acá **no abre la tarea**: esta pantalla es para ordenar. Tocarla
 * la marca, mantenerla apretada la levanta para moverla.
 */
function Fila({
  tarea,
  posicion,
  acomodable,
  marcada,
  onMarcar,
}: {
  tarea: TareaRow;
  posicion: number;
  acomodable: boolean;
  marcada: boolean;
  onMarcar: (marcar: boolean) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarea.id, disabled: !acomodable });

  const contenido = (
    <>
      <span className="w-5 flex-none text-right text-xs tabular-nums text-muted-foreground">
        {posicion}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {tarea.nombre}
      </span>
    </>
  );

  if (!acomodable) {
    return (
      <div className="flex items-center gap-3 border-b border-border px-4 py-3.5">
        {contenido}
      </div>
    );
  }

  return (
    <button
      ref={setNodeRef}
      type="button"
      onClick={() => onMarcar(!marcada)}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // `manipulation` y no `none`: con el sensor táctil configurado por
        // espera, dnd-kit cancela solo si el dedo se va antes de tiempo, así que
        // la lista sigue scrolleando normalmente. Con `none` se trabaría.
        touchAction: "manipulation",
      }}
      className={`flex w-full items-center gap-3 border-b border-border px-4 py-3.5 text-left ${
        isDragging
          ? "relative z-10 bg-muted shadow-sm"
          : marcada
            ? "bg-primary/5"
            : "bg-background"
      }`}
      {...attributes}
      {...listeners}
      // Después del spread a propósito: `attributes` de dnd-kit trae su propio
      // `aria-pressed` y, puesto antes, lo pisaba. Acá el que manda es el de la
      // selección.
      aria-pressed={marcada}
    >
      {/* La fila entera es el área de toque; la casilla solo pinta. Sin esto el
          toque llega dos veces —a ella y al botón— y la marca y la desmarca en
          el mismo gesto. */}
      <Checkbox
        checked={marcada}
        className="pointer-events-none flex-none"
        tabIndex={-1}
        aria-hidden
      />
      {contenido}
      <GripVertical className="h-4 w-4 flex-none text-muted-foreground" />
    </button>
  );
}
