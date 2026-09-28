"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
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
import { ChevronRight, GripVertical, MoreHorizontal, PlusCircle, Search, Trash2 } from "lucide-react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import type { OpcionEditable } from "../producto-variantes";
import { BotonRedondoDeHoja, CabeceraDeHoja, CampoEnCaja, HojaCompleta, PastillaDeHoja, pedir } from "./piezas";

const MAX_OPCIONES = 3;
const SUGERENCIAS = ["Color", "Tamaño", "Material", "Presentación", "Medida"];

/**
 * Las opciones del producto en el teléfono: las pantallas de Shopify, las
 * mismas que la app. Cada eje como un renglón que abre su editor, *Agregar
 * opción* al final, y *Guardar* arriba: un reemplazo entero por
 * `PUT …/opciones`, que puede responder 409 si el cambio borra variantes con
 * stock — se pregunta y se vuelve a mandar con `descartarVariantes`.
 */
export function EditorDeOpcionesMovil({
  productoId,
  opciones,
  variantes,
  onCerrar,
}: {
  productoId: string;
  opciones: OpcionEditable[];
  variantes: number;
  onCerrar: () => void;
}) {
  const router = useRouter();
  const inicial = useMemo(() => JSON.stringify(opciones), [opciones]);
  const [borrador, setBorrador] = useState<OpcionEditable[]>(opciones);
  const [editando, setEditando] = useState<{ indice: number } | { indice: null; nombre: string } | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const hayCambios = JSON.stringify(borrador) !== inicial;

  const guardar = async (descartarVariantes = false): Promise<void> => {
    setGuardando(true);
    try {
      await pedir(`/api/servicios/${productoId}/opciones`, {
        method: "PUT",
        body: { opciones: borrador, descartarVariantes },
      });
      router.refresh();
      onCerrar();
    } catch (e) {
      const mensaje = e instanceof Error ? e.message : "No pudimos guardar las opciones";
      // 409 = el cambio borra variantes con inventario: el servidor dice
      // cuáles y con cuánto; acá solo hace falta el sí.
      if (!descartarVariantes && /borra .* variante/.test(mensaje)) {
        setGuardando(false);
        if (confirm(`${mensaje}\n\n¿Seguir igual?`)) return guardar(true);
        return;
      }
      toast.error(mensaje);
      setGuardando(false);
    }
  };

  const enEdicion =
    editando === null
      ? null
      : editando.indice === null
        ? { opcion: null, nombreInicial: editando.nombre, indice: null as number | null }
        : { opcion: borrador[editando.indice], nombreInicial: "", indice: editando.indice as number | null };

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo="Opciones"
        subtitulo={`${variantes} ${variantes === 1 ? "variante" : "variantes"}`}
        onCerrar={onCerrar}
        cerrando={hayCambios ? "cancelar" : "cerrar"}
        derecha={<PastillaDeHoja texto="Guardar" primaria onClick={() => void guardar()} disabled={!hayCambios} cargando={guardando} />}
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {borrador.length === 0 ? (
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            Sin opciones. Agrega una, como Color o Tamaño, para tener variantes.
          </p>
        ) : null}
        {borrador.map((o, i) => (
          <button
            key={o.id ?? `nueva-${i}`}
            type="button"
            onClick={() => setEditando({ indice: i })}
            className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left active:bg-muted"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[17px]">{o.nombre}</span>
              <span className="block truncate text-sm text-muted-foreground">
                ({o.valores.length}) {o.valores.map((v) => v.valor).join(", ")}
              </span>
            </span>
            <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
          </button>
        ))}
        {borrador.length < MAX_OPCIONES ? (
          <button
            type="button"
            onClick={() => setAgregando(true)}
            className="flex w-full items-center gap-3 border-b px-4 py-3.5 text-left text-[17px] active:bg-muted"
          >
            <PlusCircle className="h-[22px] w-[22px]" strokeWidth={1.5} />
            <span className="flex-1">Agregar opción</span>
            <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
          </button>
        ) : null}
      </div>

      {agregando ? (
        <AgregarOpcionMovil
          usadas={borrador.map((o) => o.nombre)}
          onElegir={(nombre) => {
            setAgregando(false);
            setTimeout(() => setEditando({ indice: null, nombre }), 200);
          }}
          onCerrar={() => setAgregando(false)}
        />
      ) : null}

      {enEdicion ? (
        <EditorDeOpcionMovil
          opcion={enEdicion.opcion}
          nombreInicial={enEdicion.nombreInicial}
          nombresUsados={borrador.filter((_, i) => i !== enEdicion.indice).map((o) => o.nombre)}
          onListo={(opcion) => {
            setBorrador((actual) =>
              enEdicion.indice === null ? [...actual, opcion] : actual.map((o, i) => (i === enEdicion.indice ? opcion : o))
            );
            setEditando(null);
          }}
          onEliminar={
            enEdicion.indice === null
              ? undefined
              : () => {
                  setBorrador((actual) => actual.filter((_, i) => i !== enEdicion.indice));
                  setEditando(null);
                }
          }
          onCerrar={() => setEditando(null)}
        />
      ) : null}
    </HojaCompleta>
  );
}

