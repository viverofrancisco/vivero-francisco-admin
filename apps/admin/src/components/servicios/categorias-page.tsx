"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { Loader2, Pencil, Search } from "lucide-react";
import { toast } from "sonner";

export interface CategoriaFila {
  id: string;
  nombre: string;
  orden: number;
  contificoCategoriaId: string | null;
  contificoCategoriaNombre: string | null;
  /** Cuántos productos vivos la usan. */
  productos: number;
}

/** Una categoría de Contífico, con su ruta ("Ventas › Servicios"). */
interface CategoriaContifico {
  id: string;
  nombre: string;
  ruta: string;
}

/**
 * Las categorías del catálogo del portal.
 *
 * Cada una puede apuntar a una de Contífico: **es la que decide en qué cuenta
 * contable cae la venta**, porque allá el producto hereda la `cuenta_venta` de
 * su categoría. Sin apuntar a ninguna, lo que el portal crea allá termina en la
 * categoría por defecto de ellos, que es de bienes — y un servicio se
 * contabiliza como venta de bienes.
 */
export function CategoriasPage({ categorias }: { categorias: CategoriaFila[] }) {
  const router = useRouter();
  const [editando, setEditando] = useState<CategoriaFila | null>(null);
  const [creando, setCreando] = useState(false);

  const cerrar = () => {
    setEditando(null);
    setCreando(false);
  };

  const borrar = async (id: string) => {
    const res = await fetch(`/api/categorias/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error || "Error al eliminar");
      throw new Error(body.error);
    }
  };

  return (
    <>
      <PageHeader
        title="Categorías"
        description="Cómo se agrupa el catálogo, y con qué categoría de Contífico se crean sus productos"
        actions={[
          {
            label: "Nueva categoría",
            onClick: () => setCreando(true),
            icon: "plus",
            primary: true,
          },
        ]}
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
        {categorias.length === 0 ? (
          <EmptyState message="Todavía no hay categorías" />
        ) : (
          <Table containerClassName="h-full overflow-y-auto">
            <TableHeader sticky>
              <TableRow>
                <TableHead>Nombre</TableHead>
                <TableHead>Categoría de Contífico</TableHead>
                <TableHead className="w-28">Productos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {c.contificoCategoriaNombre ?? (
                      <span className="text-amber-700">
                        Sin asignar · sus productos caen en la categoría por
                        defecto de Contífico
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.productos}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setEditando(c)}
                        aria-label={`Editar ${c.nombre}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <DeleteDialog
                        title={`¿Eliminar "${c.nombre}"?`}
                        description={
                          c.productos > 0
                            ? `Sus ${c.productos} producto${c.productos === 1 ? "" : "s"} quedan sin categoría. No se borra ninguno.`
                            : "No la usa ningún producto."
                        }
                        onDelete={() => borrar(c.id)}
                        onSuccess={() => router.refresh()}
                      />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      {(creando || editando) && (
        <CategoriaDialog
          categoria={editando}
          onClose={cerrar}
          onGuardado={() => {
            cerrar();
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function CategoriaDialog({
  categoria,
  onClose,
  onGuardado,
}: {
  categoria: CategoriaFila | null;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [nombre, setNombre] = useState(categoria?.nombre ?? "");
  const [contifico, setContifico] = useState<CategoriaContifico | null>(
    categoria?.contificoCategoriaId
      ? {
          id: categoria.contificoCategoriaId,
          nombre: categoria.contificoCategoriaNombre ?? "",
          ruta: categoria.contificoCategoriaNombre ?? "",
        }
      : null
  );
  const [guardando, setGuardando] = useState(false);

  const guardar = async () => {
    if (!nombre.trim()) return toast.error("La categoría necesita un nombre");
    setGuardando(true);
    try {
      const res = await fetch(
        categoria ? `/api/categorias/${categoria.id}` : "/api/categorias",
        {
          method: categoria ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            nombre: nombre.trim(),
            orden: categoria?.orden ?? 0,
            contificoCategoriaId: contifico?.id ?? null,
            contificoCategoriaNombre: contifico?.ruta || contifico?.nombre || null,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(categoria ? "Categoría actualizada" : "Categoría creada");
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {categoria ? "Editar categoría" : "Nueva categoría"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="nombre">Nombre *</Label>
            <Input
              id="nombre"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Mantenimiento"
              autoFocus
            />
          </div>

          <SelectorCategoriaContifico value={contifico} onChange={setContifico} />

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Elige la categoría de Contífico con la que se crearán los productos.
 *
 * Busca contra su API en vez de traer la lista entera: son 2.939 en la cuenta
 * de pruebas. Se muestran con la ruta completa porque los nombres se repiten
 * —ahí mismo hay cinco "General"— y por el nombre solo no se sabe cuál es.
 */
function SelectorCategoriaContifico({
  value,
  onChange,
}: {
  value: CategoriaContifico | null;
  onChange: (c: CategoriaContifico | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<CategoriaContifico[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [abierto, setAbierto] = useState(false);

  useEffect(() => {
    if (!abierto) return;
    const cancelado = { current: false };
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const res = await fetch(
          `/api/servicios/contifico/categorias?q=${encodeURIComponent(query.trim())}`,
          { cache: "no-store" }
        );
        const body = await res.json();
        if (cancelado.current) return;
        if (!res.ok) throw new Error(body.error ?? "Error");
        setItems(body.items ?? []);
      } catch (e) {
        if (!cancelado.current) {
          toast.error(e instanceof Error ? e.message : "Error al buscar");
        }
      } finally {
        if (!cancelado.current) setBuscando(false);
      }
    }, 400);
    return () => {
      cancelado.current = true;
      clearTimeout(t);
    };
  }, [query, abierto]);

  return (
    <div className="space-y-1.5">
      <Label>Categoría de Contífico</Label>
      <p className="text-xs text-muted-foreground">
        Con esta se crean allá los productos de esta categoría, y es lo que
        decide en qué cuenta contable cae la venta. Sin elegir ninguna, Contífico
        les pone la suya por defecto, que es de bienes.
      </p>

      {value ? (
        <div className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
          <span className="min-w-0 truncate text-sm">{value.ruta || value.nombre}</span>
          <Button
            variant="ghost"
            size="sm"
            className="flex-none"
            onClick={() => {
              onChange(null);
              setAbierto(true);
            }}
          >
            Cambiar
          </Button>
        </div>
      ) : abierto ? (
        <div className="space-y-2">
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
          <div className="max-h-56 divide-y overflow-y-auto rounded-md border">
            {buscando ? (
              <p className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Buscando…
              </p>
            ) : items.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Sin resultados.
              </p>
            ) : (
              items.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    onChange(c);
                    setAbierto(false);
                  }}
                  className="block w-full px-3 py-2 text-left text-sm hover:bg-muted"
                >
                  {c.ruta}
                </button>
              ))
            )}
          </div>
        </div>
      ) : (
        <Button variant="outline" size="sm" onClick={() => setAbierto(true)}>
          Elegir categoría de Contífico
        </Button>
      )}
    </div>
  );
}
