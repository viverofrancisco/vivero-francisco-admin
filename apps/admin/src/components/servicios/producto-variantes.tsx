"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  ArrowLeftRight,
  ChevronDown,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useAca } from "@/lib/filtros-url";
import { MovimientoDialog } from "./movimiento-dialog";
import { money } from "@/components/ordenes/formato";
import type { ImagenProducto } from "./producto-imagenes";

/** Cuántos ejes admite un producto. El servicio aplica el mismo tope. */
const MAX_OPCIONES = 3;

export interface OpcionEditable {
  id: string | null;
  nombre: string;
  valores: { id: string | null; valor: string }[];
}

export interface VarianteFila {
  id: string;
  sku: string | null;
  /** Precio de lista. Cero es gratis; lo cobrado vive en la orden. */
  precio: number;
  /** Si se le cobra IVA. La tasa sale del producto. */
  cobraIva: boolean;
  manejaInventario: boolean;
  stock: number;
  permiteNegativo: boolean;
  imagenId: string | null;
  valores: { opcion: string; valor: string }[];
}

/**
 * Cómo se lee un precio. **Cero es gratis**, y decirlo con la palabra en vez de
 * "$0.00" es lo que hace que salte a la vista: casi siempre significa que
 * todavía nadie le puso precio.
 */
function precioTexto(precio: number): string {
  return precio === 0 ? "Gratis" : money(precio);
}

/**
 * El precio de un grupo: uno solo, o el rango que va del más barato al más caro.
 *
 * Es lo que Shopify muestra en la fila del grupo, y es la única respuesta
 * honesta cuando las 19 variantes de abajo no valen lo mismo.
 */
function rangoDePrecios(filas: VarianteFila[]): string {
  if (filas.length === 0) return "—";
  const min = Math.min(...filas.map((v) => v.precio));
  const max = Math.max(...filas.map((v) => v.precio));
  return min === max ? precioTexto(min) : `${money(min)} – ${money(max)}`;
}

/** Cómo se lee una variante: "Rojo · Grande", o el producto si no tiene ejes. */
export function nombreVariante(v: VarianteFila, productoNombre: string): string {
  return v.valores.length === 0
    ? productoNombre
    : v.valores.map((x) => x.valor).join(" · ");
}

/**
 * Opciones y variantes de un bien.
 *
 * El modelo es el de Shopify: se definen **ejes** (Color, Tamaño) con sus
 * valores, y de ahí sale una variante por cada combinación. Con 3 colores y 2
 * tamaños hay seis, y cada una es lo que se cuenta y lo que lleva su SKU.
 *
 * **Sin opciones esta card solo ofrece agregarlas.** El bien tiene una variante
 * igual —la única— pero su stock se muestra en la card de Inventario, donde
 * quien mira lo espera: una tabla de una fila para decir "hay 12" es una tabla
 * de más.
 */
