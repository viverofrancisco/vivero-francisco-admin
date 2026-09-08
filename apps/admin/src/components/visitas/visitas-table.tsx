"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
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
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { nombreCliente } from "@vivero/shared";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import {
  resumenProductos,
  type ProductoDeVisita,
} from "@/lib/visita-productos";

interface VisitaRow {
  id: string;
  numero: number;
  fechaProgramada: string;
  fechaRealizada: string | null;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
  };
  productos: ProductoDeVisita[];
  grupo: { id: string; nombre: string } | null;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function VisitasTable({
  visitas,
  puedeEliminar = false,
  seleccionando = false,
  onSalirSeleccion,
}: {
  visitas: VisitaRow[];
  /** Con esto aparecen las casillas y la barra de eliminar. */
  puedeEliminar?: boolean;
  /**
   * Modo selección **de móvil**: las filas dejan de abrir la visita y muestran
   * su casilla, y abajo aparece la barra con lo que se puede hacer.
   *
   * En escritorio no existe: ahí la casilla de cada fila está siempre y no hay
   * nada que activar. Lo prende el menú del encabezado, que es la única barra
   * de herramientas que hay en el teléfono.
   */
  seleccionando?: boolean;
  onSalirSeleccion?: () => void;
}) {
  const router = useRouter();
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [marcadas, setMarcadas] = useState<string[]>([]);
  const [confirmando, setConfirmando] = useState(false);
  const [eliminando, setEliminando] = useState(false);

  const totalPages = Math.max(1, Math.ceil(visitas.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginadas = visitas.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  // En móvil la lista crece al bajar. Los filtros de esta pantalla los aplica
  // el servidor, así que la firma es la lista que llegó.
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    visitas.length,
    visitas.map((v) => v.id).join(",")
  );
  const enLista = visitas.slice(0, visibles);
  const aqui = useAca();

  /**
   * La selección se filtra contra lo que hay en pantalla en vez de limpiarse
   * con un efecto: al cambiar un filtro o recargar la lista, los ids que ya no
   * están dejan de contar solos, y no hay un render en el medio donde la barra
   * diga "3 seleccionadas" de visitas que no se ven.
   */
  const presentes = useMemo(() => new Set(visitas.map((v) => v.id)), [visitas]);
  const elegidas = marcadas.filter((id) => presentes.has(id));
  const elegidasSet = new Set(elegidas);
  const todasEnPagina =
    paginadas.length > 0 && paginadas.every((v) => elegidasSet.has(v.id));
  const hayAlgoMarcado = puedeEliminar && elegidas.length > 0;

  const salirDeSeleccion = () => {
    setMarcadas([]);
    onSalirSeleccion?.();
  };

  const alternar = (id: string, marcada: boolean) =>
    setMarcadas((prev) =>
      marcada ? [...new Set([...prev, id])] : prev.filter((x) => x !== id)
    );

  // "Todas" son las de esta página: es lo que se está viendo, y llevarse
  // también las otras cincuenta que quedaron atrás no es lo que se pidió.
  const alternarPagina = (marcada: boolean) => {
    const ids = paginadas.map((v) => v.id);
    setMarcadas((prev) =>
      marcada
        ? [...new Set([...prev, ...ids])]
        : prev.filter((x) => !ids.includes(x))
    );
  };

  async function eliminarSeleccionadas() {
    setEliminando(true);
    try {
      const res = await fetch("/api/visitas/eliminar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: elegidas }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        throw new Error(data?.error || "No pudimos eliminar las visitas");
      }
      if (data.eliminadas > 0) {
        toast.success(
          data.eliminadas === 1
            ? "Visita eliminada"
            : `${data.eliminadas} visitas eliminadas`
        );
      }
      // Las que no se pudieron se nombran una por una: el motivo es distinto en
      // cada una —una facturada, otra de otro sector— y un "algunas fallaron"
      // deja a la persona sin saber cuál reintentar.
      if (data.errores?.length > 0) {
        toast.error(
          data.errores.length === 1
            ? "Una visita no se pudo eliminar"
            : `${data.errores.length} visitas no se pudieron eliminar`,
          {
            // Una lista y no un texto con saltos de línea: el aviso los ignora
            // y quedaba todo en un renglón.
            description: (
              <ul className="mt-1 space-y-0.5">
                {data.errores
                  .slice(0, 5)
                  .map((e: { id: string; numero: number | null; motivo: string }) => (
                    <li key={e.id}>
                      {e.numero ? `#${e.numero}: ` : ""}
                      {e.motivo}
                    </li>
                  ))}
                {data.errores.length > 5 && (
                  <li>y {data.errores.length - 5} más</li>
                )}
              </ul>
            ),
          }
        );
      }
      setConfirmando(false);
      salirDeSeleccion();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No pudimos eliminar las visitas"
      );
    } finally {
      setEliminando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Tapa la fila de encabezados en vez de empujarla: la tabla no se
              mueve al marcar la primera fila, que es justo cuando se está
              apuntando a otra.
              Va **fuera** de la tabla, no en un `<th>`, porque la tabla
              scrollea a lo ancho y ahí el botón se iba de pantalla. Alto y
              fondo son los del encabezado (`h-10`, `bg-secondary`), y el
              `px-2` deja la casilla donde está la de la columna. */}
          {hayAlgoMarcado && (
            <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center gap-3 border-b border-border bg-secondary px-2">
              <Checkbox
                checked={todasEnPagina}
                indeterminate={!todasEnPagina}
                onCheckedChange={() => setMarcadas([])}
                aria-label="Quitar la selección"
              />
              <span className="text-xs font-bold tracking-wide text-secondary-foreground">
                {elegidas.length === 1
                  ? "1 visita seleccionada"
                  : `${elegidas.length} visitas seleccionadas`}
              </span>
              <span className="flex-1" />
              {/* Neutro, igual que en la barra de móvil: el rojo lo pone la
                  confirmación, que es donde se decide. */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmando(true)}
              >
                Eliminar
              </Button>
            </div>
          )}
          <Table containerClassName="h-full overflow-y-auto">
            <TableHeader sticky>
              <TableRow>
                {puedeEliminar && (
                  <TableHead className="w-10">
                    <Checkbox
                      checked={todasEnPagina}
                      indeterminate={hayAlgoMarcado && !todasEnPagina}
                      // Con algo marcado, tocarla limpia; si no, marca la
                      // página entera. Es lo que espera quien la ve a medias:
                      // el segundo clic deshace el primero.
                      onCheckedChange={() =>
                        hayAlgoMarcado ? setMarcadas([]) : alternarPagina(true)
                      }
                      aria-label={
                        hayAlgoMarcado
                          ? "Quitar la selección"
                          : "Seleccionar las visitas de esta página"
                      }
                    />
                  </TableHead>
                )}
                <TableHead className="w-20">N.º</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Servicio</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Fecha</TableHead>
                <TableHead className="text-right">Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginadas.map((v) => {
                const nombre = nombreCliente(v.cliente);
                return (
                  <TableRow
                    key={v.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/visitas/${v.id}?from=${aca()}`)
                    }
                  >
                    {puedeEliminar && (
                      // La fila entera abre la visita, así que la casilla se
                      // queda con su clic: si no, marcar una navegaba.
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={elegidasSet.has(v.id)}
                          onCheckedChange={(c) => alternar(v.id, c === true)}
                          aria-label={`Seleccionar la visita #${v.numero}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="font-bold tabular-nums">
                      #{v.numero}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={nombre} size={32} />
                        <span className="font-bold text-foreground">
                          {nombre}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {resumenProductos(v)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {v.grupo?.nombre ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground tabular-nums">
                      {formatDate(v.fechaProgramada)}
                    </TableCell>
                    <TableCell className="text-right">
                      <StatusBadge
                        estado={v.estado as EstadoVisitaUI}
                        size="sm"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        <TablePagination
          page={pagina}
          total={visitas.length}
          onPageChange={setPage}
          sustantivo="visita"
        />
      </div>

      {/* Móvil: cliente y estado arriba, y debajo el trabajo con su fecha.
          Seis columnas en 400 px dejan el servicio en dos letras, que es
          justamente lo que distingue una visita de otra del mismo cliente. */}
      <ListaMovil
        vacia={visitas.length === 0}
        mensajeVacio="No se encontraron visitas"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((v) => {
          const nombre = nombreCliente(v.cliente);
          // Lo de adentro es igual esté o no seleccionando: cambia qué hace
          // tocar la fila, no qué dice.
          const contenido = (
            <>
              {seleccionando ? (
                <Checkbox
                  checked={elegidasSet.has(v.id)}
                  // La fila entera es el área de toque; la casilla solo pinta.
                  // Sin esto el toque llega dos veces —a ella y al botón— y la
                  // marca y la desmarca en el mismo gesto.
                  onClick={(e) => e.preventDefault()}
                  className="pointer-events-none flex-none"
                  tabIndex={-1}
                  aria-hidden
                />
              ) : (
                <InitialsAvatar name={nombre} size={40} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                    {nombre}
                  </span>
                  <StatusBadge estado={v.estado as EstadoVisitaUI} size="sm" />
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {resumenProductos(v)} ·{" "}
                  <span className="tabular-nums">
                    {formatDate(v.fechaProgramada)}
                  </span>
                </span>
              </span>
            </>
          );

          // Seleccionando, la fila marca en vez de abrir: un enlace que a veces
          // navega y a veces no es una trampa, y en el teléfono no hay dónde
          // poner una casilla aparte sin apretar el nombre contra el borde.
          return seleccionando ? (
            <button
              key={v.id}
              type="button"
              onClick={() => alternar(v.id, !elegidasSet.has(v.id))}
              aria-pressed={elegidasSet.has(v.id)}
              className={`${FILA_MOVIL} w-full text-left ${
                elegidasSet.has(v.id) ? "bg-primary/5" : ""
              }`}
            >
              {contenido}
            </button>
          ) : (
            <Link
              key={v.id}
              href={`/dashboard/visitas/${v.id}?from=${aqui}`}
              className={FILA_MOVIL}
            >
              {contenido}
            </Link>
          );
        })}
        {/* La barra flota sobre la lista, así que sin esto tapa la última
            fila y no hay manera de marcarla. */}
        {seleccionando && <div className="h-16" aria-hidden />}
      </ListaMovil>

      {/* La barra de acciones de móvil: flota arriba del nav, como el pie de
          selección de Shopify. Aparece con el modo prendido aunque no haya
          nada marcado —es lo que dice que el modo está prendido, y cómo se
          sale—. Por ahora la única acción es eliminar; cuando haya más, van
          en un "⋯" al lado. */}
      {seleccionando && (
        <div className="fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom)+0.75rem)] z-40 md:hidden">
          <div className="flex items-center gap-2 rounded-2xl bg-foreground p-2 text-background shadow-lg">
            <button
              type="button"
              onClick={salirDeSeleccion}
              className="flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm font-semibold hover:bg-background/10"
            >
              <X className="h-4 w-4" />
              <span className="tabular-nums">{elegidas.length}</span>
              <span className="sr-only">Salir de la selección</span>
            </button>
            <span className="flex-1" />
            {/* Claro sobre la barra oscura, no rojo: la variante `destructive`
                de la casa es un fondo al 10% pensado para una tarjeta clara y
                acá desaparecía. Rojo tampoco hace falta —para eso está la
                confirmación—; lo que faltaba era contraste. */}
            <Button
              size="sm"
              disabled={elegidas.length === 0}
              onClick={() => setConfirmando(true)}
              className="bg-background/15 text-background hover:bg-background/25 disabled:opacity-45"
            >
              Eliminar
            </Button>
          </div>
        </div>
      )}

      <Dialog
        open={confirmando}
        onOpenChange={(v) => !v && !eliminando && setConfirmando(false)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {elegidas.length === 1
                ? "Eliminar 1 visita"
                : `Eliminar ${elegidas.length} visitas`}
            </DialogTitle>
            <DialogDescription>
              Salen de las listas, del calendario y de lo que queda por
              facturar, con sus fotos y su chat. Las que ya estén facturadas no
              se eliminan y se avisa cuáles. No se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirmando(false)}
              disabled={eliminando}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={eliminarSeleccionadas}
              disabled={eliminando}
            >
              {eliminando ? "Eliminando…" : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
