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
import { EstadoDelCliente } from "@/components/clientes/cliente-detail-tabs";
import { ClientesPageHeader } from "./clientes-page-header";
import {
  ACCION_BARRA_MOVIL,
  BarraSeleccionMovil,
} from "@/components/shared/barra-seleccion-movil";
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
import { MoreVertical, Search } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  nombreCliente,
  nombrePersona,
  resumenDeCliente,
} from "@vivero/shared";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  email: string | null;
  telefono: string | null;
  /** Marcado como inactivo: la fila lo dice, y sigue abriéndose. */
  inactivoDesde?: Date | string | null;
  /**
   * Dónde trabaja: sus propiedades vivas.
   *
   * La dirección y el sector eran del cliente y se mudaron acá. La fila muestra
   * la primera y, si hay más, cuántas: un cliente con casa en dos sectores
   * quedaba contado en uno solo, que es lo que esto arregla.
   */
  propiedades: {
    id: string;
    nombre: string;
    ciudad: string | null;
    direccion: string | null;
    sector: { id: string; nombre: string } | null;
  }[];
  productos?: { producto: { nombre: string } }[];
}

/** La que se muestra cuando la fila tiene lugar para una sola. */
function principal(c: Cliente) {
  return c.propiedades[0] ?? null;
}

function fullName(cliente: Cliente): string {
  return nombreCliente(cliente);
}

