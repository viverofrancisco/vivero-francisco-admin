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
import { SelectorTareas } from "@/components/visitas/selector-tareas";

interface TareaCatalogo {
  id: string;
  nombre: string;
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
  tareas: TareaCatalogo[];
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
 * Agendar es una sola decisión —cuándo, a quién y con quién— y encadenarlas
 * obligaba a empezar de cero cada vez que se cambiaba la primera.
 *
 * **No se eligen productos.** Lo que se hace en una visita son tareas, y las
 * marca cada jardinero al terminar; acá lo único que se decide sobre el trabajo
 * es si alguna tarea es **obligatoria**, que es la pregunta que la oficina se
 * va a hacer después: "¿hicieron lo que había que hacer?".
 */
export function NuevaVisitaPage({
  clientes,
  suscripcionInicial,
  tareas,
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
  const [tareaIds, setTareaIds] = useState<string[]>([]);
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

  // El orden del catálogo manda, así la lista no salta al elegir.
  const elegidas = tareas.filter((t) => tareaIds.includes(t.id));

  const elegirCliente = (id: string) => {
    setClienteId(id);
    setSuscripcionId("");
  };

  const alternarTarea = (id: string) =>
    setTareaIds((prev) =>
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
          tareasObligatoriasIds: tareaIds,
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
            Una visita por fecha elegida. Lo que se hizo lo marca cada jardinero
            al terminar.
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
            disabled={loading || !clienteId || fechas.length === 0}
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
              <CardTitle className="text-base">Tareas obligatorias</CardTitle>
              <CardAction>
                <span className="text-xs text-muted-foreground">
                  {elegidas.length}
                </span>
              </CardAction>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Lo que esta visita tiene que dejar hecho. Es opcional: no impide
                hacer otras cosas ni frena nada, pero la visita va a mostrar
                cuáles quedaron sin cubrir.
              </p>
              {elegidas.length === 0 ? (
                <p className="rounded-md border border-dashed py-6 text-center text-sm text-muted-foreground">
                  Sin tareas obligatorias.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {elegidas.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-3 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm font-medium">
                        {t.nombre}
                      </span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 flex-none"
                        onClick={() => alternarTarea(t.id)}
                        aria-label={`Quitar ${t.nombre}`}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setEligiendo(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar tareas
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
              que el plan cubra sale de sus productos, no se elige aquí. La X la
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

      <SelectorTareas
        open={eligiendo}
        onOpenChange={setEligiendo}
        catalogo={tareas}
        seleccionados={tareaIds}
        titulo="Tareas obligatorias"
        onToggle={alternarTarea}
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
              <Fila etiqueta="Obligatorias">
                {elegidas.length === 0 ? (
                  "Ninguna"
                ) : (
                  <span className="space-y-0.5">
                    {elegidas.map((t) => (
                      <span key={t.id} className="block">
                        {t.nombre}
                      </span>
                    ))}
                  </span>
                )}
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
