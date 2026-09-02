"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { CustomSelect } from "@/components/ui/custom-select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DeleteDialog } from "@/components/shared/delete-dialog";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { AlertTriangle, Loader2, Pencil, ShieldCheck, Upload } from "lucide-react";
import { toast } from "sonner";

export interface EmisorFila {
  id: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string | null;
  dirMatriz: string;
  direccionEstablecimiento: string;
  establecimiento: string;
  puntoEmision: string;
  obligadoContabilidad: boolean;
  contribuyenteEspecial: string | null;
  agenteRetencion: string | null;
  ambiente: "PRUEBAS" | "PRODUCCION";
  certificadoSujeto: string | null;
  certificadoVence: string | null;
  activo: boolean;
  predeterminado: boolean;
  /** Cuántas facturas salieron a su nombre. Con una sola ya no se borra. */
  facturas: number;
}

const vacio = (): EmisorFila => ({
  id: "",
  ruc: "",
  razonSocial: "",
  nombreComercial: "",
  dirMatriz: "",
  direccionEstablecimiento: "",
  establecimiento: "001",
  puntoEmision: "001",
  obligadoContabilidad: true,
  contribuyenteEspecial: "",
  agenteRetencion: "",
  ambiente: "PRUEBAS",
  certificadoSujeto: null,
  certificadoVence: null,
  activo: true,
  predeterminado: false,
  facturas: 0,
});

const fecha = (iso: string) =>
  new Date(iso).toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });

/** Faltan menos de 30 días: hay que renovar antes de quedarse sin facturar. */
const porVencer = (iso: string) =>
  new Date(iso).getTime() - Date.now() < 30 * 24 * 60 * 60 * 1000;

/**
 * Con qué RUC factura el portal ante el SRI.
 *
 * Son varios y se elige al emitir, porque el vivero factura con más de uno.
 * Cada uno lleva su propio certificado de firma: para el SRI son contribuyentes
 * distintos, y un certificado se emite a nombre de uno solo.
 */