export function ClientesTable({
  clientes,
  canCreate = false,
  devTools = false,
}: {
  clientes: Cliente[];
  /** Si puede escribir: de eso dependen crear, importar y archivar. */
  canCreate?: boolean;
  devTools?: boolean;
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [sectorFilter, setSectorFilter] = useFiltroUrl<string | null>("sector", null);
  /** "" todos, "activos" o "inactivos". */
  const [estadoFilter, setEstadoFilter] = useFiltroUrl<string>("estado", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirm, setConfirm] = useState<null | "soft" | "hard">(null);
  /**
   * Solo en el teléfono: ahí no hay dónde poner una casilla en cada fila sin
   * gastar ese ancho para siempre, así que marcar es un modo que se prende
   * desde el ⋯ del encabezado. En escritorio las casillas están en su columna.
   */
  const [seleccionandoMovil, setSeleccionandoMovil] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const sectors = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of clientes) {
      for (const p of c.propiedades) {
        if (p.sector) map.set(p.sector.id, p.sector.nombre);
      }
    }
    return Array.from(map, ([id, nombre]) => ({ id, nombre })).sort((a, b) =>
      a.nombre.localeCompare(b.nombre),
    );
  }, [clientes]);

  const filtered = useMemo(() => {
    let result = clientes;
    if (sectorFilter) {
      // Entra si **alguna** de sus propiedades está en el sector: con dos
      // casas en dos sectores, el cliente está en los dos.
      result = result.filter((c) =>
        c.propiedades.some((p) => p.sector?.id === sectorFilter)
      );
    }
    if (estadoFilter === "activos") result = result.filter((c) => !c.inactivoDesde);
    if (estadoFilter === "inactivos") result = result.filter((c) => Boolean(c.inactivoDesde));
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (c) =>
          fullName(c).toLowerCase().includes(q) ||
          (c.empresa?.toLowerCase().includes(q) ?? false) ||
          (c.telefono?.includes(q) ?? false) ||
          c.propiedades.some(
            (p) =>
              p.ciudad?.toLowerCase().includes(q) ||
              p.direccion?.toLowerCase().includes(q)
          ),
      );
    }
    return result;
  }, [clientes, sectorFilter, estadoFilter, searchQuery]);

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

  /** Marcar la selección como inactiva, o reactivarla. Reversible: sin confirmación. */
  const cambiarEstado = async (inactivo: boolean) => {
    setCambiandoEstado(true);
    try {
      const res = await fetch("/api/clientes/inactivo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), inactivo }),
      });
      const data = (await res.json().catch(() => null)) as { count?: number; error?: string } | null;
      if (!res.ok || !data) throw new Error(data?.error || "No se pudo guardar");
      const n = data.count ?? 0;
      toast.success(
        inactivo
          ? n === 1 ? "1 cliente marcado como inactivo" : `${n} clientes marcados como inactivos`
          : n === 1 ? "1 cliente reactivado" : `${n} clientes reactivados`
      );
      clearSelection();
      setSeleccionandoMovil(false);
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setCambiandoEstado(false);
    }
  };

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
      setSeleccionandoMovil(false);
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
    `${searchQuery}|${sectorFilter ?? ""}|${estadoFilter}`
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
      {/* El encabezado lo pone la tabla y no la página: su ⋯ prende el modo de
          selección, que es estado de acá. */}
      <ClientesPageHeader
        canCreate={canCreate}
        accionesExtra={
          seleccionandoMovil || filtered.length === 0
            ? []
            : [
                {
                  label: "Seleccionar clientes",
                  onClick: () => setSeleccionandoMovil(true),
                  soloMovil: true,
                },
              ]
        }
      />

      <BarraFiltros
        activos={(sectorFilter ? 1 : 0) + (estadoFilter ? 1 : 0)}
        onLimpiar={() => {
          setSectorFilter(null);
          setEstadoFilter("");
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
        <div className="w-44">
          <CustomSelect
            value={estadoFilter}
            onChange={(v) => {
              setEstadoFilter(v);
              setPage(1);
            }}
            options={[
              { value: "", label: "Todos los estados" },
              { value: "activos", label: "Activos" },
              { value: "inactivos", label: "Inactivos" },
            ]}
            placeholder="Todos los estados"
          />
        </div>
      </BarraFiltros>

      {/* Scrollean las filas, no la página: el encabezado y la paginación
          quedan siempre a la vista. El alto sale del contenedor, no de un
          `calc` a ojo que había que reajustar con cada filtro nuevo. */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
        <div className="relative min-h-0 flex-1 overflow-hidden">
          {/* Tapa la fila de encabezados en vez de empujarla: la tabla no se
              mueve al marcar la primera fila, que es justo cuando se está
              apuntando a otra. Estaba arriba de la tarjeta, en su propio
              renglón, y empujaba la lista entera. */}
          {selected.size > 0 ? (
            <div className="absolute inset-x-0 top-0 z-20 flex h-10 items-center border-b border-border bg-secondary px-2">
              <Checkbox
                checked={allPageSelected}
                indeterminate={!allPageSelected}
                onCheckedChange={clearSelection}
                aria-label="Quitar la selección"
              />
              <span className="ml-3 text-xs font-bold tracking-wide text-secondary-foreground">
                {selected.size === 1
                  ? "1 cliente seleccionado"
                  : `${selected.size} clientes seleccionados`}
              </span>
              <button
                type="button"
                className="ml-3 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                onClick={clearSelection}
              >
                Quitar selección
              </button>
              <span className="flex-1" />
              <div className="flex items-center gap-2">
                {devTools && (
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirm("hard")}
                  >
                    Eliminar permanentemente
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cambiandoEstado}
                  onClick={() => cambiarEstado(true)}
                >
                  Marcar inactivos
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={cambiandoEstado}
                  onClick={() => cambiarEstado(false)}
                >
                  Reactivar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setConfirm("soft")}
                >
                  Archivar
                </Button>
              </div>
            </div>
          ) : null}
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
                  <TableHead>Estado</TableHead>
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
                        {/* El de su primera propiedad. Con dos en sectores
                            distintos, el filtro de arriba igual lo encuentra
                            por cualquiera de los dos. */}
                        {principal(cliente)?.sector?.nombre ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.telefono ?? "—"}
                      </TableCell>
                      {/* Activo o inactivo. La columna de propiedades que
                          estaba acá decía la dirección de la primera, que
                          ya se lee en la ficha y no es lo que se busca en
                          la lista. */}
                      <TableCell>
                        <EstadoDelCliente inactivo={Boolean(cliente.inactivoDesde)} />
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
          los va a buscar. Marcando de a varios la fila marca en vez de
          navegar; el modo lo prende el ⋯ del encabezado. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontraron clientes"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((cliente) => (
          <FilaMovil
            key={cliente.id}
            href={`/dashboard/clientes/${cliente.id}?from=${aqui}`}
            seleccionando={seleccionandoMovil}
            marcada={selected.has(cliente.id)}
            onAlternar={() => toggleOne(cliente.id)}
            etiqueta={fullName(cliente)}
          >
            <InitialsAvatar name={fullName(cliente)} size={40} />
            <span className="min-w-0 flex-1">
              {/* En el teléfono no hay columna: el estado va junto al nombre, como en la app. */}
              <span className="flex items-center gap-2">
                <span className="truncate text-sm font-bold text-foreground">
                  {fullName(cliente)}
                </span>
                <EstadoDelCliente inactivo={Boolean(cliente.inactivoDesde)} />
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {resumenDeCliente(cliente)}
              </span>
            </span>
          </FilaMovil>
        ))}
        {/* La barra flota sobre la lista: sin esto tapa la última fila. */}
        {seleccionandoMovil ? <div className="h-16" aria-hidden /> : null}
      </ListaMovil>

      {seleccionandoMovil ? (
        <BarraSeleccionMovil
          cuantas={selected.size}
          onSalir={() => {
            setSeleccionandoMovil(false);
            clearSelection();
          }}
        >
          <Button
            size="sm"
            className={ACCION_BARRA_MOVIL}
            disabled={selected.size === 0}
            onClick={() => setConfirm("soft")}
          >
            Archivar
          </Button>
          {/* Con más de una acción, el resto va detrás de un ⋯ al lado. */}
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <Button
                  size="sm"
                  className={ACCION_BARRA_MOVIL}
                  disabled={selected.size === 0 || cambiandoEstado}
                  aria-label="Más acciones"
                />
              }
            >
              <MoreVertical className="h-4 w-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" side="top" className="min-w-48">
              <DropdownMenuItem onClick={() => cambiarEstado(true)}>Marcar como inactivos</DropdownMenuItem>
              <DropdownMenuItem onClick={() => cambiarEstado(false)}>Reactivar</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </BarraSeleccionMovil>
      ) : null}

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

/**
 * Una fila del teléfono. Marcando **no navega**: una fila que a veces abre la
 * ficha y a veces marca es una trampa, así que mientras el modo está prendido
 * es un botón y no un enlace, y la casilla solo pinta —el toque es de la fila
 * entera, y dejar que la casilla lo tome también marca y desmarca en el mismo
 * gesto—.
 */
function FilaMovil({
  href,
  seleccionando,
  marcada,
  onAlternar,
  etiqueta,
  children,
}: {
  href: string;
  seleccionando: boolean;
  marcada: boolean;
  onAlternar: () => void;
  etiqueta: string;
  children: React.ReactNode;
}) {
  if (!seleccionando) {
    return (
      <Link href={href} className={`${FILA_MOVIL} bg-card`}>
        {children}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onAlternar}
      aria-pressed={marcada}
      aria-label={etiqueta}
      className={`${FILA_MOVIL} w-full text-left ${
        marcada ? "bg-primary/5" : "bg-card"
      }`}
    >
      <Checkbox
        checked={marcada}
        className="pointer-events-none flex-none"
        tabIndex={-1}
        aria-hidden
      />
      {children}
    </button>
  );
}
