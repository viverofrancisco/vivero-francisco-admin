"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { Trash2, Search, MapPin, Users, UserCog } from "lucide-react";
import { toast } from "sonner";
import { aca, useFiltroUrl } from "@/lib/filtros-url";

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


function SecMeta({
  icon: Icon,
  label,
}: {
  icon: typeof Users;
  label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <Icon className="h-[15px] w-[15px] text-green-700" />
      <span className="text-[13px] font-bold text-muted-foreground">
        {label}
      </span>
    </div>
  );
}

export function SectoresTable({ sectores }: SectoresTableProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState<string | null>(null);
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

  const handleDelete = async (id: string) => {
    if (!confirm("¿Eliminar este sector?")) return;
    setDeleting(id);
    try {
      const res = await fetch(`/api/sectores/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error);
      }
      toast.success("Sector eliminado");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al eliminar");
    } finally {
      setDeleting(null);
    }
  };

  const stripe =
    "repeating-linear-gradient(45deg, var(--green-50), var(--green-50) 10px, var(--card) 10px, var(--card) 20px)";

  return (
    <div className="space-y-5">
      {/* Search */}
      <div className="flex flex-wrap items-center gap-3">
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

      {/* Cards */}
      {filtered.length === 0 ? (
        <EmptyState message="No se encontraron sectores" />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginated.map((s) => {
              const admin = s.admins[0]?.user;
              const adminName = admin ? admin.name ?? admin.email : null;
              return (
                <div
                  key={s.id}
                  onClick={() =>
                    router.push(`/dashboard/sectores/${s.id}?from=${aca()}`)
                  }
                  className="group cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-shadow hover:shadow-md"
                >
                  {/* Striped header with pin */}
                  <div
                    className="relative flex h-[92px] items-center justify-center"
                    style={{ background: stripe }}
                  >
                    <div className="flex h-[34px] w-[34px] rotate-[-45deg] items-center justify-center rounded-[50%_50%_50%_0] bg-primary">
                      <MapPin className="h-[17px] w-[17px] rotate-45 text-primary-foreground" />
                    </div>
                    <div
                      className="absolute right-2 top-2 opacity-0 transition-opacity group-hover:opacity-100"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 bg-card/80"
                        disabled={deleting === s.id}
                        onClick={() => handleDelete(s.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="p-4">
                    <div className="text-[16.5px] font-extrabold tracking-tight text-foreground">
                      {s.nombre}
                    </div>
                    <div className="mt-2.5 flex gap-4">
                      <SecMeta
                        icon={Users}
                        label={`${s._count.clientes} ${
                          s._count.clientes === 1 ? "cliente" : "clientes"
                        }`}
                      />
                      <SecMeta
                        icon={UserCog}
                        label={`${s.admins.length} ${
                          s.admins.length === 1 ? "admin" : "admins"
                        }`}
                      />
                    </div>
                    <div className="mt-3.5 flex items-center gap-2 border-t border-border pt-3">
                      {adminName ? (
                        <>
                          <InitialsAvatar name={adminName} size={26} />
                          <span className="truncate text-[12.5px] font-semibold text-muted-foreground">
                            Admin:{" "}
                            <span className="font-bold text-foreground">
                              {adminName}
                            </span>
                            {s.admins.length > 1 && ` +${s.admins.length - 1}`}
                          </span>
                        </>
                      ) : (
                        <span className="text-[12.5px] font-semibold text-muted-foreground">
                          Sin administrador
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination */}
          <TablePagination
            page={pagina}
            total={filtered.length}
            onPageChange={setPage}
            suelta
            sustantivo="sector"
            plural="sectores"
          />
        </>
      )}
    </div>
  );
}
