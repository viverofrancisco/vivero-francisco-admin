"use client";

import { useState } from "react";
import Link from "next/link";
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
import { MoreVertical } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export interface InformeListItem {
  id: string;
  /** Un borrador todavía no es un informe: no tiene número ni PDF. */
  tipo: "emitido" | "borrador";
  numero: number | null;
  titulo: string;
  pdfUrl: string | null;
  /** Generado, para un informe; última edición, para un borrador. */
  fecha: string;
  version: number;
  /** Si es el borrador de una **edición**, el número del informe que corrige. */
  deInforme: number | null;
  cliente: { id: string; nombre: string } | null;
}

/**
 * La lista de informes.
 *
 * Muestra **cuándo se generó**, no la fecha impresa del informe: son dos
 * fechas distintas —un informe de agosto puede armarse en septiembre— y acá
 * la pregunta es "¿cuál es el último que hice?".
 *
 * Los borradores son filas más, no una lista aparte: lo que cambia entre uno y
 * un informe emitido es una columna, y separarlos hacía que la mitad de lo que
 * hay quedara fuera del orden y de los filtros.
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
      const res = await fetch(
        borrando.tipo === "borrador"
          ? `/api/admin/informes/borradores/${borrando.id}`
          : `/api/admin/informes/${borrando.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      setBorrando(null);
      toast.success(
        borrando.tipo === "borrador" ? "Borrador eliminado" : "Informe eliminado"
      );
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
                <TableHead className="w-28">Estado</TableHead>
                <TableHead className="w-24">Versión</TableHead>
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
                  // Un borrador se retoma; un informe se abre. Son la misma
                  // fila y dos destinos, porque son dos cosas distintas.
                  onClick={() =>
                    router.push(
                      item.tipo !== "borrador"
                        ? `/dashboard/informes/${item.id}?from=${aca()}`
                        : // El de una edición vuelve a la edición de ese
                          // informe; el suelto, al asistente.
                          `/dashboard/informes/nuevo?borrador=${item.id}`
                    )
                  }
                >
                  <TableCell className="font-bold tabular-nums">
                    {item.numero ? `#${item.numero}` : "—"}
                  </TableCell>
                  <TableCell className="font-medium">
                    {item.cliente?.nombre ?? (
                      <span className="text-muted-foreground">Sin cliente</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        item.tipo === "borrador" ? "outline" : "secondary"
                      }
                      className={
                        item.tipo === "borrador"
                          ? "border-amber-300 bg-amber-50 text-amber-800"
                          : ""
                      }
                    >
                      {item.tipo === "borrador"
                        ? item.deInforme
                          ? `Editando #${item.deInforme}`
                          : "Borrador"
                        : "Emitido"}
                    </Badge>
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {item.tipo === "borrador" ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={
                          item.version > 1
                            ? "font-medium"
                            : "text-muted-foreground"
                        }
                        title={
                          item.version > 1
                            ? `Se rehizo ${item.version - 1} ${item.version === 2 ? "vez" : "veces"}`
                            : "Como se emitió"
                        }
                      >
                        v{item.version}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground tabular-nums">
                    {generadoEl(item.fecha)}
                  </TableCell>
                  <TableCell
                    className="text-right"
                    // Las acciones son sobre la fila, no "abrir": sin esto,
                    // tocar el menú además navegaba al editor.
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Editar también acá: tocar la fila lo abre, pero el
                        menú es donde la gente busca qué se le puede hacer a
                        algo, y "no está porque se toca la fila" es una regla
                        que hay que saber de antemano. */}
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={
                              item.numero
                                ? `Acciones del informe #${item.numero}`
                                : "Acciones del borrador"
                            }
                          />
                        }
                      >
                        <MoreVertical className="h-4 w-4" />
                      </DropdownMenuTrigger>
                      {/* Ancho propio: por defecto el menú toma el del botón
                          que lo abre, y este es un botón de icono. */}
                      <DropdownMenuContent align="end" className="w-48">
                        {item.tipo === "borrador" ? (
                          <DropdownMenuItem
                            render={
                              <Link
                                href={`/dashboard/informes/nuevo?borrador=${item.id}`}
                              />
                            }
                          >
                            Seguir armándolo
                          </DropdownMenuItem>
                        ) : (
                          <>
                            {/* El PDF, en una pestaña aparte: mirarlo para
                                saber si es el que se busca no debería sacar a
                                nadie de la lista. */}
                            <DropdownMenuItem
                              render={
                                <a
                                  href={item.pdfUrl ?? "#"}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                />
                              }
                            >
                              Abrir el PDF
                            </DropdownMenuItem>
                            {/* Por nuestra ruta y no directo a R2: `download`
                                no funciona entre dominios, así que el enlace
                                crudo abría el PDF en vez de guardarlo. */}
                            <DropdownMenuItem
                              render={
                                <a
                                  href={`/api/admin/informes/${item.id}/descargar`}
                                />
                              }
                            >
                              Descargar
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              render={
                                <Link
                                  href={`/dashboard/informes/${item.id}/editar?from=${aca()}`}
                                />
                              }
                            >
                              Editar
                            </DropdownMenuItem>
                          </>
                        )}
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => setBorrando(item)}
                          className="text-destructive"
                        >
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
              {borrando?.tipo === "borrador"
                ? "Eliminar el borrador"
                : `Eliminar el informe #${borrando?.numero}`}
            </DialogTitle>
            {/* Dice lo que de verdad hace en cada caso: un borrador no salió a
                ningún lado, un informe emitido sí, y su PDF se va del bucket
                aunque alguien ya lo tenga. */}
            <DialogDescription>
              {borrando?.tipo === "borrador" ? (
                <>
                  Se pierde lo que había armado hasta acá. No se generó ningún
                  PDF, así que no salió a ningún lado.
                </>
              ) : (
                <>
                  Se borra el informe de {borrando?.cliente?.nombre}, sus
                  secciones y los PDF de todas sus versiones. El enlace deja de
                  abrir, también para quien ya lo haya recibido. No se puede
                  deshacer.
                </>
              )}
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