/** Agregar una opción: buscador, las sugerencias y *Crear opción personalizada*. */
function AgregarOpcionMovil({
  usadas,
  onElegir,
  onCerrar,
}: {
  usadas: string[];
  onElegir: (nombre: string) => void;
  onCerrar: () => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const enUso = new Set(usadas.map((u) => u.toLowerCase()));
  const sugeridas = SUGERENCIAS.filter(
    (s) => !enUso.has(s.toLowerCase()) && s.toLowerCase().includes(busqueda.trim().toLowerCase())
  );
  const personalizada = busqueda.trim();
  const personalizadaEnUso = enUso.has(personalizada.toLowerCase());

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja titulo="Agregar opción" onCerrar={onCerrar} />
      <div className="flex-none px-3 py-2">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && personalizada && !personalizadaEnUso) onElegir(personalizada);
            }}
            placeholder="Buscar"
            autoFocus
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {sugeridas.length > 0 ? (
          <p className="px-4 py-2 text-[13px] font-semibold text-muted-foreground">SUGERENCIAS</p>
        ) : null}
        {sugeridas.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onElegir(s)}
            className="flex w-full items-center border-b px-4 py-3.5 text-left text-[17px] active:bg-muted"
          >
            {s}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={() => onElegir(personalizada)}
        disabled={personalizadaEnUso}
        className="flex flex-none items-center gap-3 border-t px-5 py-4 text-left text-[17px] active:bg-muted disabled:opacity-40"
      >
        <PlusCircle className="h-[22px] w-[22px]" strokeWidth={1.5} />
        <span className="min-w-0 flex-1 truncate">
          {personalizada ? `Crear la opción "${personalizada}"` : "Crear opción personalizada"}
        </span>
        <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
      </button>
    </HojaCompleta>
  );
}

interface FilaValor {
  clave: number;
  id: string | null;
  valor: string;
}

/** Una clave por fila, solo para React: un valor nuevo no tiene id. */
let ultimaClave = 0;
const nuevaClave = () => ++ultimaClave;

/**
 * Una opción: el nombre en su caja, una franja gris, y los valores en una
 * tarjeta como filas con su agarre para reordenar y su tacho, con la última
 * fila vacía diciendo *Agregar valor*. **La ✕ aplica**, como en Shopify; si
 * quedó sin nombre o sin valores se descarta. Los valores viajan con su id
 * cuando ya existían: renombrar no es borrar y crear.
 */
