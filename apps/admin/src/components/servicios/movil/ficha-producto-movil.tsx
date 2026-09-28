"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { EstadoProducto } from "@vivero/shared";
import { ChevronLeft, ChevronRight, ImagePlus, MoreHorizontal, Tags } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ImagenProducto } from "../producto-imagenes";
import type { OpcionEditable, VarianteFila } from "../producto-variantes";
import { EstadoBadge } from "../estado-badge";
import { FotosDeProductoMovil } from "./fotos-movil";
import { EditorDeOpcionesMovil } from "./opciones-movil";
import { CuerpoDeVarianteMovil, ListaDeVariantesMovil } from "./variantes-movil";
import { SelectorDeCategoriasMovil } from "./categorias-movil";
import { EditarProductoMovil } from "./editar-producto-movil";
import { Fila, Seccion } from "./piezas";

const TIPO_LABEL: Record<string, string> = { SERVICIO: "Servicio", BIEN: "Bien" };

export interface ProductoMovil {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  /** La descripción sin formato: la ficha del teléfono la muestra en texto. */
  descripcionPlana: string;
  ivaTasa: string | number | null;
  estado: EstadoProducto;
  archivadoEl: string | null;
  categoriaIds: string[];
  createdAt?: string;
}

/**
 * La ficha del producto en el teléfono: la de la app, en el portal, con la
 * forma de la de Shopify.
 *
 * El encabezado es el de las demás fichas —la flecha al lado del nombre, el
 * ⋯ con *Editar*— y debajo las secciones: fotos, descripción, información
 * general, opciones (los ejes con sus valores como pastillas y *Editar*, que
 * abre el editor), el renglón *N variantes* que abre la lista, o el precio y
 * el inventario de la variante única, y al final *Categorías*. Cada hoja
 * guarda en el acto y la página se refresca: el teléfono no tiene la barra
 * de guardar del escritorio, y la app tampoco.
 */
