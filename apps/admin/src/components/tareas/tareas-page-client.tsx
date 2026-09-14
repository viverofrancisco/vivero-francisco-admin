"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
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

import { PageHeader } from "@/components/shared/page-header";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import {
  ACCION_BARRA_MOVIL,
  BarraSeleccionMovil,
} from "@/components/shared/barra-seleccion-movil";
import { GripVertical, Search } from "lucide-react";
import { useFiltroUrl } from "@/lib/filtros-url";
import { toast } from "sonner";
import { TareaForm } from "./tarea-form";
import { MoverSeleccion, MoverSeleccionMovil } from "./mover-seleccion";
import { SelectorOrden } from "./selector-orden";
import {
  moverA,
  ordenar,
  type Destino,
  type ModoOrden,
} from "./orden-tareas";

export interface TareaRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
}

const mismosIds = (a: TareaRow[], b: TareaRow[]) =>
  a.length === b.length && a.every((t, i) => t.id === b[i].id);

export function TareasPageClient({
  tareas,
  modoOrden,
}: {
  tareas: TareaRow[];
  modoOrden: ModoOrden;
}) {
  const router = useRouter();
  const [busqueda, setBusqueda] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  /** `"nueva"` para crear, la tarea para abrirla, `null` cerrado. */
  const [abierta, setAbierta] = useState<TareaRow | "nueva" | null>(null);

  /**
   * El acomodo que se está probando, que puede no ser el guardado.
   *
   * Arrastrar mueve solo esto; recién *Guardar orden* lo manda. Así se pueden
   * acomodar cinco filas y confirmarlas de una, en vez de disparar un guardado
   * por cada fila movida y quedarse sin forma de arrepentirse.
   */
  const [lista, setLista] = useState(tareas);
  const [modo, setModo] = useState<ModoOrden>(modoOrden);
  const [guardandoOrden, setGuardandoOrden] = useState(false);
  /** Ids marcados para mover de a varios. Solo existe en orden personalizado. */
  const [marcadas, setMarcadas] = useState<string[]>([]);
  /**
   * Solo en el teléfono. En escritorio las casillas ya están en su columna;
   * acá no hay dónde ponerlas sin gastar ancho en todas las filas para siempre,
   * así que son un modo que se prende desde el ⋯ del encabezado.
   */
  const [seleccionandoMovil, setSeleccionandoMovil] = useState(false);

  // Se resincroniza **durante el render**, comparando contra lo último que
  // llegó, y no con un `useEffect`: un efecto pinta primero la lista vieja y la
  // corrige en un segundo pase, que es un parpadeo justo después de guardar. Es
  // el patrón que React documenta para "ajustar estado cuando cambia una prop",
  // y React descarta el render a medio hacer y vuelve a empezar con el valor
  // nuevo antes de tocar el DOM.
  const [delServidor, setDelServidor] = useState({ tareas, modoOrden });
  if (delServidor.tareas !== tareas || delServidor.modoOrden !== modoOrden) {
    setDelServidor({ tareas, modoOrden });
    setLista(tareas);
    setModo(modoOrden);
    setMarcadas([]);
    setSeleccionandoMovil(false);
  }

  /** Hay algo que guardar solo si el acomodo local difiere del guardado. */
  const hayCambios = !mismosIds(lista, tareas);
  const todasMarcadas = lista.length > 0 && marcadas.length === lista.length;

  const filtradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (t) =>
        t.nombre.toLowerCase().includes(q) ||
        (t.descripcion ?? "").toLowerCase().includes(q)
    );
  }, [lista, busqueda]);

  const totalPaginas = Math.max(1, Math.ceil(filtradas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPaginas);
  const paginadas = filtradas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  /**
   * Arrastrar solo tiene sentido en personalizado y sin filtro puesto.
   *
   * Con la lista alfabética, mover una fila no puede guardarse en ningún lado
   * —el orden lo decide el nombre—; y con un filtro, soltarla entre dos filas
   * la deja en realidad entre otras dos que no se están viendo.
   */
  const sePuedeArrastrar = modo === "PERSONALIZADO" && busqueda.trim() === "";

  const sensores = useSensors(
    // Ocho píxeles antes de arrancar: si no, el clic que abre la ficha se
    // comería cualquier temblor del pulso y se convertiría en un arrastre.
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    // En el teléfono se mantiene apretado para agarrar la fila, que es como
    // reordena el sistema operativo. El `tolerance` deja que el dedo se mueva un
    // poco durante la espera sin cancelar; pasarse de eso es scrollear, no
    // arrastrar, y ahí la lista tiene que scrollear.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 300, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  /**
   * La mano cerrada mientras se arrastra tiene que valer para **toda la
   * página**, no para la manija.
   *
   * `active:cursor-grabbing` en el botón deja de alcanzar apenas el puntero se
   * corre de encima de él, que es lo primero que pasa al arrastrar: el cursor
   * volvía a la flecha a mitad del movimiento. Se pisa el del `body` mientras
   * dura el arrastre y se devuelve al soltar.
   */
  function cursorArrastrando(activo: boolean) {
    document.body.style.cursor = activo ? "grabbing" : "";
  }
  // Por si el componente se va a mitad de un arrastre: un cursor de mano
  // cerrada pegado al resto de la app sería un fantasma difícil de explicar.
  useEffect(() => () => cursorArrastrando(false), []);

  /**
   * Mueve sobre la lista **completa**, no sobre la página visible.
   *
   * Dentro de una página el orden relativo es el mismo que en la lista entera,
   * así que llevar la fila a la posición que ocupa la de destino da exactamente
   * lo que el dedo pidió, y de paso la paginación deja de ser un problema.
   */
  function alSoltar(evento: DragEndEvent) {
    cursorArrastrando(false);
    const { active, over } = evento;
    if (!over || active.id === over.id) return;

    const desde = lista.findIndex((t) => t.id === active.id);
    const hasta = lista.findIndex((t) => t.id === over.id);
    if (desde < 0 || hasta < 0) return;

    setLista(arrayMove(lista, desde, hasta));
  }

  function moverMarcadas(destino: Destino) {
    setLista(moverA(lista, marcadas, destino));
  }

  async function guardarOrden() {
    setGuardandoOrden(true);
    try {
      const res = await fetch("/api/tareas/reordenar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: lista.map((t) => t.id) }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "No pudimos guardar el orden");
      }
      toast.success("Orden guardado");
      setMarcadas([]);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    } finally {
      setGuardandoOrden(false);
    }
  }

  async function cambiarModo(nuevo: ModoOrden) {
    const previo = modo;
    setMarcadas([]);
    setSeleccionandoMovil(false);
    setModo(nuevo);
    setLista((actual) => ordenar(actual, nuevo));
    try {
      const res = await fetch("/api/tareas/orden", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modo: nuevo }),
      });
      if (!res.ok) throw new Error("No pudimos cambiar el orden");
      router.refresh();
    } catch (err) {
      setModo(previo);
      setLista((actual) => ordenar(actual, previo));
      toast.error(err instanceof Error ? err.message : "No pudimos guardar");
    }
  }

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtradas.length,
    busqueda
  );
  const enLista = filtradas.slice(0, visibles);

  const vacio = busqueda.trim()
    ? "No se encontraron tareas"
    : "Todavía no hay tareas";

  return (
    <>
      <PageHeader
        title="Tareas"
        actions={[
          {
            label: "Nueva tarea",
            icon: "plus",
            onClick: () => setAbierta("nueva"),
            primary: true,
          },
          // Solo en móvil y solo cuando hay algo que acomodar: en escritorio
          // las casillas ya están en su columna, y en alfabético o con un
          // filtro puesto no hay nada que mover.
          ...(sePuedeArrastrar && !seleccionandoMovil && lista.length > 0
            ? [
                {
                  label: "Seleccionar tareas",
                  onClick: () => setSeleccionandoMovil(true),
                  soloMovil: true,
                } as const,
              ]
            : []),
        ]}
      />

      <p className="flex-none text-sm text-muted-foreground">
        Lo que se hace en una visita. El personal marca de esta lista las tareas
        que hizo al cerrarla, y al agendar se puede exigir que alguna se haga.
      </p>

      <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
        <div className="flex flex-none flex-wrap items-center gap-3">
          <div className="relative min-w-0 max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar tarea..."
              value={busqueda}
              onChange={(e) => {
                setBusqueda(e.target.value);
                setPage(1);
                // Con un filtro puesto no se puede mover nada, así que un
                // contador de seleccionadas quedaría colgado sin acción.
                setMarcadas([]);
                setSeleccionandoMovil(false);
              }}
              className="pl-9"
            />
          </div>
          {/* Cambiar de modo con un acomodo a medio hacer lo tiraría a la
              basura sin avisar. Primero se resuelve la barra de abajo. */}
          <SelectorOrden
            value={modo}
            onChange={cambiarModo}
            disabled={hayCambios}
          />
        </div>

        {hayCambios ? (
          <div className="flex flex-none flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-2.5">
            <p className="text-sm font-medium">Orden sin guardar</p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setLista(tareas);
                  setMarcadas([]);
                }}
                disabled={guardandoOrden}
              >
                Cancelar
              </Button>
              <Button size="sm" onClick={guardarOrden} disabled={guardandoOrden}>
                {guardandoOrden ? "Guardando..." : "Guardar orden"}
              </Button>
            </div>
          </div>
        ) : modo === "PERSONALIZADO" && busqueda.trim() ? (
          <p className="flex-none text-xs text-muted-foreground">
            Limpia la búsqueda para poder reordenar arrastrando.
          </p>
        ) : null}

        {/* Solo las filas scrollean: encabezado y paginación quedan fijos. */}
        <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
          <div className="relative min-h-0 flex-1 overflow-hidden">
            {/* Tapa la fila de encabezados en vez de empujarla: la tabla no se
                mueve al marcar la primera fila, que es justo cuando se está
                apuntando a otra.
                Va **fuera** de la tabla y no en un `<th>` porque la tabla
                scrollea a lo ancho, y ahí el botón se iría de pantalla. Alto y
                fondo son los del encabezado (`h-10`, `bg-secondary`); el `px-2`
                más un hueco del ancho de la columna de la manija (`w-10`, la
                misma clase que su `<th>`) dejan la casilla justo encima de la
                de la columna, así parece que el encabezado siguió ahí y solo
                cambió su texto. Por eso no hay `gap` en el contenedor: cada
                separación va puesta donde corresponde. */}
            {marcadas.length > 0 ? (
              <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center border-b border-border bg-secondary px-2">
                <span className="w-10 flex-none" aria-hidden />
                <Checkbox
                  checked={todasMarcadas}
                  indeterminate={!todasMarcadas}
                  onCheckedChange={() => setMarcadas([])}
                  aria-label="Quitar la selección"
                />
                <span className="ml-3 text-xs font-bold tracking-wide text-secondary-foreground">
                  {marcadas.length === 1
                    ? "1 tarea seleccionada"
                    : `${marcadas.length} tareas seleccionadas`}
                </span>
                <button
                  type="button"
                  className="ml-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                  onClick={() => setMarcadas([])}
                >
                  Quitar selección
                </button>
                <span className="flex-1" />
                <MoverSeleccion
                  cuantas={marcadas.length}
                  total={lista.length}
                  onMover={moverMarcadas}
                />
              </div>
            ) : null}
            {filtradas.length === 0 ? (
              <EmptyState message={vacio} />
            ) : (
              <DndContext
                sensors={sensores}
                collisionDetection={closestCenter}
                modifiers={[restrictToVerticalAxis]}
                onDragStart={() => cursorArrastrando(true)}
                onDragCancel={() => cursorArrastrando(false)}
                onDragEnd={alSoltar}
              >
                <Table containerClassName="h-full overflow-y-auto">
                  <TableHeader sticky>
                    <TableRow>
                      {sePuedeArrastrar ? (
                        <>
                          <TableHead className="w-10" />
                          <TableHead className="w-10">
                            <Checkbox
                              checked={todasMarcadas}
                              indeterminate={
                                marcadas.length > 0 && !todasMarcadas
                              }
                              // Con algo marcado, tocarla limpia; si no, marca
                              // la lista entera. Es lo que espera quien la ve a
                              // medias: el segundo clic deshace el primero.
                              onCheckedChange={() =>
                                setMarcadas(
                                  marcadas.length > 0
                                    ? []
                                    : lista.map((t) => t.id)
                                )
                              }
                              aria-label={
                                marcadas.length > 0
                                  ? "Quitar la selección"
                                  : "Seleccionar todas las tareas"
                              }
                            />
                          </TableHead>
                        </>
                      ) : null}
                      <TableHead>Tarea</TableHead>
                      <TableHead>Descripción</TableHead>
                    </TableRow>
                  </TableHeader>
                  <SortableContext
                    items={paginadas.map((t) => t.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <TableBody>
                      {paginadas.map((t) => (
                        <FilaTarea
                          key={t.id}
                          tarea={t}
                          arrastrable={sePuedeArrastrar}
                          // La posición es la de la lista **completa**: en la
                          // página 2 la primera fila es la 26, y es ese número
                          // el que se escribe en "a la posición".
                          posicion={lista.findIndex((x) => x.id === t.id) + 1}
                          marcada={marcadas.includes(t.id)}
                          onMarcar={(marcar) =>
                            setMarcadas((actuales) =>
                              marcar
                                ? [...actuales, t.id]
                                : actuales.filter((id) => id !== t.id)
                            )
                          }
                          onAbrir={() => setAbierta(t)}
                        />
                      ))}
                    </TableBody>
                  </SortableContext>
                </Table>
              </DndContext>
            )}
          </div>

          <TablePagination
            page={pagina}
            total={filtradas.length}
            onPageChange={setPage}
            sustantivo="tarea"
            plural="tareas"
          />
        </div>

        {/* Móvil: un toque abre la tarea; mantener apretado la agarra para
            moverla, que es como reordena el teléfono. */}
        <DndContext
          sensors={sensores}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={alSoltar}
        >
          <ListaMovil
            vacia={filtradas.length === 0}
            mensajeVacio={vacio}
            hayMas={hayMas}
            cargando={cargando}
            centinela={centinela}
          >
            <SortableContext
              items={enLista.map((t) => t.id)}
              strategy={verticalListSortingStrategy}
            >
              {enLista.map((t) => (
                <FilaTareaMovil
                  key={t.id}
                  tarea={t}
                  // Seleccionando no se arrastra: el gesto es el mismo —el dedo
                  // apoyado— y tocar tiene que marcar, sin que a los 300 ms la
                  // fila se despegue sola.
                  arrastrable={sePuedeArrastrar && !seleccionandoMovil}
                  seleccionando={seleccionandoMovil}
                  marcada={marcadas.includes(t.id)}
                  onAlternar={() =>
                    setMarcadas((actuales) =>
                      actuales.includes(t.id)
                        ? actuales.filter((id) => id !== t.id)
                        : [...actuales, t.id]
                    )
                  }
                  onAbrir={() => setAbierta(t)}
                />
              ))}
            </SortableContext>
            {/* La barra flota sobre la lista, así que sin esto tapa la última
                fila y no hay manera de marcarla. */}
            {seleccionandoMovil ? <div className="h-16" aria-hidden /> : null}
          </ListaMovil>
        </DndContext>
      </div>

      {seleccionandoMovil ? (
        <BarraSeleccionMovil
          cuantas={marcadas.length}
          onSalir={() => {
            setSeleccionandoMovil(false);
            setMarcadas([]);
          }}
        >
          <MoverSeleccionMovil
            cuantas={marcadas.length}
            total={lista.length}
            onMover={moverMarcadas}
            className={ACCION_BARRA_MOVIL}
          />
        </BarraSeleccionMovil>
      ) : null}

      {abierta !== null ? (
        <TareaForm
          tarea={abierta === "nueva" ? null : abierta}
          onClose={() => setAbierta(null)}
          onGuardada={() => {
            setAbierta(null);
            router.refresh();
          }}
        />
      ) : null}
    </>
  );
}

