"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { hoyISOEcuador } from "@/lib/fechas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CustomSelect } from "@/components/ui/custom-select";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { nombreCliente } from "@vivero/shared";
import { PERIODICIDAD_LABEL, PERIODICIDAD_SUFIJO } from "./formato";
import { ResumenSuscripcion } from "./resumen-suscripcion";

interface Propiedad {
  id: string;
  nombre: string;
  direccion: string | null;
  /** Números de los planes activos que ya tiene: un segundo suele ser un duplicado. */
  planesActivos: number[];
}

interface Cliente {
  id: string;
  nombre: string;
  apellido: string | null;
  empresa: string | null;
  /** Marcado como inactivo: se ve, atenuado, y no se puede elegir. */
  inactivoDesde: string | null;
  propiedades: Propiedad[];
}

const PERIODICIDADES = ["MENSUAL", "TRIMESTRAL", "SEMESTRAL", "ANUAL"];

/**
 * Alta de una suscripción.
 *
 * Un plan es un precio por un jardín: de qué propiedad del cliente es, cuánto
 * se cobra por período y cuántas visitas incluye. Sin productos — lo que se
 * pacta con el cliente es un número por mantenerle ese jardín, no una lista
 * del catálogo con un precio cada uno.
 */
export function NuevaSuscripcionPage({
  clientes,
  clienteInicial,
  backHref,
}: {
  clientes: Cliente[];
  /** Preseleccionado al venir desde la ficha del cliente. */
  clienteInicial?: string;
  /** A dónde vuelve la flecha: de donde vino, no siempre a la lista. */
  backHref: string;
}) {
  const router = useRouter();
  const [guardando, setGuardando] = useState(false);
  const [clienteId, setClienteId] = useState(clienteInicial ?? "");
  // La propiedad sale sola cuando el cliente tiene una, que es casi siempre.
  const [propiedadId, setPropiedadId] = useState(() => {
    const c = clientes.find((x) => x.id === clienteInicial);
    return c?.propiedades.length === 1 ? c.propiedades[0].id : "";
  });
  const [periodicidad, setPeriodicidad] = useState("MENSUAL");
  const [fechaInicio, setFechaInicio] = useState(hoyISOEcuador());
  const [precio, setPrecio] = useState("");
  // 15 es lo que paga un servicio de jardinería en Ecuador; el 0 es la
  // excepción y se escribe.
  const [ivaTasa, setIvaTasa] = useState("15");
  const [visitasPorPeriodo, setVisitasPorPeriodo] = useState("");
  const [notas, setNotas] = useState("");

  const cliente = clientes.find((c) => c.id === clienteId) ?? null;
  const propiedad = cliente?.propiedades.find((p) => p.id === propiedadId) ?? null;
  const sufijo = PERIODICIDAD_SUFIJO[periodicidad] ?? "";

  const elegirCliente = (id: string) => {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setPropiedadId(c?.propiedades.length === 1 ? c.propiedades[0].id : "");
  };

  const guardar = async () => {
    if (!clienteId) return toast.error("Selecciona un cliente");
    if (!propiedadId) return toast.error("Elige de qué propiedad es el plan");
    if (precio.trim() === "" || Number(precio) < 0) {
      return toast.error("Pon el precio del período");
    }
    if (!(Number(visitasPorPeriodo) >= 1)) {
      return toast.error("Indica cuántas visitas incluye cada período");
    }

    setGuardando(true);
    try {
      const res = await fetch("/api/suscripciones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clienteId,
          propiedadId,
          periodicidad,
          fechaInicio,
          precio: Number(precio),
          ivaTasa: ivaTasa.trim() ? Number(ivaTasa) : null,
          visitasPorPeriodo: Number(visitasPorPeriodo),
          notas: notas.trim() || null,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Error");
      toast.success(`Suscripción #${body.numero} creada`);
      router.push(`/dashboard/suscripciones/${body.id}?from=${encodeURIComponent(backHref)}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al guardar");
      setGuardando(false);
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div className="flex items-center gap-3">
        <Link href={backHref}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Nueva suscripción</h1>
          <p className="text-sm text-muted-foreground">
            Un precio por período para mantener una propiedad, con las visitas
            que incluye.
          </p>
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Card className="overflow-visible">
          <CardHeader className="border-b py-3">
            <CardTitle className="text-base">Datos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Cliente *</Label>
              <CustomSelect
                value={clienteId}
                onChange={elegirCliente}
                options={clientes.map((c) => ({
                  value: c.id,
                  label: nombreCliente(c),
                  // Se ve pero no se elige: si volvió a contratar, primero se
                  // lo reactiva desde su ficha.
                  disabled: c.inactivoDesde !== null,
                  hint: c.inactivoDesde !== null ? "Inactivo" : undefined,
                }))}
                placeholder="Seleccionar cliente"
                searchable
                searchPlaceholder="Buscar cliente..."
              />
            </div>

            {/* De qué jardín es el plan. Con una sola propiedad ya viene
                elegida; con varias es la decisión: el precio es de un lugar. */}
            {cliente && (
              <div className="space-y-2">
                <Label>Propiedad *</Label>
                {cliente.propiedades.length === 0 ? (
                  <p className="text-sm text-warning-foreground">
                    Este cliente no tiene ninguna propiedad cargada. Agrégale
                    una desde su ficha para poder armarle un plan.
                  </p>
                ) : (
                  <CustomSelect
                    value={propiedadId}
                    onChange={setPropiedadId}
                    options={cliente.propiedades.map((p) => ({
                      value: p.id,
                      label: p.nombre,
                      hint:
                        p.planesActivos.length > 0
                          ? `Ya tiene la suscripción #${p.planesActivos.join(", #")} activa`
                          : (p.direccion ?? undefined),
                    }))}
                    placeholder="Seleccionar propiedad"
                    searchable={cliente.propiedades.length > 6}
                    searchPlaceholder="Buscar propiedad..."
                  />
                )}
                {propiedad && propiedad.planesActivos.length > 0 && (
                  <p className="text-xs text-warning-foreground">
                    Esta propiedad ya tiene la suscripción #
                    {propiedad.planesActivos.join(", #")} activa. Si es la
                    misma, edita esa en vez de crear otra.
                  </p>
                )}
              </div>
            )}

            {cliente && propiedadId && (
              <>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Se cobra *</Label>
                    <CustomSelect
                      value={periodicidad}
                      onChange={setPeriodicidad}
                      options={PERIODICIDADES.map((p) => ({
                        value: p,
                        label: PERIODICIDAD_LABEL[p],
                      }))}
                      placeholder="Periodicidad"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="inicio">Desde *</Label>
                    <Input
                      id="inicio"
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">
                      Los períodos de cobro se cuentan desde este mes.
                    </p>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="space-y-2">
                    <Label htmlFor="precio">Precio{sufijo} *</Label>
                    <Input
                      id="precio"
                      type="number"
                      step="0.01"
                      min="0"
                      value={precio}
                      onChange={(e) => setPrecio(e.target.value)}
                      placeholder="0.00"
                    />
                    <p className="text-xs text-muted-foreground">Sin IVA.</p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="iva">IVA %</Label>
                    <Input
                      id="iva"
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={ivaTasa}
                      onChange={(e) => setIvaTasa(e.target.value)}
                      placeholder="15"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="visitas">Visitas{sufijo} *</Label>
                    <Input
                      id="visitas"
                      type="number"
                      min="1"
                      value={visitasPorPeriodo}
                      onChange={(e) => setVisitasPorPeriodo(e.target.value)}
                      placeholder="4"
                    />
                    <p className="text-xs text-muted-foreground">
                      Es informativo: no limita agendar.
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notas">Notas</Label>
                  <Textarea
                    id="notas"
                    rows={3}
                    value={notas}
                    onChange={(e) => setNotas(e.target.value)}
                    placeholder="Opcional: qué incluye, qué se acordó"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <Link href={backHref}>
                    <Button variant="outline" disabled={guardando}>
                      Cancelar
                    </Button>
                  </Link>
                  <Button onClick={guardar} disabled={guardando}>
                    {guardando && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Crear suscripción
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Cuánto termina pagando el cliente: el formulario pide el precio sin
            IVA, así que de los campos solos no se puede leer. */}
        <div className="lg:sticky lg:top-6">
          <ResumenSuscripcion
            precio={precio}
            ivaTasa={ivaTasa}
            visitasPorPeriodo={visitasPorPeriodo}
            sufijo={sufijo}
          />
        </div>
      </div>
    </div>
  );
}
