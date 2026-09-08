"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
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
import { useCargaInfinita } from "@/components/shared/scroll-infinito";
import type { InformeListItem } from "@/lib/informes/lista";

export type { InformeListItem } from "@/lib/informes/lista";

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
  filtros,
}: {
  items: InformeListItem[];
  page: number;
  total: number;
  porPagina: number;
  /** Lo que hay en la URL ahora mismo, leído por el servidor. */
  filtros: Record<string, string>;
}) {
  const router = useRouter();
  /**
   * Los filtros que ya vienen aplicados, como query string.
   *
   * Llegan por props y no de `useSearchParams()`: ese hook hace que Next saque
   * del HTML del servidor todo el subárbol que lo usa, y eso corría los
   * `useId` de **toda** la página —los de Base UI dejaban de coincidir entre
   * servidor y cliente, y React tiraba un aviso de hidratación en cada carga.
   * La página ya los lee para hacer la consulta, así que pasarlos no cuesta
   * nada y de paso la lista se sigue renderizando en el servidor.
   */
  const params = new URLSearchParams(filtros);
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

  /**
   * Móvil: la lista crece al bajar en vez de paginar, y acá **sí** hay una
   * consulta de verdad — esta lista la pagina el servidor, así que la tanda
   * siguiente se va a buscar con los mismos filtros que trajo la primera.
   *
   * `pagina1` es lo que llegó renderizado; lo demás se acumula encima. Cambiar
   * un filtro cambia esa primera tanda, y eso es lo que reinicia el acumulado
   * —sin efecto que lo limpie después de pintar.
   */
  const [extra, setExtra] = useState<{
    desde: InformeListItem[];
    filas: InformeListItem[];
  }>({ desde: items, filas: [] });
  const acumulados =
    extra.desde === items ? [...items, ...extra.filas] : items;

  const cargarMas = async () => {
    const qs = new URLSearchParams(params.toString());
    qs.delete("page");
    qs.set("offset", String(acumulados.length));
    qs.set("limit", String(porPagina));
    const res = await fetch(`/api/admin/informes?${qs.toString()}`, {
      cache: "no-store",
    });
    if (!res.ok) return;
    const data: { items: InformeListItem[] } = await res.json();
    setExtra((e) => ({
      desde: items,
      filas: [...(e.desde === items ? e.filas : []), ...data.items],
    }));
  };

  const { cargando, centinela } = useCargaInfinita({
    hayMas: acumulados.length < total,
    cargarMas,
  });

  /**
   * De dónde se viene, para que la flecha de la ficha devuelva esta lista como
   * estaba. `useAca()` y no `aca()`: este `href` se arma **durante el render**,
   * y `aca()` mira `window`, que en el servidor no existe — el enlace salía
   * con `?from=` vacío en el HTML y completo al hidratar.
   */
  const aqui = encodeURIComponent(
    `/dashboard/informes${params.toString() ? `?${params.toString()}` : ""}`
  );

  /** A dónde lleva la fila: un borrador se retoma, un informe se abre. */
  const destino = (item: InformeListItem, desde: string) =>
    item.tipo !== "borrador"
      ? `/dashboard/informes/${item.id}?from=${desde}`
      : `/dashboard/informes/nuevo?borrador=${item.id}`;

  return (
    <>
    <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-md border bg-card md:flex">
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
                    {/* Editar también aquí: tocar la fila lo abre, pero el
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
                                  href={`/dashboard/informes/${item.id}/editar?from=${aqui}`}
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
                  Se pierde lo que había armado hasta aquí. No se generó ningún
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

    {/* Móvil: cliente y estado arriba, y debajo el número con cuándo se
        generó. Las acciones quedan en la ficha — el menú de la fila tiene
        hasta cinco opciones que dependen de si es borrador o informe. */}
    <ListaMovil
      vacia={acumulados.length === 0}
      mensajeVacio="No hay informes que coincidan"
      hayMas={acumulados.length < total}
      cargando={cargando}
      centinela={centinela}
    >
      {acumulados.map((item) => (
        <Link
          key={item.id}
          href={destino(item, aqui)}
          className={FILA_MOVIL}
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2">
              <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                {item.cliente?.nombre ?? "Sin cliente"}
              </span>
              <Badge
                variant={item.tipo === "borrador" ? "outline" : "secondary"}
                className={
                  item.tipo === "borrador"
                    ? "flex-none border-amber-300 bg-amber-50 text-amber-800"
                    : "flex-none"
                }
              >
                {item.tipo === "borrador"
                  ? item.deInforme
                    ? `Editando #${item.deInforme}`
                    : "Borrador"
                  : "Emitido"}
              </Badge>
            </span>
            <span className="block truncate text-xs font-medium text-muted-foreground">
              <span className="tabular-nums">
                {item.numero ? `#${item.numero}` : "—"}
                {item.tipo !== "borrador" && item.version > 1
                  ? ` · v${item.version}`
                  : ""}
              </span>
              {" · "}
              <span className="tabular-nums">{generadoEl(item.fecha)}</span>
            </span>
          </span>
        </Link>
      ))}
    </ListaMovil>

    </>
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
