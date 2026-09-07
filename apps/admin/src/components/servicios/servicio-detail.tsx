"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { BarraCambios } from "@/components/shared/barra-cambios";
import { SelectorCategorias } from "./selector-categorias";
import { ProductoImagenes, type ImagenProducto } from "./producto-imagenes";
import { ProductoInventario } from "./producto-inventario";
import {
  ProductoVariantes,
  type OpcionEditable,
  type VarianteFila,
} from "./producto-variantes";

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

interface ServicioData {
  id: string;
  nombre: string;
  tipo: string;
  descripcion: string | null;
  ivaTasa: string | number | null;
  /** El que sale impreso como `codigoPrincipal` en la factura. */
  codigo: string | null;
  /** Cuándo se archivó, o `null` si está en el catálogo. */
  archivadoEl: string | null;
  /** Varias: un rosal es "Plantas" y también "Exterior". */
  categoriaIds: string[];
}

export function ServicioDetail({
  servicio,
  categorias = [],
  imagenes = [],
  opciones = [],
  variantes = [],
  backHref = "/dashboard/productos",
}: {
  servicio: ServicioData;
  /** La galería. Todo producto puede tener fotos, servicio o bien. */
  imagenes?: ImagenProducto[];
  /** Los ejes y sus combinaciones. Vacíos en un servicio: no tiene ninguno. */
  opciones?: OpcionEditable[];
  variantes?: VarianteFila[];
  /** Las del portal, para poder reagrupar el producto desde acá. */
  categorias?: { id: string; nombre: string }[];
  /** La lista de la que se vino, con sus filtros. */
  backHref?: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  /**
   * La galería vive acá y no adentro de su card: la variante ofrece elegir una
   * de estas fotos, así que subir una tiene que aparecer en el selector de al
   * lado sin recargar.
   */
  const [galeria, setGaleria] = useState(imagenes);
  const [filas, setFilas] = useState(variantes);

  /**
   * Lo guardado y lo que se está escribiendo.
   *
   * No hay modo "editar": los campos se tocan directo y la barra de arriba
   * aparece sola cuando difieren. Un botón *Editar* obliga a decidir que se va
   * a editar antes de saber que se quiere.
   */
  const guardado = {
    nombre: servicio.nombre,
    descripcion: servicio.descripcion ?? "",
    codigo: servicio.codigo ?? "",
    categoriaIds: servicio.categoriaIds,
  };
  const [form, setForm] = useState(guardado);

  const hayCambios =
    form.nombre !== guardado.nombre ||
    form.descripcion !== guardado.descripcion ||
    form.codigo !== guardado.codigo ||
    form.categoriaIds.join() !== guardado.categoriaIds.join();

  /** Lo devuelve al catálogo. */
  const restaurar = async () => {
    setRestaurando(true);
    try {
      const res = await fetch(`/api/servicios/${servicio.id}/restaurar`, {
        method: "POST",
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success("El producto vuelve al catálogo");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al restaurar");
    } finally {
      setRestaurando(false);
    }
  };

  const guardar = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/servicios/${servicio.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          // `tipo` es inmutable: se manda tal cual está para que el servidor lo
          // valide, no para cambiarlo.
          tipo: servicio.tipo,
          descripcion: form.descripcion,
          codigo: form.codigo.trim() || null,
          categoriaIds: form.categoriaIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al guardar el producto");
      }
      toast.success("Producto actualizado");
      // El servidor es el que dice qué quedó guardado: `router.refresh()` trae
      // la ficha de nuevo y `guardado` vuelve a coincidir con el formulario.
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar el producto"
      );
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Un bien sin opciones tiene una variante y una sola: su stock es, a los ojos
   * de quien mira, el del producto. Con opciones el stock es por combinación y
   * esta card desaparece.
   */
  const varianteUnica =
    servicio.tipo === "BIEN" && opciones.length === 0 && filas.length === 1
      ? filas[0]
      : null;

  return (
    <div className="space-y-6">
      <BarraCambios
        hayCambios={hayCambios}
        guardando={guardando}
        onGuardar={guardar}
        onDescartar={() => setForm(guardado)}
      />

      <div className="flex items-start gap-3">
        {/* Faltaba: era la única ficha sin forma de volver al listado. */}
        <Link href={backHref}>
          <Button variant="ghost" size="icon" className="mt-1">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          {/* El título es el campo: cambiarle el nombre a un producto es lo que
              más se hace, y esconderlo detrás de *Editar* lo convertía en tres
              clics. */}
          <Input
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            aria-label="Nombre del producto"
            className="!h-auto border-transparent bg-transparent px-2 py-1 text-2xl font-bold tracking-tight shadow-none hover:border-input focus-visible:border-input"
          />
          <p className="px-2 text-muted-foreground">
            {TIPO_LABEL[servicio.tipo] ?? servicio.tipo}
          </p>
        </div>
      </div>

      {/* Archivado, la ficha se abre igual —se llega desde el filtro, y desde
          una orden vieja que lo nombra— pero tiene que decirlo: si no, se ve
          idéntica a la de un producto que sigue a la venta. */}
      {servicio.archivadoEl && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <span>
            Este producto está archivado: no se ofrece en visitas, órdenes ni
            suscripciones. Lo que ya lo nombra sigue igual.
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={restaurar}
            disabled={restaurando}
          >
            <Undo2 className="mr-2 h-4 w-4" />
            Restaurar
          </Button>
        </div>
      )}

      {/* Dos columnas: a la izquierda lo que es el producto —qué es, cómo se ve,
          cuánto hay—, a la derecha cómo se lo agrupa. Lo de la derecha se toca
          poco y no necesita el ancho. */}
      <div className="grid items-start gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardContent className="space-y-4">
              {/* **El código solo en un servicio.** En un bien lo lleva la
                  variante como SKU —que es lo que se imprime y lo que va en la
                  etiqueta— y tener los dos era pedir el mismo dato dos veces
                  para que después uno de los dos ganara. */}
              {servicio.tipo === "SERVICIO" && (
                <div className="space-y-2">
                  <Label htmlFor="codigo">Código</Label>
                  <Input
                    id="codigo"
                    value={form.codigo}
                    onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                    placeholder="Ej: MANT-01"
                  />
                  <p className="text-xs text-muted-foreground">
                    Sale impreso en la factura. Vacío, se usa uno derivado del
                    producto.
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="descripcion">Descripción</Label>
                <Textarea
                  id="descripcion"
                  rows={4}
                  value={form.descripcion}
                  onChange={(e) =>
                    setForm({ ...form, descripcion: e.target.value })
                  }
                  placeholder="Para qué sirve, qué incluye…"
                />
              </div>
            </CardContent>
          </Card>

          <ProductoImagenes
            productoId={servicio.id}
            imagenes={galeria}
            onCambio={setGaleria}
          />

          {/* Sin opciones, todo el inventario del bien acá: una tabla de una
              fila para decir "hay 12" es una tabla de más. */}
          {varianteUnica && (
            <ProductoInventario
              variante={varianteUnica}
              ivaTasa={
                servicio.ivaTasa === null ? null : Number(servicio.ivaTasa)
              }
              onCambio={(v) => setFilas([v])}
            />
          )}

          {/* Solo un bien: un servicio no tiene nada que combinar ni que contar. */}
          {servicio.tipo === "BIEN" && (
            <ProductoVariantes
              productoId={servicio.id}
              productoNombre={form.nombre}
              opciones={opciones}
              variantes={filas}
              imagenes={galeria}
              onVariantesChange={setFilas}
            />
          )}
        </div>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Categorías</CardTitle>
          </CardHeader>
          <CardContent>
            {categorias.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Todavía no hay categorías creadas.
              </p>
            ) : (
              <SelectorCategorias
                categorias={categorias}
                value={form.categoriaIds}
                onChange={(ids) => setForm({ ...form, categoriaIds: ids })}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