function FilaTarea({
  tarea,
  arrastrable,
  posicion,
  marcada,
  onMarcar,
  onAbrir,
}: {
  tarea: TareaRow;
  arrastrable: boolean;
  /** Su lugar en la lista completa, 1-based. Solo se muestra al reordenar. */
  posicion: number;
  marcada: boolean;
  onMarcar: (marcar: boolean) => void;
  onAbrir: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarea.id, disabled: !arrastrable });

  return (
    <TableRow
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`cursor-pointer ${
        isDragging ? "relative z-10 bg-muted shadow-sm" : marcada ? "bg-primary/5" : ""
      }`}
      onClick={onAbrir}
    >
      {arrastrable ? (
        <TableCell className="w-10 pr-0">
          {/* La manija es lo único que arrastra: con la fila entera agarrando,
              el clic que abre la ficha y el arrastre se pisan.
              Mano abierta al pasar por encima, cerrada mientras se arrastra. */}
          <button
            type="button"
            className={`flex touch-none items-center justify-center rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground ${
              isDragging ? "cursor-grabbing" : "cursor-grab"
            }`}
            aria-label={`Mover ${tarea.nombre}`}
            onClick={(e) => e.stopPropagation()}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
        </TableCell>
      ) : null}
      {arrastrable ? (
        <TableCell className="w-10" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={marcada}
            onCheckedChange={(valor) => onMarcar(valor === true)}
            aria-label={`Seleccionar ${tarea.nombre}`}
          />
        </TableCell>
      ) : null}
      <TableCell className="font-medium">
        {arrastrable ? (
          <span className="mr-2 inline-block w-6 text-right tabular-nums font-normal text-muted-foreground">
            {posicion}.
          </span>
        ) : null}
        {tarea.nombre}
      </TableCell>
      <TableCell className="text-muted-foreground">
        {tarea.descripcion ? (
          <span className="line-clamp-2">{tarea.descripcion}</span>
        ) : (
          <span className="italic">Sin descripción</span>
        )}
      </TableCell>
    </TableRow>
  );
}

