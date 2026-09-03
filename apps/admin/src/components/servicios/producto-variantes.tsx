"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardAction } from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, Pencil, Plus, TriangleAlert, X } from "lucide-react";
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
function nombreVariante(v: VarianteFila, productoNombre: string): string {
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
 * Un bien **sin ejes tiene una variante igual**, sin valores. Por eso la tabla
 * se muestra siempre: el que no usa opciones ve una fila con el stock de su
 * producto y nunca se entera de que hay combinaciones.
 */
export function ProductoVariantes({
  productoId,
  productoNombre,
  opciones: opcionesIniciales,
  variantes: variantesIniciales,
  imagenes,
}: {
  productoId: string;
  productoNombre: string;
  opciones: OpcionEditable[];
  variantes: VarianteFila[];
  imagenes: ImagenProducto[];
}) {
  const router = useRouter();
  const [editandoOpciones, setEditandoOpciones] = useState(false);
  const [opciones, setOpciones] = useState(opcionesIniciales);
  const [borrador, setBorrador] = useState<OpcionEditable[]>(opcionesIniciales);
  const [guardando, setGuardando] = useState(false);
  const [variantes, setVariantes] = useState(variantesIniciales);
  const [moviendo, setMoviendo] = useState<VarianteFila | null>(null);

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
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  const actualizarVariante = async (
    id: string,
    patch: Partial<VarianteFila>
  ) => {
    const previas = variantes;
    setVariantes((v) => v.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      const res = await fetch(`/api/variantes/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
    } catch (e) {
      setVariantes(previas);
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    }
  };

  const hayEjes = opciones.length > 0;

  return (
    <>
      <Card>
        <CardHeader className="border-b py-3">
          <CardTitle className="text-base">
            {hayEjes ? "Opciones y variantes" : "Inventario"}
          </CardTitle>
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
              <Pencil className="mr-1.5 h-3.5 w-3.5" />
              {hayEjes ? "Editar opciones" : "Agregar opciones"}
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{hayEjes ? "Variante" : "Producto"}</TableHead>
                <TableHead className="w-40">SKU</TableHead>
                <TableHead className="w-28">¿Se cuenta?</TableHead>
                <TableHead className="w-28 text-right">Stock</TableHead>
                <TableHead className="w-32">Sin stock</TableHead>
                {imagenes.length > 0 && <TableHead className="w-40">Foto</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {variantes.map((v) => {
                const foto =
                  imagenes.find((i) => i.id === v.imagenId) ?? imagenes[0] ?? null;
                return (
                  <TableRow key={v.id}>
                    <TableCell className="font-medium">
                      {nombreVariante(v, productoNombre)}
                    </TableCell>
                    <TableCell>
                      <Input
                        defaultValue={v.sku ?? ""}
                        placeholder="—"
                        className="h-8 font-mono text-xs"
                        onBlur={(e) => {
                          const sku = e.target.value.trim() || null;
                          if (sku !== v.sku) actualizarVariante(v.id, { sku });
                        }}
                      />
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={v.manejaInventario}
                        onCheckedChange={(on) =>
                          actualizarVariante(v.id, { manejaInventario: on })
                        }
                      />
                    </TableCell>
                    {/* Sin conteo no hay número que mostrar: un "0" ahí se lee
                        como "no queda ninguno", que es lo contrario. */}
                    <TableCell className="text-right">
                      {v.manejaInventario ? (
                        <button
                          type="button"
                          onClick={() => setMoviendo(v)}
                          className={`tabular-nums underline-offset-2 hover:underline ${
                            v.stock <= 0 ? "font-medium text-amber-700" : ""
                          }`}
                        >
                          {v.stock}
                        </button>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {v.manejaInventario ? (
                        <label className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Switch
                            checked={v.permiteNegativo}
                            onCheckedChange={(on) =>
                              actualizarVariante(v.id, { permiteNegativo: on })
                            }
                          />
                          Vender igual
                        </label>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {imagenes.length > 0 && (
                      <TableCell>
                        {/* La miniatura al lado del selector, no dentro: se
                            elige poco y se mira siempre, así que lo que tiene
                            que verse de un vistazo es cuál quedó. */}
                        <div className="flex items-center gap-1.5">
                          {foto && (
                            <div className="relative h-8 w-8 flex-none overflow-hidden rounded border">
                              <Image
                                src={foto.url}
                                alt=""
                                fill
                                sizes="32px"
                                className="object-cover"
                                unoptimized
                              />
                            </div>
                          )}
                          <CustomSelect
                            value={v.imagenId ?? ""}
                            onChange={(id) =>
                              actualizarVariante(v.id, { imagenId: id || null })
                            }
                            options={[
                              { value: "", label: "La principal" },
                              ...imagenes.map((img, i) => ({
                                value: img.id,
                                label: `Foto ${i + 1}`,
                              })),
                            ]}
                          />
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
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

      {moviendo && (
        <MovimientoDialog
          variante={moviendo}
          nombre={nombreVariante(moviendo, productoNombre)}
          onCerrar={() => setMoviendo(null)}
          onHecho={(stock) => {
            setVariantes((v) =>
              v.map((x) => (x.id === moviendo.id ? { ...x, stock } : x))
            );
            setMoviendo(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * Los ejes y sus valores.
 *
 * Se edita entero y se guarda de una: agregar un valor cambia cuántas variantes
 * hay, así que guardar valor por valor haría que la tabla de abajo se rearme
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
              Agregar opción
            </Button>
          )}

          <p className="text-xs text-muted-foreground">
            {opciones.length === 0
              ? "Sin opciones, el producto es uno solo y se cuenta en una fila."
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

/**
 * Mover el stock de una variante.
 *
 * Las tres formas son tres preguntas distintas y por eso no comparten campo:
 * un ingreso dice *cuánto entró*, un ajuste *cuánto sumar o restar*, y un
 * conteo *cuánto hay*. Hacer que quien cuenta el estante calcule la diferencia
 * contra el sistema es pedirle la única cuenta que la máquina no puede errar.
 */
function MovimientoDialog({
  variante,
  nombre,
  onCerrar,
  onHecho,
}: {
  variante: VarianteFila;
  nombre: string;
  onCerrar: () => void;
  onHecho: (stock: number) => void;
}) {
  const [motivo, setMotivo] = useState<"INGRESO" | "AJUSTE" | "CONTEO">("INGRESO");
  const [valor, setValor] = useState("");
  const [nota, setNota] = useState("");
  const [guardando, setGuardando] = useState(false);

  const numero = Number(valor);
  const valido = valor.trim() !== "" && Number.isFinite(numero) &&
    (motivo === "CONTEO" ? numero >= 0 : numero !== 0);

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/variantes/${variante.id}/movimientos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          motivo === "CONTEO"
            ? { motivo, contado: Math.trunc(numero), nota: nota || null }
            : { motivo, cantidad: Math.trunc(numero), nota: nota || null }
        ),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      // Un conteo que da lo mismo no mueve nada y el servidor devuelve `null`.
      onHecho(body.movimiento?.saldo ?? variante.stock);
      toast.success("Stock actualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onCerrar()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>{nombre}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Ahora hay{" "}
            <span className="font-semibold text-foreground">{variante.stock}</span>.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Qué pasó</Label>
            <CustomSelect
              value={motivo}
              onChange={(v) => setMotivo(v as typeof motivo)}
              options={[
                { value: "INGRESO", label: "Entró mercadería" },
                { value: "AJUSTE", label: "Corrección" },
                { value: "CONTEO", label: "Conté el estante" },
              ]}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              {motivo === "CONTEO"
                ? "Cuántos hay *"
                : motivo === "INGRESO"
                  ? "Cuántos entraron *"
                  : "Cuánto sumar o restar *"}
            </Label>
            <Input
              type="number"
              step="1"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder={motivo === "AJUSTE" ? "-2" : "0"}
              autoFocus
            />
            {motivo === "AJUSTE" && (
              <p className="text-xs text-muted-foreground">
                Negativo para restar: −2 saca dos.
              </p>
            )}
            {motivo === "CONTEO" && valido && (
              <p className="text-xs text-muted-foreground">
                Se anota la diferencia: {Math.trunc(numero) - variante.stock >= 0 ? "+" : ""}
                {Math.trunc(numero) - variante.stock}.
              </p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Nota</Label>
            <Input
              value={nota}
              onChange={(e) => setNota(e.target.value)}
              placeholder="Opcional"
            />
          </div>

          {!variante.permiteNegativo && (
            <p className="flex items-start gap-1.5 text-xs text-muted-foreground">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 flex-none" />
              Esta variante no se puede dejar en negativo.
            </p>
          )}

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onCerrar} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando || !valido}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
