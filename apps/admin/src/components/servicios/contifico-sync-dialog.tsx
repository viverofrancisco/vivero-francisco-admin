"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Link2,
  Loader2,
  PlusCircle,
  Search,
} from "lucide-react";
import { toast } from "sonner";
import {
  resumenParaCrear,
  type ProductoDelPortal,
} from "@/lib/contifico/campos";

export interface ContificoProducto {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  estado: string;
  /** Nombre del producto del portal que ya lo tomó, si hay alguno. */
  vinculadoA: string | null;
}

export interface VinculoContifico {
  codigo: string | null;
  contificoProductoId: string | null;
}

export const MIN_BUSQUEDA = 3;

/**
 * Pasos del asistente. Vincular y crear son decisiones distintas con
 * consecuencias distintas —una no toca el catálogo ajeno y la otra sí, de forma
 * permanente—, así que se eligen explícitamente y se confirman por separado.
 */
type Paso = "elegir" | "buscar" | "confirmar-vincular" | "confirmar-crear";

/**
 * Vincula el producto del portal con uno de Contífico, o crea uno nuevo allá.
 *
 * No sabe nada de guardar: quien lo usa decide qué hacer con la elección. Así
 * sirve igual en la ficha de un producto que existe (donde se hace el POST) y
 * en el alta, donde todavía no hay id que vincular.
 */