export function FichaProductoMovil({
  servicio,
  imagenes,
  opciones,
  variantes,
  categorias,
  backHref,
}: {
  servicio: ProductoMovil;
  imagenes: ImagenProducto[];
  opciones: OpcionEditable[];
  variantes: VarianteFila[];
  categorias: { id: string; nombre: string }[];
  backHref: string;
}) {
  const [editando, setEditando] = useState(false);
  const [editandoOpciones, setEditandoOpciones] = useState(false);
  const [listaAbierta, setListaAbierta] = useState(false);
  const [eligiendoCategorias, setEligiendoCategorias] = useState(false);

  const esBien = servicio.tipo === "BIEN";
  const conOpciones = opciones.length > 0;
  const unica = !conOpciones && variantes.length === 1 ? variantes[0] : null;
  const nombresDeCategorias = categorias
    .filter((c) => servicio.categoriaIds.includes(c.id))
    .map((c) => c.nombre);
  const ivaTasa = servicio.ivaTasa === null ? null : Number(servicio.ivaTasa);

  return (
    <div className="-mx-3 -mt-3 md:hidden">
      <div className="sticky top-0 z-20 flex items-center gap-1.5 bg-card px-3 pt-1.5 pb-2">
        <Link href={backHref} aria-label="Volver" className="-ml-1.5 flex h-10 w-10 flex-none items-center justify-center rounded-xl active:bg-muted">
          <ChevronLeft className="h-6 w-6" />
        </Link>
        <h1 className="min-w-0 flex-1 truncate text-[22px] font-extrabold tracking-[-0.4px]">{servicio.nombre}</h1>
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button type="button" aria-label="Acciones" className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] border border-border active:bg-muted">
                <MoreHorizontal className="h-5 w-5" />
              </button>
            }
          />
          <DropdownMenuContent align="end" className="min-w-52">
            <DropdownMenuItem onClick={() => setEditando(true)}>Editar</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="px-3 pb-8">
        {servicio.archivadoEl ? (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Este producto está archivado: no se ofrece en órdenes ni facturas.
          </div>
        ) : null}

        <FotosDeProductoMovil productoId={servicio.id} imagenes={imagenes} />

        <section className="mt-5">
          <p className="mb-1.5 pl-1 text-[11px] tracking-[0.8px] text-muted-foreground uppercase">Descripción</p>
          <div className={`rounded-xl bg-card px-3.5 py-3 text-sm ${servicio.descripcionPlana ? "leading-6" : "text-muted-foreground"}`}>
            {servicio.descripcionPlana || "Sin descripción."}
          </div>
        </section>

        <Seccion titulo="Información general">
          <Fila etiqueta="Estado" valor={<EstadoBadge archivado={servicio.archivadoEl !== null} estado={servicio.estado} />} />
          <Fila etiqueta="Tipo" valor={TIPO_LABEL[servicio.tipo] ?? servicio.tipo} />
          <Fila etiqueta="IVA" valor={ivaTasa === null ? "—" : `${ivaTasa}%`} />
          {servicio.createdAt ? <Fila etiqueta="Creado" valor={fechaDeAlta(servicio.createdAt)} /> : null}
        </Seccion>

        {esBien ? (
          <section className="mt-5">
            <div className="mb-1.5 flex items-center justify-between pl-1">
              <p className="text-[11px] tracking-[0.8px] text-muted-foreground uppercase">Opciones</p>
              <button type="button" onClick={() => setEditandoOpciones(true)} className="pr-1 text-sm font-semibold text-primary active:opacity-60">
                Editar
              </button>
            </div>
            <div className="rounded-xl bg-card px-3.5 py-2">
              {opciones.length === 0 ? (
                <p className="py-2 text-sm text-muted-foreground">Sin opciones. Agrega color o tamaño para tener variantes.</p>
              ) : (
                opciones.map((o) => (
                  <div key={o.id ?? o.nombre} className="py-2">
                    <p className="mb-2 text-sm font-semibold text-muted-foreground">
                      {o.nombre} ({o.valores.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {o.valores.map((v) => (
                        <span key={v.id ?? v.valor} className="rounded-[10px] bg-muted px-3.5 py-2 text-[15px]">
                          {v.valor}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        ) : null}

        {esBien && conOpciones ? (
          <Seccion titulo="Variantes">
            <button type="button" onClick={() => setListaAbierta(true)} className="flex w-full items-center gap-3 py-2.5 text-left active:opacity-60">
              <span className="relative h-11 w-11 flex-none overflow-hidden rounded-lg border bg-muted">
                {imagenes[0] ? (
                  <Image src={imagenes[0].url} alt="" fill sizes="44px" className="object-cover" unoptimized />
                ) : (
                  <span className="flex h-full items-center justify-center text-muted-foreground"><ImagePlus className="h-4 w-4" /></span>
                )}
              </span>
              <span className="flex-1 text-base">{variantes.length} {variantes.length === 1 ? "variante" : "variantes"}</span>
              <ChevronRight className="h-[18px] w-[18px] text-muted-foreground" />
            </button>
          </Seccion>
        ) : null}

        {esBien && unica ? <CuerpoDeVarianteMovil variante={unica} /> : null}

        {!esBien && unica ? (
          <Seccion titulo="SKU">
            <Fila etiqueta="SKU" valor={unica.sku || "—"} />
          </Seccion>
        ) : null}

        <Seccion titulo="Organización">
          <button type="button" onClick={() => setEligiendoCategorias(true)} className="flex w-full items-center gap-3.5 py-2.5 text-left active:opacity-60">
            <Tags className="h-5 w-5 text-muted-foreground" />
            <span className="min-w-0 flex-1">
              <span className="block text-base">Categorías</span>
              <span className="block truncate text-sm text-muted-foreground">{nombresDeCategorias.join(" • ") || "Sin categorías"}</span>
            </span>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </button>
        </Seccion>
      </div>

      {editando ? (
        <EditarProductoMovil
          producto={{
            id: servicio.id,
            nombre: servicio.nombre,
            tipo: servicio.tipo,
            descripcionPlana: servicio.descripcionPlana,
            estado: servicio.estado,
            categoriaIds: servicio.categoriaIds,
          }}
          variante={unica}
          onCerrar={() => setEditando(false)}
        />
      ) : null}
      {editandoOpciones ? (
        <EditorDeOpcionesMovil productoId={servicio.id} opciones={opciones} variantes={variantes.length} onCerrar={() => setEditandoOpciones(false)} />
      ) : null}
      {listaAbierta ? (
        <ListaDeVariantesMovil producto={{ id: servicio.id, nombre: servicio.nombre, imagenes }} variantes={variantes} onCerrar={() => setListaAbierta(false)} />
      ) : null}
      {eligiendoCategorias ? (
        <SelectorDeCategoriasMovil
          producto={{ id: servicio.id, nombre: servicio.nombre, tipo: servicio.tipo, estado: servicio.estado, descripcion: servicio.descripcion }}
          elegidas={servicio.categoriaIds}
          onCerrar={() => setEligiendoCategorias(false)}
        />
      ) : null}
    </div>
  );
}

/** "29 jun 2026", como la app. */
function fechaDeAlta(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("es-EC", { day: "numeric", month: "short", year: "numeric" });
}