function EditorDeOpcionMovil({
  opcion,
  nombreInicial = "",
  nombresUsados,
  onListo,
  onEliminar,
  onCerrar,
}: {
  opcion: OpcionEditable | null;
  nombreInicial?: string;
  nombresUsados: string[];
  onListo: (opcion: OpcionEditable) => void;
  onEliminar?: () => void;
  onCerrar: () => void;
}) {
  const [nombre, setNombre] = useState(opcion?.nombre ?? nombreInicial);
  const [valores, setValores] = useState<FilaValor[]>(() => [
    ...(opcion?.valores ?? []).map((v) => ({ clave: nuevaClave(), id: v.id, valor: v.valor })),
    { clave: nuevaClave(), id: null, valor: "" },
  ]);
  const [menu, setMenu] = useState(false);

  const llenos = valores.filter((v) => v.valor.trim() !== "");
  const falta = (() => {
    if (!nombre.trim()) return "La opción necesita un nombre.";
    if (nombresUsados.some((n) => n.toLowerCase() === nombre.trim().toLowerCase())) {
      return `Ya hay una opción llamada "${nombre.trim()}".`;
    }
    if (llenos.length === 0) return "Agrega al menos un valor.";
    const vistos = new Set<string>();
    for (const v of llenos) {
      const clave = v.valor.trim().toLowerCase();
      if (vistos.has(clave)) return `"${v.valor.trim()}" está repetido.`;
      vistos.add(clave);
    }
    return null;
  })();

  const escribir = (clave: number, texto: string) =>
    setValores((actual) => {
      const siguiente = actual.map((v) => (v.clave === clave ? { ...v, valor: texto } : v));
      if (siguiente[siguiente.length - 1].valor.trim() !== "") {
        siguiente.push({ clave: nuevaClave(), id: null, valor: "" });
      }
      return siguiente;
    });

  const cerrar = () => {
    if (falta) {
      onCerrar();
      return;
    }
    onListo({
      id: opcion?.id ?? null,
      nombre: nombre.trim(),
      valores: llenos.map((v) => ({ id: v.id, valor: v.valor.trim() })),
    });
  };

  const sensores = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 300, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const alSoltar = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    setValores((actual) => {
      const desde = actual.findIndex((v) => v.clave === active.id);
      const hasta = actual.findIndex((v) => v.clave === over.id);
      return desde < 0 || hasta < 0 ? actual : arrayMove(actual, desde, hasta);
    });
  };
  /** Las que se arrastran: todas menos la vacía del final. */
  const arrastrables = valores.slice(0, -1);
  const titulo = nombre.trim() || (opcion ? opcion.nombre : "Nueva opción");

  return (
    <HojaCompleta onCerrar={cerrar}>
      <CabeceraDeHoja
        titulo={titulo}
        subtitulo={`${llenos.length} ${llenos.length === 1 ? "valor" : "valores"}`}
        onCerrar={cerrar}
        derecha={
          onEliminar ? (
            <BotonRedondoDeHoja etiqueta="Más acciones" onClick={() => setMenu(true)}>
              <MoreHorizontal className="h-[18px] w-[18px]" />
            </BotonRedondoDeHoja>
          ) : undefined
        }
      />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3">
          <CampoEnCaja etiqueta="Nombre" valor={nombre} onCambio={setNombre} placeholder="Color, Tamaño" autoFocus={!opcion && !nombreInicial} limpiable={false} />
        </div>
        <div className="h-2 bg-muted" />
        <div className="px-4 py-3">
          <p className="mb-2.5 text-[15px] font-medium text-muted-foreground">Valores ({llenos.length})</p>
          <div className="overflow-hidden rounded-xl border bg-card">
            <DndContext sensors={sensores} modifiers={[restrictToVerticalAxis]} onDragEnd={alSoltar}>
              <SortableContext items={arrastrables.map((v) => v.clave)} strategy={verticalListSortingStrategy}>
                {arrastrables.map((v) => (
                  <FilaDeValorMovil
                    key={v.clave}
                    fila={v}
                    onEscribir={(t) => escribir(v.clave, t)}
                    onBorrar={() => setValores((actual) => actual.filter((x) => x.clave !== v.clave))}
                  />
                ))}
              </SortableContext>
            </DndContext>
            <div className="flex min-h-[52px] items-center border-t">
              <input
                value={valores[valores.length - 1].valor}
                onChange={(e) => escribir(valores[valores.length - 1].clave, e.target.value)}
                placeholder="Agregar valor"
                className="min-w-0 flex-1 bg-transparent px-3.5 py-3 text-[17px] outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          {falta && (nombre.trim() || llenos.length > 0) ? (
            <p className="mt-2 text-sm text-destructive">{falta}</p>
          ) : null}
        </div>
      </div>

      <Sheet open={menu} onOpenChange={(o) => !o && setMenu(false)}>
        <SheetContent side="bottom" showCloseButton={false} className="gap-0 rounded-t-2xl p-0 pb-[env(safe-area-inset-bottom)]">
          <SheetTitle className="px-4 pt-5 pb-1 text-[17px] font-bold">Acciones</SheetTitle>
          <div className="py-2">
            <button
              type="button"
              onClick={() => {
                setMenu(false);
                setTimeout(() => {
                  if (confirm("¿Eliminar esta opción? Las variantes que dependen de ella se borran al guardar.")) {
                    onEliminar?.();
                  }
                }, 250);
              }}
              className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left text-[16px] text-destructive active:bg-muted"
            >
              <Trash2 className="h-5 w-5" />
              Eliminar opción
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </HojaCompleta>
  );
}

function FilaDeValorMovil({
  fila,
  onEscribir,
  onBorrar,
}: {
  fila: FilaValor;
  onEscribir: (texto: string) => void;
  onBorrar: () => void;
}) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: fila.clave,
  });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, touchAction: "manipulation" }}
      className={`flex min-h-[52px] items-center border-b bg-card ${isDragging ? "opacity-70 shadow-md" : ""}`}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label="Arrastrar para reordenar"
        className="flex h-[52px] w-11 flex-none cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-5 w-5" />
      </button>
      <input
        value={fila.valor}
        onChange={(e) => onEscribir(e.target.value)}
        className="min-w-0 flex-1 bg-transparent py-3 text-[17px] outline-none"
      />
      <button
        type="button"
        onClick={onBorrar}
        aria-label={`Quitar ${fila.valor}`}
        className="flex h-10 w-10 flex-none items-center justify-center text-muted-foreground active:opacity-60"
      >
        <Trash2 className="h-[18px] w-[18px]" />
      </button>
    </div>
  );
}