function FilaTareaMovil({
  tarea,
  arrastrable,
  seleccionando,
  marcada,
  onAlternar,
  onAbrir,
}: {
  tarea: TareaRow;
  arrastrable: boolean;
  seleccionando: boolean;
  marcada: boolean;
  onAlternar: () => void;
  onAbrir: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tarea.id, disabled: !arrastrable });

  return (
    <button
      ref={setNodeRef}
      type="button"
      // Seleccionando, tocar marca en vez de abrir: una fila que a veces navega
      // y a veces no es una trampa.
      onClick={seleccionando ? onAlternar : onAbrir}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        // `manipulation` y no `none`: con el sensor táctil configurado por
        // espera, dnd-kit cancela solo si el dedo se va antes de tiempo, así que
        // la lista sigue scrolleando normalmente. Con `none` se trabaría.
        touchAction: "manipulation",
      }}
      className={`${FILA_MOVIL} w-full text-left ${
        isDragging
          ? "relative z-10 bg-muted shadow-sm"
          : marcada
            ? "bg-primary/5"
            : "bg-card"
      }`}
      {...attributes}
      {...listeners}
      // Después del spread a propósito: `attributes` de dnd-kit trae su propio
      // `aria-pressed` y, puesto antes, lo pisaba. Seleccionando no se arrastra,
      // así que acá el que manda es el de la selección.
      aria-pressed={seleccionando ? marcada : undefined}
    >
      {seleccionando ? (
        <Checkbox
          checked={marcada}
          // La fila entera es el área de toque; la casilla solo pinta. Sin esto
          // el toque llega dos veces —a ella y al botón— y la marca y la
          // desmarca en el mismo gesto.
          onClick={(e) => e.preventDefault()}
          className="pointer-events-none flex-none"
          tabIndex={-1}
          aria-hidden
        />
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-bold text-foreground">
          {tarea.nombre}
        </span>
        {tarea.descripcion ? (
          <span className="block truncate text-xs text-muted-foreground">
            {tarea.descripcion}
          </span>
        ) : null}
      </span>
    </button>
  );
}
