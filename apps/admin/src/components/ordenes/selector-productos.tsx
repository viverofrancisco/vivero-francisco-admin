"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Minus,
  Search,
} from "lucide-react";
import type { VarianteVendible } from "./selector-variante";
import { money } from "./formato";

export interface ProductoElegible {
  id: string;
  nombre: string;
  ivaTasa: number | null;
  /** Una sola en un servicio o en un bien sin opciones. */
  variantes: VarianteVendible[];
}

/** Lo que se eligió: la variante, con su producto para el precio y el IVA. */
export interface VarianteElegida {
  producto: ProductoElegible;
  variante: VarianteVendible;
}

/**
 * El catálogo de a tandas, tal como lo devuelve `useCatalogo`.
 *
 * Es el **mismo** que usa el desplegable del escritorio: así lo que se eligió
 * acá queda en `conocidos`, de donde la línea saca sus variantes.
 */
export interface CatalogoPaginado {
  pagina: ProductoElegible[];
  conocidos: ProductoElegible[];
  hayMas: boolean;
  cargando: boolean;
  busqueda: string;
  onBuscar: (texto: string) => void;
  onMas: () => void;
}

/**
 * Elegir productos para la orden, **varios de una**, como Shopify. La pantalla
 * de la app (`SelectorProductos`), para el portal en el teléfono.
 *
 * Una hoja a pantalla completa con Cancelar y Guardar arriba: se marcan
 * casillas y nada entra a la orden hasta *Guardar*. Un producto con una sola
 * variante se marca directo; con varias, el renglón dice cuántas y el chevron
 * abre su lista de variantes con precio y stock, donde se marcan las que se
 * venden. La casilla del producto queda a medias —el guion— cuando tiene
 * algunas marcadas. Cancelar con cambios pregunta antes de tirarlos.
 */
