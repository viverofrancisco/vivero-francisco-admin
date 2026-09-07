"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputNumero } from "@/components/ui/input-numero";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import { RichText } from "@/components/ui/rich-text";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { SelectorCategorias } from "./selector-categorias";
import {
  ProductoVariantes,
  type OpcionEditable,
  type VariantePendiente,
} from "./producto-variantes";
import {
  ProductoImagenes,
  type ImagenProducto,
} from "./producto-imagenes";
import { ArrowLeft } from "lucide-react";

interface Categoria {
  id: string;
  nombre: string;
}

/** Una de las dos opciones del primer paso. */
function ElegirTipo({
  titulo,
  detalle,
  nota,
  onClick,
}: {
  titulo: string;
  detalle: string;
  nota: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-full flex-col rounded-lg border bg-card p-4 text-left transition-colors hover:border-primary hover:bg-primary/5"
    >
      <p className="font-medium">{titulo}</p>
      {/* El detalle crece y la nota queda abajo: así las dos tarjetas alinean
          sus títulos y sus notas aunque el texto del medio ocupe distinto. */}
      <p className="mt-1 flex-1 text-sm text-muted-foreground">{detalle}</p>
      <p className="mt-2 text-xs text-muted-foreground">{nota}</p>
    </button>
  );
}

/**
 * Dar de alta un producto: la misma pantalla que su ficha, pero vacía.
 *
 * **Solo el nombre hace falta.** Todo lo demás se puede completar después, en la
 * ficha, y exigirlo acá obliga a decidir el código, la categoría y el IVA antes
 * de tener el producto — cuando muchas veces se lo está creando justo para poder
 * seguir con otra cosa.
 *
 * Lo que **no** está acá son las fotos, el inventario y las variantes: todas
 * necesitan un producto ya creado al que colgarse. Aparecen en la ficha, adonde
 * se llega al guardar.
 *
 * Se guarda desde la barra de arriba, igual que en la ficha: no hay un botón
 * *Crear* al pie porque entonces habría dos formas de guardar un producto según
 * en qué pantalla se esté.
 */
