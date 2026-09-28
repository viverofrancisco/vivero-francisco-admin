"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Search, Tag } from "lucide-react";
import { CabeceraDeHoja, HojaCompleta, PastillaDeHoja, pedir } from "./piezas";

interface CategoriaFila {
  id: string;
  nombre: string;
  _count: { productos: number };
  media: { key: string } | null;
  /** La página del portal la arma; acá se pide a `/api/categorias`. */
  imagenUrl?: string | null;
}

/**
 * En qué categorías está el producto: la pantalla *Collections* de Shopify,
 * la misma que la app. Un buscador, cada categoría con su casilla y cuántos
 * productos tiene, y abajo la barra oscura con cuántas van. En cuanto el
 * conjunto cambia, arriba aparecen *Cancelar* y *Guardar*; *Guardar* manda
 * el producto entero por `PUT`, porque el schema del portal pide el nombre.
 */
export function SelectorDeCategoriasMovil({
  producto,
  elegidas,
  onCerrar,
}: {
  producto: { id: string; nombre: string; tipo: string; estado: "ACTIVO" | "BORRADOR"; descripcion: string | null };
  elegidas: string[];
  onCerrar: () => void;
}) {
  const router = useRouter();
  const [categorias, setCategorias] = useState<CategoriaFila[] | null>(null);
  const [marcadas, setMarcadas] = useState<Set<string>>(() => new Set(elegidas));
  const [filtro, setFiltro] = useState("");
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    fetch("/api/categorias")
      .then((r) => r.json())
      .then((d: CategoriaFila[]) => setCategorias(Array.isArray(d) ? d : []))
      .catch(() => setCategorias([]));
  }, []);

  const filas = useMemo(() => {
    if (!categorias) return [];
    const q = filtro.trim().toLowerCase();
    return q ? categorias.filter((c) => c.nombre.toLowerCase().includes(q)) : categorias;
  }, [categorias, filtro]);

  const hayCambios =
    marcadas.size !== elegidas.length || elegidas.some((id) => !marcadas.has(id));

  const alternar = (id: string) =>
    setMarcadas((actual) => {
      const siguiente = new Set(actual);
      if (siguiente.has(id)) siguiente.delete(id);
      else siguiente.add(id);
      return siguiente;
    });

  const guardar = async () => {
    if (!hayCambios) return;
    setGuardando(true);
    try {
      const ids = (categorias ?? []).filter((c) => marcadas.has(c.id)).map((c) => c.id);
      await pedir(`/api/servicios/${producto.id}`, {
        method: "PUT",
        body: {
          nombre: producto.nombre,
          tipo: producto.tipo,
          descripcion: producto.descripcion ?? "",
          estado: producto.estado,
          categoriaIds: ids,
        },
      });
      router.refresh();
      onCerrar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar las categorías");
      setGuardando(false);
    }
  };

  return (
    <HojaCompleta onCerrar={onCerrar}>
      <CabeceraDeHoja
        titulo="Categorías"
        onCerrar={onCerrar}
        cerrando={hayCambios ? "cancelar" : "cerrar"}
        derecha={
          <PastillaDeHoja texto="Guardar" primaria onClick={guardar} disabled={!hayCambios} cargando={guardando} />
        }
      />
      <div className="flex-none px-3 py-2">
        <div className="flex h-10 items-center gap-2 rounded-xl bg-muted px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            placeholder="Filtrar categorías"
            className="min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto pb-24">
        {categorias === null ? (
          <p className="p-6 text-center text-sm text-muted-foreground">Cargando…</p>
        ) : filas.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {categorias.length === 0 ? "Todavía no hay categorías creadas." : "Ninguna categoría coincide."}
          </p>
        ) : (
          filas.map((c) => {
            const marcada = marcadas.has(c.id);
            return (
              <button
                key={c.id}
                type="button"
                role="checkbox"
                aria-checked={marcada}
                onClick={() => alternar(c.id)}
                className={`flex w-full items-center gap-3.5 border-b px-4 py-3 text-left active:opacity-70 ${
                  marcada ? "bg-primary/5" : ""
                }`}
              >
                <span
                  className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-md border-[1.5px] ${
                    marcada ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"
                  }`}
                >
                  {marcada ? <Check className="h-[15px] w-[15px]" /> : null}
                </span>
                <span className="relative h-12 w-12 flex-none overflow-hidden rounded-lg bg-muted">
                  {c.imagenUrl ? (
                    <Image src={c.imagenUrl} alt="" fill sizes="48px" className="object-cover" unoptimized />
                  ) : (
                    <span className="flex h-full items-center justify-center text-muted-foreground">
                      <Tag className="h-4 w-4" />
                    </span>
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-base font-semibold">{c.nombre}</span>
                  <span className="block text-sm text-muted-foreground">
                    {c._count.productos} {c._count.productos === 1 ? "producto" : "productos"}
                  </span>
                </span>
              </button>
            );
          })
        )}
      </div>
      {marcadas.size > 0 ? (
        <div className="pointer-events-none absolute inset-x-4 bottom-4">
          <div className="pointer-events-auto flex items-center justify-between gap-3 rounded-2xl bg-foreground py-2 pr-2 pl-4 text-background">
            <span className="text-[15px] font-semibold">
              {marcadas.size} {marcadas.size === 1 ? "seleccionada" : "seleccionadas"}
            </span>
            <button
              type="button"
              onClick={() => setMarcadas(new Set())}
              className="rounded-[10px] bg-background/15 px-3.5 py-2 text-sm font-semibold"
            >
              Desmarcar
            </button>
          </div>
        </div>
      ) : null}
    </HojaCompleta>
  );
}
