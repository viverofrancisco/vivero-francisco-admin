"use client";

import { useMemo } from "react";
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
import { Input } from "@/components/ui/input";
import { CustomSelect } from "@/components/ui/custom-select";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { BarraFiltros } from "@/components/shared/barra-filtros";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { StatCards } from "@/components/shared/stat-cards";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { Search } from "lucide-react";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface Personal {
  id: string;
  nombre: string;
  apellido: string | null;
  telefono: string | null;
  especialidad: string | null;
  tipo: string | null;
  estado: string;
  grupos?: { grupo: { nombre: string } }[];
}

function fullName(p: Personal): string {
  return `${p.nombre} ${p.apellido || ""}`.trim();
}

/**
 * El renglón de abajo en la lista de móvil: lo que la tabla reparte entre
 * especialidad, cuadrilla y teléfono, en una línea.
 */
function resumen(p: Personal): string {
  const cuadrillas = crewNames(p);
  const partes = [
    p.especialidad ?? (p.tipo ? tipoLabel(p.tipo) : null),
    cuadrillas !== "—" ? cuadrillas : null,
    p.telefono,
  ].filter(Boolean);
  return partes.length > 0 ? partes.join(" · ") : "Sin datos";
}

function tipoLabel(tipo: string): string {
  switch (tipo) {
    case "JARDINERO":
      return "Jardinero";
    case "CHOFER":
      return "Chofer";
    case "SUPERVISOR":
      return "Supervisor";
    case "MECANICO":
      return "Mecanico";
    default:
      return tipo;
  }
}

/** Dot color per specialty, matching the design palette. */
function tipoDot(tipo: string | null): string {
  switch (tipo) {
    case "JARDINERO":
      return "bg-primary";
    case "SUPERVISOR":
      return "bg-clay";
    case "CHOFER":
      return "bg-info";
    default:
      return "bg-muted-foreground";
  }
}

function crewNames(p: Personal): string {
  const names = (p.grupos ?? []).map((g) => g.grupo.nombre);
  return names.length ? names.join(", ") : "—";
}