export function ProductoVariantes({
  productoId,
  productoNombre,
  opciones: opcionesIniciales,
  variantes: variantesIniciales,
  imagenes,
  onVariantesChange,
}: {
  productoId: string;
  productoNombre: string;
  opciones: OpcionEditable[];
  variantes: VarianteFila[];
  imagenes: ImagenProducto[];
  /** Para que la card de Inventario siga en acuerdo con la variante única. */
  onVariantesChange?: (v: VarianteFila[]) => void;
}) {
  const router = useRouter();
  /** Qué opción está abierta, y cómo va quedando. `null` = ninguna. */
  const [abierta, setAbierta] = useState<number | null>(null);
  const [opciones, setOpciones] = useState(opcionesIniciales);
  const [borrador, setBorrador] = useState<OpcionEditable | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [variantes, setVariantes] = useState(variantesIniciales);
  const [ajustando, setAjustando] = useState<VarianteFila | null>(null);
  /** Por qué eje se agrupa. Solo con dos o más: con uno no hay nada que juntar. */
  const [agruparPor, setAgruparPor] = useState(0);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const aplicar = (v: VarianteFila[]) => {
    setVariantes(v);
    onVariantesChange?.(v);
  };

  /**
   * Guarda los ejes y deja que el servidor regenere las variantes.
   *
   * Se guarda al cerrar la opción y no con el resto del producto: agregar un
   * valor cambia **cuántas variantes hay**, y eso es una operación del servidor
   * —no un campo de texto que se pueda previsualizar en pantalla—.
   */
  const guardarOpciones = async (
    lista: OpcionEditable[],
    descartarVariantes = false
  ) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/servicios/${productoId}/opciones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opciones: lista, descartarVariantes }),
      });
      const body = await res.json();
      if (!res.ok) {
        // 409 = hay variantes con inventario que este cambio borra. El servidor
        // dice cuáles y con cuánto; acá solo hace falta el sí.
        if (res.status === 409 && !descartarVariantes) {
          if (confirm(`${body.error}\n\n¿Seguir igual?`)) {
            setGuardando(false);
            return guardarOpciones(lista, true);
          }
          setGuardando(false);
          return;
        }
        throw new Error(body.error ?? "Error");
      }
      setOpciones(lista);
      setAbierta(null);
      setBorrador(null);
      toast.success(
        body.variantes === 1
          ? "Guardado: una variante"
          : `Guardado: ${body.variantes} variantes`
      );
      // Las variantes las rearmó el servidor: se recarga en vez de adivinar
      // cuáles sobrevivieron.
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  /** El precio de lista de una variante, desde la tabla. */
  const guardarPrecio = async (id: string, precio: number) => {
    const previas = variantes;
    aplicar(variantes.map((x) => (x.id === id ? { ...x, precio } : x)));
    try {
      const res = await fetch(`/api/variantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ precio }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
    } catch (e) {
      aplicar(previas);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
  };

  /**
   * Escribir un stock en la tabla es **contar**.
   *
   * Se dice cuánto hay, no cuánto se movió, y el servidor anota la diferencia
   * en el libro. Interpretarlo como un ajuste haría que tipear "12" sobre un 10
   * dejara 22 — que es lo contrario de lo que alguien acaba de mirar.
   */
  const contar = async (id: string, contado: number) => {
    const previas = variantes;
    aplicar(variantes.map((x) => (x.id === id ? { ...x, stock: contado } : x)));
    try {
      const res = await fetch(`/api/variantes/${id}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "CONTEO", contado }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      router.refresh();
    } catch (e) {
      aplicar(previas);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
  };

  const hayEjes = opciones.length > 0;

  /** El total, contando solo lo que se cuenta. `null` = nada lleva inventario. */
  const total = useMemo(() => {
    const cuentan = variantes.filter((v) => v.manejaInventario);
    return cuentan.length === 0
      ? null
      : cuentan.reduce((n, v) => n + v.stock, 0);
  }, [variantes]);

  /**
   * Las variantes juntadas por el valor de un eje.
   *
   * Con dos ejes de 3 y 6 valores son dieciocho filas y ninguna se encuentra;
   * agrupadas por el primero son tres, y se abre la que interesa.
   */
  const grupos = useMemo(() => {
    if (opciones.length < 2) return null;
    const eje = opciones[Math.min(agruparPor, opciones.length - 1)]?.nombre;
    const mapa = new Map<string, VarianteFila[]>();
    for (const v of variantes) {
      const clave = v.valores.find((x) => x.opcion === eje)?.valor ?? "—";
      mapa.set(clave, [...(mapa.get(clave) ?? []), v]);
    }
    return [...mapa.entries()].map(([valor, filas]) => ({ valor, filas }));
  }, [opciones, agruparPor, variantes]);

  const alternar = (clave: string) =>
    setAbiertos((prev) => {
      const s = new Set(prev);
      if (s.has(clave)) s.delete(clave);
      else s.add(clave);
      return s;
    });

  return (
    <>
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">Variantes</CardTitle>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Los ejes, cada uno plegado a su resumen. Se abre el que se toca y
              se edita **ahí mismo**: un diálogo para cambiar una palabra tapaba
              la lista de variantes, que es justo lo que hay que mirar para
              saber si el cambio es el que se quería. */}
          <div className="divide-y rounded-md border">
            {opciones.map((o, i) =>
              abierta === i && borrador ? (
                <EditorOpcion
                  key={o.id ?? `nueva-${i}`}
                  opcion={borrador}
                  onChange={setBorrador}
                  guardando={guardando}
                  onListo={() =>
                    guardarOpciones(
                      opciones.map((x, j) => (j === i ? borrador : x))
                    )
                  }
                  onBorrar={() =>
                    guardarOpciones(opciones.filter((_, j) => j !== i))
                  }
                  onCancelar={() => {
                    // Una opción recién agregada que se cancela no queda a
                    // medias: se va con el gesto que la creó.
                    if (o.id === null && o.nombre === "") {
                      setOpciones(opciones.filter((_, j) => j !== i));
                    }
                    setAbierta(null);
                    setBorrador(null);
                  }}
                />
              ) : (
                <button
                  key={o.id ?? `op-${i}`}
                  type="button"
                  onClick={() => {
                    setAbierta(i);
                    setBorrador(o);
                  }}
                  className="block w-full space-y-1.5 p-3 text-left hover:bg-muted/40"
                >
                  <p className="text-sm font-medium">{o.nombre || "Sin nombre"}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {o.valores.map((v) => (
                      <span
                        key={v.id ?? v.valor}
                        className="rounded bg-muted px-2 py-0.5 text-xs"
                      >
                        {v.valor}
                      </span>
                    ))}
                  </div>
                </button>
              )
            )}

            {opciones.length < MAX_OPCIONES && abierta === null && (
              <button
                type="button"
                onClick={() => {
                  const nueva: OpcionEditable = {
                    id: null,
                    nombre: "",
                    valores: [],
                  };
                  setOpciones([...opciones, nueva]);
                  setAbierta(opciones.length);
                  setBorrador(nueva);
                }}
                className="flex w-full items-center gap-1.5 p-3 text-left text-sm text-primary hover:bg-muted/40"
              >
                <Plus className="h-4 w-4" />
                {hayEjes
                  ? "Agregar otra opción"
                  : "Agregar opciones como color o tamaño"}
              </button>
            )}
          </div>

          {hayEjes && (
            <>

              {grupos && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    Agrupar por
                  </Label>
                  <div className="w-40">
                    <CustomSelect
                      value={String(agruparPor)}
                      onChange={(v) => {
                        setAgruparPor(Number(v));
                        setAbiertos(new Set());
                      }}
                      options={opciones.map((o, i) => ({
                        value: String(i),
                        label: o.nombre,
                      }))}
                    />
                  </div>
                </div>
              )}

              <div className="divide-y rounded-md border">
                {/* Un encabezado y no una `<table>`: las filas se pliegan en
                    grupos y sangran, que es lo que una tabla no sabe hacer. */}
                <div className="flex items-center gap-3 bg-muted/40 px-3 py-1.5 text-xs font-medium text-muted-foreground">
                  <span className="min-w-0 flex-1">Variante</span>
                  <span className="w-24 flex-none text-right">Precio</span>
                  <span className="w-20 flex-none text-right">Stock</span>
                  <span className="w-7 flex-none" />
                </div>
                {grupos
                  ? grupos.map((g) => {
                      const abierto = abiertos.has(g.valor);
                      const cuentan = g.filas.filter((v) => v.manejaInventario);
                      return (
                        <div key={g.valor}>
                          <button
                            type="button"
                            onClick={() => alternar(g.valor)}
                            className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50"
                          >
                            {abierto ? (
                              <ChevronDown className="h-4 w-4 flex-none text-muted-foreground" />
                            ) : (
                              <ChevronRight className="h-4 w-4 flex-none text-muted-foreground" />
                            )}
                            <span className="min-w-0 flex-1">
                              <span className="block text-sm font-medium">
                                {g.valor}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {g.filas.length}{" "}
                                {g.filas.length === 1 ? "variante" : "variantes"}
                              </span>
                            </span>
                            <span className="w-24 flex-none text-right text-sm tabular-nums text-muted-foreground">
                              {rangoDePrecios(g.filas)}
                            </span>
                            <span className="w-20 flex-none text-right text-sm tabular-nums text-muted-foreground">
                              {cuentan.length === 0
                                ? "—"
                                : cuentan.reduce((n, v) => n + v.stock, 0)}
                            </span>
                            <span className="w-7 flex-none" />
                          </button>
                          {abierto && (
                            <div className="divide-y border-t bg-muted/20">
                              {g.filas.map((v) => (
                                <FilaVariante
                                  key={v.id}
                                  variante={v}
                                  productoId={productoId}
                                  productoNombre={productoNombre}
                                  imagenes={imagenes}
                                  sangrada
                                  onAjustar={() => setAjustando(v)}
                                  onPrecio={(precio) => guardarPrecio(v.id, precio)}
                                  onContar={(stock) => contar(v.id, stock)}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                  : variantes.map((v) => (
                      <FilaVariante
                        key={v.id}
                        variante={v}
                        productoId={productoId}
                        productoNombre={productoNombre}
                        imagenes={imagenes}
                        onAjustar={() => setAjustando(v)}
                        onPrecio={(precio) => guardarPrecio(v.id, precio)}
                        onContar={(stock) => contar(v.id, stock)}
                      />
                    ))}
              </div>

              {/* El total al pie, como en Shopify: es la pregunta que alguien
                  se hace mirando la lista entera. */}
              <p className="text-sm text-muted-foreground">
                {total === null
                  ? "Ninguna de estas variantes lleva inventario."
                  : `Inventario total: ${total} disponible${total === 1 ? "" : "s"}.`}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      {ajustando && (
        <MovimientoDialog
          varianteId={ajustando.id}
          nombre={nombreVariante(ajustando, productoNombre)}
          stock={ajustando.stock}
          permiteNegativo={ajustando.permiteNegativo}
          onCerrar={() => setAjustando(null)}
          onHecho={(stock) => {
            aplicar(
              variantes.map((x) =>
                x.id === ajustando.id ? { ...x, stock } : x
              )
            );
            setAjustando(null);
            router.refresh();
          }}
        />
      )}

    </>
  );
}

/** Una variante en la lista: cómo se llama, su SKU y cuánto hay. */
function FilaVariante({
  variante,
  productoId,
  productoNombre,
  imagenes,
  sangrada,
  onAjustar,
  onPrecio,
  onContar,
}: {
  variante: VarianteFila;
  productoId: string;
  productoNombre: string;
  imagenes: ImagenProducto[];
  sangrada?: boolean;
  onAjustar: () => void;
  onPrecio: (precio: number) => void;
  onContar: (stock: number) => void;
}) {
  const from = useAca();
  const foto =
    imagenes.find((i) => i.id === variante.imagenId) ?? imagenes[0] ?? null;

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2.5 ${sangrada ? "pl-10" : ""}`}
    >
      {foto && (
        <div className="relative h-9 w-9 flex-none overflow-hidden rounded border">
          <Image
            src={foto.url}
            alt=""
            fill
            sizes="36px"
            className="object-cover"
            unoptimized
          />
        </div>
      )}
      {/* El nombre lleva a la ficha de la variante; el número abre el
          movimiento. Son las dos cosas que se hacen sobre una fila y cada una
          tiene su blanco, en vez de un menú que las esconda a las dos. */}
      <Link
        href={`/dashboard/productos/${productoId}/variantes/${variante.id}?from=${from}`}
        className="min-w-0 flex-1"
      >
        <span className="block truncate text-sm font-medium hover:underline">
          {nombreVariante(variante, productoNombre)}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {variante.sku ?? "Sin SKU"}
        </span>
      </Link>
      {/* Precio y stock se escriben acá mismo: cargar seis variantes era
          entrar y salir de seis fichas. La ficha sigue estando para lo demás. */}
      <div className="relative w-24 flex-none">
        <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          $
        </span>
        <Input
          type="number"
          min="0"
          step="0.01"
          defaultValue={variante.precio}
          aria-label={`Precio de ${nombreVariante(variante, productoNombre)}`}
          className={`h-8 pl-5 text-right text-sm tabular-nums ${
            variante.precio === 0 ? "text-amber-700" : ""
          }`}
          onBlur={(e) => {
            const texto = e.target.value.trim();
            const nuevo = Number(texto);
            // Vaciar no es "gratis": repone lo que decía. Marcar algo como
            // gratis es una decisión, borrar un número mientras se reescribe no.
            if (texto === "" || !Number.isFinite(nuevo) || nuevo < 0) {
              e.target.value = String(variante.precio);
              return;
            }
            if (nuevo !== variante.precio) onPrecio(nuevo);
          }}
        />
      </div>
      {variante.manejaInventario ? (
        <>
          {/* Escribir un stock es **contar**: se dice cuánto hay, no cuánto se
              movió, y el servidor anota la diferencia en el libro. Para un
              ingreso o una corrección con nota está el botón de al lado. */}
          <Input
            type="number"
            step="1"
            defaultValue={variante.stock}
            aria-label={`Stock de ${nombreVariante(variante, productoNombre)}`}
            className={`h-8 w-20 flex-none text-right text-sm tabular-nums ${
              variante.stock <= 0 ? "font-medium text-amber-700" : ""
            }`}
            onBlur={(e) => {
              const texto = e.target.value.trim();
              const nuevo = Number(texto);
              if (texto === "" || !Number.isInteger(nuevo)) {
                e.target.value = String(variante.stock);
                return;
              }
              if (nuevo !== variante.stock) onContar(nuevo);
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Movimiento de stock"
            onClick={onAjustar}
          >
            <ArrowLeftRight />
          </Button>
        </>
      ) : (
        <span
          className="w-20 flex-none text-right text-sm text-muted-foreground"
          title="No lleva conteo de stock"
        >
          —
        </span>
      )}
    </div>
  );
}

/**
 * Un eje abierto: su nombre y sus valores.
 *
 * Se edita **en el lugar**, como en Shopify: un diálogo para cambiar una
 * palabra tapaba la lista de variantes, que es justo lo que hay que mirar para
 * saber si el cambio es el que se quería.
 *
 * *Listo* guarda y el servidor regenera las variantes: agregar un valor cambia
 * cuántas hay, y eso no es un campo de texto que se pueda previsualizar.
 */
function EditorOpcion({
  opcion,
  onChange,
  onListo,
  onBorrar,
  onCancelar,
  guardando,
}: {
  opcion: OpcionEditable;
  onChange: (o: OpcionEditable) => void;
  onListo: () => void;
  onBorrar: () => void;
  onCancelar: () => void;
  guardando: boolean;
}) {
  const [nuevo, setNuevo] = useState("");

  const agregarValor = (valor: string) => {
    const limpio = valor.trim();
    if (!limpio) return;
    onChange({
      ...opcion,
      valores: [...opcion.valores, { id: null, valor: limpio }],
    });
    setNuevo("");
  };

  const listo = opcion.nombre.trim() !== "" && opcion.valores.length > 0;

  return (
    <div className="space-y-3 bg-muted/20 p-3">
      <div className="space-y-1.5">
        <Label className="text-xs">Nombre de la opción</Label>
        <Input
          value={opcion.nombre}
          onChange={(e) => onChange({ ...opcion, nombre: e.target.value })}
          placeholder="Color"
          autoFocus
        />
      </div>

      <div className="space-y-1.5">
        <Label className="text-xs">Valores</Label>
        {opcion.valores.map((v, k) => (
          <div key={k} className="flex items-center gap-1.5">
            <Input
              value={v.valor}
              onChange={(e) =>
                onChange({
                  ...opcion,
                  valores: opcion.valores.map((x, j) =>
                    j === k ? { ...x, valor: e.target.value } : x
                  ),
                })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="flex-none"
              aria-label={`Sacar ${v.valor}`}
              onClick={() =>
                onChange({
                  ...opcion,
                  valores: opcion.valores.filter((_, j) => j !== k),
                })
              }
            >
              <Trash2 className="h-4 w-4 text-muted-foreground" />
            </Button>
          </div>
        ))}
        {/* Enter agrega y deja el campo listo para el siguiente: así se cargan
            cinco talles seguidos sin levantar las manos del teclado. */}
        <Input
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== "Enter") return;
            e.preventDefault();
            agregarValor(nuevo);
          }}
          onBlur={() => agregarValor(nuevo)}
          placeholder="Agregar otro valor"
          className="mr-10"
        />
      </div>

      <div className="flex items-center justify-between gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive hover:bg-destructive/10"
          disabled={guardando}
          onClick={onBorrar}
        >
          Borrar
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={guardando}
            onClick={onCancelar}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={guardando || !listo}
            title={
              listo ? undefined : "La opción necesita un nombre y algún valor."
            }
            onClick={onListo}
          >
            {guardando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
            Listo
          </Button>
        </div>
      </div>
    </div>
  );
}