export function EmisoresPage({
  emisores,
  cifradoListo,
}: {
  emisores: EmisorFila[];
  cifradoListo: boolean;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState<EmisorFila | null>(null);
  const [subiendoA, setSubiendoA] = useState<EmisorFila | null>(null);

  const borrar = async (id: string) => {
    const res = await fetch(`/api/emisores/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const body = await res.json();
      toast.error(body.error || "Error al eliminar");
      throw new Error(body.error);
    }
  };

  return (
    <>
      <PageHeader
        title="Facturación electrónica"
        description="Con qué RUC se emiten los comprobantes ante el SRI"
        actions={[
          {
            label: "Nuevo emisor",
            onClick: () => setEditando(vacio()),
            icon: "plus",
            primary: true,
          },
        ]}
      />

      {!cifradoListo && (
        <div className="flex gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
          <p>
            Falta configurar <code>FIRMA_ENCRYPTION_KEY</code> en el entorno. Es
            la clave con la que se cifra el certificado de firma: sin ella no se
            puede guardar ninguno, y por lo tanto no se puede emitir.
          </p>
        </div>
      )}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto">
        {emisores.length === 0 ? (
          <EmptyState message="Todavía no hay ningún emisor cargado" />
        ) : (
          emisores.map((e) => (
            <Card key={e.id}>
              <CardHeader className="border-b py-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {e.razonSocial}
                  <span className="font-mono text-xs font-normal text-muted-foreground">
                    {e.ruc}
                  </span>
                  {e.predeterminado && <Badge variant="secondary">Predeterminado</Badge>}
                  {/* Lo emitido en pruebas no es un comprobante: no vale para
                      el cliente ni entra en ninguna declaración. */}
                  <Badge variant={e.ambiente === "PRODUCCION" ? "default" : "outline"}>
                    {e.ambiente === "PRODUCCION" ? "Producción" : "Pruebas"}
                  </Badge>
                  {!e.activo && <Badge variant="outline">Inactivo</Badge>}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <Dato etiqueta="Nombre comercial" valor={e.nombreComercial} />
                  <Dato
                    etiqueta="Serie"
                    valor={`${e.establecimiento}-${e.puntoEmision}`}
                  />
                  <Dato etiqueta="Matriz" valor={e.dirMatriz} />
                  <Dato etiqueta="Establecimiento" valor={e.direccionEstablecimiento} />
                  <Dato
                    etiqueta="Obligado a llevar contabilidad"
                    valor={e.obligadoContabilidad ? "Sí" : "No"}
                  />
                  <Dato
                    etiqueta="Contribuyente especial"
                    valor={e.contribuyenteEspecial}
                  />
                  <Dato etiqueta="Agente de retención" valor={e.agenteRetencion} />
                  <Dato
                    etiqueta="Facturas emitidas"
                    valor={String(e.facturas)}
                  />
                </div>

                {/* La firma es lo que separa "configurado" de "puede emitir". */}
                <div className="rounded-md border p-3">
                  {e.certificadoSujeto ? (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0 space-y-0.5">
                        <p className="flex items-center gap-1.5 font-medium text-primary">
                          <ShieldCheck className="h-4 w-4" />
                          Firma cargada
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {e.certificadoSujeto}
                          {e.certificadoVence && (
                            <>
                              {" · "}
                              <span
                                className={
                                  porVencer(e.certificadoVence)
                                    ? "font-medium text-amber-700"
                                    : ""
                                }
                              >
                                vence el {fecha(e.certificadoVence)}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setSubiendoA(e)}
                      >
                        Reemplazar
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="flex items-center gap-1.5 text-sm text-amber-700">
                        <AlertTriangle className="h-4 w-4 flex-none" />
                        Sin firma electrónica: este RUC todavía no puede emitir.
                      </p>
                      <Button
                        size="sm"
                        onClick={() => setSubiendoA(e)}
                        disabled={!cifradoListo}
                      >
                        <Upload className="mr-2 h-4 w-4" />
                        Cargar .p12
                      </Button>
                    </div>
                  )}
                </div>

                <div className="flex justify-end gap-2 border-t pt-3">
                  <Button variant="outline" size="sm" onClick={() => setEditando(e)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <DeleteDialog
                    title={`¿Eliminar ${e.razonSocial}?`}
                    description={
                      e.facturas > 0
                        ? `Ya emitió ${e.facturas} factura${e.facturas === 1 ? "" : "s"}, así que no se puede borrar. Desactivalo para dejar de usarlo.`
                        : "Se borra la configuración y su certificado. No se puede deshacer."
                    }
                    onDelete={() => borrar(e.id)}
                    onSuccess={() => router.refresh()}
                  />
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {editando && (
        <EmisorDialog
          emisor={editando}
          onClose={() => setEditando(null)}
          onGuardado={() => {
            setEditando(null);
            router.refresh();
          }}
        />
      )}

      {subiendoA && (
        <CertificadoDialog
          emisor={subiendoA}
          onClose={() => setSubiendoA(null)}
          onGuardado={() => {
            setSubiendoA(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="text-right">{valor || "—"}</span>
    </div>
  );
}

function EmisorDialog({
  emisor,
  onClose,
  onGuardado,
}: {
  emisor: EmisorFila;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [form, setForm] = useState(emisor);
  const [guardando, setGuardando] = useState(false);
  const esNuevo = !emisor.id;

  const set = (patch: Partial<EmisorFila>) => setForm({ ...form, ...patch });

  const guardar = async () => {
    setGuardando(true);
    try {
      const res = await fetch(
        esNuevo ? "/api/emisores" : `/api/emisores/${emisor.id}`,
        {
          method: esNuevo ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ruc: form.ruc.trim(),
            razonSocial: form.razonSocial.trim(),
            nombreComercial: form.nombreComercial?.trim() || null,
            dirMatriz: form.dirMatriz.trim(),
            direccionEstablecimiento: form.direccionEstablecimiento.trim(),
            establecimiento: form.establecimiento.trim(),
            puntoEmision: form.puntoEmision.trim(),
            obligadoContabilidad: form.obligadoContabilidad,
            contribuyenteEspecial: form.contribuyenteEspecial?.trim() || null,
            agenteRetencion: form.agenteRetencion?.trim() || null,
            ambiente: form.ambiente,
            activo: form.activo,
            predeterminado: form.predeterminado,
          }),
        }
      );
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(esNuevo ? "Emisor creado" : "Emisor actualizado");
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos guardar");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{esNuevo ? "Nuevo emisor" : "Editar emisor"}</DialogTitle>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-4 overflow-y-auto pr-1">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="RUC *">
              <Input
                value={form.ruc}
                onChange={(e) => set({ ruc: e.target.value })}
                placeholder="0993374634001"
                inputMode="numeric"
                disabled={!esNuevo}
              />
            </Campo>
            <Campo etiqueta="Razón social *">
              <Input
                value={form.razonSocial}
                onChange={(e) => set({ razonSocial: e.target.value })}
                placeholder="VIVEROFRANCISCO S.A.S."
              />
            </Campo>
            <Campo etiqueta="Nombre comercial">
              <Input
                value={form.nombreComercial ?? ""}
                onChange={(e) => set({ nombreComercial: e.target.value })}
                placeholder="Vivero Francisco"
              />
            </Campo>
            <Campo etiqueta="Ambiente *">
              <CustomSelect
                value={form.ambiente}
                onChange={(v) => set({ ambiente: v as EmisorFila["ambiente"] })}
                options={[
                  { value: "PRUEBAS", label: "Pruebas" },
                  {
                    value: "PRODUCCION",
                    label: "Producción",
                    hint: "Lo que se emita acá son facturas de verdad.",
                  },
                ]}
              />
            </Campo>
            <Campo etiqueta="Dirección de la matriz *">
              <Input
                value={form.dirMatriz}
                onChange={(e) => set({ dirMatriz: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Dirección del establecimiento *">
              <Input
                value={form.direccionEstablecimiento}
                onChange={(e) => set({ direccionEstablecimiento: e.target.value })}
              />
            </Campo>
            <Campo etiqueta="Establecimiento *">
              <Input
                value={form.establecimiento}
                onChange={(e) => set({ establecimiento: e.target.value })}
                placeholder="001"
              />
            </Campo>
            <Campo etiqueta="Punto de emisión *">
              <Input
                value={form.puntoEmision}
                onChange={(e) => set({ puntoEmision: e.target.value })}
                placeholder="002"
              />
            </Campo>
            <Campo etiqueta="Contribuyente especial">
              <Input
                value={form.contribuyenteEspecial ?? ""}
                onChange={(e) => set({ contribuyenteEspecial: e.target.value })}
                placeholder="N° de resolución"
              />
            </Campo>
            <Campo etiqueta="Agente de retención">
              <Input
                value={form.agenteRetencion ?? ""}
                onChange={(e) => set({ agenteRetencion: e.target.value })}
                placeholder="N° de resolución"
              />
            </Campo>
          </div>

          <div className="space-y-2 border-t pt-3">
            <Tilde
              checked={form.obligadoContabilidad}
              onChange={(v) => set({ obligadoContabilidad: v })}
              etiqueta="Obligado a llevar contabilidad"
            />
            <Tilde
              checked={form.predeterminado}
              onChange={(v) => set({ predeterminado: v })}
              etiqueta="Predeterminado"
              ayuda="Es el que viene elegido al emitir. Solo puede haber uno."
            />
            <Tilde
              checked={form.activo}
              onChange={(v) => set({ activo: v })}
              etiqueta="Activo"
              ayuda="Un emisor inactivo no se ofrece al emitir, pero conserva lo que ya facturó."
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={guardando}>
              Cancelar
            </Button>
            <Button onClick={guardar} disabled={guardando}>
              {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Guardar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Campo({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs">{etiqueta}</Label>
      {children}
    </div>
  );
}

function Tilde({
  checked,
  onChange,
  etiqueta,
  ayuda,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  etiqueta: string;
  ayuda?: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <Checkbox
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="mt-0.5"
      />
      <span className="space-y-0.5 text-sm">
        <span className="block">{etiqueta}</span>
        {ayuda && (
          <span className="block text-xs text-muted-foreground">{ayuda}</span>
        )}
      </span>
    </label>
  );
}

/**
 * Carga el `.p12`.
 *
 * La contraseña se verifica en el servidor al subirlo: si está mal, se sabe acá
 * y no con una factura ya armada. El archivo se guarda cifrado y no vuelve a
 * salir del servidor nunca.
 */
function CertificadoDialog({
  emisor,
  onClose,
  onGuardado,
}: {
  emisor: EmisorFila;
  onClose: () => void;
  onGuardado: () => void;
}) {
  const [archivo, setArchivo] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [subiendo, setSubiendo] = useState(false);

  const subir = async () => {
    if (!archivo) return toast.error("Elegí el archivo .p12");
    setSubiendo(true);
    try {
      const datos = new FormData();
      datos.append("certificado", archivo);
      datos.append("password", password);
      const res = await fetch(`/api/emisores/${emisor.id}/certificado`, {
        method: "POST",
        body: datos,
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(`Firma cargada: ${body.sujeto}`);
      onGuardado();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos cargarlo");
    } finally {
      setSubiendo(false);
    }
  };

  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Firma electrónica de {emisor.razonSocial}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            El archivo <code>.p12</code> que emitió la entidad certificadora
            (Security Data, UANATACA, Banco Central, ANF). Se guarda cifrado y
            solo lo usa el servidor al firmar un comprobante.
          </p>

          <div className="space-y-1.5">
            <Label className="text-xs">Archivo .p12 *</Label>
            <Input
              type="file"
              accept=".p12,.pfx"
              onChange={(e) => setArchivo(e.target.files?.[0] ?? null)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Contraseña *</Label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="off"
            />
          </div>

          <div className="flex justify-end gap-2 border-t pt-4">
            <Button variant="outline" onClick={onClose} disabled={subiendo}>
              Cancelar
            </Button>
            <Button onClick={subir} disabled={subiendo}>
              {subiendo && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Cargar
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