export function PersonalTable({ personal }: { personal: Personal[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [estadoFilter, setEstadoFilter] = useFiltroUrl<string | null>("estado", null);
  const [tipoFilter, setTipoFilter] = useFiltroUrl<string | null>("tipo", null);
  const [page, setPage] = useFiltroUrl("pagina", 1);

  const filtered = useMemo(() => {
    let result = personal;
    if (estadoFilter) {
      result = result.filter((p) => p.estado === estadoFilter);
    }
    if (tipoFilter) {
      result = result.filter((p) => p.tipo === tipoFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          fullName(p).toLowerCase().includes(q) ||
          (p.telefono?.includes(q) ?? false) ||
          (p.especialidad?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  }, [personal, estadoFilter, tipoFilter, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA,
  );

  const stats: [string, number][] = useMemo(() => {
    const activo = personal.filter((p) => p.estado === "ACTIVO").length;
    const jardineros = personal.filter((p) => p.tipo === "JARDINERO").length;
    const supervisores = personal.filter((p) => p.tipo === "SUPERVISOR").length;
    const cuadrillas = new Set(
      personal.flatMap((p) => (p.grupos ?? []).map((g) => g.grupo.nombre)),
    ).size;
    return [
      ["Personal activo", activo],
      ["Jardineros", jardineros],
      ["Supervisores", supervisores],
      ["Cuadrillas", cuadrillas],
    ];
  }, [personal]);

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/personal/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtered.length,
    `${searchQuery}|${estadoFilter ?? ""}|${tipoFilter ?? ""}`
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
      {/* Solo en escritorio: cuatro tarjetas apiladas se comían la pantalla
          entera antes de la primera fila, y quien entra acá viene a buscar a
          alguien, no a mirar los totales. */}
      <div className="hidden md:block">
        <StatCards stats={stats} />
      </div>

      {/* Filters */}
      <BarraFiltros
        activos={[estadoFilter, tipoFilter].filter(Boolean).length}
        onLimpiar={() => {
          setEstadoFilter(null);
          setTipoFilter(null);
          setPage(1);
        }}
        busqueda={
          <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por nombre, telefono o especialidad..."
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
        <CustomSelect
          value={estadoFilter ?? ""}
          onChange={(v) => {
            setEstadoFilter(v || null);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los estados" },
            { value: "ACTIVO", label: "Activos" },
            { value: "INACTIVO", label: "Inactivos" },
          ]}
          placeholder="Todos los estados"
          className="w-44"
        />
        <CustomSelect
          value={tipoFilter ?? ""}
          onChange={(v) => {
            setTipoFilter(v || null);
            setPage(1);
          }}
          options={[
            { value: "", label: "Todos los tipos" },
            { value: "JARDINERO", label: "Jardineros" },
            { value: "CHOFER", label: "Choferes" },
            { value: "SUPERVISOR", label: "Supervisores" },
            { value: "MECANICO", label: "Mecanicos" },
          ]}
          placeholder="Todos los tipos"
          className="w-44"
        />
      </BarraFiltros>

      {/* Solo las filas scrollean: encabezado y paginación quedan fijos. */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontro personal" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Especialidad</TableHead>
                  <TableHead>Teléfono</TableHead>
                  <TableHead>Cuadrilla</TableHead>
                  <TableHead className="text-right">Estado</TableHead>
                  <TableHead className="w-16 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((p) => (
                  <TableRow
                    key={p.id}
                    className="cursor-pointer"
                    onClick={() =>
                      router.push(`/dashboard/personal/${p.id}?from=${aca()}`)
                    }
                  >
                    <TableCell>
                      <div className="flex items-center gap-2.5">
                        <InitialsAvatar name={fullName(p)} size={36} />
                        <div className="min-w-0">
                          <div className="truncate font-bold text-foreground">
                            {fullName(p)}
                          </div>
                          {p.tipo && (
                            <div className="truncate text-xs font-semibold text-muted-foreground">
                              {tipoLabel(p.tipo)}
                            </div>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      {p.tipo || p.especialidad ? (
                        <span className="inline-flex items-center gap-1.5 font-semibold text-muted-foreground">
                          <span
                            className={`h-2 w-2 rounded-full ${tipoDot(p.tipo)}`}
                          />
                          {p.especialidad ?? tipoLabel(p.tipo ?? "")}
                        </span>
                      ) : (
                        "—"
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {p.telefono ?? "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {crewNames(p)}
                    </TableCell>
                    <TableCell className="text-right">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${
                          p.estado === "ACTIVO"
                            ? "bg-secondary text-green-700"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {p.estado === "ACTIVO" ? "Activo" : "Inactivo"}
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <DeleteDialog
                          title={`¿Eliminar a ${fullName(p)}?`}
                          description="Se eliminara este personal permanentemente."
                          onDelete={() => handleDelete(p.id)}
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

        <TablePagination
          page={pagina}
          total={filtered.length}
          onPageChange={setPage}
          sustantivo="persona"
          plural="personas"
        />
      </div>

      {/* Móvil: nombre y estado arriba; debajo, la especialidad con la
          cuadrilla y el teléfono, que es con lo que se ubica a alguien. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontro personal"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((p) => (
          <Link
            key={p.id}
            href={`/dashboard/personal/${p.id}?from=${aqui}`}
            className={FILA_MOVIL}
          >
            <InitialsAvatar name={fullName(p)} size={40} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-bold text-foreground">
                  {fullName(p)}
                </span>
                {p.estado !== "ACTIVO" && (
                  <span className="flex-none rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold text-muted-foreground">
                    Inactivo
                  </span>
                )}
              </span>
              <span className="block truncate text-xs font-medium text-muted-foreground">
                {resumen(p)}
              </span>
            </span>
          </Link>
        ))}
      </ListaMovil>
    </div>
  );
}