export function ContificoSyncDialog({
  producto,
  open,
  onOpenChange,
  onElegir,
  onCrearNuevo,
  actualId,
  guardando = false,
}: {
  /** Lo que el portal tiene. `id` en null si el producto todavía no se guardó. */
  producto: Omit<ProductoDelPortal, "id"> & { id: string | null };
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onElegir: (
    elegido: ContificoProducto,
    opciones: { actualizarNombre: boolean }
  ) => void | Promise<void>;
  onCrearNuevo: () => void | Promise<void>;
  /** Vínculo actual, para no ofrecer el que ya está puesto. */
  actualId?: string | null;
  guardando?: boolean;
}) {
  const [paso, setPaso] = useState<Paso>("elegir");
  const [query, setQuery] = useState(producto.nombre);
  const [elegido, setElegido] = useState<ContificoProducto | null>(null);
  // Por defecto se renombra: si no, la factura sale con el nombre de ellos y la
  // diferencia se descubre recién cuando el cliente recibe el papel.
  const [actualizarNombre, setActualizarNombre] = useState(true);
  // El resultado guarda la consulta que lo produjo: así lo que se muestra se
  // deriva de si coincide con lo tipeado ahora, y el efecto nunca necesita
  // limpiar estado (que dispara renders en cascada).
  const [resultado, setResultado] = useState<{
    query: string;
    items: ContificoProducto[];
  } | null>(null);
  const [buscando, setBuscando] = useState(false);

  // Debounce: cada tecla sería una llamada a una API ajena que puede tardar.
  useEffect(() => {
    if (paso !== "buscar") return;
    const q = query.trim();
    if (q.length < MIN_BUSQUEDA) return;
    const cancelado = { current: false };
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/servicios/contifico/buscar?q=${encodeURIComponent(q)}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelado.current) return;
        if (!res.ok) throw new Error(body.error ?? "Error");
        setResultado({ query: q, items: body.items ?? [] });
      } catch (e) {
        if (!cancelado.current) {
          toast.error(e instanceof Error ? e.message : "Error al buscar");
          setResultado({ query: q, items: [] });
        }
      } finally {
        if (!cancelado.current) setBuscando(false);
      }
    }, 400);
    return () => {
      cancelado.current = true;
      clearTimeout(t);
    };
  }, [query, paso]);

  const corta = query.trim().length < MIN_BUSQUEDA;
  // Solo vale lo que corresponde a lo que está tipeado ahora.
  const vigente = resultado?.query === query.trim() ? resultado : null;
  const items = vigente?.items ?? [];

  const seleccionar = (p: ContificoProducto) => {
    setElegido(p);
    setActualizarNombre(p.nombre !== producto.nombre);
    setPaso("confirmar-vincular");
  };

  const titulos: Record<Paso, string> = {
    elegir: actualId ? "Cambiar producto de Contífico" : "Vincular con Contífico",
    buscar: "Buscar en el catálogo de Contífico",
    "confirmar-vincular": "Confirmar vinculación",
    "confirmar-crear": "Confirmar creación en Contífico",
  };

  const filasCrear = resumenParaCrear(
    producto.id ? { ...producto, id: producto.id } : null
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{titulos[paso]}</DialogTitle>
        </DialogHeader>

        {/* ── Paso 1: qué querés hacer ─────────────────────────────── */}
        {paso === "elegir" && (
          <div className="min-w-0 space-y-4">
            <p className="text-sm text-muted-foreground">
              Para poder facturarlo, este producto necesita su par en Contífico.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setPaso("buscar")}
                className="flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <Link2 className="h-5 w-5 text-primary" />
                <span className="font-medium">
                  Vincular con uno existente
                </span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Buscá en el catálogo que ya tienen. No crea nada nuevo.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setPaso("confirmar-crear")}
                className="flex h-full flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
              >
                <PlusCircle className="h-5 w-5 text-muted-foreground" />
                <span className="font-medium">Crear producto nuevo</span>
                <span className="text-xs leading-snug text-muted-foreground">
                  Se agrega al catálogo de Contífico con los datos del portal.
                </span>
              </button>
            </div>
          </div>
        )}

        {/* ── Paso 2a: buscar ──────────────────────────────────────── */}
        {paso === "buscar" && (
          <div className="min-w-0 space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar en Contífico..."
                className="pl-9"
                autoFocus
              />
            </div>

            <div className="min-h-[220px]">
              {corta ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  Escribí al menos {MIN_BUSQUEDA} letras. Su API no admite
                  búsquedas más amplias: intenta devolver el catálogo entero y
                  no responde.
                </p>
              ) : buscando ? (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Buscando en Contífico…
                </div>
              ) : items.length === 0 ? (
                <p className="py-10 text-center text-sm text-muted-foreground">
                  {vigente
                    ? "No hay productos con ese nombre en Contífico."
                    : "Sin resultados."}
                </p>
              ) : (
                <div className="max-h-[320px] divide-y overflow-y-auto overflow-x-hidden rounded-md border">
                  {items.map((p) => {
                    const esElActual = p.id === actualId;
                    // Los tomados se marcan en vez de esconderse: si no, el
                    // usuario los busca y no entiende por qué no aparecen.
                    const tomado = Boolean(p.vinculadoA) && !esElActual;
                    return (
                      <div
                        key={p.id}
                        className="flex min-w-0 items-center justify-between gap-3 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium">
                            {p.nombre}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            <span className="font-mono">{p.codigo}</span>
                            {" · "}
                            {p.tipo === "SER" ? "Servicio" : "Bien"}
                            {p.estado !== "A" && " · Inactivo"}
                            {tomado && ` · ya vinculado a "${p.vinculadoA}"`}
                          </p>
                        </div>
                        {esElActual ? (
                          <Badge
                            variant="secondary"
                            className="flex-none text-xs"
                          >
                            Vinculado ahora
                          </Badge>
                        ) : tomado ? (
                          <Badge variant="outline" className="flex-none text-xs">
                            Tomado
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="flex-none"
                            onClick={() => seleccionar(p)}
                          >
                            Seleccionar
                          </Button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex justify-between border-t pt-4">
              <Button variant="ghost" onClick={() => setPaso("elegir")}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3a: confirmar vinculación ───────────────────────── */}
        {paso === "confirmar-vincular" && elegido && (
          <div className="min-w-0 space-y-4">
            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                Se va a vincular con
              </div>
              <div className="px-3 py-2.5">
                <p className="text-sm font-medium">{elegido.nombre}</p>
                <p className="text-xs text-muted-foreground">
                  <span className="font-mono">{elegido.codigo}</span>
                  {" · "}
                  {elegido.tipo === "SER" ? "Servicio" : "Bien"}
                  {elegido.estado !== "A" && " · Inactivo"}
                </p>
              </div>
            </div>

            {elegido.nombre !== producto.nombre ? (
              <label className="flex cursor-pointer items-start gap-2.5 rounded-md bg-amber-50 p-3">
                <Checkbox
                  checked={actualizarNombre}
                  onCheckedChange={(v) => setActualizarNombre(v === true)}
                  className="mt-0.5"
                />
                <span className="space-y-1 text-xs leading-snug text-amber-800">
                  <span className="flex items-center gap-1 font-medium">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Renombrar el producto en Contífico
                  </span>
                  <span className="block">
                    La factura imprime el nombre que Contífico tiene guardado,
                    no el del portal.
                  </span>
                </span>
              </label>
            ) : (
              <p className="text-xs text-muted-foreground">
                Los nombres coinciden: no hace falta renombrar nada.
              </p>
            )}

            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                {actualizarNombre && elegido.nombre !== producto.nombre
                  ? "Lo que se escribe en Contífico"
                  : "No se escribe nada en Contífico"}
              </div>
              {actualizarNombre && elegido.nombre !== producto.nombre ? (
                <dl className="divide-y text-sm">
                  <div className="flex gap-3 px-3 py-2">
                    <dt className="w-28 flex-none text-muted-foreground">
                      Nombre actual
                    </dt>
                    <dd className="min-w-0 flex-1 break-words line-through decoration-muted-foreground/50">
                      {elegido.nombre}
                    </dd>
                  </div>
                  <div className="flex gap-3 px-3 py-2">
                    <dt className="w-28 flex-none text-muted-foreground">
                      Nombre nuevo
                    </dt>
                    <dd className="min-w-0 flex-1 break-words font-medium">
                      {producto.nombre}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="px-3 py-2 text-sm text-muted-foreground">
                  Solo se guarda la referencia en el portal.
                </p>
              )}
            </div>

            {actualizarNombre && elegido.nombre !== producto.nombre && (
              <p className="text-xs text-muted-foreground">
                El cambio afecta a ese producto para todos los que lo usen en
                Contífico, no solo al portal.
              </p>
            )}

            <div className="flex justify-between border-t pt-4">
              <Button
                variant="ghost"
                onClick={() => setPaso("buscar")}
                disabled={guardando}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
              <Button
                onClick={() =>
                  onElegir(elegido, {
                    actualizarNombre:
                      actualizarNombre && elegido.nombre !== producto.nombre,
                  })
                }
                disabled={guardando}
              >
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
                {!guardando && <ArrowRight className="ml-2 h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}

        {/* ── Paso 3b: confirmar creación ──────────────────────────── */}
        {paso === "confirmar-crear" && (
          <div className="min-w-0 space-y-4">
            <div className="flex items-start gap-2 rounded-md bg-amber-50 p-3 text-xs leading-snug text-amber-800">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-none" />
              <span>
                Contífico no permite borrar productos, solo desactivarlos: este
                producto va a quedar en su catálogo para siempre. Si ya existe
                allá, conviene vincularlo en vez de crear un duplicado.
              </span>
            </div>

            <div className="rounded-md border">
              <div className="border-b bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                Se va a crear en Contífico con estos datos
              </div>
              <dl className="divide-y text-sm">
                {filasCrear.map((f) => (
                  <div key={f.etiqueta} className="flex gap-3 px-3 py-2">
                    <dt className="w-28 flex-none text-muted-foreground">
                      {f.etiqueta}
                    </dt>
                    <dd className="min-w-0 flex-1 break-words">{f.valor}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <div className="flex justify-between border-t pt-4">
              <Button
                variant="ghost"
                onClick={() => setPaso("elegir")}
                disabled={guardando}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Atrás
              </Button>
              <Button onClick={onCrearNuevo} disabled={guardando}>
                {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Crear en Contífico
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
