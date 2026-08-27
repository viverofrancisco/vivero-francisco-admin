"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { TablePagination } from "@/components/shared/table-pagination";
import { aca } from "@/lib/filtros-url";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, Eye, MoreVertical, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface InformeListItem {
  id: string;
  numero: number;
  titulo: string;
  pdfUrl: string;
  generatedAt: string;
  cliente: { id: string; nombre: string };
}

/**
 * La lista de informes.
 *
 * Muestra **cuándo se generó**, no la fecha impresa del informe: son dos
 * fechas distintas —un informe de agosto puede armarse en septiembre— y acá
 * la pregunta es "¿cuál es el último que hice?".
 *
 * La paginación la resuelve el servidor (`?page=` en la URL), así que este
 * componente solo dibuja el pie: recibe la página que ya vino cortada, en vez
 * de cortarla él como las otras tablas.
 */
export function InformesTable({
  items,
  page,
  total,
  porPagina,
}: {
  items: InformeListItem[];
  page: number;
  total: number;
  porPagina: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  /** El que está por eliminarse, mientras se confirma. */
  const [borrando, setBorrando] = useState<InformeListItem | null>(null);
  const [eliminando, setEliminando] = useState(false);

  /** Cambiar de página es navegar: la lista la corta el servidor. */
  function irAPagina(p: number) {
    const qs = new URLSearchParams(params.toString());
    if (p <= 1) qs.delete("page");
    else qs.set("page", String(p));
    const texto = qs.toString();
    router.push(`/dashboard/informes${texto ? `?${texto}` : ""}`);
  }

  async function eliminar() {
    if (!borrando) return;
    setEliminando(true);
    try {
      const res = await fetch(`/api/admin/informes/${borrando.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setBorrando(null);
      toast.success("Informe eliminado");
      router.refresh();
    } catch {
      toast.error("No pudimos eliminar");
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card">
      <div className="min-h-0 flex-1 overflow-hidden">
        {items.length === 0 ? (
          <EmptyState message="No hay informes que coincidan" />
        ) : (
          <Table containerClassName="h-full overflow-y-auto">
            <TableHeader sticky>
              <TableRow>
                <TableHead className="w-20">N.º</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Generado</TableHead>
                <TableHead className="w-32 text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  // Con `?from=` la flecha de la ficha vuelve a esta lista
                  // como estaba: mismos filtros, misma página.
                  onClick={() =>
                    router.push(`/dashboard/informes/${item.id}?from=${aca()}`)
                  }
                >
                  <TableCell className="font-bold tabular-nums">
                    #{item.numero}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.cliente.nombre}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {generadoEl(item.generatedAt)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    // Las acciones son sobre la fila, no "abrir": sin esto,
                    // tocar el menú además navegaba al editor.
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Editar no está: para eso se toca la fila. Lo que queda
                        son las tres cosas que se le hacen al PDF. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={`Acciones del informe #${item.numero}`}
                          />
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {/* El PDF, en una pestaña aparte: mirarlo para saber
                            si es el que se busca no debería sacar a nadie de
                            la lista. */}
                        <DropdownMenuItem
                          render={
                            <a
                              href={item.pdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                            />
                          }
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          Vista previa
                        </DropdownMenuItem>
                        {/* Por nuestra ruta y no directo a R2: `download` no
                            funciona entre dominios, así que el enlace crudo
                            abría el PDF en vez de guardarlo. */}
                        <DropdownMenuItem
                          render={
                            <a href={`/api/admin/informes/${item.id}/descargar`} />
                          }
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Descargar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setBorrando(item)}
                          className="text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <Dialog
        open={borrando !== null}
        onOpenChange={(v) => !v && setBorrando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Eliminar el informe #{borrando?.numero}
            </DialogTitle>
            {/* Dice lo que de verdad hace: el PDF se va del bucket, así que
                el link deja de abrir para quien ya lo tenga. */}
            <DialogDescription>
              Se borra el informe de {borrando?.cliente.nombre}, sus secciones y
              el PDF. El enlace deja de abrir, también para quien ya lo haya
              recibido. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBorrando(null)}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={eliminar}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <TablePagination
        page={page}
        total={total}
        porPagina={porPagina}
        onPageChange={irAPagina}
        sustantivo="informe"
      />
    </div>
  );
}

/** "26 ago 2026, 11:33" — con hora, que es lo que distingue dos del mismo día. */
function generadoEl(iso: string): string {
  return new Date(iso).toLocaleString("es-EC", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
