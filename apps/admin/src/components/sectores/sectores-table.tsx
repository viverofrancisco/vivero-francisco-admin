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
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { MapPin, Search } from "lucide-react";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface AdminUser {
  id: string;
  name: string | null;
  email: string;
}

interface SectorRow {
  id: string;
  nombre: string;
  _count: { clientes: number };
  admins: { user: AdminUser }[];
}

interface SectoresTableProps {
  sectores: SectorRow[];
}

/** Cómo se llama un admin: su nombre, y si no lo tiene, su correo. */
function nombreAdmin(admin: AdminUser): string {
  return admin.name ?? admin.email;
}

export function SectoresTable({ sectores }: SectoresTableProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return sectores;
    const q = searchQuery.toLowerCase();
    return sectores.filter((s) => s.nombre.toLowerCase().includes(q));
  }, [sectores, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  async function handleDelete(id: string) {
    const res = await fetch(`/api/sectores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      // El error de acá dice *por qué* no se puede —normalmente porque tiene
      // clientes—, así que vale más que un "Error al eliminar".
      throw new Error(body.error ?? "No pudimos eliminar el sector");
    }
  }

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtered.length,
    searchQuery
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:gap-5">
      <div className="flex flex-none flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar sector..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Solo las filas scrollean: encabezado y paginación quedan fijos. */}
      <div className="hidden min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-border bg-card md:flex">
        <div className="min-h-0 flex-1 overflow-hidden">
          {filtered.length === 0 ? (
            <EmptyState message="No se encontraron sectores" />
          ) : (
            <Table containerClassName="h-full overflow-y-auto">
              <TableHeader sticky>
                <TableRow>
                  <TableHead>Sector</TableHead>
                  <TableHead className="text-right">Clientes</TableHead>
                  <TableHead>Administrador</TableHead>
                  <TableHead className="w-16 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginated.map((s) => {
                  const admin = s.admins[0]?.user;
                  const otros = s.admins.length - 1;
                  return (
                    <TableRow
                      key={s.id}
                      className="cursor-pointer"
                      onClick={() =>
                        router.push(`/dashboard/sectores/${s.id}?from=${aca()}`)
                      }
                    >
                      <TableCell>
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-primary/10">
                            <MapPin className="h-4 w-4 text-primary" />
                          </span>
                          <span className="font-medium">{s.nombre}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {s._count.clientes}
                      </TableCell>
                      <TableCell>
                        {admin ? (
                          <div className="flex items-center gap-2.5">
                            <InitialsAvatar name={nombreAdmin(admin)} size={28} />
                            <span className="truncate">
                              {nombreAdmin(admin)}
                              {otros > 0 ? (
                                <span className="text-muted-foreground">
                                  {` +${otros}`}
                                </span>
                              ) : null}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">
                            Sin administrador
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DeleteDialog
                            title={`¿Eliminar ${s.nombre}?`}
                            description={
                              s._count.clientes > 0
                                ? `Este sector tiene ${s._count.clientes} ${
                                    s._count.clientes === 1
                                      ? "cliente asignado"
                                      : "clientes asignados"
                                  }.`
                                : "Esta acción no se puede deshacer."
                            }
                            onDelete={() => handleDelete(s.id)}
                            onSuccess={() => router.refresh()}
                          />
                        </div>
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
          sustantivo="sector"
          plural="sectores"
        />
      </div>

      {/* Móvil: el sector y, debajo, cuántos clientes tiene y quién lo
          administra — las tres columnas de la tabla en una línea. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontraron sectores"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((s) => {
          const admin = s.admins[0]?.user;
          const otros = s.admins.length - 1;
          return (
            <Link
              key={s.id}
              href={`/dashboard/sectores/${s.id}?from=${aqui}`}
              className={FILA_MOVIL}
            >
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-primary/10">
                <MapPin className="h-4 w-4 text-primary" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {s.nombre}
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {s._count.clientes}{" "}
                  {s._count.clientes === 1 ? "cliente" : "clientes"}
                  {" · "}
                  {admin
                    ? `${nombreAdmin(admin)}${otros > 0 ? ` +${otros}` : ""}`
                    : "Sin administrador"}
                </span>
              </span>
            </Link>
          );
        })}
      </ListaMovil>
    </div>
  );
}
