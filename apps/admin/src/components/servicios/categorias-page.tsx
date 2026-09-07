"use client";

import { useRouter } from "next/navigation";
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
        actions={[
          {
            label: "Nueva categoría",
            href: "/dashboard/productos/categorias/nueva",
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

    </>
  );
}
