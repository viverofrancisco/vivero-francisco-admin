"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
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
import { StatusBadge, type EstadoVisitaUI } from "@/components/ui/status-badge";
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import {
  SelectorProductos,
  type ProductoElegible,
} from "@/components/visitas/selector-productos";

interface VisitaEditable {
  id: string;
  fechaProgramada: string;
  fechaRealizada: string | null;
  horaEntrada: string | null;
  horaSalida: string | null;
  estado: string;
  notas: string | null;
  cliente: {
    id: string;
    nombre: string;
    apellido?: string | null;
    empresa?: string | null;
    sector: { nombre: string } | null;
  };
  productos: { productoId: string }[];
  /** De qué plan es hoy la visita, si es de alguno. */
  suscripcionId: string | null;
  grupoId: string | null;
  personalIds: string[];
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

const fechaLarga = (iso: string) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("es-EC", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

/**
 * Editar una visita, con la misma forma que darla de alta.
 *
 * Era un diálogo, y un diálogo no da para lo que hay que editar: productos,
 * fecha en un calendario y personal no entran cómodos en una ventanita, y el
 * salto de layout entre crear y corregir no ayuda a nadie.
 *
 * El cliente **no** se cambia acá, y no es una limitación de la pantalla: cada
 * producto de la visita está enlazado al ítem de suscripción **de ese cliente**
 * que lo cubre, y si ya se facturó, la línea de la orden apunta a esta visita.
 * Moverla dejaría trabajo descontándose del plan de otro y cobrado en la orden
 * equivocada. Para eso se agenda una visita nueva y se cancela esta.
 */
interface PlanOpcion {
  id: string;
  numero: number;
  estado: string;
  periodicidad: string;
  productos: { productoId: string; nombre: string; visitasPorPeriodo: number | null }[];
}

export function EditarVisitaPage({
  visita,
  catalogo,
  planes,
  grupos,
  personalList,
}: {
  visita: VisitaEditable;
  catalogo: ProductoElegible[];
  /** Los planes del cliente, más el que la visita ya tenga. */
  planes: PlanOpcion[];
  grupos: Grupo[];
  personalList: PersonalOption[];
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [eligiendo, setEligiendo] = useState(false);

  const [fecha, setFecha] = useState(visita.fechaProgramada);
  const [realizada, setRealizada] = useState(visita.fechaRealizada ?? "");
  const [entrada, setEntrada] = useState(visita.horaEntrada ?? "");
  const [salida, setSalida] = useState(visita.horaSalida ?? "");
  const [productoIds, setProductoIds] = useState(
    visita.productos.map((p) => p.productoId)
  );
  /** De qué plan es. Vacío la desvincula: todo pasa a cobrarse aparte. */
  const [suscripcionId, setSuscripcionId] = useState(
    visita.suscripcionId ?? ""
  );
  const [grupoId, setGrupoId] = useState(visita.grupoId ?? "");
  const [personalIds, setPersonalIds] = useState(visita.personalIds);
  const [notas, setNotas] = useState(visita.notas ?? "");

  const elegidos = catalogo.filter((p) => productoIds.includes(p.id));

  const alternarProducto = (id: string) =>
    setProductoIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );

  const aplicarGrupo = (id: string) => {
    setGrupoId(id);
    const g = grupos.find((x) => x.id === id);
    if (g) setPersonalIds(g.miembrosIds);
  };

  const guardar = async () => {
    if (productoIds.length === 0) {
      toast.error("La visita necesita al menos un producto");
      return;
    }
    setGuardando(true);
    try {
      const res = await fetch(`/api/visitas/${visita.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fechaProgramada: fecha,
          fechaRealizada: realizada || null,
          horaEntrada: entrada || null,
          horaSalida: salida || null,
          productos: productoIds.map((productoId) => ({ productoId })),
          // `null` la desvincula del plan y todo pasa a cobrarse aparte.
          suscripcionId: suscripcionId || null,
          grupoId: grupoId || null,
          personalIds,
          notas: notas.trim() || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Error");
      toast.success("Visita actualizada");
      router.push(`/dashboard/visitas/${visita.id}`);
      router.refresh();
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "No pudimos actualizar la visita"
      );
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="space-y-6 pb-6">
      <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b bg-card/95 px-4 py-3 backdrop-blur-sm md:px-6">
        <Link href={`/dashboard/visitas/${visita.id}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold">Editar visita</h1>
            <StatusBadge estado={visita.estado as EstadoVisitaUI} size="sm" />
          </div>
          <p className="truncate text-sm text-muted-foreground">
            {nombreCliente(visita.cliente)} · {fechaLarga(visita.fechaProgramada)}
          </p>
        </div>
        {/* Cancelar al lado de guardar, no solo la flecha de atrás: salir sin
            guardar es una decisión y merece un botón con nombre. */}
        <div className="flex flex-none items-center gap-2">
          <Link href={`/dashboard/visitas/${visita.id}`}>
            <Button variant="outline" disabled={guardando}>
              Cancelar
            </Button>
          </Link>
          <Button
            onClick={guardar}
            disabled={guardando || !elegidos.length}
          >
            {guardando && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Guardar cambios
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
                  La visita quedó sin productos.
                </p>
              ) : (
                <div className="divide-y rounded-md border">
                  {elegidos.map((p) => (
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
                  ))}
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

          {/* De qué plan es la visita, si es de alguno. La X la desvincula: no
              hace falta una opción "Ninguna" que diga lo mismo. */}
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
                    label: `Suscripción #${sus.numero}${
                      sus.estado === "ACTIVO"
                        ? ""
                        : ` · ${sus.estado.charAt(0)}${sus.estado.slice(1).toLowerCase()}`
                    }`,
                    hint: sus.productos.map((x) => x.nombre).join(", "),
                  }))}
                  placeholder="Sin suscripción"
                  clearable
                />
              </CardContent>
            </Card>
          )}

