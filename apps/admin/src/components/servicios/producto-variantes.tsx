"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ChevronDown, ChevronRight, Loader2, Plus, X } from "lucide-react";
import { MovimientoDialog } from "./movimiento-dialog";
import type { ImagenProducto } from "./producto-imagenes";

export interface OpcionEditable {
  id: string | null;
  nombre: string;
  valores: { id: string | null; valor: string }[];
}

export interface VarianteFila {
  id: string;
  sku: string | null;
  manejaInventario: boolean;
  stock: number;
  permiteNegativo: boolean;
  imagenId: string | null;
  valores: { opcion: string; valor: string }[];
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
  const [editandoOpciones, setEditandoOpciones] = useState(false);
  const [opciones, setOpciones] = useState(opcionesIniciales);
  const [borrador, setBorrador] = useState<OpcionEditable[]>(opcionesIniciales);
  const [guardando, setGuardando] = useState(false);
  const [variantes, setVariantes] = useState(variantesIniciales);
  const [ajustando, setAjustando] = useState<VarianteFila | null>(null);
  const [editando, setEditando] = useState<VarianteFila | null>(null);
  /** Por qué eje se agrupa. Solo con dos o más: con uno no hay nada que juntar. */
  const [agruparPor, setAgruparPor] = useState(0);
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set());

  const aplicar = (v: VarianteFila[]) => {
    setVariantes(v);
    onVariantesChange?.(v);
  };

  const guardarOpciones = async (descartarVariantes = false) => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/servicios/${productoId}/opciones`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opciones: borrador, descartarVariantes }),
      });
      const body = await res.json();
      if (!res.ok) {
        // 409 = hay variantes con inventario que este cambio borra. El servidor
        // dice cuáles y con cuánto; acá solo hace falta el sí.
        if (res.status === 409 && !descartarVariantes) {
          if (confirm(`${body.error}\n\n¿Seguir igual?`)) {
            setGuardando(false);
            return guardarOpciones(true);
          }
          setGuardando(false);
          return;
        }
        throw new Error(body.error ?? "Error");
      }
      setOpciones(borrador);
      setEditandoOpciones(false);
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

  const actualizarVariante = async (id: string, patch: Partial<VarianteFila>) => {
    const previas = variantes;
    aplicar(variantes.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/variantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
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
          {hayEjes && (
            <CardAction>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setBorrador(opciones);
                  setEditandoOpciones(true);
                }}
              >
                Editar opciones
              </Button>
            </CardAction>
          )}
        </CardHeader>

        <CardContent className={hayEjes ? "space-y-4" : ""}>
          {!hayEjes ? (
            // Sin opciones no hay nada que listar: el stock de la variante
            // única se muestra arriba, en Inventario.
            <Button
              type="button"
              variant="ghost"
              className="px-0 text-primary hover:bg-transparent hover:underline"
              onClick={() => {
                setBorrador([]);
                setEditandoOpciones(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Agregar opciones como color o tamaño
            </Button>
          ) : (
            <>
              {/* Los ejes con sus valores, como los muestra Shopify: el resumen
                  de qué divide a este producto, sin tener que abrir nada. */}
              <div className="divide-y rounded-md border">
                {opciones.map((o) => (
                  <div key={o.id ?? o.nombre} className="space-y-1.5 p-3">
                    <p className="text-sm font-medium">{o.nombre}</p>
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
                  </div>
                ))}
              </div>

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
                            <span className="flex-none text-sm tabular-nums text-muted-foreground">
                              {cuentan.length === 0
                                ? "—"
                                : cuentan.reduce((n, v) => n + v.stock, 0)}
                            </span>
                          </button>
                          {abierto && (
                            <div className="divide-y border-t bg-muted/20">
                              {g.filas.map((v) => (
                                <FilaVariante
                                  key={v.id}
                                  variante={v}
                                  productoNombre={productoNombre}
                                  imagenes={imagenes}
                                  sangrada
                                  onAjustar={() => setAjustando(v)}
                                  onEditar={() => setEditando(v)}
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
                        productoNombre={productoNombre}
                        imagenes={imagenes}
                        onAjustar={() => setAjustando(v)}
                        onEditar={() => setEditando(v)}
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

      {editandoOpciones && (
        <EditorOpciones
          opciones={borrador}
          onChange={setBorrador}
          onGuardar={() => guardarOpciones()}
          onCerrar={() => setEditandoOpciones(false)}
          guardando={guardando}
        />
      )}

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

      {editando && (
        <VarianteDialog
          variante={variantes.find((v) => v.id === editando.id) ?? editando}
          nombre={nombreVariante(editando, productoNombre)}
          imagenes={imagenes}
          onGuardar={(patch) => actualizarVariante(editando.id, patch)}
          onCerrar={() => setEditando(null)}
        />
      )}
    </>
  );
}

/** Una variante en la lista: cómo se llama, su SKU y cuánto hay. */
function FilaVariante({
  variante,
  productoNombre,
  imagenes,
  sangrada,
  onAjustar,
  onEditar,
}: {
  variante: VarianteFila;
  productoNombre: string;
  imagenes: ImagenProducto[];
  sangrada?: boolean;
  onAjustar: () => void;
  onEditar: () => void;
}) {
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
      {/* El nombre abre los ajustes de la variante; el número, el movimiento.
          Son las dos cosas que se hacen sobre una fila y cada una tiene su
          blanco, en vez de un menú que las esconda a las dos. */}
      <button
        type="button"
        onClick={onEditar}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block truncate text-sm font-medium hover:underline">
          {nombreVariante(variante, productoNombre)}
        </span>
        <span className="block truncate font-mono text-xs text-muted-foreground">
          {variante.sku ?? "Sin SKU"}
        </span>
      </button>
      {variante.manejaInventario ? (
        <button
          type="button"
          onClick={onAjustar}
          className={`flex-none tabular-nums underline-offset-2 hover:underline ${
            variante.stock <= 0 ? "font-medium text-amber-700" : ""
          }`}
        >
          {variante.stock}
        </button>
      ) : (
        <span
          className="flex-none text-sm text-muted-foreground"
          title="No lleva conteo de stock"
        >
          —
        </span>
      )}
    </div>
  );
}

/** Lo propio de una variante: su SKU, si se cuenta, y con qué foto sale. */
function VarianteDialog({
  variante,
  nombre,
  imagenes,
  onGuardar,
  onCerrar,
}: {
  variante: VarianteFila;
  nombre: string;
  imagenes: ImagenProducto[];
  onGuardar: (patch: Partial<VarianteFila>) => void;
  onCerrar: () => void;
}) {
  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">SKU</Label>
            <Input
              defaultValue={variante.sku ?? ""}
              placeholder="—"
              className="font-mono text-sm"
              onBlur={(e) => {
                const sku = e.target.value.trim() || null;
                if (sku !== variante.sku) onGuardar({ sku });
              }}
            />
            <p className="text-xs text-muted-foreground">
              Sale impreso en la factura y es lo que va en la etiqueta.
            </p>
          </div>

          <label className="flex items-center justify-between gap-3 border-t pt-3 text-sm">
            Se cuenta
            <Switch
              checked={variante.manejaInventario}
              onCheckedChange={(on) => onGuardar({ manejaInventario: on })}
            />
          </label>

          {variante.manejaInventario && (
            <label className="flex items-center justify-between gap-3 text-sm">
              <span>
                Vender sin stock
                <span className="block text-xs text-muted-foreground">
                  Deja que la cantidad quede en negativo.
                </span>
              </span>
              <Switch
                checked={variante.permiteNegativo}
                onCheckedChange={(on) => onGuardar({ permiteNegativo: on })}
              />
            </label>
          )}

          {imagenes.length > 0 && (
            <div className="space-y-1.5 border-t pt-3">
              <Label className="text-xs">Foto</Label>
              <CustomSelect
                value={variante.imagenId ?? ""}
                onChange={(id) => onGuardar({ imagenId: id || null })}
                options={[
                  { value: "", label: "La principal" },
                  ...imagenes.map((img, i) => ({
                    value: img.id,
                    label: `Foto ${i + 1}`,
                  })),
                ]}
              />
            </div>
          )}

          <div className="flex justify-end border-t pt-4">
            <Button variant="outline" onClick={onCerrar}>
              Listo
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Los ejes y sus valores.
 *
 * Se edita entero y se guarda de una: agregar un valor cambia cuántas variantes
 * hay, así que guardar valor por valor haría que la lista de abajo se rearme
 * cinco veces mientras alguien escribe.
 */
function EditorOpciones({
  opciones,
  onChange,
  onGuardar,
  onCerrar,
  guardando,
}: {
  opciones: OpcionEditable[];
  onChange: (o: OpcionEditable[]) => void;
  onGuardar: () => void;
  onCerrar: () => void;
  guardando: boolean;
}) {
  const [nuevoValor, setNuevoValor] = useState<Record<number, string>>({});

  const cambiar = (i: number, patch: Partial<OpcionEditable>) =>
    onChange(opciones.map((o, j) => (j === i ? { ...o, ...patch } : o)));

  const combinaciones = opciones.reduce(
    (n, o) => n * Math.max(o.valores.length, 1),
    1
  );

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Opciones</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Cada opción es un eje —Color, Tamaño— y de sus valores sale una
            variante por combinación.
          </p>

          {opciones.map((o, i) => (
            <div key={i} className="space-y-2 rounded-md border p-3">
              <div className="flex items-center gap-2">
                <Input
                  value={o.nombre}
                  onChange={(e) => cambiar(i, { nombre: e.target.value })}
                  placeholder="Color"
                  className="h-8"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 flex-none"
                  aria-label="Sacar opción"
                  onClick={() => onChange(opciones.filter((_, j) => j !== i))}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {o.valores.map((v, k) => (
                  <span
                    key={k}
                    className="flex items-center gap-1 rounded-md border bg-muted/50 py-0.5 pl-2 pr-0.5 text-sm"
                  >
                    {v.valor}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      aria-label={`Sacar ${v.valor}`}
                      onClick={() =>
                        cambiar(i, {
                          valores: o.valores.filter((_, j) => j !== k),
                        })
                      }
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </span>
                ))}
              </div>

              {/* Enter agrega, que es como se cargan cinco talles seguidos sin
                  levantar las manos del teclado. */}
              <Input
                value={nuevoValor[i] ?? ""}
                onChange={(e) =>
                  setNuevoValor({ ...nuevoValor, [i]: e.target.value })
                }
                onKeyDown={(e) => {
                  if (e.key !== "Enter") return;
                  e.preventDefault();
                  const valor = (nuevoValor[i] ?? "").trim();
                  if (!valor) return;
                  cambiar(i, { valores: [...o.valores, { id: null, valor }] });
                  setNuevoValor({ ...nuevoValor, [i]: "" });
                }}
                placeholder="Agregar valor y Enter"
                className="h-8"
              />
            </div>
          ))}

          {opciones.length < 3 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() =>
                onChange([...opciones, { id: null, nombre: "", valores: [] }])
              }
            >
              <Plus className="mr-1.5 h-3.5 w-3.5" />
              {opciones.length === 0 ? "Agregar opción" : "Agregar otra opción"}
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            {opciones.length === 0
              ? "Sin opciones, el producto es uno solo y su stock se lleva en Inventario."
              : `${combinaciones} ${combinaciones === 1 ? "variante" : "variantes"}.`}
          </p>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={onGuardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
