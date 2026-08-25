"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CustomSelect } from "@/components/ui/custom-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";

export interface DatoFacturacionResumen {
  id: string;
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  esPredeterminado: boolean;
  /** El resto de lo que va en la factura. Ya viene en la respuesta. */
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string | null;
  telefono: string | null;
  email: string | null;
}

interface Nuevo {
  tipoIdentificacion: "CEDULA" | "RUC";
  identificacion: string;
  razonSocial: string;
  tipoPersona: "NATURAL" | "JURIDICA";
  direccion: string;
  telefono: string;
  email: string;
  guardarEnFicha: boolean;
}

const nuevoVacio: Nuevo = {
  tipoIdentificacion: "CEDULA",
  identificacion: "",
  razonSocial: "",
  tipoPersona: "NATURAL",
  direccion: "",
  telefono: "",
  email: "",
  guardarEnFicha: true,
};

/**
 * Elige con qué datos se factura, o los captura en el momento.
 *
 * Lo comparten el armado de la orden y la emisión. Preguntar temprano es mejor:
 * quien vende tiene al cliente delante y puede consultarle a nombre de quién
 * quiere la factura. Al emitir ya es tarde.
 *
 * Lo que se ingresa a mano **siempre** se guarda como registro, porque la orden
 * y la factura lo referencian por id. La casilla decide si además queda
 * ofrecido en la ficha o se archiva al toque, para no ensuciar la lista con un
 * caso puntual.
 */