export function SelectorProductos({
  abierto,
  catalogo,
  yaElegidas,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  catalogo: CatalogoPaginado;
  /** Las variantes que ya están en la orden: llegan marcadas. */
  yaElegidas: string[];
  onCerrar: () => void;
  /** La selección entera: lo que hay que agregar y lo que se desmarcó. */
  onGuardar: (elegidas: VarianteElegida[]) => void;
}) {
  /**
   * Cómo cerrar, según lo que haya adentro. Escape o un toque afuera llegan
   * acá, al `Root`, y quien sabe si hay cambios sin guardar es el contenido:
   * lo deja anotado en este ref cada vez que cambia.
   */
  const cerrarRef = useRef(onCerrar);
  return (
    <DialogPrimitive.Root
      open={abierto}
      onOpenChange={(o) => {
        if (!o) cerrarRef.current();
      }}
    >
      <DialogPrimitive.Portal>
        <DialogPrimitive.Popup className="fixed inset-0 z-50 flex h-dvh w-screen flex-col bg-background outline-none data-open:animate-in data-open:fade-in-0 data-open:slide-in-from-bottom-4 data-closed:animate-out data-closed:fade-out-0">
          {/* El estado vive en el contenido, que se monta con la hoja y se
              va con ella: así cada apertura arranca con lo que la orden tiene
              hoy, sin un efecto que lo reinicie. */}
          <Contenido
            catalogo={catalogo}
            yaElegidas={yaElegidas}
            onCerrar={onCerrar}
            onGuardar={onGuardar}
            registrarCierre={(fn) => {
              cerrarRef.current = fn;
            }}
          />
        </DialogPrimitive.Popup>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

function Contenido({
  catalogo,
  yaElegidas,
  onCerrar,
  onGuardar,
  registrarCierre,
}: {
  catalogo: CatalogoPaginado;
  yaElegidas: string[];
  onCerrar: () => void;
  onGuardar: (elegidas: VarianteElegida[]) => void;
  registrarCierre: (fn: () => void) => void;
}) {
  // Arranca con lo que la orden ya tiene.
  const [marcadas, setMarcadas] = useState<Set<string>>(
    () => new Set(yaElegidas)
  );
  /** Adentro de un producto con varias variantes. */
  const [dentro, setDentro] = useState<ProductoElegible | null>(null);
  const [confirmarSalida, setConfirmarSalida] = useState(false);

  // Y con la búsqueda limpia: la del desplegable del escritorio es la misma,
  // y lo que se buscó la última vez no es lo que se busca ahora.
  const limpiarBusqueda = catalogo.onBuscar;
  useEffect(() => {
    limpiarBusqueda("");
  }, [limpiarBusqueda]);

  const hayCambios = useMemo(() => {
    const antes = new Set(yaElegidas);
    if (antes.size !== marcadas.size) return true;
    for (const id of marcadas) if (!antes.has(id)) return true;
    return false;
  }, [yaElegidas, marcadas]);

  const alternar = (ids: string[], marcar: boolean) =>
    setMarcadas((prev) => {
      const s = new Set(prev);
      for (const id of ids) {
        if (marcar) s.add(id);
        else s.delete(id);
      }
      return s;
    });

  /**
   * Cancelar con cambios pregunta en un **diálogo chico y centrado**, no en
   * otra hoja: es una decisión de dos líneas, y una hoja encima de otra hoja
   * le da a esa decisión el peso de una pantalla.
   */
  const cerrar = () => {
    if (!hayCambios) return onCerrar();
    setConfirmarSalida(true);
  };
  useEffect(() => {
    registrarCierre(cerrar);
  });

  const guardar = () => {
    const elegidas: VarianteElegida[] = [];
    for (const p of catalogo.conocidos) {
      for (const v of p.variantes) {
        if (marcadas.has(v.id)) elegidas.push({ producto: p, variante: v });
      }
    }
    onGuardar(elegidas);
  };

  /** Cuántas variantes de un producto están marcadas. */
  const marcadasDe = (p: ProductoElegible) =>
    p.variantes.filter((v) => marcadas.has(v.id)).length;

  return (
    <>
      {/* Cancelar / Guardar arriba, como la app y como Shopify: son lo
          único que no se va scrolleando. Adentro de un producto, la flecha
          vuelve a la lista sin perder nada. */}
      <div className="flex h-14 flex-none items-center gap-1.5 border-b border-border px-2.5">
        {dentro ? (
          <button
            type="button"
            onClick={() => setDentro(null)}
            className="flex h-10 w-10 items-center justify-center rounded-xl active:bg-muted"
            aria-label="Volver a la lista"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : (
          <button
            type="button"
            onClick={cerrar}
            className="min-w-[76px] rounded-lg px-1.5 py-1.5 text-left text-base font-semibold text-muted-foreground active:bg-muted"
          >
            Cancelar
          </button>
        )}
        <DialogPrimitive.Title className="min-w-0 flex-1 truncate text-center text-[17px] font-bold">
          {dentro ? dentro.nombre : "Productos"}
        </DialogPrimitive.Title>
        {dentro ? (
          <span className="min-w-[76px]" />
        ) : (
          <button
            type="button"
            onClick={guardar}
            disabled={!hayCambios}
            className="min-w-[76px] rounded-lg px-1.5 py-1.5 text-right text-base font-bold text-primary active:bg-muted disabled:text-muted-foreground"
          >
            Guardar
          </button>
        )}
      </div>

      {dentro ? (
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          {dentro.variantes.map((v) => {
            const marcada = marcadas.has(v.id);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => alternar([v.id], !marcada)}
                className="flex w-full items-center gap-3 border-t border-border px-2 py-3 text-left first:border-t-0 active:bg-muted"
              >
                <Casilla estado={marcada ? "si" : "no"} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-medium">
                    {v.nombre || dentro.nombre}
                  </span>
                  <span className="block text-xs text-muted-foreground">
                    {v.precio === 0 ? "Sin precio de lista" : money(v.precio)}
                    {v.manejaInventario ? ` · ${v.stock} disponibles` : ""}
                    {v.sku ? ` · ${v.sku}` : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : (
        <>
          <div className="flex-none px-3 py-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={catalogo.busqueda}
                onChange={(e) => catalogo.onBuscar(e.target.value)}
                placeholder="Buscar"
                className="h-10 rounded-xl bg-muted pl-9"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2">
            {catalogo.cargando && catalogo.pagina.length === 0 ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : catalogo.pagina.length === 0 ? (
              <p className="p-4 text-center text-sm text-muted-foreground">
                Sin coincidencias.
              </p>
            ) : (
              catalogo.pagina.map((p) => {
                const varias = p.variantes.length > 1;
                const cuantas = marcadasDe(p);
                const estado =
                  cuantas === 0
                    ? "no"
                    : cuantas === p.variantes.length
                      ? "si"
                      : "medias";
                const unica = p.variantes[0];
                const marcarTodas = () =>
                  varias
                    ? alternar(
                        p.variantes.map((v) => v.id),
                        estado !== "si"
                      )
                    : unica && alternar([unica.id], !marcadas.has(unica.id));
                return (
                  /* La casilla y el renglón son dos botones **hermanos**:
                         con varias variantes la casilla marca o desmarca todas
                         y el renglón entra a elegir; con una, hacen lo mismo. */
                  <div
                    key={p.id}
                    className="flex items-center gap-3 border-t border-border px-2 py-3 first:border-t-0"
                  >
                    <button
                      type="button"
                      onClick={marcarTodas}
                      disabled={!unica}
                      className="-m-2 flex-none p-2"
                      aria-label={estado === "si" ? "Desmarcar" : "Marcar"}
                    >
                      <Casilla estado={estado} />
                    </button>
                    <button
                      type="button"
                      onClick={() => (varias ? setDentro(p) : marcarTodas())}
                      disabled={!unica}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg text-left active:bg-muted"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] font-medium">
                          {p.nombre}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {varias
                            ? `${p.variantes.length} variantes${
                                cuantas > 0
                                  ? ` (${cuantas} seleccionada${cuantas === 1 ? "" : "s"})`
                                  : ""
                              }`
                            : !unica
                              ? "Sin variante para vender"
                              : unica.precio === 0
                                ? "Sin precio de lista"
                                : money(unica.precio)}
                        </span>
                      </span>
                      {varias && (
                        <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                      )}
                    </button>
                  </div>
                );
              })
            )}
            <PieDelCatalogo
              hayMas={catalogo.hayMas}
              cuantos={catalogo.pagina.length}
              onMas={catalogo.onMas}
            />
          </div>
        </>
      )}

      <Dialog open={confirmarSalida} onOpenChange={setConfirmarSalida}>
        <DialogContent showCloseButton={false} className="max-w-xs">
          <DialogHeader>
            <DialogTitle>Tienes cambios sin guardar</DialogTitle>
            <DialogDescription>
              Lo que marcaste no entra a la orden si sales ahora.
            </DialogDescription>
          </DialogHeader>
          {/* Lado a lado, como el alerta del sistema en la app: apilados
                  ocupaban media pantalla para una decisión de dos palabras. */}
          <DialogFooter className="flex-row justify-end">
            <Button variant="outline" onClick={() => setConfirmarSalida(false)}>
              Volver
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setConfirmarSalida(false);
                onCerrar();
              }}
            >
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

/**
 * El pie de la lista: al asomarse pide la tanda siguiente.
 *
 * Se vuelve a observar cada vez que la lista crece, porque un
 * `IntersectionObserver` avisa de los *cambios*: si la tanda nueva no llenó
 * la pantalla, el pie seguía a la vista y no volvía a disparar.
 */
function PieDelCatalogo({
  hayMas,
  cuantos,
  onMas,
}: {
  hayMas: boolean;
  cuantos: number;
  onMas: () => void;
}) {
  const nodo = useRef<HTMLDivElement>(null);
  const pedir = useRef(onMas);
  useEffect(() => {
    pedir.current = onMas;
  });
  useEffect(() => {
    const el = nodo.current;
    if (!el || !hayMas) return;
    const obs = new IntersectionObserver(
      (e) => {
        if (e[0]?.isIntersecting) pedir.current();
      },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [hayMas, cuantos]);

  return (
    <div
      ref={nodo}
      className={hayMas ? "flex h-10 items-center justify-center" : "h-0"}
      aria-hidden={!hayMas}
    >
      {hayMas && (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      )}
    </div>
  );
}

/**
 * La casilla de la app: vacía, marcada, o a medias (algunas variantes).
 *
 * Dibujada y no la `Checkbox` de la interfaz, porque va **adentro** de un
 * botón —la fila entera es lo que se toca— y un botón adentro de otro no es
 * HTML válido.
 */
export function Casilla({
  estado,
  className,
}: {
  estado: "no" | "si" | "medias";
  className?: string;
}) {
  const activa = estado !== "no";
  return (
    <span
      className={cn(
        "flex h-6 w-6 flex-none items-center justify-center rounded-[7px] border-[1.5px] border-border transition-colors",
        activa && "border-primary bg-primary text-primary-foreground",
        className
      )}
      aria-hidden
    >
      {estado === "si" ? (
        <Check className="h-[15px] w-[15px]" strokeWidth={3} />
      ) : estado === "medias" ? (
        <Minus className="h-[15px] w-[15px]" strokeWidth={3} />
      ) : null}
    </span>
  );
}
