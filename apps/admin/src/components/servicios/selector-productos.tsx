"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, ImageOff, Loader2, Search } from "lucide-react";

export interface ProductoElegible {
  id: string;
  nombre: string;
  tipo: string;
  estado: string;
  /** El más bajo de sus variantes. `null` en un servicio: no tiene ninguna. */
  precio: number | null;
  /** Para poder ordenar por antigüedad. */
  creadoEl: string;
  imagenUrl: string | null;
}

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/**
 * De a cuántos se piden.
 *
 * Medido contra la base: un pedido tarda lo mismo por 10 que por 100 —el costo
 * es el viaje, no las filas— así que lo que conviene es hacer pocos viajes. La
 * lista muestra unas diez filas a la vez, y veinte son dos pantallas: la
 * primera tanda llena la vista y deja resto, así que la siguiente llega
 * mientras se desplaza. Con diez, el pie quedaría visible de entrada y se
 * pediría la segunda tanda enseguida: dos viajes para mostrar lo que uno ya
 * mostraba.
 */
const POR_TANDA = 20;

/**
 * Elegir productos para sumarlos a una categoría.
 *
 * Esconde los que **ya están elegidos** —incluidos los que se acaban de marcar
 * y todavía no se guardaron— porque mostrarlos obligaría a recordar cuáles ya
 * se agregaron, que es justo lo que la pantalla debería contestar. Incluye los
 * borradores: ordenar el catálogo antes de vender es exactamente cuándo conviene
 * hacerlo.
 *
 * Devuelve los productos **enteros** y no sus ids: quien los recibe los va a
 * pintar en una lista, y volver al servidor por algo que acaba de tener en la
 * mano es un viaje de más.
 */
export function SelectorProductos({
  excluir,
  onElegir,
  onCerrar,
}: {
  /** Los que ya están en la categoría. No se ofrecen. */
  excluir: string[];
  onElegir: (productos: ProductoElegible[]) => void;
  onCerrar: () => void;
}) {
  const [items, setItems] = useState<ProductoElegible[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  /** Lo que de verdad se pidió: va detrás de lo tipeado. */
  const [aplicada, setAplicada] = useState("");
  const [pedida, setPedida] = useState<string | null>(null);
  const [hayMas, setHayMas] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [elegidos, setElegidos] = useState<string[]>([]);
  const centinela = useRef<HTMLDivElement>(null);

  /**
   * La búsqueda espera a que la mano pare.
   *
   * Cada pedido cuesta lo mismo vaya por 10 o por 100 filas —el costo es el
   * viaje, no las filas— así que lo que hay que evitar es hacer uno por tecla.
   */
  useEffect(() => {
    const t = setTimeout(() => setAplicada(busqueda), 300);
    return () => clearTimeout(t);
  }, [busqueda]);

  const traer = (q: string, offset: number) => {
    setCargandoMas(true);
    fetch(
      `/api/categorias/productos?q=${encodeURIComponent(q)}&offset=${offset}&limit=${POR_TANDA}`
    )
      .then((r) => r.json())
      .then((d: { productos?: ProductoElegible[]; hayMas?: boolean }) => {
        const nuevos = d.productos ?? [];
        // Por offset y no acumulando a ciegas: si la búsqueda cambió mientras
        // volaba el pedido, esto reemplaza en vez de mezclar dos listas.
        setItems((prev) => (offset === 0 || prev === null ? nuevos : [...prev, ...nuevos]));
        setHayMas(Boolean(d.hayMas));
      })
      .catch(() => setItems((prev) => prev ?? []))
      .finally(() => setCargandoMas(false));
  };

  // Al renderizar con una búsqueda nueva en vez de con un efecto: no hay
  // dependencias que sincronizar ni un `setState` después de pintar.
  if (pedida !== aplicada) {
    setPedida(aplicada);
    setItems(null);
    setHayMas(false);
    traer(aplicada, 0);
  }

  /**
   * Sigue pidiendo al llegar al final de la lista.
   *
   * El centinela es un div al pie: cuando entra en la parte visible del
   * scroll, hay que traer la tanda siguiente. Es lo mismo que mirar el scroll a
   * mano, sin escuchar cada píxel.
   */
  useEffect(() => {
    const nodo = centinela.current;
    if (!nodo || !hayMas || cargandoMas || items === null) return;
    const obs = new IntersectionObserver(
      (entradas) => {
        if (entradas[0]?.isIntersecting) traer(pedida ?? "", items.length);
      },
      // Un poco antes del borde: así la tanda llega mientras todavía se está
      // desplazando y no se ve el hueco.
      { rootMargin: "120px" }
    );
    obs.observe(nodo);
    return () => obs.disconnect();
  }, [hayMas, cargandoMas, items, pedida]);

  /** Lo que queda por elegir: lo ya agregado no se vuelve a ofrecer. */
  const disponibles = (items ?? []).filter((p) => !excluir.includes(p.id));

  const alternar = (id: string) =>
    setElegidos((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar productos</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar producto..."
              className="pl-9"
              autoFocus
            />
          </div>

          <div className="max-h-[50vh] divide-y overflow-y-auto rounded-md border">
            {items === null ? (
              <p className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando…
              </p>
            ) : disponibles.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                {busqueda
                  ? "Nada con ese nombre."
                  : "Todos los productos ya están en esta categoría."}
              </p>
            ) : (
              disponibles.map((p) => {
                const elegido = elegidos.includes(p.id);
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => alternar(p.id)}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left ${
                      elegido ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`flex h-4 w-4 flex-none items-center justify-center rounded border ${
                        elegido
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {elegido && <Check className="h-3 w-3" />}
                    </span>
                    <span className="relative h-9 w-9 flex-none overflow-hidden rounded border bg-muted">
                      {p.imagenUrl ? (
                        <Image
                          src={p.imagenUrl}
                          alt=""
                          fill
                          sizes="36px"
                          className="object-cover"
                          unoptimized
                        />
                      ) : (
                        <span className="flex h-full items-center justify-center text-muted-foreground">
                          <ImageOff className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {p.nombre}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {TIPO_LABEL[p.tipo] ?? p.tipo}
                        {p.estado === "BORRADOR" && " · Borrador"}
                      </span>
                    </span>
                  </button>
                );
              })
            )}

            {/* El pie que dispara la tanda siguiente. Va dentro del área que
                se desplaza, que es de lo que el observador mira la visibilidad. */}
            {items !== null && hayMas ? (
              <div
                ref={centinela}
                className="flex items-center justify-center gap-2 py-4 text-sm text-muted-foreground"
              >
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando más…
              </div>
            ) : null}
          </div>

          <div className="flex items-center justify-between gap-2 border-t pt-4">
            <span className="text-xs text-muted-foreground">
              {elegidos.length > 0 &&
                `${elegidos.length} ${elegidos.length === 1 ? "elegido" : "elegidos"}`}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" onClick={onCerrar}>
                Cancelar
              </Button>
              <Button
                onClick={() =>
                  onElegir(
                    elegidos
                      .map((id) => (items ?? []).find((p) => p.id === id))
                      .filter((p): p is ProductoElegible => Boolean(p))
                  )
                }
                disabled={elegidos.length === 0}
              >
                Agregar
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
