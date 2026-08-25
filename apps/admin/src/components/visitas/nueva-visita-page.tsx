"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CustomSelect } from "@/components/ui/custom-select";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MultiDateCalendar } from "@/components/ui/multi-date-calendar";
import { PersonalSelector } from "@/components/grupos/personal-selector";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Loader2, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { PERIODICIDAD_SUFIJO } from "@/components/suscripciones/formato";
import { SelectorProductos } from "@/components/visitas/selector-productos";

/** Un producto que ya cubre una suscripción activa del cliente. */

interface ProductoCatalogo {
  id: string;
  nombre: string;
  tipo: string;
  ivaTasa: number | null;
}

interface SuscripcionOpcion {
  id: string;
  numero: number;
  periodicidad: string;
  productos: { productoId: string; nombre: string; visitasPorPeriodo: number | null }[];
}

interface Cliente {
  id: string;
  nombre: string;
  apellido?: string | null;
  empresa?: string | null;
  suscripciones: SuscripcionOpcion[];
}

interface Grupo {
  id: string;
  nombre: string;
  miembrosIds: string[];
}

interface PersonalOption {
  id: string;
  nombre: string;
  apellido?: string | null;
}

interface Props {
  clientes: Cliente[];
  catalogo: ProductoCatalogo[];
  grupos: Grupo[];
  personalList: PersonalOption[];
  /** Preseleccionado al venir desde una suscripción. */
  suscripcionInicial?: string;
}

const fechaCorta = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    day: "2-digit",
    month: "short",
    timeZone: "UTC",
  });

/**
 * Alta de visitas.
 *
 * Todo se ve de una: no hay pasos ni campos que aparezcan al elegir cliente.
 * Agendar es una sola decisión con cuatro partes —qué, cuándo, a quién, con
 * quién— y encadenarlas obligaba a empezar de cero cada vez que se cambiaba la
 * primera.
 *
 * La visita **no lleva precio**: lo que un plan no cubra se cotiza al facturar.
 */
