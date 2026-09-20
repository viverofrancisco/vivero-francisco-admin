"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { PageHeader } from "@/components/shared/page-header";
import {
  ACCION_BARRA_MOVIL,
  BarraSeleccionMovil,
} from "@/components/shared/barra-seleccion-movil";
import {
  DialogoEliminarEnLote,
  useEliminarEnLote,
} from "@/components/shared/eliminar-en-lote";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import {
  TablePagination,
  FILAS_POR_PAGINA,
} from "@/components/shared/table-pagination";
import { InitialsAvatar } from "@/components/shared/initials-avatar";
import { useScrollInfinito } from "@/components/shared/scroll-infinito";
import { FILA_MOVIL, ListaMovil } from "@/components/shared/lista-movil";
import { Search, ChevronRight } from "lucide-react";
import { aca, useAca, useFiltroUrl } from "@/lib/filtros-url";

interface Grupo {
  id: string;
  nombre: string;
  descripcion: string | null;
  _count?: { visitas: number };
  miembros: {
    personal: { nombre: string; apellido?: string | null };
  }[];
}


const barColors = [
  "bg-chart-1",
  "bg-chart-2",
  "bg-chart-3",
  "bg-chart-5",
  "bg-chart-4",
];

export function GruposTable({ grupos }: { grupos: Grupo[] }) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useFiltroUrl("q", "");
  const [page, setPage] = useFiltroUrl("pagina", 1);
  const [marcados, setMarcados] = useState<string[]>([]);
  /** Solo en el teléfono: ahí marcar es un modo, que prende el ⋯. */
  const [seleccionando, setSeleccionando] = useState(false);
  const [confirmando, setConfirmando] = useState(false);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return grupos;
    const q = searchQuery.toLowerCase();
    return grupos.filter((g) => g.nombre.toLowerCase().includes(q));
  }, [grupos, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / FILAS_POR_PAGINA));
  const pagina = Math.min(page, totalPages);
  const paginated = filtered.slice(
    (pagina - 1) * FILAS_POR_PAGINA,
    pagina * FILAS_POR_PAGINA
  );

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/grupos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Error al eliminar");
  };

  const { eliminar, eliminando } = useEliminarEnLote({
    endpoint: "/api/grupos/eliminar",
    sustantivo: "grupo",
    plural: "grupos",
    onListo: () => {
      setConfirmando(false);
      setMarcados([]);
      setSeleccionando(false);
      router.refresh();
    },
  });

  // Marcar y filtrar después dejaría una cuenta de seleccionados que ya no
  // están en pantalla, y un botón que borra lo que no se ve.
  const enPantalla = new Set(filtered.map((g) => g.id));
  const elegidos = marcados.filter((id) => enPantalla.has(id));

  function alternar(id: string, marcar: boolean) {
    setMarcados((actuales) =>
      marcar ? [...actuales, id] : actuales.filter((x) => x !== id)
    );
  }

  const { visibles, hayMas, cargando, centinela } = useScrollInfinito(
    filtered.length,
    searchQuery
  );
  const enLista = filtered.slice(0, visibles);
  const aqui = useAca();

  return (
    // Columna con alto propio en móvil, para que scrollee la lista y no la
    // página; en escritorio, el bloque de tarjetas de siempre.
    <div className="flex min-h-0 flex-1 flex-col gap-3 md:block md:flex-none md:space-y-5">
      {/* El encabezado vive en el cliente porque el ⋯ prende el modo de
          selección, que es estado de esta pantalla. */}
      <PageHeader
        title="Grupos"
        actions={[
          {
            label: "Nuevo Grupo",
            href: "/dashboard/grupos/nuevo",
            icon: "plus",
            primary: true,
          },
          ...(seleccionando || filtered.length === 0
            ? []
            : [
                {
                  label: "Seleccionar grupos",
                  onClick: () => setSeleccionando(true),
                  soloMovil: true,
                } as const,
              ]),
        ]}
      />
      {/* Search */}
      <div className="flex flex-none flex-wrap items-center gap-3 [&_input]:h-9">
        <div className="relative min-w-0 flex-1 md:min-w-[200px] md:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar grupo..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>

        {/* Comparte renglón con el buscador en vez de ir sobre las tarjetas:
            una franja propia las empujaría hacia abajo justo cuando se está
            apuntando a una, y acá no hay fila de encabezados que tapar. */}
        {elegidos.length > 0 ? (
          <div className="hidden items-center gap-3 md:flex">
            <span className="text-xs font-bold tracking-wide text-muted-foreground">
              {elegidos.length === 1
                ? "1 grupo seleccionado"
                : `${elegidos.length} grupos seleccionados`}
            </span>
            <button
              type="button"
              className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              onClick={() => setMarcados([])}
            >
              Quitar selección
            </button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmando(true)}
            >
              Eliminar
            </Button>
          </div>
        ) : null}
      </div>

      {/* Tarjetas: solo en escritorio. En una columna de 400 px cada una
          ocupa media pantalla y hay que scrollear tres veces para ver cuatro
          grupos, así que ahí van como lista. */}
      {filtered.length === 0 ? (
        <div className="hidden md:block">
          <EmptyState message="No se encontraron grupos" />
        </div>
      ) : (
        <div className="hidden md:block md:space-y-5">
          <div className="grid gap-4 lg:grid-cols-2">
            {paginated.map((grupo, idx) => {
              const miembros = grupo.miembros ?? [];
              return (
                <div
                  key={grupo.id}
                  onClick={() =>
                    router.push(`/dashboard/grupos/${grupo.id}?from=${aca()}`)
                  }
                  className={`cursor-pointer rounded-2xl border bg-card p-5 transition-shadow hover:shadow-md ${
                    marcados.includes(grupo.id)
                      ? "border-primary/40 bg-primary/5"
                      : "border-border"
                  }`}
                >
                  <div className="mb-4 flex items-center gap-3">
                    <span onClick={(e) => e.stopPropagation()}>
                      <Checkbox
                        checked={marcados.includes(grupo.id)}
                        onCheckedChange={(valor) =>
                          alternar(grupo.id, valor === true)
                        }
                        aria-label={`Seleccionar ${grupo.nombre}`}
                      />
                    </span>
                    <div
                      className={`h-11 w-3 flex-none rounded-md ${
                        barColors[idx % barColors.length]
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[17px] font-extrabold tracking-tight text-foreground">
                        {grupo.nombre}
                      </div>
                      <div className="truncate text-[12.5px] font-semibold text-muted-foreground">
                        {grupo.descripcion || "Sin descripción"}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[22px] font-extrabold text-foreground">
                        {grupo._count?.visitas ?? 0}
                      </div>
                      <div className="text-[11.5px] font-semibold text-muted-foreground">
                        visitas
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between border-t border-border pt-3.5">
                    <div className="flex items-center">
                      {miembros.slice(0, 4).map((m, i) => (
                        <div
                          key={i}
                          className="rounded-full ring-[2.5px] ring-card"
                          style={{ marginLeft: i ? -10 : 0 }}
                        >
                          <InitialsAvatar
                            name={`${m.personal.nombre} ${m.personal.apellido || ""}`.trim()}
                            size={32}
                          />
                        </div>
                      ))}
                      <span className="ml-2.5 text-[13px] font-bold text-muted-foreground">
                        {miembros.length}{" "}
                        {miembros.length === 1 ? "miembro" : "miembros"}
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <DeleteDialog
                        title={`¿Eliminar "${grupo.nombre}"?`}
                        description="Se eliminará este grupo permanentemente."
                        onDelete={() => handleDelete(grupo.id)}
                        onSuccess={() => router.refresh()}
                      />
                      <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
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
            sustantivo="grupo"
            plural="grupos"
          />
        </div>
      )}

      {/* Móvil: nombre y descripción, y a la derecha cuántas visitas lleva.
          Los avatares de los miembros quedan para la ficha —cuatro caras de
          32 px al lado del nombre lo dejan sin ancho— pero cuántos son sí se
          dice, que es el dato que distingue una cuadrilla de otra. */}
      <ListaMovil
        vacia={filtered.length === 0}
        mensajeVacio="No se encontraron grupos"
        hayMas={hayMas}
        cargando={cargando}
        centinela={centinela}
      >
        {enLista.map((grupo, idx) => {
          const miembros = grupo.miembros ?? [];
          return (
            <FilaMovil
              key={grupo.id}
              href={`/dashboard/grupos/${grupo.id}?from=${aqui}`}
              seleccionando={seleccionando}
              marcada={marcados.includes(grupo.id)}
              onAlternar={() =>
                alternar(grupo.id, !marcados.includes(grupo.id))
              }
              etiqueta={grupo.nombre}
            >
              <span
                className={`h-10 w-1.5 flex-none rounded-md ${
                  barColors[idx % barColors.length]
                }`}
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-foreground">
                  {grupo.nombre}
                </span>
                <span className="block truncate text-xs font-medium text-muted-foreground">
                  {miembros.length}{" "}
                  {miembros.length === 1 ? "miembro" : "miembros"}
                  {grupo.descripcion ? ` · ${grupo.descripcion}` : ""}
                </span>
              </span>
              <span className="flex-none text-right">
                <span className="block text-sm font-bold tabular-nums text-foreground">
                  {grupo._count?.visitas ?? 0}
                </span>
                <span className="block text-[11px] font-semibold text-muted-foreground">
                  visitas
                </span>
              </span>
              <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
            </FilaMovil>
          );
        })}
        {/* La barra flota sobre la lista: sin esto tapa la última fila. */}
        {seleccionando ? <div className="h-16" aria-hidden /> : null}
      </ListaMovil>

      {seleccionando ? (
        <BarraSeleccionMovil
          cuantas={elegidos.length}
          onSalir={() => {
            setSeleccionando(false);
            setMarcados([]);
          }}
        >
          <Button
            size="sm"
            className={ACCION_BARRA_MOVIL}
            disabled={elegidos.length === 0}
            onClick={() => setConfirmando(true)}
          >
            Eliminar
          </Button>
        </BarraSeleccionMovil>
      ) : null}

      <DialogoEliminarEnLote
        abierto={confirmando}
        onOpenChange={setConfirmando}
        cuantas={elegidos.length}
        sustantivo="grupo"
        plural="grupos"
        detalle="Las cuadrillas salen de las listas y de los selectores. Las visitas que salieron con ellas las siguen nombrando: por eso se archivan en vez de borrarse."
        eliminando={eliminando}
        onConfirmar={() => eliminar(elegidos)}
      />
    </div>
  );
}

/**
 * Una fila del teléfono. Marcando **no navega**: una fila que a veces abre la
 * ficha y a veces marca es una trampa, así que mientras el modo está prendido
 * es un botón y no un enlace, y la casilla solo pinta —el toque es de la fila
 * entera—.
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
