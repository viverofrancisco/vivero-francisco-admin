"use client";

import { useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InputNumero } from "@/components/ui/input-numero";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { RichText } from "@/components/ui/rich-text";
import { TablePagination } from "@/components/shared/table-pagination";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowUpToLine,
  GripVertical,
  ImageOff,
  Loader2,
  Plus,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useRegistrarCambios } from "@/components/shared/cambios-pendientes";
import { MediaLibrary, subirALaBiblioteca, type MediaItem } from "./media-library";
import { EditorImagen } from "./editor-imagen";
import { SelectorProductos, type ProductoElegible } from "./selector-productos";
import { money } from "@/components/ordenes/formato";
import { useAca } from "@/lib/filtros-url";

export interface CategoriaDetalle {
  id: string;
  nombre: string;
  orden: number;
  descripcion: string | null;
  imagen: { id: string; url: string; alt: string | null; nombre: string } | null;
  productos: ProductoElegible[];
}

const TIPO_LABEL: Record<string, string> = {
  SERVICIO: "Servicio",
  BIEN: "Bien",
};

/** Cuántos productos entran en una página de la lista. */
const POR_PAGINA = 50;

type Orden =
  | "MANUAL"
  | "AZ"
  | "ZA"
  | "PRECIO_ASC"
  | "PRECIO_DESC"
  | "NUEVOS"
  | "VIEJOS";

const ORDENES: { value: Orden; label: string }[] = [
  { value: "MANUAL", label: "Orden manual" },
  { value: "AZ", label: "Nombre A-Z" },
  { value: "ZA", label: "Nombre Z-A" },
  { value: "PRECIO_DESC", label: "Precio más alto" },
  { value: "PRECIO_ASC", label: "Precio más bajo" },
  { value: "NUEVOS", label: "Más nuevos" },
  { value: "VIEJOS", label: "Más viejos" },
];

/**
 * Ordena la lista para mostrarla.
 *
 * **El único orden que se guarda es el manual** (`ProductoCategoria.posicion`);
 * los demás son formas de mirar y viven acá. Por eso `MANUAL` devuelve el
 * arreglo tal cual: es el orden guardado, y arrastrar una fila lo cambia.
 *
 * Un servicio no tiene precio de lista, así que al ordenar por precio queda al
 * final en los dos sentidos: no es "cero", es "no tiene".
 */
function ordenar(productos: ProductoElegible[], orden: Orden): ProductoElegible[] {
  const copia = [...productos];
  const porNombre = (a: ProductoElegible, b: ProductoElegible) =>
    a.nombre.localeCompare(b.nombre, "es");
  const porPrecio = (a: ProductoElegible, b: ProductoElegible, desc: boolean) => {
    if (a.precio === null && b.precio === null) return porNombre(a, b);
    if (a.precio === null) return 1;
    if (b.precio === null) return -1;
    return desc ? b.precio - a.precio : a.precio - b.precio;
  };
  switch (orden) {
    case "ZA":
      return copia.sort((a, b) => porNombre(b, a));
    case "PRECIO_ASC":
      return copia.sort((a, b) => porPrecio(a, b, false));
    case "PRECIO_DESC":
      return copia.sort((a, b) => porPrecio(a, b, true));
    case "NUEVOS":
      return copia.sort((a, b) => b.creadoEl.localeCompare(a.creadoEl));
    case "VIEJOS":
      return copia.sort((a, b) => a.creadoEl.localeCompare(b.creadoEl));
    case "AZ":
      return copia.sort(porNombre);
    default:
      // MANUAL: tal como está, que es el orden guardado.
      return copia;
  }
}

/**
 * La ficha de una categoría, y también la de una nueva.
 *
 * Es el mismo formulario porque es el mismo trabajo: al crear una categoría ya
 * se sabe qué productos van adentro, y obligar a guardarla vacía para después
 * volver a abrirla era partir en dos algo que se piensa junto.
 *
 * **Todo se guarda con la barra del header**, incluidos los productos. Agregar
 * uno y que quede al toque parecía cómodo, pero deja a la mitad de la pantalla
 * guardando sola y a la otra mitad esperando — y no había forma de arrepentirse.
 */