export function SelectorDatosFacturacion({
  clienteId,
  value,
  onChange,
}: {
  clienteId: string;
  /** Id elegido, o null para resolver el predeterminado al emitir. */
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [datos, setDatos] = useState<DatoFacturacionResumen[] | null>(null);
  /** El popup donde se elige otro dato o se carga uno nuevo. */
  const [abierto, setAbierto] = useState(false);
  const [modoNuevo, setModoNuevo] = useState(false);
  const [nuevo, setNuevo] = useState<Nuevo>(nuevoVacio);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    let cancelado = false;
    fetch(`/api/clientes/${clienteId}/facturacion`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (cancelado) return;
        const items: DatoFacturacionResumen[] = d.items ?? [];
        setDatos(items);
        // Se propone el predeterminado; se puede cambiar.
        const porDefecto = items.find((i) => i.esPredeterminado) ?? items[0];
        if (porDefecto) onChange(porDefecto.id);
      })
      .catch(() => {
        if (!cancelado) setDatos([]);
      });
    return () => {
      cancelado = true;
    };
    // Solo al cambiar de cliente: `onChange` se recrea en cada render del padre.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  const guardarNuevo = async () => {
    setGuardando(true);
    try {
      const res = await fetch(`/api/clientes/${clienteId}/facturacion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipoIdentificacion: nuevo.tipoIdentificacion,
          identificacion: nuevo.identificacion,
          razonSocial: nuevo.razonSocial,
          tipoPersona: nuevo.tipoPersona,
          direccion: nuevo.direccion.trim() || null,
          telefono: nuevo.telefono.trim() || null,
          email: nuevo.email.trim() || null,
          esPredeterminado: nuevo.guardarEnFicha && (datos?.length ?? 0) === 0,
          archivado: !nuevo.guardarEnFicha,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      const creado: DatoFacturacionResumen = {
        id: body.id,
        tipoIdentificacion: body.tipoIdentificacion,
        identificacion: body.identificacion,
        razonSocial: body.razonSocial,
        esPredeterminado: body.esPredeterminado,
        tipoPersona: body.tipoPersona,
        direccion: body.direccion ?? null,
        telefono: body.telefono ?? null,
        email: body.email ?? null,
      };
      setDatos((prev) => [...(prev ?? []), creado]);
      onChange(creado.id);
      setModoNuevo(false);
      setAbierto(false);
      setNuevo(nuevoVacio);
      toast.success(
        nuevo.guardarEnFicha
          ? "Datos guardados en la ficha del cliente"
          : "Datos usados solo para esta orden"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (datos === null) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Cargando…
      </div>
    );
  }

  const elegido = datos.find((d) => d.id === value) ?? null;

  return (
    <>
      {/* La card muestra lo que va a salir impreso, completo. Antes era una
          lista de opciones incluso cuando había una sola, que es el caso
          normal: ocupaba lugar para hacer elegir algo ya elegido. */}
      {elegido ? (
        <dl className="space-y-1 text-sm">
          <div className="font-medium">{elegido.razonSocial}</div>
          <Fila
            etiqueta={elegido.tipoIdentificacion === "RUC" ? "RUC" : "Cédula"}
            valor={elegido.identificacion}
          />
          <Fila
            etiqueta="Tipo"
            valor={
              elegido.tipoPersona === "JURIDICA"
                ? "Persona jurídica"
                : "Persona natural"
            }
          />
          <Fila etiqueta="Dirección" valor={elegido.direccion} />
          <Fila etiqueta="Teléfono" valor={elegido.telefono} />
          <Fila etiqueta="Email" valor={elegido.email} />
        </dl>
      ) : (
        <p className="text-sm text-muted-foreground">
          El cliente todavía no tiene datos de facturación cargados. Sin ellos
          la orden se confirma pero no se puede facturar.
        </p>
      )}

      <Button
        variant="outline"
        size="sm"
        className="mt-3 w-full"
        onClick={() => {
          setModoNuevo(datos.length === 0);
          setAbierto(true);
        }}
      >
        {datos.length > 0 ? (
          <>
            <Pencil className="mr-2 h-3.5 w-3.5" />
            Usar otros datos
          </>
        ) : (
          <>
            <Plus className="mr-2 h-3.5 w-3.5" />
            Ingresar datos
          </>
        )}
      </Button>

      <Dialog open={abierto} onOpenChange={setAbierto}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {modoNuevo ? "Nuevos datos de facturación" : "Datos de facturación"}
            </DialogTitle>
          </DialogHeader>

          {modoNuevo ? (
            <>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de identificación *</Label>
                <CustomSelect
                  value={nuevo.tipoIdentificacion}
                  onChange={(v) =>
                    setNuevo({
                      ...nuevo,
                      tipoIdentificacion: v as "CEDULA" | "RUC",
                      tipoPersona: v === "RUC" ? "JURIDICA" : "NATURAL",
                    })
                  }
                  options={[
                    { value: "CEDULA", label: "Cédula" },
                    { value: "RUC", label: "RUC" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                {/* La etiqueta sigue al tipo elegido: un "Número" a secas se
                    confundía con el teléfono. */}
                <Label className="text-xs">
                  {nuevo.tipoIdentificacion === "RUC" ? "RUC *" : "Cédula *"}
                </Label>
                <Input
                  inputMode="numeric"
                  value={nuevo.identificacion}
                  onChange={(e) =>
                    setNuevo({ ...nuevo, identificacion: e.target.value })
                  }
                  placeholder={
                    nuevo.tipoIdentificacion === "RUC" ? "13 dígitos" : "10 dígitos"
                  }
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Razón social *</Label>
              <Input
                value={nuevo.razonSocial}
                onChange={(e) => setNuevo({ ...nuevo, razonSocial: e.target.value })}
                placeholder="Como debe salir en la factura"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de persona *</Label>
                <CustomSelect
                  value={nuevo.tipoPersona}
                  onChange={(v) =>
                    setNuevo({ ...nuevo, tipoPersona: v as "NATURAL" | "JURIDICA" })
                  }
                  options={[
                    { value: "NATURAL", label: "Natural" },
                    { value: "JURIDICA", label: "Jurídica" },
                  ]}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Email</Label>
                <Input
                  value={nuevo.email}
                  onChange={(e) => setNuevo({ ...nuevo, email: e.target.value })}
                  placeholder="Recibe la factura"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Dirección</Label>
              <Input
                value={nuevo.direccion}
                onChange={(e) => setNuevo({ ...nuevo, direccion: e.target.value })}
              />
            </div>
            {/* El mismo input que en la ficha del cliente: formatea y guarda el
                número igual, así no conviven dos formatos en la base. */}
            <div className="space-y-1.5">
              <Label className="text-xs">Teléfono</Label>
              <PhoneInput
                value={nuevo.telefono}
                onChange={(v) => setNuevo({ ...nuevo, telefono: v })}
              />
            </div>

            <label className="flex cursor-pointer items-start gap-2.5">
              <Checkbox
                checked={nuevo.guardarEnFicha}
                onCheckedChange={(v) =>
                  setNuevo({ ...nuevo, guardarEnFicha: v === true })
                }
                className="mt-0.5"
              />
              <span className="text-xs leading-snug">
                Guardar en la ficha del cliente
                <span className="block text-muted-foreground">
                  Para poder reusarlos. Sin esto se usan solo en esta orden.
                </span>
              </span>
            </label>

            <div className="flex justify-end gap-2">
              {datos.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setModoNuevo(false)}
                  disabled={guardando}
                >
                  Cancelar
                </Button>
              )}
              <Button
                size="sm"
                onClick={guardarNuevo}
                disabled={
                  guardando ||
                  !nuevo.identificacion.trim() ||
                  !nuevo.razonSocial.trim()
                }
              >
                {guardando && <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />}
                Usar estos datos
              </Button>
            </div>
          </div>

              {datos.length > 0 && (
                <button
                  type="button"
                  onClick={() => setModoNuevo(false)}
                  className="text-xs text-muted-foreground hover:underline"
                >
                  ← Volver a los datos guardados
                </button>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {/* Los que ya tiene el cliente, para elegir sin volver a
                  tipearlos. Es el caso común: empresa y nombre propio. */}
              <div className="divide-y rounded-md border">
                {datos.map((d) => (
                  <button
                    key={d.id}
                    type="button"
                    onClick={() => {
                      onChange(d.id);
                      setAbierto(false);
                    }}
                    className={`flex w-full items-start gap-2.5 px-3 py-2.5 text-left transition-colors ${
                      value === d.id ? "bg-primary/5" : "hover:bg-muted/50"
                    }`}
                  >
                    <span
                      className={`mt-0.5 flex h-4 w-4 flex-none items-center justify-center rounded-full border ${
                        value === d.id
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-input"
                      }`}
                    >
                      {value === d.id && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">
                        {d.razonSocial}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {d.tipoIdentificacion === "RUC" ? "RUC" : "Cédula"}{" "}
                        {d.identificacion}
                        {d.esPredeterminado && " · predeterminado"}
                      </span>
                      {(d.direccion || d.telefono || d.email) && (
                        <span className="block truncate text-xs text-muted-foreground">
                          {[d.direccion, d.telefono, d.email]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      )}
                    </span>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => setModoNuevo(true)}
              >
                <Plus className="mr-2 h-3.5 w-3.5" />
                Ingresar otros datos
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

/** Una fila etiqueta/valor; se calla sola cuando el dato no está. */
function Fila({
  etiqueta,
  valor,
}: {
  etiqueta: string;
  valor: string | null;
}) {
  if (!valor) return null;
  return (
    <div className="flex justify-between gap-3">
      <dt className="flex-none text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 truncate text-right">{valor}</dd>
    </div>
  );
}