          {/* Las dos fechas juntas: se comparan de un vistazo, que es lo que
              se hace al corregirlas. Un mes por calendario alcanza —para irse
              lejos está el salto de mes y año en el título. */}
          <div className="grid gap-6 sm:grid-cols-2">
            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Programada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* El calendario es multi-select: quedarse con la última
                    elegida lo convierte en "reemplazar". */}
                <MultiDateCalendar
                  meses={1}
                  value={[fecha]}
                  onChange={(v) => setFecha(v[v.length - 1] ?? fecha)}
                />
                <p className="text-xs capitalize text-muted-foreground">
                  {fechaLarga(fecha)}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="border-b py-3">
                <CardTitle className="text-base">Realizada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <MultiDateCalendar
                  meses={1}
                  value={realizada ? [realizada] : []}
                  // Sin `?? realizada`: volver a tocar el día elegido la borra,
                  // que es como se marca una visita que no se hizo.
                  onChange={(v) => setRealizada(v[v.length - 1] ?? "")}
                />
                <p className="text-xs text-muted-foreground">
                  {realizada ? (
                    <span className="capitalize">{fechaLarga(realizada)}</span>
                  ) : (
                    "Todavía no se hizo. Tocá el día marcado para borrarlo."
                  )}
                </p>

                <div className="grid grid-cols-2 gap-3 border-t pt-3">
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="horaEntrada">
                      Hora de entrada
                    </Label>
                    <Input
                      id="horaEntrada"
                      type="time"
                      value={entrada}
                      onChange={(e) => setEntrada(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs" htmlFor="horaSalida">
                      Hora de salida
                    </Label>
                    <Input
                      id="horaSalida"
                      type="time"
                      value={salida}
                      onChange={(e) => setSalida(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

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
          <Card>
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Cliente</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5">
              <Link
                href={`/dashboard/clientes/${visita.cliente.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                {nombreCliente(visita.cliente)}
              </Link>
              {visita.cliente.sector && (
                <p className="text-xs text-muted-foreground">
                  {visita.cliente.sector.nombre}
                </p>
              )}
              <p className="pt-1 text-xs text-muted-foreground">
                El cliente no se cambia. Si el trabajo era para otro, agendá una
                visita nueva y cancelá esta.
              </p>
            </CardContent>
          </Card>

          <Card className="overflow-visible">
            <CardHeader className="border-b py-3">
              <CardTitle className="text-base">Personal</CardTitle>
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
        onToggle={alternarProducto}
      />
    </div>
  );
}