export function CategoriaForm({
  categoria,
  backHref,
}: {
  /** `null` = una nueva. */
  categoria: CategoriaDetalle | null;
  backHref: string;
}) {
  const router = useRouter();
  const from = useAca();
  const [guardando, setGuardando] = useState(false);
  const [eligiendoFoto, setEligiendoFoto] = useState(false);
  const [recortando, setRecortando] = useState(false);
  const [agregando, setAgregando] = useState(false);
  const [subiendo, setSubiendo] = useState(false);
  const [arrastrando, setArrastrando] = useState(false);
  const [orden, setOrden] = useState<Orden>("MANUAL");
  /** Qué fila se está arrastrando, por su posición en la página visible. */
  const [arrastrada, setArrastrada] = useState<number | null>(null);
  /** Qué productos están marcados, para moverlos de a varios. */
  const [marcados, setMarcados] = useState<string[]>([]);
  const [moviendo, setMoviendo] = useState(false);
  const [aPosicion, setAPosicion] = useState("1");
  const [pagina, setPagina] = useState(1);
  const input = useRef<HTMLInputElement>(null);

  const guardado = {
    nombre: categoria?.nombre ?? "",
    descripcion: categoria?.descripcion ?? "",
    imagen: categoria?.imagen ?? null,
    productos: categoria?.productos ?? [],
  };
  const [form, setForm] = useState(guardado);

  // Lo que el servidor devolvió manda: sin esto la barra quedaba prendida
  // después de guardar, sobre una diferencia que ya no existía.
  const [ultimo, setUltimo] = useState(() => JSON.stringify(guardado));
  const actual = JSON.stringify(guardado);
  if (actual !== ultimo) {
    setUltimo(actual);
    setForm(guardado);
  }

  const esNueva = categoria === null;
  const hayCambios =
    form.nombre !== guardado.nombre ||
    form.descripcion !== guardado.descripcion ||
    (form.imagen?.id ?? null) !== (guardado.imagen?.id ?? null) ||
    // **En orden**, no como conjunto: reacomodar la lista es un cambio, porque
    // la posición es lo que se guarda.
    form.productos.map((p) => p.id).join() !==
      guardado.productos.map((p) => p.id).join();

  /**
   * Qué falta para poder guardar.
   *
   * El nombre y nada más: todo lo demás se puede completar después. Con esto la
   * barra muestra *Guardar* apagado y dice qué falta, en vez de dejar apretar
   * para contestar con un error.
   */
  const falta = form.nombre.trim() ? null : "Agrega un nombre para guardarla";

  const guardar = async () => {
    // La barra no deja apretar sin nombre; esto es el cinturón por si alguien
    // llega por otro lado.
    if (!form.nombre.trim()) return;
    setGuardando(true);
    try {
      const cuerpo = {
        nombre: form.nombre.trim(),
        orden: categoria?.orden ?? 0,
        descripcion: form.descripcion,
        mediaId: form.imagen?.id ?? null,
      };
      const res = await fetch(
        esNueva ? "/api/categorias" : `/api/categorias/${categoria.id}`,
        {
          method: esNueva ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(cuerpo),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error al guardar");

      // Los productos van aparte: es una relación, y en una categoría nueva no
      // hay id hasta que el POST responde.
      const id = esNueva ? body.id : categoria.id;
      const productoIds = form.productos.map((p) => p.id);
      if (
        esNueva
          ? productoIds.length > 0
          : productoIds.join() !== guardado.productos.map((p) => p.id).join()
      ) {
        const r2 = await fetch(`/api/categorias/${id}/productos`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ productoIds }),
        });
        if (!r2.ok) {
          throw new Error((await r2.json()).error ?? "Error con los productos");
        }
      }

      toast.success(esNueva ? "Categoría creada" : "Categoría actualizada");
      if (esNueva) {
        router.push(`/dashboard/productos/categorias/${id}`);
      } else {
        router.refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  /**
   * Creando, la barra está desde que se abre la pantalla.
   *
   * Una categoría nueva es, por definición, algo sin guardar: mostrar la barra
   * recién cuando alguien escribe algo esconde justo la acción que la pantalla
   * existe para ofrecer. Editando aparece cuando hay algo distinto, que es lo
   * que corresponde: ahí lo guardado ya existe.
   */
  useRegistrarCambios(
    esNueva || hayCambios,
    guardando,
    guardar,
    // Creando, descartar es irse: lo que se descarta es la categoría entera,
    // que todavía no existe, y limpiar campos vacíos no se ve. Editando sí es
    // volver a lo guardado, que es lo que hay.
    () => (esNueva ? router.push(backHref) : setForm(guardado)),
    falta
  );

  /** Sube y deja la foto elegida: subir y elegir son el mismo gesto acá. */
  const subirFoto = async (files: File[]) => {
    if (files.length === 0) return;
    setSubiendo(true);
    try {
      const [nueva] = await subirALaBiblioteca(files.slice(0, 1));
      if (nueva) elegirFoto([nueva]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos subir");
    } finally {
      setSubiendo(false);
      if (input.current) input.current.value = "";
    }
  };

  const elegirFoto = (elegidas: MediaItem[]) => {
    setEligiendoFoto(false);
    const foto = elegidas[0];
    if (!foto) return;
    setForm((f) => ({
      ...f,
      imagen: { id: foto.id, url: foto.url, alt: foto.alt, nombre: foto.nombre },
    }));
  };

  const manual = orden === "MANUAL";
  const ordenados = useMemo(
    () => ordenar(form.productos, orden),
    [form.productos, orden]
  );

  /**
   * Mueve lo marcado a una posición, contando desde 1 sobre la lista entera.
   *
   * Los marcados conservan **su orden relativo** y entran juntos: mover cinco
   * al principio no debería mezclarlos entre sí, que es lo que pasaría si cada
   * uno viajara por su cuenta.
   *
   * Existe porque arrastrar sirve para mover una fila dos lugares, no para
   * llevar diez del final al principio en una lista paginada.
   */
  const moverMarcados = (destino: number) => {
    if (marcados.length === 0) return;
    const sel = new Set(marcados);
    const movidos = form.productos.filter((p) => sel.has(p.id));
    const resto = form.productos.filter((p) => !sel.has(p.id));
    const i = Math.max(0, Math.min(destino - 1, resto.length));
    setForm({
      ...form,
      productos: [...resto.slice(0, i), ...movidos, ...resto.slice(i)],
    });
    setMarcados([]);
    setMoviendo(false);
  };

  /**
   * Cambia el criterio de orden.
   *
   * Al pasar **a manual, se queda con lo que está viendo**: si alguien ordenó
   * por precio y ahora quiere acomodar a mano, empezar desde el orden guardado
   * le haría perder justo el arreglo que fue a buscar. Queda como un cambio sin
   * guardar, que es lo que es: una propuesta de orden nuevo.
   */
  const elegirOrden = (nuevo: Orden) => {
    if (nuevo === "MANUAL" && orden !== "MANUAL") {
      setForm({ ...form, productos: ordenados });
    }
    setOrden(nuevo);
    setPagina(1);
    // Lo marcado era para moverlo, y fuera del orden manual no hay adónde.
    setMarcados([]);
  };

  /**
   * Mueve la fila arrastrada al lugar donde se soltó.
   *
   * Sobre `form.productos` y no sobre la página visible: el índice de la página
   * se traduce sumando lo que quedó atrás, así que arrastrar en la página tres
   * mueve lo que hay que mover y no lo de la primera.
   */
  const soltarEn = (destinoEnPagina: number) => {
    if (arrastrada === null || arrastrada === destinoEnPagina) return;
    const base = (actualPagina - 1) * POR_PAGINA;
    const lista = [...form.productos];
    const [movida] = lista.splice(base + arrastrada, 1);
    lista.splice(base + destinoEnPagina, 0, movida);
    setForm({ ...form, productos: lista });
    setArrastrada(null);
  };
  const paginas = Math.max(1, Math.ceil(ordenados.length / POR_PAGINA));
  const actualPagina = Math.min(pagina, paginas);
  const visibles = ordenados.slice(
    (actualPagina - 1) * POR_PAGINA,
    actualPagina * POR_PAGINA
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="min-w-0 truncate text-2xl font-bold tracking-tight">
          {form.nombre || (esNueva ? "Nueva categoría" : "Sin nombre")}
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
                  autoFocus={esNueva}
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

          {/* Agregar va **en la misma card** que la lista: sumar un producto y
              ver que entró son el mismo gesto, y un botón en el encabezado lo
              separaba de su resultado. */}
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">
                Productos
                <span className="ml-2 font-normal text-muted-foreground">
                  {form.productos.length}
                </span>
              </CardTitle>
              <CardAction>
                <div className="flex items-center gap-2">
                  {form.productos.length > 1 && (
                    <div className="w-40">
                      <CustomSelect
                        value={orden}
                        onChange={(v) => elegirOrden(v as Orden)}
                        options={ORDENES}
                      />
                    </div>
                  )}
                  {/* `h-9`, la del selector de al lado: dos controles en la
                      misma fila con alturas distintas se leen como un error. */}
                  <Button
                    type="button"
                    variant="outline"
                    className="h-9"
                    onClick={() => setAgregando(true)}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Agregar productos
                  </Button>
                </div>
              </CardAction>
            </CardHeader>
            <CardContent className="p-0">
              {form.productos.length === 0 ? (
                <p className="p-4 text-sm text-muted-foreground">
                  Todavía no hay ningún producto en esta categoría.
                </p>
              ) : (
                <>
                  {/* Solo con algo marcado: una barra siempre visible ocupando
                      lugar para decir "0 seleccionados" es ruido. */}
                  {manual && marcados.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/40 px-3 py-2">
                      <span className="text-sm">
                        {marcados.length}{" "}
                        {marcados.length === 1
                          ? "producto marcado"
                          : "productos marcados"}
                        <button
                          type="button"
                          onClick={() => setMarcados([])}
                          className="ml-2 text-primary hover:underline"
                        >
                          Desmarcar
                        </button>
                      </span>
                      <Popover open={moviendo} onOpenChange={setMoviendo}>
                        <PopoverTrigger
                          render={
                            <Button type="button" variant="outline" size="sm">
                              Mover
                            </Button>
                          }
                        />
                        <PopoverContent align="end" className="w-auto p-1.5">
                          <div className="space-y-0.5">
                            <button
                              type="button"
                              onClick={() => moverMarcados(1)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                            >
                              <ArrowUpToLine className="h-3.5 w-3.5" />
                              Al principio
                            </button>
                            <button
                              type="button"
                              onClick={() => moverMarcados(form.productos.length)}
                              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                            >
                              <ArrowDownToLine className="h-3.5 w-3.5" />
                              Al final
                            </button>
                            <div className="flex items-center gap-1.5 border-t px-2 pb-1 pt-2">
                              <span className="text-sm">A la posición</span>
                              <InputNumero
                                value={aPosicion}
                                onChange={setAPosicion}
                                onKeyDown={(e) => {
                                  if (e.key !== "Enter") return;
                                  e.preventDefault();
                                  moverMarcados(Number(aPosicion));
                                }}
                                className="h-8 w-20 text-right tabular-nums"
                              />
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => moverMarcados(Number(aPosicion))}
                                disabled={
                                  !Number.isInteger(Number(aPosicion)) ||
                                  Number(aPosicion) < 1
                                }
                              >
                                Mover
                              </Button>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  )}
                  <ul className="divide-y">
                    {visibles.map((p, i) => (
                      <li
                        key={p.id}
                        // Arrastrar solo en orden manual: en cualquier otro, la
                        // fila volvería a su lugar al soltar y el gesto sería
                        // una promesa que la lista no cumple.
                        draggable={manual}
                        onDragStart={() => setArrastrada(i)}
                        onDragOver={(e) => manual && e.preventDefault()}
                        onDrop={() => soltarEn(i)}
                        onDragEnd={() => setArrastrada(null)}
                        className={`flex items-center gap-3 px-3 py-2.5 ${
                          manual ? "cursor-grab active:cursor-grabbing" : ""
                        } ${arrastrada === i ? "opacity-40" : ""}`}
                      >
                        {manual && (
                          <>
                            <GripVertical className="h-4 w-4 flex-none text-muted-foreground" />
                            <Checkbox
                              checked={marcados.includes(p.id)}
                              onCheckedChange={(v) =>
                                setMarcados((prev) =>
                                  v
                                    ? [...prev, p.id]
                                    : prev.filter((x) => x !== p.id)
                                )
                              }
                              aria-label={`Marcar ${p.nombre}`}
                              className="flex-none"
                            />
                            {/* El número es la posición en la lista entera, no
                                en la página: es con lo que alguien dice "movelo
                                al 30". */}
                            <span className="w-7 flex-none text-right text-xs tabular-nums text-muted-foreground">
                              {(actualPagina - 1) * POR_PAGINA + i + 1}.
                            </span>
                          </>
                        )}
                        <Miniatura url={p.imagenUrl} />
                        {/* Un producto recién agregado todavía no está guardado
                            en la categoría, pero sí existe: el enlace a su ficha
                            vale igual. */}
                        <Link
                          href={`/dashboard/productos/${p.id}?from=${from}`}
                          className="min-w-0 flex-1"
                        >
                          <span className="block truncate text-sm font-medium hover:underline">
                            {p.nombre}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {TIPO_LABEL[p.tipo] ?? p.tipo}
                            {p.estado === "BORRADOR" && " · Borrador"}
                          </span>
                        </Link>
                        <span className="flex-none text-sm tabular-nums text-muted-foreground">
                          {p.precio === null
                            ? "—"
                            : p.precio === 0
                              ? "Gratis"
                              : money(p.precio)}
                        </span>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Sacar ${p.nombre} de la categoría`}
                          onClick={() =>
                            setForm({
                              ...form,
                              productos: form.productos.filter(
                                (x) => x.id !== p.id
                              ),
                            })
                          }
                        >
                          <X className="h-4 w-4 text-muted-foreground" />
                        </Button>
                      </li>
                    ))}
                  </ul>
                  {ordenados.length > POR_PAGINA && (
                    <TablePagination
                      page={actualPagina}
                      total={ordenados.length}
                      porPagina={POR_PAGINA}
                      onPageChange={setPagina}
                      sustantivo="producto"
                      plural="productos"
                    />
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Foto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Soltar el archivo encima es el gesto más corto que hay. Los dos
                caminos siguen: subir del disco, o elegir de la biblioteca. */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setArrastrando(true);
              }}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                subirFoto([...e.dataTransfer.files]);
              }}
              className={`relative aspect-square overflow-hidden rounded-md border-2 border-dashed transition-colors ${
                arrastrando ? "border-primary bg-primary/5" : "border-muted"
              }`}
            >
              {form.imagen ? (
                /* Tocarla la abre para editarla: es lo que se quiere hacer con
                   una foto que se está mirando, y un botón aparte era un blanco
                   más chico para la acción más frecuente. */
                <button
                  type="button"
                  onClick={() => setRecortando(true)}
                  className="block h-full w-full"
                  aria-label="Editar la foto"
                >
                  <Image
                    src={form.imagen.url}
                    alt={form.imagen.alt ?? ""}
                    fill
                    sizes="300px"
                    className="object-cover"
                    unoptimized
                  />
                </button>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1 text-muted-foreground">
                  {subiendo ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : (
                    <>
                      <ImageOff className="h-6 w-6" />
                      <span className="text-xs">Arrastra una imagen aquí</span>
                    </>
                  )}
                </div>
              )}
            </div>

            <input
              ref={input}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files && subirFoto([...e.target.files])}
            />
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1"
                disabled={subiendo}
                onClick={() => input.current?.click()}
              >
                Subir
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="flex-1 text-primary hover:bg-transparent hover:underline"
                onClick={() => setEligiendoFoto(true)}
              >
                Elegir existente
              </Button>
            </div>
            {form.imagen && (
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="flex-1 text-muted-foreground"
                  onClick={() => setForm({ ...form, imagen: null })}
                >
                  Sacar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {recortando && form.imagen && (
        <EditorImagen
          media={{
            id: form.imagen.id,
            url: form.imagen.url,
            alt: form.imagen.alt,
          }}
          onCerrar={() => setRecortando(false)}
          onGuardado={(nueva) => {
            setRecortando(false);
            // Como cualquier cambio de la ficha: queda sin guardar hasta que
            // alguien apriete la barra de arriba.
            elegirFoto([nueva]);
          }}
        />
      )}

      {eligiendoFoto && (
        <MediaLibrary
          yaUsadas={[]}
          unaSola
          onCerrar={() => setEligiendoFoto(false)}
          onElegirItems={elegirFoto}
        />
      )}

      {agregando && (
        <SelectorProductos
          excluir={form.productos.map((p) => p.id)}
          onCerrar={() => setAgregando(false)}
          onElegir={(nuevos) => {
            setAgregando(false);
            setForm((f) => ({ ...f, productos: [...f.productos, ...nuevos] }));
          }}
        />
      )}
    </div>
  );
}

function Miniatura({ url }: { url: string | null }) {
  return (
    <div className="relative h-9 w-9 flex-none overflow-hidden rounded border bg-muted">
      {url ? (
        <Image src={url} alt="" fill sizes="36px" className="object-cover" unoptimized />
      ) : (
        <span className="flex h-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-3.5 w-3.5" />
        </span>
      )}
    </div>
  );
}