export function ServicioForm({
  categorias,
  tipoInicial,
}: {
  categorias: Categoria[];
  /** Lo eligió el diálogo del listado. Sin esto, la pantalla lo pregunta. */
  tipoInicial?: "SERVICIO" | "BIEN";
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);

  /**
   * Qué se está creando. **Se elige antes de la ficha.**
   *
   * Es lo único del producto que no se puede cambiar después —cambiarlo dejaría
   * suscripciones, visitas y líneas de orden con una semántica que ya no
   * corresponde— así que preguntarlo primero es tratarlo como lo que es: una
   * decisión, y no un campo más perdido entre otros diez que sí se editan.
   *
   * Y la ficha depende de la respuesta: un bien tiene precio, stock y
   * variantes; un servicio, ninguna de las tres. Sabiéndolo de entrada, la
   * pantalla muestra los campos que corresponden en vez de todos.
   */
  const [tipo, setTipo] = useState<"SERVICIO" | "BIEN" | null>(
    tipoInicial ?? null,
  );

  const vacio = {
    nombre: "",
    codigo: "",
    descripcion: "",
    estado: "ACTIVO" as "ACTIVO" | "BORRADOR",
    categoriaIds: [] as string[],
    /**
     * Las fotos elegidas antes de que el producto exista.
     *
     * Se puede porque la **biblioteca es independiente del producto**: subir
     * una foto la deja en `Media`, y recién `ProductoImagen` la ata a un
     * producto. Así que acá se juntan y se vinculan apenas el POST devuelve el
     * id — el mismo camino en dos pasos que usa la categoría con sus productos.
     */
    imagenes: [] as ImagenProducto[],
    /**
     * Lo de la variante única, solo para un bien.
     *
     * Se completa acá y se aplica apenas el producto existe: son sus datos, y
     * pedirlos en una segunda pantalla partía en dos lo que se piensa junto.
     * Las **opciones** sí quedan para después, y no por comodidad: agregar una
     * opción reemplaza esta variante por las combinaciones, así que configurar
     * su precio y su stock en la misma pantalla donde se la puede borrar sería
     * pedir dos cosas que se contradicen.
     */
    precio: "",
    cobraIva: true,
    manejaInventario: true,
    stock: "",
    /**
     * Las opciones del bien y, por nombre de combinación, con qué precio y
     * stock nacen.
     *
     * Se pueden armar antes de guardar porque el editor de variantes es puro
     * estado: no toca el servidor. Al guardar se manda la lista de opciones, el
     * servidor genera las combinaciones y recién ahí cada una recibe lo suyo —
     * por nombre, que es lo único que existe de una variante que todavía no fue
     * creada.
     */
    opciones: [] as OpcionEditable[],
    nuevas: {} as Record<string, VariantePendiente>,
  };
  const [form, setForm] = useState(vacio);

  /**
   * La barra está desde que se abre la pantalla.
   *
   * Un producto nuevo es, por definición, algo sin guardar: mostrar la barra
   * recién cuando alguien escribe algo esconde justo la acción que la pantalla
   * existe para ofrecer. Con el nombre vacío el botón se ve, pero apagado y
   * diciendo qué falta — antes se podía apretar y saltaba un error.
   */
  const falta = form.nombre.trim() ? null : "Agrega un nombre para guardarlo";

  /**
   * Lo que cada combinación recién creada trae puesto.
   *
   * Se emparejan **por nombre** ("Rojo · Grande") porque hasta que el servidor
   * no las genera no tienen id: lo que se cargó en pantalla está indexado por
   * lo único que existía en ese momento.
   */
  async function estrenarVariantes(
    variantes: { id: string; valores: string[] }[],
  ) {
    const porNombre = new Map(
      variantes.map((v) => [v.valores.join(" · "), v.id]),
    );
    for (const [nombre, valores] of Object.entries(form.nuevas)) {
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
  }

  async function guardar() {
    // La barra no deja apretar sin nombre; esto es el cinturón por si alguien
    // llega por otro lado.
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const res = await fetch("/api/servicios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre: form.nombre.trim(),
          // Vacío es vacío, no cadena vacía: el código es único y dos productos
          // con "" chocarían entre sí.
          codigo: form.codigo.trim() || null,
          descripcion: form.descripcion || null,
          tipo,
          estado: form.estado,
          categoriaIds: form.categoriaIds,
        }),
      });
      const data: { id?: string; varianteId?: string | null; error?: string } =
        await res.json();
      if (!res.ok || !data.id) {
        throw new Error(data.error ?? "No pudimos crearlo");
      }
      // Con opciones, la variante única se reemplaza por las combinaciones:
      // el precio y el stock de arriba dejan de aplicar, y cada combinación
      // recibe el suyo. Sin opciones, se configura la única.
      const conOpciones = tipo === "BIEN" && form.opciones.length > 0;
      if (conOpciones) {
        const r = await fetch(`/api/servicios/${data.id}/opciones`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ opciones: form.opciones }),
        });
        const body = await r.json();
        if (!r.ok) {
          throw new Error(
            body.error ?? "El producto se creó, pero sin las opciones",
          );
        }
        await estrenarVariantes(body.variantes ?? []);
      }

      // Lo de la variante, si es un bien sin opciones y se cargó algo. El
      // servidor la creó junto con el producto y devolvió su id.
      const precio = Number(form.precio);
      const stock = Number(form.stock);
      if (tipo === "BIEN" && !conOpciones && data.varianteId) {
        await fetch(`/api/variantes/${data.varianteId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            precio: form.precio.trim() && precio >= 0 ? precio : 0,
            cobraIva: form.cobraIva,
            manejaInventario: form.manejaInventario,
          }),
        });
        // El stock entra por el libro, nunca escribiéndole encima: un número
        // que cambia sin dejar rastro no se puede discutir después.
        if (form.manejaInventario && form.stock.trim() && stock > 0) {
          await fetch(`/api/variantes/${data.varianteId}/movimientos`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // `cantidad` y no `valor`: un INGRESO dice **cuánto entró**. El
            // CONTEO es el que manda `contado`, o sea cuánto hay.
            body: JSON.stringify({
              motivo: "INGRESO",
              cantidad: stock,
              nota: "Carga inicial",
            }),
          });
        }
      }

      // Las fotos van aparte: son una relación, y hasta que el POST no
      // responde no hay id al que atarlas.
      if (form.imagenes.length > 0) {
        const r2 = await fetch(`/api/servicios/${data.id}/imagenes`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mediaIds: form.imagenes.map((m) => m.mediaId),
          }),
        });
        if (!r2.ok) {
          throw new Error(
            (await r2.json()).error ??
              "El producto se creó, pero sin las fotos",
          );
        }
      }

      toast.success("Producto creado");
      // A su ficha y no al listado: recién ahí están las fotos, las variantes y
      // el inventario, que es lo que sigue después de darlo de alta.
      router.push(`/dashboard/productos/${data.id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crearlo");
      setGuardando(false);
    }
  }

  /**
   * Descartar vuelve al listado.
   *
   * Limpiar el formulario era peor que no hacer nada: con la pantalla recién
   * abierta no cambiaba nada visible, y el botón parecía roto. Acá lo que se
   * descarta es el producto entero, que todavía no existe — así que la salida
   * es irse.
   */
  useRegistrarCambios(
    true,
    guardando,
    guardar,
    () => router.push("/dashboard/productos"),
    falta,
  );

  if (tipo === null) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/productos">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">Nuevo producto</h1>
        </div>

        <div className="max-w-2xl space-y-4">
          <p className="text-sm text-muted-foreground">
            ¿Qué vas a cargar? No se puede cambiar después, y de esto depende lo
            que se le puede poner.
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <ElegirTipo
              titulo="Servicio"
              detalle="Un trabajo o una mano de obra."
              nota="No se cuenta ni se guarda: no lleva inventario."
              onClick={() => setTipo("SERVICIO")}
            />
            <ElegirTipo
              titulo="Bien"
              detalle="Un producto físico que se entrega."
              nota="Se cuenta, y puede venir en variantes: color, tamaño."
              onClick={() => setTipo("BIEN")}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard/productos">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        {/* El nombre a medida que se escribe, como en la ficha: la pantalla es
            la misma y el título tiene que comportarse igual. */}
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {form.nombre.trim() || "Nuevo producto"}
        </h1>
      </div>

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
                  placeholder="Ej: Poda de setos"
                  autoFocus
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

          {/* La misma galería que la ficha, en modo sin producto: agregar,
              reordenar, recortar y sacar quedan en el formulario y se guardan
              con el resto. */}
          <ProductoImagenes
            imagenes={form.imagenes}
            onCambio={(imagenes) => setForm({ ...form, imagenes })}
          />

          {/* Debajo de las fotos, en el mismo lugar que en la ficha — y solo
              mientras haya una sola variante: al agregar una opción el SKU pasa
              a ser de cada combinación, igual que el precio y el stock. */}
          {form.opciones.length === 0 && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">SKU</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                <Input
                  id="codigo"
                  value={form.codigo}
                  onChange={(e) => setForm({ ...form, codigo: e.target.value })}
                  placeholder="—"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  Sale impreso en la factura y es lo que va en la etiqueta.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Sin opciones hay una sola variante y su precio y su stock son,
              a los ojos de quien mira, los del producto. Al agregar una opción
              pasan a ser de cada combinación y esta card desaparece. */}
          {tipo === "BIEN" && form.opciones.length === 0 && (
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Precio e inventario</CardTitle>
                <CardAction>
                  <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                    Se cuenta
                    <Switch
                      checked={form.manejaInventario}
                      onCheckedChange={(on) =>
                        setForm({ ...form, manejaInventario: on })
                      }
                    />
                  </label>
                </CardAction>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="precio">Precio</Label>
                    <InputNumero
                      id="precio"
                      decimales
                      value={form.precio}
                      onChange={(precio) => setForm({ ...form, precio })}
                      placeholder="0.00"
                      className="text-right tabular-nums"
                    />
                    {/* Es una propuesta: al armar la orden se ofrece este y se
                        puede cambiar ahí, y lo cobrado queda en la línea. */}
                    <p className="text-xs text-muted-foreground">
                      Se propone al armar una orden y se puede cambiar ahí.
                    </p>
                  </div>
                  {form.manejaInventario && (
                    <div className="space-y-1.5">
                      <Label htmlFor="stock">Stock inicial</Label>
                      <InputNumero
                        id="stock"
                        value={form.stock}
                        onChange={(stock) => setForm({ ...form, stock })}
                        placeholder="0"
                        className="text-right tabular-nums"
                      />
                      <p className="text-xs text-muted-foreground">
                        Queda anotado como un ingreso en el libro.
                      </p>
                    </div>
                  )}
                </div>
                <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
                  <span>Cobrar IVA</span>
                  <Switch
                    checked={form.cobraIva}
                    onCheckedChange={(on) => setForm({ ...form, cobraIva: on })}
                  />
                </label>
              </CardContent>
            </Card>
          )}

          {/* Las opciones, igual que en la ficha. Al agregar una, la variante
              única se reemplaza por las combinaciones y cada una lleva su
              propio precio y su propio stock — por eso la card de arriba deja
              de aplicar y se oculta. */}
          {tipo === "BIEN" && (
            <ProductoVariantes
              productoId={null}
              productoNombre={form.nombre}
              opciones={form.opciones}
              onOpcionesChange={(opciones) => setForm({ ...form, opciones })}
              nuevas={form.nuevas}
              onNuevasChange={(nuevas) => setForm({ ...form, nuevas })}
              precios={{}}
              onPreciosChange={() => {}}
              skus={{}}
              onSkusChange={() => {}}
              movimientos={{}}
              onMovimientosChange={() => {}}
              variantes={[]}
              imagenes={[]}
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
              {/* Ya elegido en el paso anterior, y no se cambia: se muestra
                  como en la ficha, que es donde va a estar siempre. */}
              <div className="border-t pt-3">
                <div className="text-xs text-muted-foreground">Tipo</div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm">
                    {tipo === "BIEN" ? "Bien" : "Servicio"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 text-xs text-muted-foreground hover:bg-transparent hover:underline"
                    onClick={() => setTipo(null)}
                  >
                    Cambiar
                  </Button>
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