export function NuevaVisitaPage({
  clientes,
  suscripcionInicial,
  catalogo,
  grupos,
  personalList,
}: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  // Con un plan preseleccionado, el cliente sale de él: es su dueño y no hay
  // nada que elegir. Se resuelve en el estado inicial y no en un efecto.
  const [clienteId, setClienteId] = useState(
    () =>
      clientes.find((c) =>
        c.suscripciones.some((s) => s.id === suscripcionInicial)
      )?.id ?? ""
  );
  const [productoIds, setProductoIds] = useState<string[]>([]);
  const [fechas, setFechas] = useState<string[]>([]);
  const [grupoId, setGrupoId] = useState("");
  const [personalIds, setPersonalIds] = useState<string[]>([]);
  const [notas, setNotas] = useState("");
  const [confirmar, setConfirmar] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);
  /**
   * De qué plan es la visita. Vacío = trabajo aparte, se cobra en una orden.
   *
   * Una sola decisión y de la visita entera. Qué productos cubre ese plan no se
   * elige: se deduce de lo que el plan contiene.
   */
  const [suscripcionId, setSuscripcionId] = useState(
    suscripcionInicial ?? ""
  );

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const planes = cliente?.suscripciones ?? [];
  const plan = planes.find((s) => s.id === suscripcionId) ?? null;
  /** Lo que el plan elegido cubre, para marcarlo en la lista. */
  const cubiertos = new Map(
    (plan?.productos ?? []).map((p) => [p.productoId, p])
  );

  // El orden del catálogo manda, así la lista no salta al elegir.
  const elegidos = catalogo.filter((p) => productoIds.includes(p.id));

  const elegirCliente = (id: string) => {
    setClienteId(id);
    setSuscripcionId("");
  };

  const alternarProducto = (id: string) =>
    setProductoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const aplicarGrupo = (id: string) => {
    setGrupoId(id);
    const g = grupos.find((x) => x.id === id);
    if (g) setPersonalIds(g.miembrosIds);
  };

  const crear = async () => {
    setConfirmar(false);
    setLoading(true);
    try {
      const res = await fetch("/api/visitas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          productos: productoIds.map((productoId) => ({ productoId })),
          // De qué plan es. El servidor deduce qué productos cubre.
          suscripcionId: suscripcionId || null,
          fechas,
          grupoId: grupoId || undefined,
          personalIds,
          notas: notas.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success(
        fechas.length === 1 ? "Visita creada" : `${fechas.length} visitas creadas`
      );
      router.push("/dashboard/visitas");
      router.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No pudimos crear la visita");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href="/dashboard/visitas">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">Nueva visita</h1>
          <p className="text-sm text-muted-foreground">
            Una visita por fecha elegida. El precio de lo que no cubra un plan se
            define al facturar.
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <Link href="/dashboard/visitas">
            <Button variant="outline" disabled={loading}>
              Cancelar
            </Button>
          </Link>
          <Button
            onClick={() => setConfirmar(true)}
            disabled={
              loading ||
              !clienteId ||
              elegidos.length === 0 ||
              fechas.length === 0
            }
          >
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {fechas.length > 1
              ? `Crear ${fechas.length} visitas`
              : "Crear visita"}
          </Button>
        </div>
      </div>

      <div className="grid items-start gap-6 px-4 md:px-6 lg:grid-cols-3">
        {/* ── Qué y cuándo ─────────────────────────────────────────── */}
        <div className="space-y-6 lg:col-span-2">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Productos</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {elegidos.length}{" "}
                  {elegidos.length === 1 ? "elegido" : "elegidos"}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {elegidos.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Todavía no agregaste ningún producto.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {elegidos.map((p) => {
                    return (
                      <div
                        key={p.id}
                        className="flex items-center gap-3 px-3 py-2.5"
                      >
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">
                          {p.nombre}
                        </span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 flex-none"
                          onClick={() => alternarProducto(p.id)}
                          aria-label={`Quitar ${p.nombre}`}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEligiendo(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar productos
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Fechas</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {fechas.length} {fechas.length === 1 ? "visita" : "visitas"}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <MultiDateCalendar value={fechas} onChange={setFechas} />
              {fechas.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 border-t pt-3">
                  {fechas.map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() =>
                        setFechas((prev) => prev.filter((x) => x !== f))
                      }
                      className="inline-flex items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-medium hover:bg-secondary/70"
                    >
                      {fechaCorta(f)}
                      <X className="h-3 w-3" />
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFechas([])}
                    className="ml-1 text-xs text-muted-foreground hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Notas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                placeholder="Opcional"
                rows={3}
              />
            </CardContent>
          </Card>
        </div>

        {/* ── A quién y con quién ──────────────────────────────────── */}
        <div className="space-y-6">
          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent>
              <CustomSelect
                value={clienteId}
                onChange={elegirCliente}
                options={clientes.map((c) => ({
                  value: c.id,
                  label: nombreCliente(c),
                }))}
                placeholder="Seleccionar cliente"
                searchable
                searchPlaceholder="Buscar cliente..."
                clearable
              />
            </CardContent>
          </Card>

          {/* De qué plan es la visita: una decisión, de la visita entera. Lo
              que el plan cubra sale de sus productos, no se elige acá. La X la
              desvincula; una opción "Ninguna" diría lo mismo ocupando lugar. */}
          {planes.length > 0 && (
            <Card className="overflow-visible">
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Suscripción</CardTitle>
              </CardHeader>
              <CardContent>
                <CustomSelect
                  value={suscripcionId}
                  onChange={setSuscripcionId}
                  options={planes.map((sus) => ({
                    value: sus.id,
                    label: `Suscripción #${sus.numero}`,
                    hint: sus.productos.map((x) => x.nombre).join(", "),
                  }))}
                  placeholder="Sin suscripción"
                  clearable
                />
              </CardContent>
            </Card>
          )}

          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Personal</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {personalIds.length}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              {grupos.length > 0 && (
                <div className="space-y-1.5">
                  <Label className="text-xs">Aplicar un grupo</Label>
                  <CustomSelect
                    value={grupoId}
                    onChange={aplicarGrupo}
                    options={grupos.map((g) => ({
                      value: g.id,
                      label: g.nombre,
                    }))}
                    placeholder="Sin grupo"
                    searchable
                    searchPlaceholder="Buscar grupo..."
                    clearable
                  />
                  <p className="text-xs text-muted-foreground">
                    Carga sus miembros; después se pueden ajustar.
                  </p>
                </div>
              )}
              <PersonalSelector
                personalList={personalList}
                selectedIds={personalIds}
                onChange={setPersonalIds}
              />
            </CardContent>
          </Card>

        </div>
      </div>

      <SelectorProductos
        open={eligiendo}
        onOpenChange={setEligiendo}
        catalogo={catalogo}
        seleccionados={productoIds}
        etiqueta={(id) => {
          const c = cubiertos.get(id);
          return c ? etiquetaCobertura(c, plan?.periodicidad ?? "") : null;
        }}
        onToggle={alternarProducto}
      />

      {/* Se crean N visitas de una sola vez y deshacerlo es borrarlas una por
          una, así que conviene mirar el resumen antes. */}
      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {fechas.length > 1
                ? `Crear ${fechas.length} visitas`
                : "Crear visita"}
            </DialogTitle>
          </DialogHeader>
          <div className="min-w-0 space-y-4">
            <dl className="divide-y rounded-md border text-sm">
              <Fila etiqueta="Cliente">
                {cliente ? nombreCliente(cliente) : "—"}
              </Fila>
              <Fila etiqueta="Productos">
                <span className="space-y-0.5">
                  {elegidos.map((p) => (
                    <span key={p.id} className="block">
                      {p.nombre}
                      <span className="text-xs text-muted-foreground">
                        {" "}
                        ·{" "}
                        {cubiertos.has(p.id)
                          ? "cubierto por el plan"
                          : "se cobra aparte"}
                      </span>
                    </span>
                  ))}
                </span>
              </Fila>
              <Fila etiqueta="Fechas">
                {[...fechas].sort().map(fechaCorta).join(", ")}
              </Fila>
              <Fila etiqueta="Personal">
                {personalIds.length === 0
                  ? "Sin asignar"
                  : personalList
                      .filter((p) => personalIds.includes(p.id))
                      .map((p) => `${p.nombre} ${p.apellido ?? ""}`.trim())
                      .join(", ")}
              </Fila>
              {notas.trim() && <Fila etiqueta="Notas">{notas.trim()}</Fila>}
            </dl>

            <div className="flex justify-end gap-2 border-t pt-4">
              <Button
                variant="outline"
                onClick={() => setConfirmar(false)}
                disabled={loading}
              >
                Volver
              </Button>
              <Button onClick={crear} disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Fila({
  etiqueta,
  children,
}: {
  etiqueta: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 px-3 py-2">
      <dt className="w-20 flex-none text-muted-foreground">{etiqueta}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  );
}

/** "4/trimestre incluidas" — lo que dice el contrato, no un tope. */
function etiquetaCobertura(
  c: { visitasPorPeriodo: number | null },
  periodicidad: string
): string {
  if (!c.visitasPorPeriodo) return "Incluido en el plan";
  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";
  return `${c.visitasPorPeriodo}${sufijo} incluidas`;
}
