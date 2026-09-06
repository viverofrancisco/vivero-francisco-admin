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
import { ArrowLeft, Pencil, Undo2 } from "lucide-react";
import { toast } from "sonner";
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
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  /**
   * La galería vive acá y no adentro de su card: la variante ofrece elegir una
   * de estas fotos, así que subir una tiene que aparecer en el selector de al
   * lado sin recargar.
   */
  const [galeria, setGaleria] = useState(imagenes);
  const [filas, setFilas] = useState(variantes);

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

  const [data, setData] = useState({
    nombre: servicio.nombre,
    tipo: servicio.tipo,
    descripcion: servicio.descripcion ?? "",
    codigo: servicio.codigo ?? "",
  });
  const [form, setForm] = useState(data);
  const [categoriaIds, setCategoriaIds] = useState(servicio.categoriaIds);

  const startEdit = () => {
    setForm(data);
    setEditing(true);
  };

  const guardarCampos = async (
    cuerpo: Record<string, unknown>
  ): Promise<boolean> => {
    const res = await fetch(`/api/servicios/${servicio.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nombre: data.nombre,
        // `tipo` es inmutable: se manda tal cual está para que el servidor lo
        // valide, no para cambiarlo.
        tipo: data.tipo,
        descripcion: data.descripcion,
        codigo: data.codigo || null,
        categoriaIds,
        ...cuerpo,
      }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? "Error al guardar el producto");
    }
    return true;
  };

  const save = async () => {
    if (!form.nombre.trim()) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setSaving(true);
    try {
      await guardarCampos({
        nombre: form.nombre.trim(),
        tipo: form.tipo,
        descripcion: form.descripcion,
        codigo: form.codigo.trim() || null,
      });
      toast.success("Producto actualizado");
      setData(form);
      setEditing(false);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Error al guardar el producto"
      );
    } finally {
      setSaving(false);
    }
  };

  /**
   * Las categorías se guardan al elegirlas, sin pasar por *Editar*.
   *
   * Reagrupar un producto no es editarlo: es una etiqueta que se pone y se
   * saca mientras se ordena el catálogo, y obligar a entrar en modo edición
   * para eso convertía dos clics en cinco.
   */
  const guardarCategorias = async (ids: string[]) => {
    const previas = categoriaIds;
    setCategoriaIds(ids);
    try {
      await guardarCampos({ categoriaIds: ids });
      router.refresh();
    } catch (e) {
      setCategoriaIds(previas);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
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
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          {/* Faltaba: era la única ficha sin forma de volver al listado. */}
          <Link href={backHref}>
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{data.nombre}</h1>
            <p className="text-muted-foreground">
              {TIPO_LABEL[data.tipo] ?? data.tipo}
            </p>
          </div>
        </div>
        {!editing && (
          <Button variant="outline" onClick={startEdit}>
            <Pencil className="mr-1.5 h-4 w-4" />
            Editar
          </Button>
        )}
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
              {editing ? (
                <>
                  <div className="space-y-2">
                    <Label htmlFor="nombre">Nombre *</Label>
                    <Input
                      id="nombre"
                      value={form.nombre}
                      onChange={(e) =>
                        setForm({ ...form, nombre: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="codigo">Código</Label>
                    <Input
                      id="codigo"
                      value={form.codigo}
                      onChange={(e) =>
                        setForm({ ...form, codigo: e.target.value })
                      }
                      placeholder="Ej: MANT-01"
                    />
                    <p className="text-xs text-muted-foreground">
                      Sale impreso en la factura. Vacío, se usa uno derivado del
                      producto.
                      {servicio.tipo === "BIEN" &&
                        " En un bien manda el SKU de la variante, si lo tiene."}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="descripcion">Descripción</Label>
                    <Textarea
                      id="descripcion"
                      rows={4}
                      value={form.descripcion}
                      onChange={(e) =>
                        setForm({ ...form, descripcion: e.target.value })
                      }
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setEditing(false)}
                      disabled={saving}
                    >
                      Cancelar
                    </Button>
                    <Button onClick={save} disabled={saving}>
                      {saving ? "Guardando..." : "Guardar cambios"}
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      Código
                    </div>
                    <div className="font-mono text-sm">
                      {data.codigo || (
                        <span className="font-sans text-muted-foreground">
                          Sin código
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-muted-foreground">
                      Descripción
                    </div>
                    <div className="whitespace-pre-wrap">
                      {data.descripcion || (
                        <span className="text-muted-foreground">
                          Sin descripción
                        </span>
                      )}
                    </div>
                  </div>
                </>
              )}
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
              onCambio={(v) => setFilas([v])}
            />
          )}

          {/* Solo un bien: un servicio no tiene nada que combinar ni que contar. */}
          {servicio.tipo === "BIEN" && (
            <ProductoVariantes
              productoId={servicio.id}
              productoNombre={data.nombre}
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
                value={categoriaIds}
                onChange={guardarCategorias}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
