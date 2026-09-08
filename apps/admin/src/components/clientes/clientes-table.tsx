"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { CustomSelect } from "@/components/ui/custom-select";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente, nombrePersona } from "@vivero/shared";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  ciudad: string | null;
  direccion: string | null;
  referencia: string | null;
  metrosCuadrados?: number | null;
  sector?: { id: string; nombre: string } | null;
  productos?: { producto: { nombre: string } }[];
}

function fullName(cliente: Cliente): string {
  return nombreCliente(cliente);
}

/**
 * El renglón de abajo en la lista de móvil. La empresa va primero cuando el
 * nombre de arriba es el de la persona —es lo que la tabla muestra en su
 * propia línea—, y después sector y teléfono, que es con lo que se lo ubica.
 */
function resumen(c: Cliente): string {
  const partes = [
    nombrePersona(c) && c.empresa ? c.empresa : null,
    c.sector?.nombre ?? null,
    c.telefono ?? null,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin datos de contacto";
}

export function ClientesTable({
  clientes,
  devTools = false,
}: {
  clientes: Cliente[];
  devTools?: boolean;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [sectorFilter, setSectorFilter] = useFiltroUrl<string | null>("sector", null);
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | "soft" | "hard">(null);
  const [deleting, setDeleting] = useState(false);
  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientes) {
      if (c.sector) map.set(c.sector.id, c.sector.nombre);
    }
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [clientes]);

  const filtered = useMemo(() => {
    let result = clientes;
    if (sectorFilter) {
      result = result.filter((c) => c.sector?.id === sectorFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          fullName(c).toLowerCase().includes(q) ||
          (c.empresa?.toLowerCase().includes(q) ?? false) ||
          (c.telefono?.includes(q) ?? false) ||
          (c.ciudad?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [clientes, sectorFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  // Top sectors by client count, for the summary strip.
  const pageIds = paginated.map((c) => c.id);
  const allPageSelected =
    pageIds.length > 0 && pageIds.every((id) => selected.has(id));

  const toggleOne = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const togglePage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach((id) => next.delete(id));
      else pageIds.forEach((id) => next.add(id));
      return next;
    });

  const clearSelection = () => setSelected(new Set());

  const runDelete = async (hard: boolean) => {
    setDeleting(true);
    try {
      const res = await fetch("/api/clientes/bulk-delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), hard }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Error al eliminar");
      toast.success(
        hard
          ? `${data.count} cliente(s) eliminado(s) permanentemente`
          : `${data.count} cliente(s) archivado(s)`,
      );
      setConfirm(null);
      clearSelection();
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al eliminar");
    } finally {
      setDeleting(false);
    }
  };

  // En móvil la lista crece al bajar en vez de paginar. La firma son los
  // filtros: si cambian, vuelve a la primera tanda.
  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtered.length,
    `${searchQuery}|${sectorFilter ?? ""}`
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
      <BarraFiltros
        activos={sectorFilter ? 1 : 0}
        onLimpiar={() => {
          setSectorFilter(null);
          setPage(1);
        }}
        busqueda={
          <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nombre, empresa, telefono o ciudad..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="pl-9"
            />
          </div>
        }
      >
        {/* Era un desplegable escrito a mano —con su propio buscador, su tope
            de seis y su clic-afuera— que hacía lo mismo que `CustomSelect` y,
            al ser `absolute`, no entraba en el panel de filtros de móvil. */}
        {sectors.length > 0 && (
          <div className="w-56">
            <CustomSelect
              value={sectorFilter ?? ""}
              onChange={(v) => {
                setSectorFilter(v || null);
                setPage(1);
              }}
              options={[
                { value: "", label: "Todos los sectores" },
                ...sectors.map((s) => ({ value: s.id, label: s.nombre })),
              ]}
              placeholder="Todos los sectores"
              searchable
              searchPlaceholder="Buscar sector..."
            />
          </div>
        )}
      </BarraFiltros>

      {/* Bulk actions bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card px-4 py-2.5">
          <span className="text-sm font-semibold">
            {selected.size} seleccionado{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={clearSelection}>
              Limpiar
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirm("soft")}
            >
              Archivar
            </Button>
            {devTools && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setConfirm("hard")}
              >
                Eliminar permanentemente
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Scrollean las filas, no la página: el encabezado y la paginación
          quedan siempre a la vista. El alto sale del contenedor, no de un
          `calc` a ojo que había que reajustar con cada filtro nuevo. */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontraron clientes" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      checked={allPageSelected}
                      onCheckedChange={togglePage}
                      aria-label="Seleccionar página"
                    />
                  </TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Correo</TableHead>
                  <TableHead>Sector</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>m²</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((cliente) => {
                  return (
                    <TableRow
                      key={cliente.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/clientes/${cliente.id}?from=${aca()}`)
                      }
                    >
                      <TableCell
                        className="w-10"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Checkbox
                          checked={selected.has(cliente.id)}
                          onCheckedChange={() => toggleOne(cliente.id)}
                          aria-label={`Seleccionar ${fullName(cliente)}`}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <InitialsAvatar name={fullName(cliente)} size={36} />
                          <div className="min-w-0">
                            <div className="truncate font-bold text-foreground">
                              {fullName(cliente)}
                            </div>
                            {nombrePersona(cliente) && cliente.empresa ? (
                              <div className="truncate text-xs font-semibold text-muted-foreground">
                                {cliente.empresa}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.email ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.sector?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.telefono ?? "—"}
                      </TableCell>
                      <TableCell className="font-bold text-foreground">
                        {cliente.metrosCuadrados ?? "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>

        <TablePagination
          page={pagina}
          total={filtered.length}
          onPageChange={setPage}
          sustantivo="cliente"
        />
      </div>

      {/* Móvil: una fila por cliente en vez de seis columnas apretadas. Nombre
          y empresa arriba, y debajo lo que sirve para reconocerlo —sector y
          teléfono—; el correo y los m² quedan para la ficha, que es donde se
          los va a buscar. Sin casillas: seleccionar de a varios para
          archivarlos es trabajo de escritorio. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontraron clientes"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((cliente) => (
          <Link
            key={cliente.id}
            href={`/dashboard/clientes/${cliente.id}?from=${aqui}`}
            className={FILA_MOVIL}
          >
            <InitialsAvatar name={fullName(cliente)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-bold text-foreground">
                {fullName(cliente)}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {resumen(cliente)}
              </span>
            </span>
          </Link>
        ))}
      </ListaMovil>

      {/* Confirmación bulk (archivar / eliminar permanentemente) */}
      <Dialog
        open={confirm !== null}
        onOpenChange={(o) => !o && setConfirm(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirm === "hard"
                ? "Eliminar permanentemente"
                : "Archivar clientes"}
            </DialogTitle>
            <DialogDescription>
              {confirm === "hard"
                ? `Esto borrará ${selected.size} cliente(s) y TODO lo relacionado (servicios, visitas, fotos, informes y su cuenta de acceso). Esta acción no se puede deshacer.`
                : `Se archivarán ${selected.size} cliente(s). Podrás recuperarlos.`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setConfirm(null)}
              disabled={deleting}
            >
              Cancelar
            </Button>
            <Button
              variant={confirm === "hard" ? "destructive" : "default"}
              onClick={() => runDelete(confirm === "hard")}
              disabled={deleting}
            >
              {deleting
                ? "Procesando..."
                : confirm === "hard"
                  ? "Eliminar permanentemente"
                  : "Archivar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
