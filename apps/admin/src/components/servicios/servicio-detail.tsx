"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { RichText } from "@/components/ui/rich-text";
import { CustomSelect } from "@/components/ui/custom-select";
import { SelectorCategorias } from "./selector-categorias";
import { ProductoImagenes, type ImagenProducto } from "./producto-imagenes";
import { ProductoInventario } from "./producto-inventario";
import {
  ProductoVariantes,
  type OpcionEditable,
  type VarianteFila,
  type VariantePendiente,
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


  /** Si ya se puede vender. Un borrador no aparece en los selectores. */
  estado: "ACTIVO" | "BORRADOR";
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
    /**
     * Las fotos, en orden. Van en el formulario como todo lo demás: agregar,
     * sacar, reordenar y recortar quedan pendientes hasta que alguien guarda.
     */
    imagenes,
    descripcion: servicio.descripcion ?? "",
    estado: servicio.estado,
    categoriaIds: servicio.categoriaIds,
    opciones,
    /**
     * El precio y el stock con los que nacen las combinaciones **nuevas**, por
     * su nombre ("Rojo · Chica"). Viven acá y no en la tabla porque se aplican
     * al guardar, cuando el servidor ya las creó y les dio un id.
     */
    nuevas: {} as Record<string, VariantePendiente>,
    /** Precios cambiados en la tabla, por variante. */
    precios: {} as Record<string, number>,
    /** SKU cambiados en la tabla, por variante. */
    skus: {} as Record<string, string>,
    /**
     * Movimientos de stock sin guardar, uno por variante. Uno solo: dos sobre
     * la misma variante antes de guardar no se acumulan.
     */
    movimientos: {} as Record<
      string,
      { motivo: "CONTEO" | "AJUSTE" | "INGRESO"; valor: number; nota: string | null }
    >,
  };
  const [form, setForm] = useState(guardado);

  /**
   * Re-sincroniza el formulario cuando el servidor manda otra cosa.
   *
   * Sin esto, `form` quedaba con lo que había **antes** de guardar y `guardado`
   * con lo que el servidor devolvió: cualquier normalización suya —la
   * descripción saneada, un código en blanco que vuelve `null`— dejaba la barra
   * de *Cambios sin guardar* prendida para siempre, sobre un cambio que ya
   * estaba guardado.
   *
   * Se compara por forma y se resetea en el render, que es lo que React
   * recomienda para derivar estado de props sin un efecto que pinte dos veces.
   */
  const [ultimo, setUltimo] = useState(() => JSON.stringify(guardado));
  const actual = JSON.stringify(guardado);
  if (actual !== ultimo) {
    setUltimo(actual);
    setForm(guardado);
  }

  const hayCambios =
    form.nombre !== guardado.nombre ||
    form.descripcion !== guardado.descripcion ||
    form.estado !== guardado.estado ||
    form.categoriaIds.join() !== guardado.categoriaIds.join() ||
    // Por id de fila **y** por archivo: mover una es un cambio, y recortarla
    // deja la fila donde está pero apuntando a otra imagen.
    form.imagenes.map((i) => `${i.id}:${i.mediaId}`).join() !==
      guardado.imagenes.map((i) => `${i.id}:${i.mediaId}`).join() ||
    // Por su forma y no por identidad: el editor rearma el arreglo en cada
    // tecla, así que comparar referencias diría "cambió" siempre.
    JSON.stringify(form.opciones) !== JSON.stringify(guardado.opciones) ||
    Object.keys(form.nuevas).length > 0 ||
    Object.keys(form.precios).length > 0 ||
    Object.keys(form.skus).length > 0 ||
    Object.keys(form.movimientos).length > 0;

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

  /**
   * Los ejes, si cambiaron. Van en su propio pedido porque **regeneran las
   * variantes**: no son un campo del producto sino una operación estructural,
   * y el servidor puede rechazarla si el cambio borra variantes con stock.
   */
  const guardarOpciones = async (descartarVariantes = false): Promise<void> => {
    const res = await fetch(`/api/servicios/${servicio.id}/opciones`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ opciones: form.opciones, descartarVariantes }),
    });
    const body = await res.json();
    if (res.ok) {
      await estrenarVariantes(body.variantes ?? []);
      return;
    }
    // 409 = el cambio borra variantes con inventario. El servidor dice cuáles
    // y con cuánto; acá solo hace falta el sí.
    if (res.status === 409 && !descartarVariantes) {
      if (!confirm(`${body.error}\n\n¿Seguir igual?`)) {
        throw new Error("cancelado");
      }
      return guardarOpciones(true);
    }
    throw new Error(body.error ?? "Error al guardar las opciones");
  };

  /**
   * Les pone el precio y el stock a las combinaciones que acaban de nacer.
   *
   * Se las reconoce por su nombre —"Rojo · Chica"— porque es lo único que la
   * pantalla tenía antes de guardar: los ids recién existen ahora. Dentro de un
   * producto los valores de un eje son únicos, así que el nombre alcanza.
   *
   * El stock entra como un movimiento y no como un número escrito encima: es la
   * primera vez que hay algo, y el libro tiene que empezar diciéndolo.
   */
  const estrenarVariantes = async (
    variantes: { id: string; valores: string[] }[]
  ) => {
    const pendientes = Object.entries(form.nuevas);
    if (pendientes.length === 0) return;

    const porNombre = new Map(
      variantes.map((v) => [v.valores.join(" · "), v.id])
    );
    for (const [nombre, valores] of pendientes) {
      const id = porNombre.get(nombre);
      if (!id) continue;
      if (valores.precio > 0 || valores.sku.trim()) {
        await fetch(`/api/variantes/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...(valores.precio > 0 ? { precio: valores.precio } : {}),
            ...(valores.sku.trim() ? { sku: valores.sku.trim() } : {}),
          }),
        });
      }
      if (valores.stock > 0) {
        await fetch(`/api/variantes/${id}/movimientos`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            motivo: "INGRESO",
            cantidad: valores.stock,
            nota: "Stock inicial",
          }),
        });
      }
    }
    setForm((f) => ({ ...f, nuevas: {} }));
  };

  /**
   * Aplica lo que se escribió sobre variantes que **ya existen**.
   *
   * El precio es un valor y va por `PATCH`; el stock es un **movimiento** y va
   * al libro con su motivo. Por eso se guardan por caminos distintos aunque en
   * la pantalla se hayan tocado en la misma fila.
   */
  /**
   * La galería entera, en un solo pedido.
   *
   * Se manda la lista con el id de cada fila para que el servidor conserve las
   * que siguen —y con ellas la foto que cada variante había elegido— en vez de
   * borrar y recrear.
   */
  const guardarGaleria = async () => {
    const igual =
      form.imagenes.map((i) => `${i.id}:${i.mediaId}`).join() ===
      imagenes.map((i) => `${i.id}:${i.mediaId}`).join();
    if (igual) return;
    const res = await fetch(`/api/servicios/${servicio.id}/imagenes`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        // Las agregadas todavía no tienen fila: van sin id y el servidor la
        // crea. Se reconocen porque su id es el de la media.
        imagenes: form.imagenes.map((i) => ({
          id: i.id === i.mediaId ? null : i.id,
          mediaId: i.mediaId,
        })),
      }),
    });
    if (!res.ok) {
      throw new Error((await res.json()).error ?? "Error con las fotos");
    }
  };

  const guardarCambiosDeVariantes = async () => {
    for (const [id, sku] of Object.entries(form.skus)) {
      const r = await fetch(`/api/variantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Vacío es "sin SKU", no cadena vacía: el índice único no admite dos
        // cadenas vacías, y "sin código" es un estado válido.
        body: JSON.stringify({ sku: sku.trim() || null }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error con un SKU");
    }
    for (const [id, precio] of Object.entries(form.precios)) {
      const r = await fetch(`/api/variantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precio }),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error con un precio");
    }
    for (const [id, m] of Object.entries(form.movimientos)) {
      const r = await fetch(`/api/variantes/${id}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          m.motivo === "CONTEO"
            ? { motivo: m.motivo, contado: m.valor, nota: m.nota }
            : {
                motivo: m.motivo,
                cantidad: m.motivo === "INGRESO" ? Math.abs(m.valor) : m.valor,
                nota: m.nota,
              }
        ),
      });
      if (!r.ok) throw new Error((await r.json()).error ?? "Error con el stock");
    }
    setForm((f) => ({ ...f, precios: {}, skus: {}, movimientos: {} }));
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
          estado: form.estado,
          categoriaIds: form.categoriaIds,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Error al guardar el producto");
      }
      if (
        JSON.stringify(form.opciones) !== JSON.stringify(opciones) ||
        Object.keys(form.nuevas).length > 0
      ) {
        await guardarOpciones();
      }
      await guardarGaleria();
      await guardarCambiosDeVariantes();
      toast.success("Producto actualizado");
      // El servidor es el que dice qué quedó guardado: `router.refresh()` trae
      // la ficha de nuevo y `guardado` vuelve a coincidir con el formulario.
      router.refresh();
    } catch (e) {
      // El "no" de la confirmación no es un error que haya que mostrar.
      if (e instanceof Error && e.message === "cancelado") return;
      toast.error(
        e instanceof Error ? e.message : "Error al guardar el producto"
      );
    } finally {
      setGuardando(false);
    }
  };

  // La barra de guardar vive en el header, en lugar del buscador.
  useRegistrarCambios(hayCambios, guardando, guardar, () => setForm(guardado));

  /**
   * Con una sola variante —todo servicio, y un bien sin opciones— lo que se
   * vende es, a los ojos de quien mira, el producto: su precio, su SKU y su
   * stock van en una card y no en una tabla de una fila. Con opciones cada
   * combinación tiene lo suyo y esta card desaparece.
   */
  const varianteUnica =
    // Por lo que hay **en el formulario**, no por lo guardado: al agregar la
    // primera opción el SKU, el precio y el stock pasan a ser de cada
    // combinación, y esta card tiene que irse en ese momento y no al guardar.
    form.opciones.length === 0 && filas.length === 1 ? filas[0] : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        {/* Faltaba: era la única ficha sin forma de volver al listado. */}
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {form.nombre || "Sin nombre"}
        </h1>
        {/* El estado al lado del título: es lo primero que hay que saber de un
            producto, y archivado gana porque es el que explica todo lo demás. */}
        <EstadoBadge
          archivado={servicio.archivadoEl !== null}
          estado={form.estado}
        />
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
              <div className="space-y-2">
                <Label htmlFor="nombre">Nombre *</Label>
                <Input
                  id="nombre"
                  value={form.nombre}
                  onChange={(e) => setForm({ ...form, nombre: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Descripción</Label>
                <RichText
                  value={form.descripcion}
                  onChange={(html) => setForm({ ...form, descripcion: html })}
                />
              </div>
            </CardContent>
          </Card>

          {/* Los cambios de la galería viajan al formulario y se guardan con
              la barra de arriba, como todo lo demás de la ficha. */}
          <ProductoImagenes
            imagenes={form.imagenes}
            onCambio={(imagenes) => setForm({ ...form, imagenes })}
          />

          {/* Debajo de las fotos, como en Shopify: primero qué es y cómo se
              ve, después cuánto vale y con qué código sale. */}
          {varianteUnica && (
            <ProductoInventario
              productoId={servicio.id}
              variante={varianteUnica}
              esBien={servicio.tipo === "BIEN"}
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
              opciones={form.opciones}
              onOpcionesChange={(o) => setForm({ ...form, opciones: o })}
              nuevas={form.nuevas}
              onNuevasChange={(n) => setForm({ ...form, nuevas: n })}
              precios={form.precios}
              onPreciosChange={(p) => setForm({ ...form, precios: p })}
              skus={form.skus}
              onSkusChange={(sk) => setForm({ ...form, skus: sk })}
              movimientos={form.movimientos}
              onMovimientosChange={(m) => setForm({ ...form, movimientos: m })}
              variantes={filas}
              imagenes={form.imagenes}
            />
          )}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Estado</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <CustomSelect
                value={form.estado}
                onChange={(v) =>
                  setForm({ ...form, estado: v as "ACTIVO" | "BORRADOR" })
                }
                options={[
                  { value: "ACTIVO", label: "Activo" },
                  {
                    value: "BORRADOR",
                    label: "Borrador",
                    hint: "No aparece al armar una orden",
                  },
                ]}
              />
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground">Tipo</div>
                {/* Inmutable: cambiarlo dejaría suscripciones, visitas y líneas
                    de orden con una semántica que ya no corresponde. */}
                <div className="text-sm">
                  {TIPO_LABEL[servicio.tipo] ?? servicio.tipo}
                </div>
              </div>
            </CardContent>
          </Card>

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
    </div>
  );
}

/** Qué estado se ve al lado del título. Archivado gana: explica todo lo demás. */
function EstadoBadge({
  archivado,
  estado,
}: {
  archivado: boolean;
  estado: "ACTIVO" | "BORRADOR";
}) {
  const [texto, clases] = archivado
    ? ["Archivado", "border-amber-200 bg-amber-50 text-amber-900"]
    : estado === "BORRADOR"
      ? ["Borrador", "border-border bg-muted text-muted-foreground"]
      : ["Activo", "border-primary/20 bg-primary/10 text-primary"];

  return (
    <span
      className={`flex-none rounded-full border px-2 py-0.5 text-xs font-medium ${clases}`}
    >
      {texto}
    </span>
  );
}
