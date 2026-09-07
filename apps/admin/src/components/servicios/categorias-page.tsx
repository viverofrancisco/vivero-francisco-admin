"use client";

import { useState } from "react";
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
import { Loader2 } from "lucide-react";
import { aca } from "@/lib/filtros-url";
import { toast } from "sonner";

export interface CategoriaFila {
  id: string;
  nombre: string;
  orden: number;
  /** Cuántos productos vivos la usan. */
  productos: number;
}

/**
 * Las categorías del catálogo. Sirven para encontrar un producto en una lista:
 * no salen impresas en la factura ni cambian cómo se emite.
 */
export function CategoriasPage({ categorias }: { categorias: CategoriaFila[] }) {
  const router = useRouter();
  const [creando, setCreando] = useState(false);

  const cerrar = () => setCreando(false);

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
        description="Cómo se agrupa el catálogo de productos"
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
                <TableHead className="w-28">Productos</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {categorias.map((c) => (
                // La fila lleva a la ficha: es donde se le suman productos, que
                // es para lo que alguien abre una categoría.
                <TableRow
                  key={c.id}
                  className="cursor-pointer"
                  onClick={() =>
                    router.push(`/dashboard/productos/categorias/${c.id}?from=${aca()}`)
                  }
                >
                  <TableCell className="font-medium">{c.nombre}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {c.productos}
                  </TableCell>
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
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

      {creando && (
        <CategoriaDialog
          categoria={null}
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
